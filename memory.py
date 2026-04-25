#!/usr/bin/env python3
"""
memory.py — Cross-Session Conversation Memory for MindSLM
==========================================================
Embeds and stores what users say across sessions.
At inference, retrieves the most relevant past disclosures
so the model can reference them naturally.

Usage (from mindslm_pipeline_api.py):
  from memory import store_message, retrieve_memories

  # After user sends a message:
  store_message(session_id, user_id, message_text)

  # Before generating response:
  memories = retrieve_memories(user_id, current_message, exclude_session=session_id, n=3)
"""

import os
import time

CHROMA_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")
COLLECTION  = "user_memory"

_client     = None
_collection = None
_embedder   = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection
    try:
        import chromadb
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = _client.get_or_create_collection(
            COLLECTION,
            metadata={"hnsw:space": "cosine"}
        )
    except Exception as e:
        print(f"  ⚠️  Memory: ChromaDB unavailable: {e}")
        _collection = None
    return _collection


def store_message(session_id: str, user_id: str, text: str):
    """
    Embed and store a user message for future retrieval.
    Call this after every user message.
    """
    col = _get_collection()
    if col is None:
        return

    text = text.strip()
    if not text or len(text) < 15:
        return

    try:
        emb = _get_embedder().encode(text).tolist()
        doc_id = f"{user_id}_{session_id}_{int(time.time()*1000)}"
        col.add(
            documents=[text],
            embeddings=[emb],
            metadatas=[{
                "user_id":    user_id,
                "session_id": session_id,
                "timestamp":  int(time.time()),
            }],
            ids=[doc_id],
        )
    except Exception as e:
        print(f"  ⚠️  Memory store failed: {e}")


def retrieve_memories(user_id: str, current_message: str,
                      exclude_session: str = None, n: int = 3) -> list[str]:
    """
    Retrieve the most relevant things this user said in past sessions.
    Returns list of past message strings.
    """
    col = _get_collection()
    if col is None or col.count() == 0:
        return []

    try:
        emb = _get_embedder().encode(current_message).tolist()

        where = {"user_id": user_id}

        results = col.query(
            query_embeddings=[emb],
            n_results=min(n + 5, col.count()),
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        docs      = results["documents"][0] if results["documents"] else []
        metas     = results["metadatas"][0] if results["metadatas"] else []
        distances = results["distances"][0]  if results["distances"] else []

        # Filter out current session + low similarity + duplicates
        seen = set()
        memories = []
        for doc, meta, dist in zip(docs, metas, distances):
            if exclude_session and meta.get("session_id") == exclude_session:
                continue
            similarity = 1 - dist  # cosine distance → similarity
            if similarity < 0.3:
                continue
            if doc in seen:
                continue
            seen.add(doc)
            memories.append(doc)
            if len(memories) >= n:
                break

        return memories

    except Exception as e:
        print(f"  ⚠️  Memory retrieval failed: {e}")
        return []


def format_memory_context(memories: list[str]) -> str:
    """
    Format retrieved memories into a prompt injection string.
    """
    if not memories:
        return ""

    lines = "\n".join(f"- {m}" for m in memories)
    return f"\n\nThis user has previously mentioned:\n{lines}\nReference these naturally if relevant — do not list them."


def clear_user_memory(user_id: str):
    """Delete all stored memories for a user."""
    col = _get_collection()
    if col is None:
        return
    try:
        results = col.get(where={"user_id": user_id}, include=["documents"])
        ids = results.get("ids", [])
        if ids:
            col.delete(ids=ids)
            print(f"  Cleared {len(ids)} memories for user {user_id}")
    except Exception as e:
        print(f"  ⚠️  Memory clear failed: {e}")
