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
from dotenv import load_dotenv
load_dotenv(override=True)
import joblib
import numpy as np
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

import database as db
from screening import ScreeningEngine
from rag import retrieve_examples
from memory import store_message, retrieve_memories, format_memory_context

app = Flask(__name__)
CORS(app)

# ==============================
# CONFIGURATION
# ==============================
OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
MODEL_NAME   = os.getenv("MODEL_NAME", "mindslm-14b")
MODEL_DIR    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
API_PORT     = int(os.getenv("API_PORT", "8080"))
GEMINI_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"

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
        "annoyance": "Normal",
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
        "Abuse": [
            "he touched me without consent", "bad touch", "touched me inappropriately",
            "sexual harassment", "sexual assault", "groped me", "molested me",
            "touched me where I didn't want", "forced himself on me", "forced herself on me",
            "non-consensual touching", "without my consent", "without my permission",
            "he abused me", "she abused me", "they abused me", "physically abused",
            "emotionally abused", "domestic violence", "he hit me", "she hit me",
            "I was raped", "rape", "he forced me", "inappropriate touching",
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
    category_scores = {"Anxiety": 0, "Depression": 0, "Normal": 0, "Suicidal": 0, "Abuse": 0}

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

    # Abuse safety net — non-consensual touch, assault, domestic violence
    if SEMANTIC_OK:
        abuse_sims = util.cos_sim(emb, _anchor_embs["Abuse"])[0]
        if float(abuse_sims.max()) >= 0.48:
            category = "Abuse"
            confidence = max(confidence, round(float(abuse_sims.max()), 4))
            category_scores["Abuse"] = confidence

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
        "You are a therapist. EXACTLY 2 sentences. You MUST respond to the specific situation the user described.\n"
        "Sentence 1: Name the EXACT trigger or situation they mentioned — use their words (person's name, event, place). NEVER say 'anxiety' or 'stress' generically.\n"
        "Sentence 2: Give ONE action that applies DIRECTLY to their specific situation. BANNED: breathing exercises, 'take a breath', 'slow breaths', grounding exercises. Instead give something that addresses what they actually said.\n"
        "Good (person conflict): 'Dealing with Rahul all morning when he won't stop is genuinely exhausting. Step away for 5 minutes — put headphones on, close a door, anything to create distance right now.'\n"
        "Good (work pressure): 'That deadline sitting over everything makes it impossible to think clearly. Write down just the one thing that has to happen today and ignore the rest until it is done.'\n"
        "Bad: 'That anxiety you are carrying is real. Try taking three slow breaths.' — this is too generic, never do this."
    ),

    "Depression": (
        "You are a therapist. EXACTLY 2 sentences. DO NOT explain depression. DO NOT say 'it's common'. DO NOT use 'we'.\n"
        "Sentence 1: Mirror back the SPECIFIC thing they said — use their exact words or situation. Not a general statement about depression.\n"
        "Sentence 2: Give ONE tiny physical action tied to their specific situation that they can do in the next 30 seconds.\n"
        "Good: 'Not being able to get out of bed even when you want to is one of the cruelest parts of this. Plant both feet on the floor right now — that is the whole task, nothing else.'\n"
        "Bad: 'It is common to feel low. We are sorry you are feeling this way.'"
    ),

    "Suicidal": (
        "You are a crisis counselor. EXACTLY 2 sentences. You MUST reference the specific words the user used — do not give a generic response.\n"
        "Sentence 1: Acknowledge their exact statement directly. Name what they said. Make clear you heard them and are taking it seriously. Do NOT say 'what you are carrying' or 'what you are feeling'.\n"
        "Sentence 2: Tell them to call iCall at 9152987821 RIGHT NOW. Be direct and urgent, not soft.\n"
        "Good: 'You just said you want to kill yourself — I hear you and I am not going to brush past that. Please do not be alone with this right now.'\n"
        "Good: 'Saying you will kill yourself is the most important thing you could have told me today — I am glad you said it out loud.'\n"
        "Bad: 'What you are carrying right now is real and heavy. Please call iCall.' — this ignores what they actually said.\n"
        "Bad: Any response that does not directly reference that they said they want to kill themselves."
    ),

    "Abuse": (
        "You are a trauma-informed support specialist. EXACTLY 2 sentences. No softening, no minimising.\n"
        "Sentence 1: Name what happened clearly — touching or harming someone without consent is not okay. Use the word 'not okay' or 'wrong'. Make clear this is NOT their fault.\n"
        "Sentence 2: Direct them to a specific support line immediately. Do NOT say 'stay safe', 'take care', or 'talk to a trusted friend'.\n"
        "Good: 'What happened to you is not okay — touching someone without consent is assault, and this is not your fault. "
        "Please call the One Stop Crisis Centre at 181 or iCall at 9152987821 right now — trained counselors are available.'\n"
        "Bad: 'It is important to stay safe. You should talk to someone you trust.'"
    ),

    "Normal": (
        "You are a friend responding to exactly what they said. 1 sentence reply that references their specific situation + 1 follow-up question.\n"
        "NEVER give advice. NEVER say 'I understand' or 'that sounds'. Just react naturally to what they said.\n"
        "Good: 'Rahul sounds like a lot to deal with on a Monday morning — what did he do this time?'\n"
        "Bad: 'I understand that can be frustrating. How are you feeling about it?'"
    ),
}

