#!/usr/bin/env python3
"""
MindSLM Pipeline API (Port 8080)
=================================
Three-stage pipeline:

  Stage 1: GoEmotions (27 fine-grained emotions) + ensemble fallback
  Stage 2: Conversational PHQ-9/GAD-7 screening (clinically validated)
  Stage 3: Emotion-aware + screening-aware prompt → MindSLM via Ollama

Frontend (5173) → This API (8080) → Ollama (11434)
"""

import os
import json
import time
import requests
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

import database as db
from screening import ScreeningEngine

app = Flask(__name__)
CORS(app)

# ==============================
# CONFIGURATION
# ==============================
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
MODEL_NAME = os.getenv("MODEL_NAME", "mindslm")
MODEL_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
API_PORT   = int(os.getenv("API_PORT", "8080"))

# ==============================
# STAGE 1: GoEmotions CLASSIFIER (primary)
# ==============================
print("\n  Loading GoEmotions classifier...")
try:
    from transformers import pipeline as hf_pipeline
    _emotion_classifier = hf_pipeline(
        "text-classification",
        model="SamLowe/roberta-base-go_emotions",
        top_k=None,
        device=-1   # CPU
    )

    # Map 27 emotions → mental health routing categories
    EMOTION_TO_CATEGORY = {
        # Crisis signals
        "grief": "Suicidal", "remorse": "Depression",
        # Depression cluster
        "sadness": "Depression", "disappointment": "Depression",
        "embarrassment": "Depression",
        # Anxiety cluster
        "fear": "Anxiety", "nervousness": "Anxiety", "confusion": "Anxiety",
        "annoyance": "Anxiety",
        # Positive cluster
        "joy": "Normal", "love": "Normal", "admiration": "Normal",
        "amusement": "Normal", "approval": "Normal", "caring": "Normal",
        "curiosity": "Normal", "desire": "Normal", "excitement": "Normal",
        "gratitude": "Normal", "optimism": "Normal", "pride": "Normal",
        "realization": "Normal", "relief": "Normal", "surprise": "Normal",
        # Negative but not clinical
        "anger": "Anxiety", "disapproval": "Normal", "disgust": "Normal",
    }

    # Weights for routing — some emotions are stronger signals
    EMOTION_WEIGHTS = {
        "sadness": 2.5, "grief": 3.0, "fear": 2.0, "nervousness": 2.0,
        "disappointment": 1.5, "remorse": 2.0, "embarrassment": 1.2,
        "anger": 1.0, "annoyance": 0.8, "confusion": 1.0,
        "joy": 1.5, "love": 1.5, "optimism": 1.5, "gratitude": 1.5,
    }

    GOEMOTIONS_OK = True
    print("  ✅ GoEmotions classifier loaded (27 emotions)")
except Exception as e:
    GOEMOTIONS_OK = False
    print(f"  ⚠️  GoEmotions failed: {e}")


# ==============================
# STAGE 1 FALLBACK: Semantic + TF-IDF
# ==============================
print("  Loading fallback classifiers...")
try:
    from sentence_transformers import SentenceTransformer, util
    _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    _anchors = {
        "Suicidal": [
            "I want to kill myself", "I want to die", "I don't want to live anymore",
            "thinking about ending my life", "suicidal thoughts", "no reason to live",
            "everyone would be better without me", "I want to disappear forever",
        ],
        "Depression": [
            "I feel empty and hopeless", "I can't get out of bed", "nothing makes me happy",
            "I feel worthless", "I've been really depressed", "I feel numb",
            "I don't enjoy anything anymore", "life feels meaningless", "I feel like a burden",
        ],
        "Anxiety": [
            "I can't stop worrying", "I feel anxious and panicked", "my heart is racing",
            "I'm having a panic attack", "I'm overwhelmed with stress", "I can't relax",
            "I can't stop overthinking", "I feel like something bad will happen",
        ],
        "Normal": [
            "I'm doing fine today", "things are going well", "I feel good",
            "just checking in", "I had a good day", "feeling okay",
        ],
    }
    _anchor_embs = {cls: _embedder.encode(p, convert_to_tensor=True) for cls, p in _anchors.items()}
    SEMANTIC_OK = True
    print("  ✅ Semantic fallback loaded")
