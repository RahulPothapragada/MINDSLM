#!/usr/bin/env python3
"""
rag.py — Retrieval-Augmented Generation for MindSLM
=====================================================
Builds and queries a ChromaDB vector store of real therapist responses
from Counsel Chat and EmpatheticDialogues.

Usage:
  python3 rag.py --build        # Download datasets, embed, store in ChromaDB (run once)
  python3 rag.py --test         # Test retrieval with a sample query

At inference (called from mindslm_pipeline_api.py):
  from rag import retrieve_examples
  examples = retrieve_examples("i keep waking up at night crying", category="Depression", n=3)
"""

import os
import argparse

CHROMA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")
COLLECTION_NAME = "therapist_responses"

# ==============================
# RETRIEVAL (called at inference)
# ==============================
_client = None
_collection = None

def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection
    import chromadb
    _client = chromadb.PersistentClient(path=CHROMA_DIR)
    try:
        _collection = _client.get_collection(COLLECTION_NAME)
        print(f"  ✅ RAG: loaded {_collection.count()} therapist responses from ChromaDB")
    except Exception:
        _collection = None
        print("  ⚠️  RAG: ChromaDB not built yet. Run: python3 rag.py --build")
    return _collection


_rag_embedder = None

def _get_rag_embedder():
    global _rag_embedder
    if _rag_embedder is None:
        from sentence_transformers import SentenceTransformer
        _rag_embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _rag_embedder


def retrieve_examples(user_message: str, category: str = None, n: int = 3) -> list[str]:
    """
    Retrieve top-n real therapist responses similar to user_message.
    Returns list of response strings to inject as few-shot examples.
    """
    col = _get_collection()
    if col is None or col.count() == 0:
        return []

    where = {"category": category} if category and category != "Normal" else None

    try:
        # Pre-compute embedding so ChromaDB doesn't try to download its own model
        emb = _get_rag_embedder().encode(user_message).tolist()

        results = col.query(
            query_embeddings=[emb],
            n_results=min(n, col.count()),
            where=where,
            include=["documents", "metadatas"],
        )
        responses = results["documents"][0] if results["documents"] else []
        return responses
    except Exception as e:
        print(f"  ⚠️  RAG retrieval failed: {e}")
        return []


