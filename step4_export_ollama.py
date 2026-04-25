#!/usr/bin/env python3
"""
STEP 4: Merge LoRA Adapter → Full Model → GGUF → Ollama
========================================================
This script:
  1. Downloads Qwen2.5-1.5B-Instruct base model
  2. Loads your LoRA adapter from mindslm-finetuned/
  3. Merges them into a full model (mindslm-merged/)
  4. Converts to GGUF format
  5. Registers with Ollama as "mindslm"
"""

import os
import sys
import subprocess
import shutil

# ==============================
# Configuration
# ==============================
ADAPTER_DIR = "./output/mindslm-qwen-lora"
MERGED_DIR = "./mindslm-merged"
GGUF_FILE = "./mindslm.gguf"
OLLAMA_MODEL_NAME = "mindslm"

def banner(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")

def check_prereqs():
    """Check that adapter files exist."""
    banner("STEP 4: Export MindSLM → GGUF → Ollama")
    
    required = ["adapter_model.safetensors", "adapter_config.json"]
    for f in required:
        path = os.path.join(ADAPTER_DIR, f)
        if not os.path.exists(path):
            print(f"  ❌ Missing: {path}")
            print(f"  Make sure mindslm-finetuned/ folder is in the current directory")
            sys.exit(1)
    
    size_mb = os.path.getsize(os.path.join(ADAPTER_DIR, "adapter_model.safetensors")) / (1024*1024)
    print(f"  ✅ Adapter found: adapter_model.safetensors ({size_mb:.1f} MB)")
    print(f"  ✅ Config found: adapter_config.json")

# ==============================
# PHASE 1: Merge LoRA into base
# ==============================
def merge_adapter():
    banner("Phase 1: Merging LoRA adapter into base model")
    
    if os.path.exists(MERGED_DIR) and os.path.exists(os.path.join(MERGED_DIR, "config.json")):
        print("  ⏭️  Merged model already exists, skipping...")
        return
    
    print("  Loading base model + adapter (this downloads ~3 GB first time)...")
    
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    import torch
    
    # Load base model
    print("  📥 Loading Qwen2.5-1.5B-Instruct...")
    base_model = AutoModelForCausalLM.from_pretrained(
        "Qwen/Qwen2.5-1.5B-Instruct",
        torch_dtype=torch.float16,
        device_map="cpu",
        trust_remote_code=True
    )
    
    tokenizer = AutoTokenizer.from_pretrained(
        "Qwen/Qwen2.5-1.5B-Instruct",
        trust_remote_code=True
    )
    
    # Load and merge adapter
    print("  🔗 Loading LoRA adapter...")
    model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
    
    print("  🔀 Merging weights...")
    model = model.merge_and_unload()
    
    # Save merged model
    print(f"  💾 Saving merged model to {MERGED_DIR}/...")
    os.makedirs(MERGED_DIR, exist_ok=True)
    model.save_pretrained(MERGED_DIR, safe_serialization=True)
    tokenizer.save_pretrained(MERGED_DIR)
    
    # Check output
    total_size = sum(
        os.path.getsize(os.path.join(MERGED_DIR, f))
        for f in os.listdir(MERGED_DIR)
        if os.path.isfile(os.path.join(MERGED_DIR, f))
    ) / (1024*1024)
    print(f"  ✅ Merged model saved! Total size: {total_size:.0f} MB")

# ==============================
# PHASE 2: Convert to GGUF
# ==============================
def convert_to_gguf():
    banner("Phase 2: Converting to GGUF format")
    
    if os.path.exists(GGUF_FILE):
        size_mb = os.path.getsize(GGUF_FILE) / (1024*1024)
        print(f"  ⏭️  GGUF already exists ({size_mb:.0f} MB), skipping...")
        return
    
    # Check if llama.cpp convert script is available
    # Try using the pip-installed llama-cpp-python or clone llama.cpp
    convert_script = None
    
    # Option 1: Check if llama.cpp is cloned nearby
    for path in ["./llama.cpp/convert_hf_to_gguf.py", "../llama.cpp/convert_hf_to_gguf.py"]:
        if os.path.exists(path):
            convert_script = path
            break
    
    if convert_script is None:
        print("  📥 Cloning llama.cpp for GGUF conversion...")
        subprocess.run(["git", "clone", "--depth", "1", "https://github.com/ggerganov/llama.cpp.git"], 
                      check=True, capture_output=True)
        convert_script = "./llama.cpp/convert_hf_to_gguf.py"
        
        # Install requirements
        req_file = "./llama.cpp/requirements.txt"
        if os.path.exists(req_file):
            print("  📦 Installing llama.cpp requirements...")
            subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", req_file],
                         capture_output=True)
    
    print(f"  🔄 Converting to GGUF (Q4_K_M quantization)...")
    
    # First convert to F16 GGUF
    f16_gguf = "./mindslm-f16.gguf"
    result = subprocess.run(
        [sys.executable, convert_script, MERGED_DIR, "--outfile", f16_gguf, "--outtype", "f16"],
        capture_output=True, text=True
    )
    
    if result.returncode != 0:
        print(f"  ⚠️  Convert output: {result.stderr[-500:]}")
        # Try alternative flag
        result = subprocess.run(
            [sys.executable, convert_script, MERGED_DIR, "--outfile", f16_gguf],
            capture_output=True, text=True
        )
    
    if not os.path.exists(f16_gguf):
        print(f"  ❌ F16 conversion failed.")
        print(f"  stderr: {result.stderr[-500:]}")
        print(f"\n  💡 Alternative: Use Ollama directly (see below)")
        create_modelfile_for_hf()
        return
    
    # Quantize to Q4_K_M
    quantize_bin = "./llama.cpp/build/bin/llama-quantize"
    if not os.path.exists(quantize_bin):
        quantize_bin = "./llama.cpp/llama-quantize"
    
    if os.path.exists(quantize_bin):
        print("  📦 Quantizing to Q4_K_M...")
        subprocess.run([quantize_bin, f16_gguf, GGUF_FILE, "Q4_K_M"], check=True)
        os.remove(f16_gguf)
    else:
        print("  ⚠️  Quantize binary not found, using F16 GGUF directly")
        shutil.move(f16_gguf, GGUF_FILE)
    
    size_mb = os.path.getsize(GGUF_FILE) / (1024*1024)
    print(f"  ✅ GGUF created: {GGUF_FILE} ({size_mb:.0f} MB)")