except Exception:
    SEMANTIC_OK = False
    print("  ⚠️  Semantic fallback unavailable")

tfidf_classifier = None
label_encoder = None
classifier_path = os.path.join(MODEL_DIR, "best_text_model.joblib")
encoder_path = os.path.join(MODEL_DIR, "label_encoder.joblib")
if os.path.exists(classifier_path) and os.path.exists(encoder_path):
    tfidf_classifier = joblib.load(classifier_path)
    label_encoder = joblib.load(encoder_path)
    print("  ✅ TF-IDF fallback loaded")


# ==============================
# CLASSIFY FUNCTION
# ==============================
def classify_message(text: str) -> dict:
    """
    Returns {
        category: str,          # Anxiety|Depression|Suicidal|Normal
        confidence: float,
        emotions: list[dict],   # [{label, score}, ...] top emotions
        scores: dict            # category probabilities
    }
    """
    text = text.strip()
    if not text:
        return {"category": "Normal", "confidence": 0.5, "emotions": [], "scores": {}}

    emotions = []
    category = "Normal"
    confidence = 0.5
    category_scores = {"Anxiety": 0, "Depression": 0, "Normal": 0, "Suicidal": 0}

    if GOEMOTIONS_OK:
        raw = _emotion_classifier(text[:512])[0]  # list of {label, score}
        # Top emotions with score > 0.05
        emotions = [{"label": e["label"], "score": round(e["score"], 4)}
                     for e in sorted(raw, key=lambda x: -x["score"]) if e["score"] > 0.05][:6]

        # Route to category using weighted emotion scores
        for e in raw:
            cat = EMOTION_TO_CATEGORY.get(e["label"], "Normal")
            weight = EMOTION_WEIGHTS.get(e["label"], 1.0)
            category_scores[cat] += e["score"] * weight

        # Normalise
        total = sum(category_scores.values()) or 1
        category_scores = {k: round(v / total, 4) for k, v in category_scores.items()}
        category = max(category_scores, key=category_scores.get)
        confidence = category_scores[category]

    # Suicidal safety net — use semantic similarity as override
    if SEMANTIC_OK:
        emb = _embedder.encode(text, convert_to_tensor=True)
        sui_sims = util.cos_sim(emb, _anchor_embs["Suicidal"])[0]
        if float(sui_sims.max()) >= 0.55:
            category = "Suicidal"
            confidence = max(confidence, round(float(sui_sims.max()), 4))
            category_scores["Suicidal"] = confidence

    # If GoEmotions failed, use semantic + TF-IDF ensemble
    if not GOEMOTIONS_OK:
        if SEMANTIC_OK:
            emb = _embedder.encode(text, convert_to_tensor=True)
            for cls, anchors in _anchor_embs.items():
                sims = util.cos_sim(emb, anchors)[0]
                category_scores[cls] = round(float(sims.max()), 4)
        if tfidf_classifier is not None:
            probs = tfidf_classifier.predict_proba([text])[0]
            for i, cls in enumerate(label_encoder.classes_):
                if cls in category_scores:
                    category_scores[cls] = (category_scores.get(cls, 0) * 0.5) + (float(probs[i]) * 0.5)
        total = sum(category_scores.values()) or 1
        category_scores = {k: round(v / total, 4) for k, v in category_scores.items()}
        category = max(category_scores, key=category_scores.get)
        confidence = category_scores[category]

    return {
        "category": category,
        "confidence": confidence,
        "emotions": emotions,
        "scores": category_scores,
    }


