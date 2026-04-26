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
import os
from sklearn.model_selection import train_test_split

# ── Configuration ──
INPUT_CSV  = "response_dataset_v2.csv"
TRAIN_JSONL = "train_chat.jsonl"
VAL_JSONL   = "val_chat.jsonl"
VAL_RATIO   = 0.1

# ── System Prompts (embedded in training data) ──
# Must match mindslm_pipeline_api.py SYSTEM_PROMPTS exactly.
# DO NOT add "explain briefly why it helps" — that teaches generic educational responses.
SYSTEM_PROMPTS = {
    "Anxiety": (
        "You are a therapist. 2 sentences max. Name their specific symptom, then give one concrete technique.\n"
        "Example: 'That racing heart before your meeting is your body in overdrive. "
        "Try box breathing: inhale 4 counts, hold 4, exhale 4, repeat 3 times.'"
    ),
    "Depression": (
        "You are a therapist. EXACTLY 2 sentences. DO NOT explain depression. DO NOT say 'it's common'. DO NOT use 'we'.\n"
        "Sentence 1: Echo back what they said using their own words, with warmth. Use 'I' not 'We'.\n"
        "Sentence 2: Give ONE tiny physical action they can do in the next 30 seconds.\n"
        "Good: 'That heavy, low feeling can make everything feel pointless. Put both feet flat on the floor right now and take one slow breath.' "
        "Bad: 'It is common to feel low. We are sorry you are feeling this way.'"
    ),
    "Suicidal": (
        "You are a crisis counselor. 2 sentences max.\n"
        "Example: 'What you are carrying right now is real and heavy. "
        "Please call or text 988 right now — someone is there to listen.'"
    ),
    "Normal": "You are a friend. 1 sentence reply + 1 follow-up question. No advice.",
}

# ── Response quality filter ──
# Mirrors the BANNED list in mindslm_pipeline_api.py + RAG quality filter.
# Remove any training example whose response contains these phrases.
_RESPONSE_BANNED = [
    "explain briefly", "why it helps", "it's common", "it is common",
    "common to feel", "normal to feel", "very common", "most people", "many people",
    "fight or flight", "stress hormone", "nervous system",
    "diagnos", "disorder", "condition", "seek professional", "see a doctor",
    "speak with", "consult", "talk to your doctor",
    "blog", "http", "www.", ".com", ".org",
    "self-esteem", "keeping a log", "write down",
    "one way to approach", "in order to", "a variety of factors",
    "you're not alone", "you are not alone", "you matter",
    "it gets better", "everything will be okay", "think positive",
    "silver lining", "bright side", "count your blessings",
    "there are a number", "a number of things",
]

def _is_quality_response(text: str) -> bool:
    """Return True only if the response is short and empathetic, not educational."""
    t = text.lower()
    if any(b in t for b in _RESPONSE_BANNED):
        return False
    words = len(text.split())
    if words > 80:   # too long = educational / rambling
        return False
    if words < 8:    # too short to be useful
        return False
    return True


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

    # Quality filter — remove educational / too-long / banned-phrase responses
    before = len(df)
    df = df[df["response"].apply(_is_quality_response)]
    print(f"  After quality filter: {len(df)} samples ({before - len(df)} removed)")
    print(f"  Distribution: {dict(df['status'].value_counts())}")

    # Format Counsel Chat samples
    formatted = [format_for_qwen(row) for _, row in df.iterrows()]

    # ── Add curated hand-written responses ──────────────────────────
    CURATED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "curated_responses.json")
    curated_formatted = []
    if os.path.exists(CURATED_PATH):
        with open(CURATED_PATH) as f:
            curated = json.load(f)
        for entry in curated:
            query    = entry.get("query", "").strip()
            response = entry.get("response", "").strip()
            status   = entry.get("category", "Normal")
            if not query or not response or status not in SYSTEM_PROMPTS:
                continue
            curated_formatted.append({
                "messages": [
                    {"role": "system",    "content": SYSTEM_PROMPTS[status]},
                    {"role": "user",      "content": query},
                    {"role": "assistant", "content": response},
                ]
            })
        print(f"  ✅ Curated responses: {len(curated_formatted)} samples added")
    else:
        print(f"  ⚠️  curated_responses.json not found — skipping")

    # Duplicate curated samples 3x so they dominate the training signal
    formatted = formatted + (curated_formatted * 3)
    random.seed(42)
    random.shuffle(formatted)
    print(f"  Total after combining: {len(formatted)} samples")

    # Split (no stratify — mixed sources after curated injection)
    train_data, val_data = train_test_split(
        formatted, test_size=val_ratio, random_state=42,
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