CRISIS_RESOURCES = "\n\nCall iCall right now: **9152987821** (free, Mon–Sat 8am–10pm) · Emergency: **112**"

ABUSE_RESOURCES = "\n\nOne Stop Crisis Centre: **181** (24/7, free) · Police: **100** · Emergency: **112**"


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
        # Build a prefill that directly acknowledges their specific words
        if any(w in msg for w in ["kill myself", "end my life", "want to die", "don't want to live", "kill my self"]):
            return "You just told me you want to kill yourself — I hear you, and I'm not going to brush past that."
        if any(w in msg for w in ["disappear", "disappear forever", "everyone better without"]):
            return "You saying you want to disappear — I'm taking that seriously."
        if any(w in msg for w in ["suicide", "suicidal"]):
            return "You're telling me you're having thoughts of suicide — I hear you."
        return "What you just shared is serious and I'm not going to ignore it."

    if category == "Abuse":
        return "What happened to you is not okay — this is not your fault."

    if category == "Normal":
        return ""

    # Extract key symptoms from user message to echo back
    # All descriptions must work as noun phrases after "That ... you're carrying right now is real."
    symptoms = []
    keyword_map = {
        "sleep": "sleeplessness",
        "waking up": "waking in the night",
        "cry": "need to cry",
        "crying": "urge to cry",
        "empty": "emptiness",
        "hopeless": "hopelessness",
        "lonely": "loneliness",
        "anxious": "anxiety",
        "anxiety": "anxiety",
        "panic": "panic",
        "heart racing": "racing heart",
        "breathe": "trouble breathing",
        "breath": "trouble breathing",
        "chest": "chest tightness",
        "tired": "exhaustion",
        "motivation": "loss of motivation",
        "bed": "exhaustion",
        "worthless": "worthlessness",
        "numb": "numbness",
        "worry": "worry",
        "overwhelm": "overwhelm",
        "low": "heaviness",
        "down": "low mood",
        "sad": "sadness",
        "depressed": "heaviness",
        "dark": "dark thoughts",
        "stuck": "stuck feeling",
        "lost": "lost feeling",
        "alone": "loneliness",
        "stressed": "stress",
        "stress": "stress",
        "angry": "anger",
        "anger": "anger",
        "scared": "fear",
        "fear": "fear",
        "shame": "shame",
        "guilt": "guilt",
        "point": "hopelessness",
        "disconnect": "disconnection",
        "numb": "numbness",
        "isolat": "isolation",
        "drain": "exhaustion",
    }
    for keyword, description in keyword_map.items():
        if keyword in msg:
            symptoms.append(description)

    if not symptoms:
        # No specific keywords found — let the model generate its own specific opener
        # rather than forcing a generic prefill that leads to generic responses
        return ""

    symptom_text = symptoms[0]
    return f"That {symptom_text} you're carrying right now is real."


