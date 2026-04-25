"""
==========================================================================
STEP 3: Fine-Tune Qwen2.5-1.5B-Instruct for Mental Health Responses
==========================================================================
🏷️  Model Name: MindSLM
📊  Base Model: Qwen/Qwen2.5-1.5B-Instruct
🔧  Method: QLoRA (4-bit quantization + LoRA adapters)
🖥️  Hardware: Kaggle T4 GPU (16GB VRAM)
⏱️  Training Time: ~2-4 hours

HOW TO USE ON KAGGLE:
1. Create a new Kaggle Notebook
2. Enable GPU: Settings → Accelerator → GPU T4 x2
3. Upload train_chat.jsonl and val_chat.jsonl as dataset
4. Copy this entire file into a notebook cell (or split into cells)
5. Run!

Output: Fine-tuned model saved to ./mindslm-finetuned/
==========================================================================
"""

# ════════════════════════════════════════════════════════
# CELL 1: Install Dependencies
# ════════════════════════════════════════════════════════
# !pip install -q torch transformers accelerate peft bitsandbytes trl datasets wandb

import os
os.environ["WANDB_DISABLED"] = "true"  # Disable wandb logging

# ════════════════════════════════════════════════════════
# CELL 2: Imports
# ════════════════════════════════════════════════════════
import torch
import json
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import (
    LoraConfig,
    get_peft_model,
    prepare_model_for_kbit_training,
    TaskType,
)
from trl import SFTTrainer, SFTConfig

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_mem / 1024**3:.1f} GB")

# ════════════════════════════════════════════════════════
# CELL 3: Configuration
# ════════════════════════════════════════════════════════
# ── Model Config ──
BASE_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"
OUTPUT_DIR = "./mindslm-finetuned"
MERGED_DIR = "./mindslm-merged"       # Full merged model for export

# ── QLoRA Config ──
LORA_R = 16              # LoRA rank — smaller dataset (1.2K) so lower rank avoids overfitting
LORA_ALPHA = 32           # LoRA scaling factor (usually 2x rank)
LORA_DROPOUT = 0.05       # Dropout for regularization
LORA_TARGET_MODULES = [   # Which layers to fine-tune
    "q_proj", "k_proj", "v_proj", "o_proj",  # Attention layers
    "gate_proj", "up_proj", "down_proj",      # MLP layers
]

# ── Training Config ──
NUM_EPOCHS = 3
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4  # Effective batch = 4 * 4 = 16
LEARNING_RATE = 2e-4
MAX_SEQ_LENGTH = 512       # Max tokens per sample
WARMUP_RATIO = 0.05
WEIGHT_DECAY = 0.01
LR_SCHEDULER = "cosine"

# ── Data Paths ──
# Update these based on your Kaggle dataset path
TRAIN_FILE = "/kaggle/input/mindslm-training-data/train_chat.jsonl"
VAL_FILE   = "/kaggle/input/mindslm-training-data/val_chat.jsonl"

# ════════════════════════════════════════════════════════
# CELL 4: Load Dataset
# ════════════════════════════════════════════════════════
def load_jsonl(filepath):
    """Load JSONL chat format data."""
    data = []
    with open(filepath, 'r') as f:
        for line in f:
            data.append(json.loads(line.strip()))
    return data

print("Loading datasets...")
train_data = load_jsonl(TRAIN_FILE)
val_data = load_jsonl(VAL_FILE)

train_dataset = Dataset.from_list(train_data)
val_dataset = Dataset.from_list(val_data)

print(f"✅ Train: {len(train_dataset)} samples")
print(f"✅ Val:   {len(val_dataset)} samples")

# Preview a sample
sample = train_data[0]
print(f"\nSample:")
for msg in sample['messages']:
    print(f"  [{msg['role']}]: {msg['content'][:80]}...")

# ════════════════════════════════════════════════════════
# CELL 5: Load Tokenizer
# ════════════════════════════════════════════════════════
print(f"\nLoading tokenizer: {BASE_MODEL}")
tokenizer = AutoTokenizer.from_pretrained(
    BASE_MODEL,
    trust_remote_code=True,
)

# Ensure pad token is set
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.pad_token_id = tokenizer.eos_token_id

print(f"✅ Tokenizer loaded — Vocab size: {tokenizer.vocab_size}")

# ════════════════════════════════════════════════════════
# CELL 6: Load Model with 4-bit Quantization
# ════════════════════════════════════════════════════════
print(f"\nLoading model with 4-bit quantization: {BASE_MODEL}")

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",           # Normal Float 4 — best for fine-tuning
    bnb_4bit_compute_dtype=torch.float16, # Compute in fp16
    bnb_4bit_use_double_quant=True,       # Double quantization saves more VRAM
)

model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
    torch_dtype=torch.float16,
)

# Prepare for k-bit training
model = prepare_model_for_kbit_training(model)

# Print model size
total_params = sum(p.numel() for p in model.parameters())
print(f"✅ Model loaded — Total parameters: {total_params / 1e9:.2f}B")
print(f"   VRAM used: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")

# ════════════════════════════════════════════════════════
# CELL 7: Apply LoRA Adapters
# ════════════════════════════════════════════════════════
print("\nApplying LoRA adapters...")

lora_config = LoraConfig(
    r=LORA_R,
    lora_alpha=LORA_ALPHA,
    lora_dropout=LORA_DROPOUT,
    target_modules=LORA_TARGET_MODULES,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)

# Print trainable parameters
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
total_params = sum(p.numel() for p in model.parameters())
pct = 100 * trainable_params / total_params

