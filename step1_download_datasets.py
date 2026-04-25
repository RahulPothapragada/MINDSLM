"""
==========================================================================
STEP 1: Download & Prepare Real Therapist Response Datasets
==========================================================================
Downloads Counsel Chat (real therapist Q&A) and EmpatheticDialogues
(human empathetic conversations), cleans and merges them into a unified
response dataset for fine-tuning.

No more synthetic/AI-generated responses — these are real human responses.

Output: response_dataset.csv with columns [text, status, response]

Usage: python step1_download_datasets.py
==========================================================================
"""

import os
import json
import pandas as pd
from datasets import load_dataset

OUTPUT_CSV = "response_dataset_v2.csv"

# ==============================
# 1. COUNSEL CHAT (Real therapist Q&A)
# ==============================
def download_counsel_chat() -> pd.DataFrame:
    """
    Counsel Chat: ~2K real therapist responses from counselchat.com.
    Each row has a question (from a real person) and an answer (from a licensed therapist).
    """
    print("\n  Downloading Counsel Chat (real therapist responses)...")
    try:
        ds = load_dataset("nbertagnolli/counsel-chat", split="train")
        df = pd.DataFrame(ds)

        # Key columns: questionTitle, questionText, answerText, topic
        # Map topics → our 4 categories
        topic_map = {
            "depression":          "Depression",
            "anxiety":             "Anxiety",
            "stress":              "Anxiety",
            "trauma":              "Depression",
            "grief-and-loss":      "Depression",
            "self-harm":           "Suicidal",
            "suicide":             "Suicidal",
            "self-esteem":         "Depression",
            "anger-management":    "Anxiety",
            "relationship-dissolution": "Depression",
            "relationships":       "Normal",
            "family-conflict":     "Anxiety",
            "parenting":           "Normal",
            "marriage":            "Normal",
            "intimacy":            "Normal",
            "lgbtq":               "Normal",
            "spirituality":        "Normal",
            "sleep-improvement":   "Anxiety",
            "behavioral-change":   "Normal",
            "professional-ethics": "Normal",
            "counseling-fundamentals": "Normal",
            "substance-abuse":     "Depression",
            "addiction":           "Depression",
            "eating-disorders":    "Depression",
        }

        rows = []
        for _, row in df.iterrows():
            # Combine title + text for the user message
            q_title = str(row.get("questionTitle", "")).strip()
            q_text  = str(row.get("questionText", "")).strip()
            answer  = str(row.get("answerText", "")).strip()
            topic   = str(row.get("topic", "")).strip().lower()

            user_msg = q_title
            if q_text and q_text != q_title and len(q_text) > 10:
                user_msg = q_text

            if len(user_msg) < 10 or len(answer) < 20:
                continue

            # Truncate very long therapist responses to keep training focused
            if len(answer) > 800:
                # Take first ~600 chars, ending at a sentence boundary
                cut = answer[:800]
                last_period = cut.rfind(".")
                if last_period > 400:
                    answer = cut[:last_period + 1]

            status = topic_map.get(topic, "Normal")
            rows.append({"text": user_msg, "status": status, "response": answer, "source": "counsel_chat"})

        result = pd.DataFrame(rows)
        print(f"  ✅ Counsel Chat: {len(result)} samples")
        print(f"     Distribution: {dict(result['status'].value_counts())}")
        return result

    except Exception as e:
        print(f"  ❌ Failed to load Counsel Chat: {e}")
        print(f"     Install: pip install datasets")
        return pd.DataFrame()