# ==============================
# SYSTEM PROMPTS
# ==============================
SYSTEM_PROMPTS = {
    "Anxiety": (
        "You are a therapist. 2 sentences max. Name their specific symptom, then give one concrete technique.\n"
        "Example: 'That racing heart before your meeting is your body in overdrive. "
        "Try box breathing: inhale 4 counts, hold 4, exhale 4, repeat 3 times.'"
    ),

    "Depression": (
        "You are a therapist. 2 sentences max. Name the specific thing they described, then suggest one small action they can do RIGHT NOW.\n"
        "Example: 'Waking up crying with no sleep is draining. "
        "Get a glass of cold water right now, hold it with both hands, and take 5 slow sips.'"
    ),

    "Suicidal": (
        "You are a crisis counselor. 2 sentences max.\n"
        "Example: 'What you are carrying right now is real and heavy. "
        "Please call or text 988 right now — someone is there to listen.'"
    ),

    "Normal": "You are a friend. 1 sentence reply + 1 follow-up question. No advice.",
}

CRISIS_RESOURCES = """

---
**If you're in crisis, please reach out now:**
- **988 Suicide & Crisis Lifeline** — Call or text **988** (US, 24/7)
- **Crisis Text Line** — Text **HOME** to **741741**
- **iCall (India)** — **9152987821**
- **Vandrevala Foundation (India)** — **1860-2662-345**

*Trained counselors are available right now.*"""


# ==============================
# STAGE 3: RESPONSE GENERATION
# ==============================
def build_messages(user_message: str, category: str, history: list,
                   system_prompt: str) -> list:
    """Build Ollama chat API messages array."""
    messages = [{"role": "system", "content": system_prompt}]

    # Add real conversation history
    for turn in history[-6:]:
        messages.append({"role": turn["role"], "content": turn["content"]})

    messages.append({"role": "user", "content": user_message})
    return messages


def _build_prefill(user_message: str, category: str, emotions: list) -> str:
    """Build a partial assistant response so the model continues from a good start."""
    msg = user_message.lower()

    if category == "Suicidal":
        return "What you're feeling right now is real and heavy."

    if category == "Normal":
        return ""

    # Extract key symptoms from user message to echo back
    symptoms = []
    keyword_map = {
        "sleep": "not sleeping", "waking up": "waking up at night",
        "cry": "crying", "crying": "crying", "empty": "feeling empty",
        "hopeless": "feeling hopeless", "lonely": "feeling lonely",
        "anxious": "the anxiety", "anxiety": "the anxiety",
        "panic": "panic attacks", "heart racing": "your heart racing",
        "breathe": "trouble breathing", "breath": "trouble breathing",
        "chest": "chest tightness", "tired": "exhaustion",
        "motivation": "losing motivation", "bed": "staying in bed",
        "worthless": "feeling worthless", "numb": "feeling numb",
        "worry": "constant worrying", "overwhelm": "being overwhelmed",
    }
    for keyword, description in keyword_map.items():
        if keyword in msg:
            symptoms.append(description)

    if not symptoms:
        return ""

    symptom_text = " and ".join(symptoms[:2])

    if category == "Anxiety":
        return f"The {symptom_text} you're describing"
    else:
        return f"The {symptom_text}"