# ==============================
# BUILD (run once to ingest data)
# ==============================
def build():
    print("\n" + "="*60)
    print("  Building RAG vector store from real therapist data")
    print("="*60 + "\n")

    import chromadb
    from sentence_transformers import SentenceTransformer

    # Load embedder
    print("  Loading MiniLM embedder...")
    embedder = SentenceTransformer("all-MiniLM-L6-v2")

    # Setup ChromaDB
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(
        COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )

    documents = []  # therapist responses (what model should sound like)
    queries    = []  # user messages (what to match against)
    metadatas  = []
    ids        = []
    idx = 0

    # ── Source 1: Counsel Chat ──────────────────────────────────────
    print("\n  [1/2] Loading Counsel Chat (real therapist Q&As)...")
    try:
        from datasets import load_dataset
        ds = load_dataset("nbertagnolli/counsel-chat", split="train")
        print(f"       Loaded {len(ds)} rows")

        for row in ds:
            question   = str(row.get("questionText", "") or "").strip()
            answer     = str(row.get("answerText", "") or "").strip()
            topic      = str(row.get("topic", "") or "").lower()

            if not question or not answer or len(answer) < 30:
                continue

            # Filter for mental health relevant topics
            mh_topics = ["depression", "anxiety", "grief", "trauma", "suicid",
                         "stress", "relationship", "sleep", "self-esteem",
                         "anger", "family", "loneliness", "ptsd"]
            if not any(t in topic for t in mh_topics):
                # Still include if answer text is clearly therapeutic
                therapeutic_words = ["feel", "emotion", "support", "cope",
                                     "difficult", "struggle", "help", "understand"]
                if not any(w in answer.lower() for w in therapeutic_words):
                    continue

            # Map topic to category
            if any(t in topic for t in ["suicid", "self-harm"]):
                cat = "Suicidal"
            elif any(t in topic for t in ["depression", "grief", "loss", "loneliness"]):
                cat = "Depression"
            elif any(t in topic for t in ["anxiety", "stress", "panic", "ptsd", "trauma"]):
                cat = "Anxiety"
            else:
                cat = "Normal"

            # Truncate long responses to ~3 sentences
            sentences = answer.replace("\n", " ").split(". ")
            short_answer = ". ".join(sentences[:3]).strip()
            if not short_answer.endswith("."):
                short_answer += "."

            documents.append(short_answer)
            queries.append(question)
            metadatas.append({"source": "counsel_chat", "category": cat, "topic": topic[:50]})
            ids.append(f"cc_{idx}")
            idx += 1

        print(f"       Added {idx} Counsel Chat entries")

    except Exception as e:
        print(f"       ⚠️  Counsel Chat failed: {e}")

    cc_count = idx

    # ── Source 2: EmpatheticDialogues ──────────────────────────────
    print("\n  [2/2] Loading EmpatheticDialogues (empathetic conversations)...")
    try:
        from datasets import load_dataset
        ds = load_dataset("facebook/empathetic_dialogues", split="train", trust_remote_code=True)
        print(f"       Loaded {len(ds)} rows")

        # Map EmpatheticDialogues emotions to our categories
        emotion_map = {
            "sad": "Depression", "grief": "Depression", "devastated": "Depression",
            "disappointed": "Depression", "hopeless": "Depression", "lonely": "Depression",
            "depressed": "Depression", "ashamed": "Depression", "guilty": "Depression",
            "afraid": "Anxiety", "anxious": "Anxiety", "nervous": "Anxiety",
            "terrified": "Anxiety", "apprehensive": "Anxiety", "worried": "Anxiety",
            "furious": "Anxiety", "annoyed": "Anxiety",
            "joyful": "Normal", "excited": "Normal", "hopeful": "Normal",
            "grateful": "Normal", "proud": "Normal", "content": "Normal",
            "trusting": "Normal", "surprised": "Normal",
        }

        added = 0
        seen_contexts = set()
        for row in ds:
            context  = str(row.get("prompt", "") or "").strip()
            utterance = str(row.get("utterance", "") or "").strip()
            emotion  = str(row.get("context", "") or "").lower()

            if not context or not utterance or len(utterance) < 20:
                continue
            if context in seen_contexts:
                continue
            seen_contexts.add(context)

            cat = emotion_map.get(emotion, "Normal")
            # Only include non-Normal for mental health relevance
            if cat == "Normal" and added > 500:
                continue

            # Truncate response
            sentences = utterance.replace("\n", " ").split(". ")
            short_utt = ". ".join(sentences[:2]).strip()
            if not short_utt.endswith("."):
                short_utt += "."

            documents.append(short_utt)
            queries.append(context)
            metadatas.append({"source": "empathetic_dialogues", "category": cat, "emotion": emotion})
            ids.append(f"ed_{idx}")
            idx += 1
            added += 1

            if added >= 2000:  # cap to keep DB manageable
                break

        print(f"       Added {added} EmpatheticDialogues entries")

    except Exception as e:
        print(f"       ⚠️  EmpatheticDialogues failed: {e}")

    if not documents:
        print("\n  ❌ No documents loaded. Check your internet connection.")
        return

    # ── Embed and store ────────────────────────────────────────────
    print(f"\n  Embedding {len(documents)} entries with MiniLM...")
    print("  (this takes ~2-3 minutes)")

    BATCH = 256
    for i in range(0, len(documents), BATCH):
        batch_docs  = documents[i:i+BATCH]
        batch_query = queries[i:i+BATCH]
        batch_meta  = metadatas[i:i+BATCH]
        batch_ids   = ids[i:i+BATCH]

        embeddings = embedder.encode(batch_query, show_progress_bar=False).tolist()

        collection.add(
            documents=batch_docs,
            embeddings=embeddings,
            metadatas=batch_meta,
            ids=batch_ids,
        )

        pct = min(100, int((i + BATCH) / len(documents) * 100))
        print(f"  [{pct:3d}%] {min(i+BATCH, len(documents))}/{len(documents)} embedded", end="\r")

    print(f"\n\n  ✅ RAG store built!")
    print(f"     Total entries:        {collection.count()}")
    print(f"     Counsel Chat:         {cc_count}")
    print(f"     EmpatheticDialogues:  {idx - cc_count}")
    print(f"     Stored at:            {CHROMA_DIR}")
    print("\n  Test with: python3 rag.py --test\n")


# ==============================
# TEST
# ==============================
def test():
    test_cases = [
        ("i keep waking up at night and crying i dont know why", "Depression"),
        ("i feel so anxious before every meeting my heart races", "Anxiety"),
        ("i dont see the point of anything anymore", "Depression"),
        ("i feel like everyone would be better off without me", "Suicidal"),
        ("i had a good day today", "Normal"),
    ]

    print("\n" + "="*60)
    print("  RAG Retrieval Test")
    print("="*60)

    for query, expected_cat in test_cases:
        print(f"\n  Query [{expected_cat}]: \"{query}\"")
        examples = retrieve_examples(query, category=expected_cat, n=2)
        if examples:
            for i, ex in enumerate(examples, 1):
                print(f"  [{i}] {ex[:120]}...")
        else:
            print("  No results (run --build first)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--build", action="store_true", help="Download datasets and build ChromaDB")
    parser.add_argument("--test",  action="store_true", help="Test retrieval")
    args = parser.parse_args()

    if args.build:
        build()
    elif args.test:
        test()
    else:
        print("Usage: python3 rag.py --build | --test")
