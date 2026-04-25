"""
==========================================================================
STEP 3: Fine-Tune Qwen2.5-14B-Instruct for Mental Health Responses
==========================================================================
🏷️  Model Name: MindSLM
📊  Base Model: Qwen/Qwen2.5-14B-Instruct
🔧  Method: QLoRA (4-bit quantization + LoRA adapters)
🖥️  Hardware: Kaggle T4 x2 (30GB VRAM total)
📦  Data: Counsel Chat (real therapist Q&As) — downloaded directly from HuggingFace
⏱️  Training Time: ~3-5 hours

HOW TO USE ON KAGGLE:
1. Create a new Kaggle Notebook
2. Enable GPU: Settings → Accelerator → GPU T4 x2
3. Enable Internet: Settings → Internet → On
4. Paste this entire file into the notebook (split at CELL markers)
5. Run all cells in order

Output: Merged model saved to /kaggle/working/mindslm-14b-merged/
        Then zip and download for GGUF conversion
==========================================================================
"""

# ════════════════════════════════════════════════════════
# CELL 1: Install Dependencies
# ════════════════════════════════════════════════════════
import subprocess
subprocess.run([
    "pip", "install", "-q",
    "torch", "transformers", "accelerate", "peft",
    "bitsandbytes", "trl", "datasets"
])

import os
os.environ["WANDB_DISABLED"] = "true"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# ════════════════════════════════════════════════════════
# CELL 2: Imports + GPU Check
# ════════════════════════════════════════════════════════
import torch
import json
import gc
from datasets import Dataset, load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
)
from peft import (
    LoraConfig,
    get_peft_model,
    prepare_model_for_kbit_training,
    PeftModel,
    TaskType,
)
from trl import SFTTrainer, SFTConfig

print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
for i in range(torch.cuda.device_count()):
    props = torch.cuda.get_device_properties(i)
    print(f"GPU {i}: {props.name} — {props.total_memory / 1024**3:.1f} GB VRAM")

# ════════════════════════════════════════════════════════
# CELL 3: Configuration
# ════════════════════════════════════════════════════════
BASE_MODEL  = "Qwen/Qwen2.5-14B-Instruct"
OUTPUT_DIR  = "/kaggle/working/mindslm-14b-lora"
MERGED_DIR  = "/kaggle/working/mindslm-14b-merged"

# QLoRA — conservative settings for T4x2 with 14B
LORA_R          = 8       # Lower rank = less VRAM
LORA_ALPHA      = 16
LORA_DROPOUT    = 0.05
LORA_TARGET_MODULES = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]

# Training — small batch to fit in 30GB total VRAM
NUM_EPOCHS            = 3
BATCH_SIZE            = 1    # Must be 1 for 14B on T4
GRADIENT_ACCUMULATION = 16   # Effective batch = 16
LEARNING_RATE         = 1e-4 # Lower LR for larger model
MAX_SEQ_LENGTH        = 512
WEIGHT_DECAY          = 0.01
LR_SCHEDULER          = "cosine"
WARMUP_STEPS          = 30

# Routing category for system prompt selection
SYSTEM_PROMPTS = {
    "Depression": (
        "You are a therapist. Name the specific thing the user described, "
        "then suggest one small concrete action they can do right now. "
        "2 sentences max. Do not use generic phrases."
    ),
    "Anxiety": (
        "You are a therapist. Name the specific symptom the user described, "
        "then give one concrete grounding technique. "
        "2 sentences max. Do not use generic phrases."
    ),
    "Suicidal": (
        "You are a crisis counselor. Acknowledge what the user is carrying, "
        "then direct them to call or text 988. 2 sentences max."
    ),
    "Normal": (
        "You are a supportive friend. Reply in 1 sentence and ask 1 follow-up question."
    ),
}

# ════════════════════════════════════════════════════════
# CELL 4: Load + Format Counsel Chat Data
# ════════════════════════════════════════════════════════
print("\nDownloading Counsel Chat from HuggingFace...")
raw = load_dataset("nbertagnolli/counsel-chat", split="train")
print(f"Loaded {len(raw)} rows")