def _generate_via_gemini(messages: list, category: str, prefill: str) -> str:
    """Call Google Gemini as a fallback when Ollama is unavailable.
    Converts Ollama-style messages array to Gemini generateContent format.
    Applies the same post-processing as the Ollama path.
    """
    import re

    system_parts = [m["content"] for m in messages if m["role"] == "system"]
    turns = [m for m in messages if m["role"] in ("user", "assistant")]

    gemini_contents = []
    for t in turns:
        role = "model" if t["role"] == "assistant" else "user"
        gemini_contents.append({"role": role, "parts": [{"text": t["content"]}]})

    payload = {
        "system_instruction": {"parts": [{"text": "\n\n".join(system_parts)}]},
        "contents": gemini_contents,
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.9,
            "maxOutputTokens": 150,
        }
    }

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
    )
    try:
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        candidates = resp.json().get("candidates", [])
        if not candidates:
            return "I'm having difficulty generating a response right now. Please try again."
        response_text = candidates[0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        print(f"  ⚠️  Gemini fallback also failed: {e}")
        return "I'm having difficulty connecting right now. Please try again shortly."

    # Prepend prefill
    if prefill and not response_text.startswith(prefill):
        response_text = prefill + " " + response_text

    # Strip fake conversation markers
    for marker in ["User:", "MindSLM:", "Therapist:", "Assistant:"]:
        if marker in response_text:
            response_text = response_text[:response_text.index(marker)].strip()

    # Truncate to 2 sentences
    sentences = re.split(r'(?<=[.!?])\s*', response_text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) > 2:
        response_text = " ".join(sentences[:2])

    if category == "Suicidal":
        response_text += CRISIS_RESOURCES
    if category == "Abuse":
        response_text += ABUSE_RESOURCES

    print(f"  ✅ Gemini fallback used for category: {category}")
    return response_text


def generate_response(user_message: str, category: str, history: list,
                      emotions: list, screening_prompt: str = "",
                      session_id: str = "default") -> str:
    system_prompt = SYSTEM_PROMPTS.get(category, SYSTEM_PROMPTS["Normal"])

    # Inject detected emotions into prompt
    if emotions:
        top = ", ".join(e["label"] for e in emotions[:3])
        system_prompt += f"\nDetected emotions: {top}."

    # ── RAG: inject real therapist examples ──
    rag_examples = retrieve_examples(user_message, category=category, n=3)
    if rag_examples:
        examples_text = "\n".join(f"- {ex}" for ex in rag_examples)
        system_prompt += f"\n\nReal therapist responses for similar situations (match this tone and specificity):\n{examples_text}"

    # ── Memory: inject relevant past user disclosures ──
    memories = retrieve_memories(
        user_id="default",
        current_message=user_message,
        exclude_session=session_id,
        n=3
    )
    memory_context = format_memory_context(memories)
    if memory_context:
        system_prompt += memory_context

    # ── Global User Profile (Behavioral Patterns) ──
    profile = db.get_user_profile("default")
    if profile and profile.get("situational_context") and profile.get("behavioral_patterns"):
        system_prompt += f"\n\nGlobal User Context:\nSituation: {profile['situational_context']}\nBehavioral Patterns: {profile['behavioral_patterns']}\nKeep this broad context in mind, but always respond directly to their current message."

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
            "temperature": 0.7,
            "top_p": 0.9,
            "top_k": 40,
            "num_predict": 120,
            "repeat_penalty": 1.1,
        }
    }

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=90)
        resp.raise_for_status()
        raw_json = resp.json()
        # If Ollama returns an error field (e.g. model not found), fall through to Gemini
        if raw_json.get("error"):
            raise requests.exceptions.ConnectionError(raw_json["error"])
        response_text = raw_json.get("message", {}).get("content", "").strip()

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
            r"^I'?m (?:sorry|truly sorry|really sorry)\b[^.!?]*[.!?]\s*",
            r"^We(?:'?re| are) (?:sorry|truly sorry|really sorry)\b[^.!?]*[.!?]\s*",
            r"^We(?:'?re| are) here (?:to help|for you)\b[^.!?]*[.!?]\s*",
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
            "what you are carrying right now is real and heavy",
            "what you're carrying right now is real and heavy",
            "take three slow breaths", "take a slow breath", "take three breaths",
            "slow breaths in through your nose", "breathe in through your nose",
            "sit with your feet on the floor, hands resting",
            "box breathing", "inhale 4 counts",
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
            "very common for", "is very common", "it's common", "it is common",
            "common to feel", "normal to feel", "natural to feel",
            "can make it hard", "can make it difficult",
            "result from", "often result", "can result",
            "life event", "recent event",
            "can be caused by", "caused by a variety", "variety of factors",
            "fills your cup", "fill your cup", "what fills",
            "one way to approach", "one approach",
            "look at what would help", "what would help you feel",
            "in order to", "in a way that",
            "the body needs", "function properly", "daily life",
            "imagine yourself", "open meadow", "using this script",
            "isn't just about", "it's also quality",
            "world is filled", "things to enjoy", "appreciate",
            "focus on the negative", "focus on the positive",
            "silver lining", "bright side", "there is always",
            "count your blessings", "things could be worse",
            "so many good things", "good things in life",
            "remember the good", "think positive", "stay positive",
            "it gets better", "everything will be okay",
            "things will improve", "tomorrow is another day",
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
        if category == "Abuse":
            response_text += ABUSE_RESOURCES
        return response_text

    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
        # Ollama unavailable — try Gemini fallback
        if GEMINI_KEY:
            print(f"  ⚠️  Ollama unavailable ({e}), falling back to Gemini...")
            return _generate_via_gemini(messages, category, prefill)
        return "I'm having trouble connecting. Please make sure Ollama is running (`ollama serve`)."

    except requests.exceptions.RequestException as e:
        if GEMINI_KEY:
            print(f"  ⚠️  Ollama error ({e}), falling back to Gemini...")
            return _generate_via_gemini(messages, category, prefill)
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
    response = generate_response(user_message, category, history, emotions,
                                 screening_prompt, session_id=session_id)

    # ── Persist ──
    store_message(session_id, "default", user_message)  # store in memory for future sessions
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


