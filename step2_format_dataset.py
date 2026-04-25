"""
==========================================================================
STEP 2: Format Dataset for Qwen2.5 Fine-Tuning
==========================================================================
Converts response_dataset_v2.csv (real therapist data from Step 1)
→ training JSONL in Qwen chat format with train/val split.

Input:  response_dataset_v2.csv (from Step 1)
Output: train_chat.jsonl, val_chat.jsonl

Usage: python step2_format_dataset.py
==========================================================================
"""

import pandas as pd
import json
import random
from sklearn.model_selection import train_test_split

# ── Configuration ──
INPUT_CSV  = "response_dataset_v2.csv"
TRAIN_JSONL = "train_chat.jsonl"
VAL_JSONL   = "val_chat.jsonl"
VAL_RATIO   = 0.1

# ── System Prompts (embedded in training data) ──
# Updated to match the new pipeline's conversational style
SYSTEM_PROMPTS = {
    "Anxiety": (
        "You are MindSLM, a compassionate mental health support companion. "
        "The user is experiencing anxiety. Acknowledge what they described specifically, "
        "offer a practical grounding technique, and explain briefly why it helps. "
        "Sound like a calm friend, not a textbook. Keep it under 5 sentences. "
        "No platitudes like 'it takes courage' or 'you matter'."
    ),
    "Depression": (
        "You are MindSLM, a compassionate mental health support companion. "
        "The user is showing signs of depression. Name the specific feeling they expressed. "
        "Suggest one small action they can take right now. Be direct and human — "
        "not cheerful, not clinical. Keep it under 5 sentences. "
        "Never say 'you matter' or 'you're not alone' as filler."
    ),
    "Suicidal": (
        "You are MindSLM, a crisis support companion. "
        "The user may be in crisis. Open with 'I'm really glad you told me this.' "
        "Validate the pain without minimizing. Direct them to 988 (call or text). "
        "Do not give coping tips or silver linings. Presence and direction only. "
        "3-4 sentences max. Crisis resources are appended automatically."
    ),
    "Normal": (
        "You are MindSLM, a friendly mental health check-in companion. "
        "The user seems to be doing okay. Respond warmly in 2 sentences max. "
        "Ask one curious follow-up about something they mentioned. "
        "No unsolicited advice."
    ),
}


def format_for_qwen(row):
    """Convert a single row into Qwen2.5 chat format."""
    return {
        "messages": [
            {"role": "system",    "content": SYSTEM_PROMPTS[row["status"]]},
            {"role": "user",      "content": row["text"]},
            {"role": "assistant", "content": row["response"]},
        ]
    }


def process_dataset(input_csv, train_jsonl, val_jsonl, val_ratio):
    print(f"{'='*60}")
    print(f"  FORMATTING DATASET FOR QWEN FINE-TUNING")
    print(f"{'='*60}")

    df = pd.read_csv(input_csv)
    print(f"  Loaded {len(df)} samples from {input_csv}")

    # Clean
    df = df.dropna(subset=["text", "status", "response"])
    df = df[df["response"].str.len() > 10]
    df = df[df["status"].isin(["Anxiety", "Depression", "Suicidal", "Normal"])]
    print(f"  After cleaning: {len(df)} samples")
    print(f"  Distribution: {dict(df['status'].value_counts())}")

    # Format
    formatted = [format_for_qwen(row) for _, row in df.iterrows()]

    # Stratified split
    train_data, val_data = train_test_split(
        formatted, test_size=val_ratio, random_state=42,
        stratify=df["status"]
    )

    random.seed(42)
    random.shuffle(train_data)

    # Save
    for path, data in [(train_jsonl, train_data), (val_jsonl, val_data)]:
        with open(path, "w") as f:
            for item in data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"\n  ✅ Train: {len(train_data)} samples → {train_jsonl}")
    print(f"  ✅ Val:   {len(val_data)} samples → {val_jsonl}")

    # Preview
    sample = train_data[0]
    print(f"\n  Sample:")
    print(f"  System: \"{sample['messages'][0]['content'][:80]}...\"")
    print(f"  User:   \"{sample['messages'][1]['content'][:80]}\"")
    print(f"  Asst:   \"{sample['messages'][2]['content'][:80]}\"")

    # Token estimate
    total_chars = sum(len(m["content"]) for item in train_data for m in item["messages"])
    est_tokens = total_chars / 4
    print(f"\n  Estimated tokens: ~{int(est_tokens):,}")
    print(f"  Avg per sample:   ~{int(est_tokens/len(train_data)):,}")


if __name__ == "__main__":
    process_dataset(INPUT_CSV, TRAIN_JSONL, VAL_JSONL, VAL_RATIO)