TOPIC_TO_CATEGORY = {
    "depression": "Depression", "grief": "Depression", "loss": "Depression",
    "loneliness": "Depression", "self-esteem": "Depression", "trauma": "Depression",
    "anxiety": "Anxiety", "stress": "Anxiety", "panic": "Anxiety",
    "ptsd": "Anxiety", "anger": "Anxiety", "relationships": "Normal",
    "sleep": "Depression", "family": "Normal", "workplace": "Normal",
}

def format_row(row):
    question = str(row.get("questionText", "") or "").strip()
    answer   = str(row.get("answerText", "") or "").strip()
    topic    = str(row.get("topic", "") or "").lower()

    if not question or not answer or len(answer) < 40:
        return None

    # Map topic → category
    category = "Normal"
    for t, cat in TOPIC_TO_CATEGORY.items():
        if t in topic:
            category = cat
            break

    # Truncate answer to 3 sentences
    sentences = answer.replace("\n", " ").split(". ")
    short_answer = ". ".join(sentences[:3]).strip()
    if not short_answer.endswith("."):
        short_answer += "."

    return {
        "messages": [
            {"role": "system",    "content": SYSTEM_PROMPTS[category]},
            {"role": "user",      "content": question},
            {"role": "assistant", "content": short_answer},
        ]
    }

print("Formatting data...")
formatted = [format_row(row) for row in raw]
formatted = [x for x in formatted if x is not None]
print(f"Formatted {len(formatted)} valid samples")

# Split 90/10 train/val
split_idx   = int(len(formatted) * 0.9)
train_data  = formatted[:split_idx]
val_data    = formatted[split_idx:]

train_dataset = Dataset.from_list(train_data)
val_dataset   = Dataset.from_list(val_data)

print(f"Train: {len(train_dataset)} | Val: {len(val_dataset)}")

# Preview
sample = train_data[0]
print("\nSample:")
for msg in sample["messages"]:
    print(f"  [{msg['role']}]: {msg['content'][:100]}...")

# ════════════════════════════════════════════════════════
# CELL 5: Load Tokenizer
# ════════════════════════════════════════════════════════
print(f"\nLoading tokenizer: {BASE_MODEL}")
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)

if tokenizer.pad_token is None:
    tokenizer.pad_token     = tokenizer.eos_token
    tokenizer.pad_token_id  = tokenizer.eos_token_id

print(f"Vocab size: {tokenizer.vocab_size}")

# ════════════════════════════════════════════════════════
# CELL 6: Load 14B Model with 4-bit Quantization
# ════════════════════════════════════════════════════════
print(f"\nLoading {BASE_MODEL} in 4-bit...")
print("(This downloads ~28GB of weights — takes 10-15 minutes first time)")

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map="auto",          # Spreads across both T4 GPUs automatically
    trust_remote_code=True,
    torch_dtype=torch.float16,
)

model = prepare_model_for_kbit_training(model)

total = sum(p.numel() for p in model.parameters())
print(f"Parameters: {total / 1e9:.1f}B")
for i in range(torch.cuda.device_count()):
    print(f"GPU {i} VRAM used: {torch.cuda.memory_allocated(i) / 1024**3:.2f} GB")

# ════════════════════════════════════════════════════════
# CELL 7: Apply LoRA
# ════════════════════════════════════════════════════════
print("\nApplying LoRA...")

lora_config = LoraConfig(
    r=LORA_R,
    lora_alpha=LORA_ALPHA,
    lora_dropout=LORA_DROPOUT,
    target_modules=LORA_TARGET_MODULES,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)

trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total     = sum(p.numel() for p in model.parameters())
print(f"Trainable: {trainable:,} ({100*trainable/total:.2f}%)")
print(f"Total:     {total:,}")

# ════════════════════════════════════════════════════════
# CELL 8: Training Config
# ════════════════════════════════════════════════════════
print("\nConfiguring training...")

training_args = SFTConfig(
    output_dir=OUTPUT_DIR,
    num_train_epochs=NUM_EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRADIENT_ACCUMULATION,
    learning_rate=LEARNING_RATE,
    weight_decay=WEIGHT_DECAY,
    warmup_steps=WARMUP_STEPS,
    lr_scheduler_type=LR_SCHEDULER,
    max_seq_length=MAX_SEQ_LENGTH,

    eval_strategy="steps",
    eval_steps=50,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=2,
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    greater_is_better=False,

    logging_steps=10,
    logging_first_step=True,
    report_to="none",

    fp16=True,
    optim="paged_adamw_8bit",
    gradient_checkpointing=True,
    gradient_checkpointing_kwargs={"use_reentrant": False},

    seed=42,
    remove_unused_columns=False,
    dataloader_num_workers=0,  # 0 for stability on Kaggle
)