@app.route("/api/heatmap", methods=["GET"])
def heatmap():
    """Return real session activity aggregated by day-of-week × 3-hour bucket.
    Also returns summary stats computed from actual data.
    """
    import sqlite3
    from collections import defaultdict

    conn = db.get_db()

    # Pull all sessions that have at least one message
    rows = conn.execute(
        "SELECT id, created_at, phq9_score, gad7_score, severity, message_count FROM sessions WHERE message_count > 0"
    ).fetchall()
    conn.close()

    sessions = [dict(r) for r in rows]

    # Day labels (0=Mon … 6=Sun in Python's weekday())
    DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    HOUR_BUCKETS = [0, 3, 6, 9, 12, 15, 18, 21]  # start of each 3-h bucket

    # grid[day_idx][bucket_idx] = count
    grid = defaultdict(lambda: defaultdict(int))

    total_sessions = len(sessions)
    severe_count = 0
    phq9_scores = []

    for s in sessions:
        # Parse timestamp
        ts_str = s.get("created_at", "")
        try:
            from datetime import datetime as dt
            # SQLite stores as "YYYY-MM-DD HH:MM:SS"
            ts = dt.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
        except Exception:
            continue

        day_idx = ts.weekday()  # 0=Mon
        hour = ts.hour
        # Map to nearest lower bucket
        bucket_idx = max(i for i, b in enumerate(HOUR_BUCKETS) if b <= hour)
        grid[day_idx][bucket_idx] += 1

        if s.get("severity") in ("severe", "moderately severe"):
            severe_count += 1
        if s.get("phq9_score") is not None:
            phq9_scores.append(s["phq9_score"])

    # Build the structured response mirroring the heatmap shape
    heatmap_data = []
    for day_idx, day_label in enumerate(DAY_LABELS):
        day_row = []
        for bucket_idx, bucket_hour in enumerate(HOUR_BUCKETS):
            day_row.append({
                "key": f"{bucket_hour:02d}h",
                "data": grid[day_idx][bucket_idx]
            })
        heatmap_data.append({"key": day_label, "data": day_row})

    avg_phq9 = round(sum(phq9_scores) / len(phq9_scores), 1) if phq9_scores else None

    return jsonify({
        "heatmap": heatmap_data,
        "stats": {
            "total_sessions": total_sessions,
            "severe_count": severe_count,
            "avg_phq9": avg_phq9,
        }
    })