print(f"✅ LoRA applied:")
print(f"   Trainable parameters: {trainable_params:,} ({pct:.2f}%)")
print(f"   Total parameters:     {total_params:,}")
print(f"   VRAM used: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")

# ════════════════════════════════════════════════════════
# CELL 8: Configure Training
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
    warmup_ratio=WARMUP_RATIO,
    lr_scheduler_type=LR_SCHEDULER,
    max_seq_length=MAX_SEQ_LENGTH,
    
    # Evaluation
    eval_strategy="steps",
    eval_steps=100,
    
    # Saving
    save_strategy="steps",
    save_steps=200,
    save_total_limit=3,
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    greater_is_better=False,
    
    # Logging
    logging_steps=25,
    logging_first_step=True,
    report_to="none",
    
    # Optimization
    fp16=True,
    optim="paged_adamw_8bit",
    gradient_checkpointing=True,
    gradient_checkpointing_kwargs={"use_reentrant": False},
    
    # Misc
    seed=42,
    dataloader_num_workers=2,
    remove_unused_columns=False,
)

# ════════════════════════════════════════════════════════
# CELL 9: Create Trainer and Start Training
# ════════════════════════════════════════════════════════
print("\nInitializing trainer...")

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    processing_class=tokenizer,
)

print(f"\n{'='*60}")
print(f"  🚀 STARTING TRAINING — MindSLM")
print(f"{'='*60}")
print(f"  Base model:     {BASE_MODEL}")
print(f"  Method:         QLoRA (r={LORA_R}, alpha={LORA_ALPHA})")
print(f"  Train samples:  {len(train_dataset)}")
print(f"  Val samples:    {len(val_dataset)}")
print(f"  Epochs:         {NUM_EPOCHS}")
print(f"  Effective batch: {BATCH_SIZE * GRADIENT_ACCUMULATION}")
print(f"  Learning rate:  {LEARNING_RATE}")
print(f"  Max seq length: {MAX_SEQ_LENGTH}")
print(f"{'='*60}\n")

# TRAIN!
train_result = trainer.train()

# Print results
print(f"\n{'='*60}")
print(f"  ✅ TRAINING COMPLETE")
print(f"{'='*60}")
print(f"  Training loss:    {train_result.training_loss:.4f}")
print(f"  Training runtime: {train_result.metrics['train_runtime']:.0f}s")
print(f"  Samples/second:   {train_result.metrics['train_samples_per_second']:.2f}")

# Evaluate
eval_result = trainer.evaluate()
print(f"  Validation loss:  {eval_result['eval_loss']:.4f}")

# ════════════════════════════════════════════════════════
# CELL 10: Save LoRA Adapter
# ════════════════════════════════════════════════════════
print(f"\nSaving LoRA adapter to {OUTPUT_DIR}...")
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f"✅ LoRA adapter saved!")

# ════════════════════════════════════════════════════════
# CELL 11: Merge LoRA into Base Model (for export)
# ════════════════════════════════════════════════════════
print(f"\nMerging LoRA weights into base model...")

# Reload base model in full precision for merging
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True,
)

# Load and merge LoRA
merged_model = PeftModel.from_pretrained(base_model, OUTPUT_DIR)
merged_model = merged_model.merge_and_unload()

# Save merged model
merged_model.save_pretrained(MERGED_DIR)
tokenizer.save_pretrained(MERGED_DIR)

print(f"✅ Merged model saved to {MERGED_DIR}")
print(f"   This is your complete MindSLM model ready for GGUF conversion!")

# ════════════════════════════════════════════════════════
# CELL 12: Quick Test — Generate a Response
# ════════════════════════════════════════════════════════
print(f"\n{'='*60}")
print(f"  🧪 TESTING MindSLM")
print(f"{'='*60}")

test_inputs = [
    ("I can't sleep at night, my heart keeps racing and I feel so worried", "Anxiety"),
    ("I've been crying for days and can't get out of bed", "Depression"),
    ("I don't want to live anymore, everything is hopeless", "Suicidal"),
    ("Had a great day today, finished my project!", "Normal"),
]

# System prompts for testing
test_prompts = {
    "Anxiety": "You are MindSLM, a compassionate mental health support assistant. The user is experiencing anxiety. Acknowledge their feelings, suggest grounding techniques. Be warm and reassuring. 2-4 sentences.",
    "Depression": "You are MindSLM, a compassionate mental health support assistant. The user is experiencing depression. Validate their pain, encourage small steps. 2-4 sentences.",
    "Suicidal": "You are MindSLM, a compassionate crisis support assistant. The user is expressing suicidal thoughts. Express care, provide crisis resources (988 Lifeline). 2-4 sentences.",
    "Normal": "You are MindSLM, a friendly conversational assistant. Respond naturally and warmly. 1-3 sentences.",
}

for user_text, status in test_inputs:
    messages = [
        {"role": "system", "content": test_prompts[status]},
        {"role": "user", "content": user_text},
    ]
    
    input_text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(input_text, return_tensors="pt").to(merged_model.device)
    
    with torch.no_grad():
        outputs = merged_model.generate(
            **inputs,
            max_new_tokens=200,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
        )
    
    response = tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
    
    print(f"\n  [{status}] User: \"{user_text[:60]}...\"")
    print(f"  MindSLM: \"{response[:150]}\"")

print(f"\n{'='*60}")
print(f"  ✅ MindSLM is ready!")
print(f"  Next: Run step4_export_ollama.py to create Ollama model")
print(f"{'='*60}")