def create_modelfile_for_hf():
    """Fallback: Create Modelfile that loads from HF merged model via Ollama."""
    print("  🔄 Creating Modelfile for direct Ollama import...")
    
    modelfile = f"""FROM {MERGED_DIR}

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40

SYSTEM \"\"\"You are MindSLM, a compassionate mental health support assistant. You provide empathetic, supportive responses to help users manage their emotional wellbeing. You are not a replacement for professional help. In crisis situations, always direct users to emergency services or crisis hotlines.\"\"\"
"""
    with open("Modelfile", "w") as f:
        f.write(modelfile)
    print(f"  ✅ Modelfile created")

# ==============================
# PHASE 3: Register with Ollama
# ==============================
def register_ollama():
    banner("Phase 3: Registering with Ollama")
    
    # Check Ollama is installed
    try:
        result = subprocess.run(["ollama", "--version"], capture_output=True, text=True)
        print(f"  ✅ Ollama found: {result.stdout.strip()}")
    except FileNotFoundError:
        print("  ❌ Ollama not found! Install from https://ollama.com")
        sys.exit(1)
    
    # Create Modelfile
    if os.path.exists(GGUF_FILE):
        source = GGUF_FILE
        modelfile_content = f"""FROM ./{GGUF_FILE}

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40

TEMPLATE \"\"\"{{{{- if .System }}}}<|im_start|>system
{{{{ .System }}}}<|im_end|>
{{{{- end }}}}
<|im_start|>user
{{{{ .Prompt }}}}<|im_end|>
<|im_start|>assistant
{{{{ .Response }}}}<|im_end|>\"\"\"

SYSTEM \"\"\"You are MindSLM, a compassionate mental health support assistant. You provide empathetic, supportive responses to help users manage their emotional wellbeing. You are not a replacement for professional help. In crisis situations, always direct users to emergency services or crisis hotlines.\"\"\"
"""
    else:
        # Use merged HF model directly
        source = MERGED_DIR
        modelfile_content = f"""FROM {MERGED_DIR}

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40

SYSTEM \"\"\"You are MindSLM, a compassionate mental health support assistant. You provide empathetic, supportive responses to help users manage their emotional wellbeing. You are not a replacement for professional help. In crisis situations, always direct users to emergency services or crisis hotlines.\"\"\"
"""
    
    with open("Modelfile", "w") as f:
        f.write(modelfile_content)
    print(f"  ✅ Modelfile created (source: {source})")
    
    # Register with Ollama
    print(f"  🚀 Creating Ollama model '{OLLAMA_MODEL_NAME}'...")
    print(f"     (This may take a few minutes...)\n")
    
    result = subprocess.run(
        ["ollama", "create", OLLAMA_MODEL_NAME, "-f", "Modelfile"],
        capture_output=False
    )
    
    if result.returncode == 0:
        print(f"\n  ✅ Model registered as '{OLLAMA_MODEL_NAME}'!")
    else:
        print(f"\n  ⚠️  Ollama create returned code {result.returncode}")
        print(f"  Try running manually: ollama create {OLLAMA_MODEL_NAME} -f Modelfile")

def test_model():
    banner("Phase 4: Quick Test")
    print(f"  Your model is ready! Test it with:\n")
    print(f"    ollama run {OLLAMA_MODEL_NAME}")
    print(f'\n  Or send a test message:')
    print(f'    ollama run {OLLAMA_MODEL_NAME} "I have been feeling anxious lately"')
    print(f"\n  To use in your app, the API endpoint is:")
    print(f"    http://localhost:11434/api/generate")
    print(f'    model: "{OLLAMA_MODEL_NAME}"')

# ==============================
# Main
# ==============================
if __name__ == "__main__":
    check_prereqs()
    merge_adapter()
    convert_to_gguf()
    register_ollama()
    test_model()
    banner("✅ STEP 4 COMPLETE!")