def generate_response(user_message: str, category: str, history: list,
                      emotions: list, screening_prompt: str = "") -> str:
    system_prompt = SYSTEM_PROMPTS.get(category, SYSTEM_PROMPTS["Normal"])

    # Inject detected emotions into prompt
    if emotions:
        top = ", ".join(e["label"] for e in emotions[:3])
        system_prompt += f"\nDetected emotions: {top}."

    # Inject screening instructions
    if screening_prompt:
        system_prompt += screening_prompt

    messages = build_messages(user_message, category, history, system_prompt)

    # Add prefill to force model to start with user's specific symptoms
    prefill = _build_prefill(user_message, category, emotions)
    if prefill:
        messages.append({"role": "assistant", "content": prefill})

    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.65,
            "top_p": 0.85,
            "top_k": 40,
            "num_predict": 60,
            "repeat_penalty": 1.2,
            "presence_penalty": 0.6,
        }
    }

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=90)
        resp.raise_for_status()
        response_text = resp.json().get("message", {}).get("content", "").strip()

        # Prepend the prefill so the full response reads naturally
        if prefill and not response_text.startswith(prefill):
            response_text = prefill + " " + response_text

        # Cut off fake conversation continuations
        import re
        for marker in ["User:", "MindSLM:", "Therapist:", "Assistant:"]:
            if marker in response_text:
                response_text = response_text[:response_text.index(marker)].strip()

        # Strip AI-ish openers the model keeps generating despite prompts
        ai_openers = [
            r"^I'?m (?:sorry|truly sorry|really sorry) to hear[.,!]?\s*(?:that[.,!]?\s*)?",
            r"^(?:It|That) sounds\b[^.!?]*[.!?]\s*",
            r"^I understand (?:how |that |what )?",
            r"^Thank you for (?:sharing|reaching out|opening up)[.,!]?\s*",
            r"^I appreciate you (?:sharing|opening up|reaching out)[.,!]?\s*",
            r"^That must be (?:really |very |so )?(?:difficult|hard|tough|challenging|overwhelming)[.,!]?\s*",
            r"^I can (?:see|hear|tell|sense|imagine) (?:that |how )",
            r"^First of all,?\s*",
            r"^It'?s (?:completely |totally |perfectly )?(?:normal|okay|natural|valid|understandable)\b[.,!]?\s*(?:to feel |that )?",
            r"^(?:I )?hear you[.,!]?\s*",
            r"^What you'?r?e? (?:feeling|experiencing|going through) is\s",
            r"^I'?m (?:so |really )?(?:glad|happy|pleased)\b[^.!?]*[.!?]\s*",
            r"^Hello!?\s*",
            r"^Hi!?\s*",
            r"^I'?m (?:sorry|truly sorry|really sorry)\b[^.!?]*[.!?]\s*",
        ]
        for pattern in ai_openers:
            new_text = re.sub(pattern, "", response_text, count=1, flags=re.IGNORECASE)
            if new_text != response_text:
                response_text = new_text.strip()
                # Try stripping a second opener if present
                for p2 in ai_openers:
                    new2 = re.sub(p2, "", response_text, count=1, flags=re.IGNORECASE)
                    if new2 != response_text:
                        response_text = new2.strip()
                        break
                break
        if response_text:
            response_text = response_text[0].upper() + response_text[1:]

        # Kill any sentence containing banned filler phrases
        BANNED = [
            "you're not alone", "you are not alone", "you matter",
            "it's okay to", "take it one", "speak with your",
            "seek professional", "talk to a doctor", "see a doctor",
            "primary care", "healthcare provider", "which would explain",
            "not uncommon", "it can be hard when", "it can be helpful",
            "your feelings are valid", "your feelings sound",
            "we all worry", "we all feel", "everyone feels",
            "which is a state", "which are both", "treatable condition",
            "lots of people", "many people", "this is common",
            "this can make it", "stress hormones", "fight or flight",
            "alarm reaction", "chronic anxiety", "as part of",
            "common symptom", "may indicate", "is normal for",
            "this is a sign", "could be a sign", "which may lead",
            "there are a number", "a number of things",
            "mentioned in your post", "you mentioned",
            "talk to your doctor", "talk with your doctor", "talking with your doctor",
            "see your doctor", "speak to your doctor", "consult your doctor",
            "anxiety disorder", "panic attack", "panic disorder",
            "depression disorder", "depressive disorder",
            "very common for", "is very common",
            "the body needs", "function properly", "daily life",
            "imagine yourself", "open meadow", "using this script",
            "isn't just about", "it's also quality",
        ]
        sentences_clean = re.split(r'(?<=[.!?])\s*', response_text)
        sentences_clean = [s for s in sentences_clean if s.strip() and not any(b in s.lower() for b in BANNED)]
        response_text = " ".join(sentences_clean) if sentences_clean else response_text

        # Clean up double spaces / leading punctuation
        response_text = re.sub(r"\s{2,}", " ", response_text).strip()
        response_text = re.sub(r"^[.,;!\s]+", "", response_text).strip()

        # Truncate to max 2 sentences to keep responses concise
        sentences = re.split(r'(?<=[.!?])\s*', response_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) > 2:
            response_text = " ".join(sentences[:2])

        # If filtering stripped too much, add a concrete fallback action
        FALLBACK_ACTIONS = {
            "Anxiety": "Try box breathing right now — inhale 4 counts, hold 4, exhale 4, repeat 3 times.",
            "Depression": "Get a glass of cold water right now, hold it with both hands, and take 5 slow sips.",
        }
        if len(response_text.split()) < 8 and category in FALLBACK_ACTIONS:
            response_text = response_text.rstrip('.! ') + ". " + FALLBACK_ACTIONS[category]

        if category == "Suicidal":
            response_text += CRISIS_RESOURCES
        return response_text
    except requests.exceptions.ConnectionError:
        return "I'm having trouble connecting. Please make sure Ollama is running (`ollama serve`)."
    except requests.exceptions.Timeout:
        return "That took longer than expected. Please try again."
    except requests.exceptions.RequestException as e:
        return f"Something went wrong: {str(e)}"