@app.route("/api/user/profile", methods=["GET"])
def get_user_profile_api():
    """Extracts and returns the user's situational context and behavioral patterns."""
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    
    profile = db.get_user_profile("default")
    if profile and not force_refresh:
        return jsonify(profile)

    messages = db.get_recent_user_messages("default", limit=50)
    if not messages:
        return jsonify({
            "situational_context": "No sufficient data yet to determine a situation.",
            "behavioral_patterns": "No sufficient data yet to determine patterns."
        })
        
    history_text = "\n".join([f"- {m['content']}" for m in messages])
    
    prompt = f"""You are a clinical assistant analyzing a user's chat history across multiple sessions.
Read the user's messages and extract their overarching situation and behavioral patterns.
Be concise and clinical. Format your response exactly as two parts separated by '|||'. Do not include markdown headers.
Example output format:
User is currently dealing with high stress at work due to an overbearing boss. They are feeling overwhelmed.
|||
User tends to isolate themselves when stressed. They frequently mention sleep disturbances and negative self-talk.

User Messages:
{history_text}
"""
    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {
            "temperature": 0.2,
            "top_p": 0.9,
            "num_predict": 200
        }
    }
    
    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=60)
        resp.raise_for_status()
        output = resp.json().get("message", {}).get("content", "").strip()
        parts = output.split("|||")
        if len(parts) >= 2:
            sit_context = parts[0].strip()
            beh_patterns = parts[1].strip()
            db.upsert_user_profile("default", sit_context, beh_patterns)
            return jsonify({"situational_context": sit_context, "behavioral_patterns": beh_patterns})
        else:
            # Fallback if model fails to format
            db.upsert_user_profile("default", output, "Behavioral analysis integrated above.")
            return jsonify({"situational_context": output, "behavioral_patterns": "Behavioral analysis integrated above."})
    except Exception as e:
        print(f"Profile generation via Ollama failed: {e}. Trying Gemini...")
        # Gemini fallback for profile generation
        if GEMINI_KEY:
            try:
                gem_payload = {
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 300}
                }
                gem_url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
                )
                gr = requests.post(gem_url, json=gem_payload, timeout=30)
                gr.raise_for_status()
                output = gr.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                parts = output.split("|||")
                if len(parts) >= 2:
                    sit_context = parts[0].strip()
                    beh_patterns = parts[1].strip()
                else:
                    sit_context = output
                    beh_patterns = "Behavioral analysis integrated above."
                db.upsert_user_profile("default", sit_context, beh_patterns)
                return jsonify({"situational_context": sit_context, "behavioral_patterns": beh_patterns})
            except Exception as gem_e:
                print(f"Gemini profile generation also failed: {gem_e}")

        return jsonify({
            "situational_context": "Analysis temporarily unavailable.",
            "behavioral_patterns": "Analysis temporarily unavailable."
        })


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
# TTS PROXY
# ==============================
ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # Sarah - Mature, Reassuring, Confident

@app.route("/api/speak", methods=["POST"])
def speak():
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400
    if not elevenlabs_key:
        return jsonify({"error": "ELEVENLABS_API_KEY not configured"}), 500

    try:
        r = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
            headers={
                "xi-api-key": elevenlabs_key,
                "Content-Type": "application/json",
            },
            json={"text": text, "model_id": "eleven_multilingual_v2"},
            timeout=20,
        )
        if r.status_code != 200:
            print(f"[DEBUG] ElevenLabs response {r.status_code}: {r.text[:300]}")
            return jsonify({"error": f"ElevenLabs error {r.status_code}"}), 502

        audio_bytes = r.content
        return Response(audio_bytes, content_type="audio/mpeg")
    except Exception as e:
        return jsonify({"error": str(e)}), 502


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