# ==============================
# 2. EMPATHETIC DIALOGUES (Facebook Research)
# ==============================
def download_empathetic_dialogues() -> pd.DataFrame:
    """
    EmpatheticDialogues: 25K human conversations with empathetic responses.
    Uses the CSV-based version since the script-based loader is deprecated.
    """
    print("\n  Downloading EmpatheticDialogues...")
    try:
        import urllib.request, csv, io

        url = "https://dl.fbaipublicfiles.com/parlai/empatheticdialogues/empatheticdialogues.tar.gz"
        # Try HuggingFace parquet version first
        ds = load_dataset("bdotloh/empathetic-dialogues-contexts", split="train")
        df = pd.DataFrame(ds)

        emotion_map = {
            "sad": "Depression", "lonely": "Depression", "guilty": "Depression",
            "ashamed": "Depression", "disappointed": "Depression", "devastated": "Depression",
            "sentimental": "Depression", "nostalgic": "Depression", "jealous": "Depression",
            "embarrassed": "Depression",
            "anxious": "Anxiety", "terrified": "Anxiety", "afraid": "Anxiety",
            "apprehensive": "Anxiety", "nervous": "Anxiety",
            "annoyed": "Anxiety", "angry": "Anxiety", "furious": "Anxiety",
            "disgusted": "Anxiety",
            "joyful": "Normal", "grateful": "Normal", "proud": "Normal",
            "hopeful": "Normal", "excited": "Normal", "content": "Normal",
            "confident": "Normal", "caring": "Normal", "trusting": "Normal",
            "surprised": "Normal", "impressed": "Normal", "faithful": "Normal",
            "anticipating": "Normal", "prepared": "Normal",
        }

        rows = []
        # This dataset variant has context (situation), prompt, utterance columns
        for _, row in df.iterrows():
            user_msg = str(row.get("prompt", row.get("utterance", ""))).strip().replace("_comma_", ",")
            response = str(row.get("utterance", row.get("response", ""))).strip().replace("_comma_", ",")
            emotion  = str(row.get("context", row.get("emotion", ""))).strip().lower()

            if len(user_msg) < 10 or len(response) < 10:
                continue
            if user_msg == response:
                continue

            status = emotion_map.get(emotion, "Normal")
            rows.append({"text": user_msg, "status": status, "response": response, "source": "empathetic_dialogues"})

        result = pd.DataFrame(rows)
        if len(result) > 0:
            print(f"  ✅ EmpatheticDialogues: {len(result)} samples")
            print(f"     Distribution: {dict(result['status'].value_counts())}")
        else:
            print(f"  ⚠️  EmpatheticDialogues: loaded but 0 valid rows")
        return result

    except Exception as e:
        print(f"  ⚠️  EmpatheticDialogues unavailable: {e}")
        print(f"     Continuing with Counsel Chat only")
        return pd.DataFrame()


def supplement_suicidal_from_original(original_csv: str = "train.csv") -> pd.DataFrame:
    """
    The Counsel Chat dataset has very few suicidal examples.
    Use the original train.csv suicidal texts + generate careful responses.
    These responses are templates, not AI-generated, for safety.
    """
    print("\n  Supplementing suicidal class from original dataset...")
    try:
        df = pd.read_csv(original_csv)
        sui = df[df["status"] == "Suicidal"].copy()
        sui["text"] = sui["text"].astype(str).str.strip()
        sui = sui[(sui["text"].str.len() >= 15) & (sui["text"].str.len() <= 500)]

        # Use carefully crafted template responses for suicidal content
        # These follow clinical best practice: validate, don't advise, direct to help
        templates = [
            "I'm really glad you told me this. What you're feeling right now is real pain, and it matters. Please reach out to the 988 Suicide & Crisis Lifeline by calling or texting 988 — trained counselors are available right now, 24/7.",
            "Thank you for sharing something so difficult. You don't have to face this alone. Please contact the 988 Lifeline (call or text 988) or text HOME to 741741 to connect with someone who can help right now.",
            "I hear you, and I want you to know that reaching out like this takes real strength. Please call or text 988 to speak with a crisis counselor who's trained to help with exactly what you're going through.",
            "What you're going through sounds incredibly painful. You deserve support from someone trained in crisis care. Please reach out to the 988 Suicide & Crisis Lifeline — call or text 988, anytime.",
            "I'm glad you're talking about this instead of keeping it inside. Please connect with the 988 Lifeline (call or text 988) — they're available 24/7 and can provide the support you need right now.",
        ]

        # Sample and assign template responses
        sui_sample = sui.sample(n=min(300, len(sui)), random_state=42)
        rows = []
        for i, (_, row) in enumerate(sui_sample.iterrows()):
            rows.append({
                "text": row["text"],
                "status": "Suicidal",
                "response": templates[i % len(templates)],
                "source": "original_supplemented",
            })

        result = pd.DataFrame(rows)
        print(f"  ✅ Supplemented {len(result)} suicidal samples with safe template responses")
        return result

    except Exception as e:
        print(f"  ⚠️  Could not supplement suicidal class: {e}")
        return pd.DataFrame()