# ==============================
# API ENDPOINTS
# ==============================
@app.route("/api/chat", methods=["POST"])
def chat():
    """Full pipeline: Emotions → Classify → Screen → Generate → Safety"""
    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    session_id   = data.get("session_id", "default")

    if not user_message:
        return jsonify({"error": "Empty message"}), 400
    if len(user_message) > 3000:
        return jsonify({"error": "Message too long"}), 400

    start_time = time.time()

    # Ensure session exists
    db.create_session(session_id)

    # ── Stage 1: Emotion classification ──
    result = classify_message(user_message)
    category   = result["category"]
    confidence = result["confidence"]
    emotions   = result["emotions"]
    scores     = result["scores"]
    is_crisis  = category == "Suicidal"

    # ── Stage 2: Screening ──
    screener = ScreeningEngine(session_id)
    screening_info = {}

    # Check if screening should start
    session_data = db.get_session(session_id)
    msg_count = session_data["message_count"] if session_data else 0

    if screener.active:
        # Record answer to current screening question
        screening_info = screener.record_answer(user_message)
    else:
        should_start = screener.should_start(category, msg_count)
        if should_start:
            screener.start(should_start)

    # Get screening prompt injection
    screening_prompt = screener.get_prompt_injection()

    # Get conversation history from DB
    messages = db.get_messages(session_id, limit=12)
    history = [{"role": m["role"], "content": m["content"]} for m in messages]

    # ── Stage 3: Generate ──
    response = generate_response(user_message, category, history, emotions, screening_prompt)

    # ── Persist ──
    db.save_message(session_id, "user", user_message,
                    emotions={e["label"]: e["score"] for e in emotions},
                    classification=category, confidence=confidence)
    db.save_message(session_id, "assistant", response)

    # Update session top emotions
    if emotions:
        db.update_session(session_id,
                          top_emotions=json.dumps([e["label"] for e in emotions[:3]]))

    elapsed = round(time.time() - start_time, 2)

    # Screening progress
    answered, total = screener.progress
    screening_response = {
        "active": screener.active,
        "completed": screener.completed,
        "instrument": screener.instrument,
        "progress": {"answered": answered, "total": total},
    }
    if screening_info.get("completed"):
        screening_response["final_score"] = screening_info["final_score"]
        screening_response["severity"] = screening_info["severity"]

    return jsonify({
        "response":        response,
        "classification":  category,
        "confidence":      confidence,
        "emotions":        emotions,
        "scores":          scores,
        "is_crisis":       is_crisis,
        "screening":       screening_response,
        "latency_seconds": elapsed,
        "model":           MODEL_NAME,
        "pipeline":        "GoEmotions → Screen → Generate → Safety",
    })


