"""
MindSLM — SQLite persistence layer
Sessions, messages, screening state, severity tracking
"""

import os
import json
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mindslm.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY,
            name        TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now')),
            phq9_score  INTEGER,
            gad7_score  INTEGER,
            severity    TEXT,
            top_emotions TEXT,
            message_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT REFERENCES sessions(id) ON DELETE CASCADE,
            role        TEXT NOT NULL,
            content     TEXT NOT NULL,
            emotions    TEXT,
            classification TEXT,
            confidence  REAL,
            timestamp   TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS screening_state (
            session_id  TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
            instrument  TEXT NOT NULL,
            answers     TEXT DEFAULT '{}',
            current_q   INTEGER DEFAULT 0,
            completed   INTEGER DEFAULT 0
        );
    """)
    conn.commit()
    conn.close()


# ── Sessions ──

def create_session(session_id: str, name: str = "Check-In") -> dict:
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO sessions (id, name) VALUES (?, ?)",
        (session_id, name)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row)

def update_session(session_id: str, **kwargs):
    conn = get_db()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [session_id]
    conn.execute(f"UPDATE sessions SET {sets}, updated_at = datetime('now') WHERE id = ?", vals)
    conn.commit()
    conn.close()

def get_session(session_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def list_sessions(limit: int = 50) -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_session(session_id: str):
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


# ── Messages ──

def save_message(session_id: str, role: str, content: str,
                 emotions: dict = None, classification: str = None, confidence: float = None):
    conn = get_db()
    conn.execute(
        """INSERT INTO messages (session_id, role, content, emotions, classification, confidence)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, role, content, json.dumps(emotions) if emotions else None,
         classification, confidence)
    )
    conn.execute(
        "UPDATE sessions SET message_count = message_count + 1, updated_at = datetime('now') WHERE id = ?",
        (session_id,)
    )
    conn.commit()
    conn.close()

def get_messages(session_id: str, limit: int = 50) -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT ?",
        (session_id, limit)
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d["emotions"]:
            d["emotions"] = json.loads(d["emotions"])
        results.append(d)
    return results


# ── Screening ──

def get_screening_state(session_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM screening_state WHERE session_id = ?", (session_id,)).fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["answers"] = json.loads(d["answers"])
        return d
    return None

def upsert_screening_state(session_id: str, instrument: str, answers: dict,
                           current_q: int, completed: bool):
    conn = get_db()
    conn.execute(
        """INSERT INTO screening_state (session_id, instrument, answers, current_q, completed)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
             answers = excluded.answers,
             current_q = excluded.current_q,
             completed = excluded.completed""",
        (session_id, instrument, json.dumps(answers), current_q, int(completed))
    )
    conn.commit()
    conn.close()


# ── Timeline ──

def get_timeline(limit: int = 30) -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        """SELECT id, name, created_at, phq9_score, gad7_score, severity,
                  top_emotions, message_count
           FROM sessions
           WHERE message_count > 0
           ORDER BY created_at DESC LIMIT ?""",
        (limit,)
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d["top_emotions"]:
            d["top_emotions"] = json.loads(d["top_emotions"])
        results.append(d)
    return results


# Init on import
init_db()