# ════════════════════════════════════════════════════════
# CELL 9: Train
# ════════════════════════════════════════════════════════
print("\nInitializing SFTTrainer...")

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    processing_class=tokenizer,
)

print(f"\n{'='*60}")
print(f"  STARTING TRAINING — MindSLM 14B")
print(f"{'='*60}")
print(f"  Base model:      {BASE_MODEL}")
print(f"  LoRA rank:       {LORA_R}  |  alpha: {LORA_ALPHA}")
print(f"  Train samples:   {len(train_dataset)}")
print(f"  Val samples:     {len(val_dataset)}")
print(f"  Epochs:          {NUM_EPOCHS}")
print(f"  Effective batch: {BATCH_SIZE * GRADIENT_ACCUMULATION}")
print(f"  Learning rate:   {LEARNING_RATE}")
print(f"{'='*60}\n")

train_result = trainer.train()

print(f"\n{'='*60}")
print(f"  TRAINING COMPLETE")
print(f"{'='*60}")
print(f"  Loss:       {train_result.training_loss:.4f}")
print(f"  Runtime:    {train_result.metrics['train_runtime']:.0f}s")
print(f"  Samples/s:  {train_result.metrics['train_samples_per_second']:.2f}")

eval_result = trainer.evaluate()
print(f"  Val loss:   {eval_result['eval_loss']:.4f}")

# ════════════════════════════════════════════════════════
# CELL 10: Save LoRA Adapter
# ════════════════════════════════════════════════════════
print(f"\nSaving LoRA adapter to {OUTPUT_DIR}...")
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print("LoRA adapter saved!")

# ════════════════════════════════════════════════════════
# CELL 11: Merge LoRA into Base Model
# ════════════════════════════════════════════════════════
print("\nMerging LoRA into base model...")
print("(Reloads base model in fp16 — takes ~10 minutes)")

# Free training memory first
del trainer
del model
gc.collect()
torch.cuda.empty_cache()

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True,
)

merged = PeftModel.from_pretrained(base_model, OUTPUT_DIR)
merged = merged.merge_and_unload()

os.makedirs(MERGED_DIR, exist_ok=True)
merged.save_pretrained(MERGED_DIR, safe_serialization=True)
tokenizer.save_pretrained(MERGED_DIR)

print(f"Merged model saved to {MERGED_DIR}")

# ════════════════════════════════════════════════════════
# CELL 12: Quick Test
# ════════════════════════════════════════════════════════
print(f"\n{'='*60}")
print("  TESTING MindSLM 14B")
print(f"{'='*60}")

test_cases = [
    ("I keep waking up at night crying and I don't know why", "Depression"),
    ("My heart races before every meeting and I can't breathe", "Anxiety"),
    ("I don't see the point in anything anymore", "Depression"),
]

for user_text, category in test_cases:
    messages = [
        {"role": "system",  "content": SYSTEM_PROMPTS[category]},
        {"role": "user",    "content": user_text},
    ]
    input_text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(input_text, return_tensors="pt").to("cuda:0")

    with torch.no_grad():
        outputs = merged.generate(
            **inputs,
            max_new_tokens=100,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
        )

    response = tokenizer.decode(
        outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True
    )
    print(f"\n  [{category}] {user_text[:60]}...")
    print(f"  → {response[:200]}")

# ════════════════════════════════════════════════════════
# CELL 13: Zip for Download
# ════════════════════════════════════════════════════════
print(f"\nZipping merged model for download...")
import subprocess

result = subprocess.run(
    ["zip", "-r", "/kaggle/working/mindslm-14b-merged.zip", MERGED_DIR],
    capture_output=True, text=True
)

size_gb = os.path.getsize("/kaggle/working/mindslm-14b-merged.zip") / (1024**3)
print(f"mindslm-14b-merged.zip created ({size_gb:.1f} GB)")
print("\nDownload from Kaggle Output tab → mindslm-14b-merged.zip")
print("Then run: python3 step4_export_ollama.py")