@app.route("/api/classify", methods=["POST"])
def classify_only():
    data = request.get_json(silent=True) or {}
    text = data.get("message", "").strip()
    if not text:
        return jsonify({"error": "Empty message"}), 400
    result = classify_message(text)
    return jsonify({
        "classification": result["category"],
        "confidence":     result["confidence"],
        "emotions":       result["emotions"],
        "scores":         result["scores"],
        "is_crisis":      result["category"] == "Suicidal",
    })


@app.route("/api/sessions", methods=["GET"])
def list_sessions():
    return jsonify(db.list_sessions())


@app.route("/api/sessions/<session_id>", methods=["GET"])
def get_session_detail(session_id):
    session = db.get_session(session_id)
    if not session:
        return jsonify({"error": "Not found"}), 404
    session["messages"] = db.get_messages(session_id)
    session["screening"] = db.get_screening_state(session_id)
    return jsonify(session)


@app.route("/api/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    db.delete_session(session_id)
    return jsonify({"deleted": session_id})


@app.route("/api/timeline", methods=["GET"])
def timeline():
    return jsonify(db.get_timeline())


@app.route("/api/health", methods=["GET"])
def health():
    ollama_ok = False
    model_found = False
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=5)
        models = [m["name"] for m in r.json().get("models", [])]
        ollama_ok = True
        model_found = any(MODEL_NAME in m for m in models)
    except Exception:
        pass

    classifier_type = "GoEmotions (27 emotions)" if GOEMOTIONS_OK else "Semantic+TF-IDF"

    return jsonify({
        "status":     "ok" if (ollama_ok and model_found) else "degraded",
        "classifier": classifier_type,
        "ollama":     "connected" if ollama_ok else "disconnected",
        "model":      MODEL_NAME if model_found else "not found",
        "screening":  "PHQ-9 / GAD-7 enabled",
        "pipeline":   "GoEmotions → PHQ-9/GAD-7 → MindSLM → Safety",
    })


# ==============================
# START
# ==============================
if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║           MindSLM Pipeline API · Port {API_PORT}                  ║
╠══════════════════════════════════════════════════════════════╣
║  Pipeline:                                                   ║
║    → [Stage 1] GoEmotions (27 fine-grained emotions)         ║
║    → [Stage 2] Conversational PHQ-9 / GAD-7 screening        ║
║    → [Stage 3] Emotion-aware MindSLM via Ollama              ║
║    → [Safety]  Crisis detection + resource injection         ║
║                                                              ║
║  Endpoints:                                                  ║
║    POST /api/chat              Full pipeline                 ║
║    POST /api/classify          Classify only                 ║
║    GET  /api/sessions          List sessions                 ║
║    GET  /api/sessions/:id      Session detail + messages     ║
║    DELETE /api/sessions/:id    Delete session                ║
║    GET  /api/timeline          Severity timeline             ║
║    GET  /api/health            System status                 ║
╚══════════════════════════════════════════════════════════════╝
""")

    # Ollama check
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=3)
        models = [m["name"] for m in r.json().get("models", [])]
        if any(MODEL_NAME in m for m in models):
            print(f"  ✅ Ollama: '{MODEL_NAME}' ready")
        else:
            print(f"  ⚠️  Ollama running but '{MODEL_NAME}' not found → {models}")
    except Exception:
        print("  ⚠️  Ollama not reachable — run: ollama serve")

    # Classifier smoke test
    test_msg = "I've been feeling really hopeless and empty lately"
    result = classify_message(test_msg)
    top_emo = ", ".join(e["label"] for e in result["emotions"][:3]) if result["emotions"] else "N/A"
    print(f"  ✅ Classifier test: '{test_msg}'")
    print(f"     → {result['category']} ({result['confidence']:.0%}) | emotions: {top_emo}")

    print(f"\n  🚀 Starting on http://localhost:{API_PORT}\n")
    app.run(host="0.0.0.0", port=API_PORT, debug=True)