# ==============================
# 3. MERGE + BALANCE
# ==============================
def merge_and_balance(dfs: list[pd.DataFrame], max_per_class: int = 3000) -> pd.DataFrame:
    """Merge datasets and balance classes."""
    print("\n  Merging and balancing...")

    combined = pd.concat(dfs, ignore_index=True)
    combined = combined.drop_duplicates(subset=["text"], keep="first")

    print(f"  Total unique samples: {len(combined)}")
    print(f"  Before balancing: {dict(combined['status'].value_counts())}")

    # Balance: cap each class, prioritize counsel_chat, then supplemented, then others
    SOURCE_PRIORITY = ["counsel_chat", "original_supplemented", "empathetic_dialogues"]
    balanced = []
    for status in ["Anxiety", "Depression", "Suicidal", "Normal"]:
        class_df = combined[combined["status"] == status]

        selected = pd.DataFrame()
        for src in SOURCE_PRIORITY:
            if len(selected) >= max_per_class:
                break
            src_df = class_df[class_df["source"] == src]
            remaining = max_per_class - len(selected)
            if len(src_df) > 0:
                take = src_df if len(src_df) <= remaining else src_df.sample(n=remaining, random_state=42)
                selected = pd.concat([selected, take])

        balanced.append(selected)

    result = pd.concat(balanced, ignore_index=True)
    result = result.sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"\n  After balancing: {dict(result['status'].value_counts())}")
    print(f"  Total: {len(result)} samples")

    # Source breakdown
    print(f"\n  Source breakdown:")
    for src, cnt in result["source"].value_counts().items():
        print(f"    {src}: {cnt}")

    return result


# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    print("=" * 60)
    print("  STEP 1: Download Real Therapist Response Datasets")
    print("=" * 60)

    dfs = []

    counsel_df = download_counsel_chat()
    if len(counsel_df) > 0:
        dfs.append(counsel_df)

    empathetic_df = download_empathetic_dialogues()
    if len(empathetic_df) > 0:
        dfs.append(empathetic_df)

    # Supplement suicidal class (very underrepresented in Counsel Chat)
    sui_df = supplement_suicidal_from_original()
    if len(sui_df) > 0:
        dfs.append(sui_df)

    if not dfs:
        print("\n  ❌ No datasets loaded. Install: pip install datasets")
        exit(1)

    final = merge_and_balance(dfs)

    # Drop source column before saving (not needed for training)
    final_out = final.drop(columns=["source"])
    final_out.to_csv(OUTPUT_CSV, index=False)

    print(f"\n  ✅ Saved to {OUTPUT_CSV}")
    print(f"     Total: {len(final_out)} real human-written responses")

    # Preview
    print(f"\n  Sample outputs:")
    for status in ["Anxiety", "Depression", "Suicidal", "Normal"]:
        subset = final[final["status"] == status]
        if len(subset) > 0:
            sample = subset.iloc[0]
            print(f"\n  [{status}] (source: {sample['source']})")
            print(f"  User: \"{sample['text'][:100]}\"")
            print(f"  Response: \"{sample['response'][:150]}\"")
