# MindSLM — Project Context & Upgrade Plan

---

## 🔴 TOP PRIORITY: Response Quality

**The single most important thing to fix right now is response quality.**
The model currently generates generic, educational responses instead of empathetic, specific ones.
This is the core product problem. Everything else (frontend, RAG, memory) is secondary until this is solved.

### Root Causes (diagnosed 2026-04-26)

**1. RAG is actively making responses worse**
- Counsel Chat dataset is Q&A forum posts, not conversational therapy
- Responses retrieved are educational ("common symptoms of depression", "keeping a log", blog links)
- Injecting these examples teaches the model to respond the same way
- **Fix applied:** quality filter + cosine distance threshold (< 0.45) — effectively disables RAG until better data exists
- **Permanent fix needed:** replace Counsel Chat with a curated dataset of 50–100 ideal short empathetic responses

**2. Training data taught the model to explain, not empathise**
- `step2_format_dataset.py` system prompt included: "explain briefly why it helps"
- Counsel Chat training examples are 3-paragraph forum answers, not 2-sentence empathetic replies
- Model learned psychoeducation style: "anxiety is part of the fight-or-flight response..." 
- **Fix needed:** filter `response_dataset_v2.csv` to keep only responses < 60 words that don't contain educational phrases, retrain

**3. 7B model has weak instruction following**
- val loss plateaued at step 300 → model only partially absorbed training style
- ~1200 training examples not enough to override Qwen base defaults
- Base Qwen 7B reverts to its pre-training style when uncertain
- **Fix needed:** test qwen2.5:14b base immediately — 14B follows instructions significantly better

**4. Training and inference system prompts were mismatched**
- Training prompt: "acknowledge, offer technique, explain why it helps"
- Inference prompt: "2 sentences max, name the specific thing, suggest one small action"
- Model was never trained to match what the inference prompt asks for

### The Fix Plan (in priority order)

#### Step 1 — Test qwen2.5:14b base (15 minutes, do this first)
```bash
MODEL_NAME=qwen2.5:14b python3 mindslm_pipeline_api.py
```
Send "i am feeling low" and compare to mindslm-7b output.
If 14B base is already better → confirms the 7B is the bottleneck, not the prompts.

#### Step 2A — If 14B base is better: MLX fine-tune 14B locally
- Install MLX: `pip install mlx-lm`
- Filter training data first (see Step 3)
- Fine-tune Qwen2.5-14B-Instruct with MLX on filtered dataset
- Quantize to Q4_K_M (~8.5GB) → fits on 18GB M3 Pro with room to spare
- This is the target architecture: fine-tuned 14B + curated RAG

#### Step 2B — If 14B base is not better: retrain 7B on Kaggle with filtered data
- Filter dataset, fix system prompt, retrain
- Use as interim while MLX 14B training runs

#### Step 3 — Filter training data (do before any retraining)
Edit `step2_format_dataset.py`:
- Keep only responses where `len(response.split()) < 60`
- Remove responses containing: "common", "symptom", "disorder", "diagnos", "fight or flight", "it is normal", "many people", "it is important to", "you may want to", "I would suggest", "I recommend"
- Remove the "explain briefly why it helps" line from SYSTEM_PROMPTS
- Change system prompt to: "Name the specific thing they said. Suggest one small action right now. 2 sentences max. No explanations."
- Expected: filters ~60% of Counsel Chat responses, keeps ~400–500 high-quality short ones
- Retrain on Kaggle (same setup: Qwen2.5-7B or 14B, QLoRA r=16 alpha=32, 3 epochs)

#### Step 4 — Build curated RAG dataset (50–100 hand-crafted ideal responses)
Create `curated_rag.jsonl` with entries like:
```json
{"user": "i am feeling low", "category": "Depression", "response": "That heavy, low feeling can make everything feel pointless. Put both feet flat on the floor right now and take one slow breath."}
{"user": "i feel really anxious", "category": "Anxiety", "response": "The anxiety you're describing is real. Try box breathing right now — inhale 4 counts, hold 4, exhale 4, repeat twice."}
```
Then rebuild ChromaDB with these as primary source + Counsel Chat as fallback.
Even 50 high-quality examples will outperform 2,400 mediocre Counsel Chat entries.

### What a good response looks like
**Bad (current):** "We are sorry you are feeling this way. The world is filled with so many things to enjoy and appreciate but it's easy for us to focus on the negative."
**Bad (current):** "Anxiety is a normal response to stress. It's part of the fight-or-flight system which prepares us for danger."
**Good (target):** "That low and heavy feeling you're carrying right now is real. Put both feet flat on the floor and take one slow breath."
**Good (target):** "The anxiety you're feeling before meetings is your body in overdrive. Try box breathing right now — 4 counts in, hold 4, out 4."

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: GoEmotions (27 emotions) | DONE | Replaced 4-class TF-IDF with GoEmotions + semantic safety net |
| Phase 2: PHQ-9/GAD-7 screening | DONE | screening.py — conversational state machine, auto-triggers |
| Phase 3: SQLite persistence | DONE | database.py — sessions, messages, screening state |
| Phase 4: Frontend (emotions + screening + timeline) | DONE | Emotion tags, screening badge, mood timeline modal (vanilla JS) |
| Phase 5: QLoRA 7B fine-tune + export | DONE | Qwen2.5-7B-Instruct, r=8 alpha=16, Kaggle T4x2. Best checkpoint step 300 (val loss 1.6526). Merged → F16 GGUF (14GB) → Q4_K_M (4.4GB) → mindslm-7b:latest in Ollama. 14B attempted but OOM during training. |
| Phase 6: Evaluation / ablation | PARTIAL | Track 3 (classifier comparison) done; Tracks 1-2 need GEMINI_API_KEY (quota exhausted) |
| Phase 7: RAG pipeline | DONE | rag.py with ChromaDB, Counsel Chat therapist responses embedded with MiniLM |
| Phase 8: Conversation Memory | DONE | memory.py — per-session user message embedding + retrieval via ChromaDB |
| Phase 9: React Frontend Rebuild | DONE | React + Vite, Apple-inspired dark theme (#000 bg, #30d158 green accent, #f5f5f7 text). All inline styles (Tailwind v4 dropped — arbitrary opacity syntax broken). Pages: Landing, Login, Register, Dashboard, Chat, Exercises, Insights. |
| Phase 10: CBT Interactive Exercises | DONE | Box breathing (4-4-4-2 animated circle) + 5-4-3-2-1 grounding (multi-step with progress bar). Both in Exercises.jsx. |
| Phase 11: Voice Input (Whisper) | TODO | Local STT via whisper.cpp on M3 Pro |
| Phase 12: Severity Escalation Alerts | TODO | PHQ-9 trend monitoring across sessions → crisis alert |
| Phase 13: Confidence-Blended Prompts | TODO | Blend category prompts when classifier is uncertain |
| Phase 14: 14B MLX Fine-tune | DONE | QLoRA r=16 alpha=32, 600 steps on filtered dataset. Val loss 0.453 (vs 7B plateau 1.6526). Fused → F16 GGUF (28GB) → Q4_K_M (8.4GB) → mindslm-14b:latest in Ollama. API default updated. |
| Phase 15: Evaluation (updated) | TODO | Re-run with 14B + RAG, fill paper results table |

---

## What MindSLM Is

A local-first mental health screening and support system. Runs entirely on-device. Uses fine-grained emotion detection (27 emotions via GoEmotions), conducts clinically validated PHQ-9/GAD-7 screenings through natural conversation, retrieves real therapist responses via RAG, and generates therapeutically-informed responses via Qwen2.5-14B-Instruct — all served locally through Ollama. Full conversation memory across sessions. No cloud, no tracking.

---

## Current State (what exists and works)

- `mindslm-7b` Ollama model: Qwen2.5-7B fine-tuned via QLoRA, Q4_K_M quantized (4.4GB). Best checkpoint step 300, val loss 1.6526. Registered as mindslm-7b:latest.
- `mindslm` Ollama model: old Qwen2.5-1.5B (still present, 3.1GB — kept for comparison)
- GoEmotions 27-class emotion classifier (SamLowe/roberta-base-go_emotions)
- TF-IDF + LogReg classifier (safety net for suicidal keywords)
- PHQ-9/GAD-7 conversational state machine (screening.py)
- SQLite persistence (database.py) — sessions, messages, screening state
- RAG: rag.py with ChromaDB over Counsel Chat therapist responses
- Memory: memory.py — per-session user message embedding + retrieval
- React frontend: dark theme, all pages built, exercises implemented
- API server: mindslm_pipeline_api.py on port 8080, default model = mindslm-7b
- Training pipeline: step1–step5 scripts
- llama.cpp installed (homebrew, version 8920) — used for GGUF conversion

### Key files
- `mindslm-7b-q4km.gguf` — 4.4GB quantized model (production)
- `mindslm-7b-f16.gguf` — 14GB F16 GGUF (intermediate, can delete to save space)
- `mindslm-7b-merged/` — 14.2GB HF safetensors (source for re-conversion if needed)
- `mindslm-7b-lora/` — 77MB LoRA adapter weights (checkpoint-300 is best)
- `Modelfile-7b` — Ollama model definition pointing to mindslm-7b-q4km.gguf
- `frontend-react/` — React + Vite app (dev server on port 5173+)
- `llama.cpp/` — cloned repo with convert_hf_to_gguf.py (needed for future re-quantization)

### Known issues / response quality
- 7B model defaults to educational/generic responses despite system prompt (val loss plateau at step 300 means it didn't fully absorb training style)
- Responses use "We are sorry" (training data had group/clinic voices) — now stripped by ai_openers filter
- "It's common to feel..." and "world is filled with things to enjoy" type phrases — now blocked by BANNED list
- Prefill now injects complete empathetic first sentence e.g. "That low and heavy feeling you're carrying right now is real." so model only adds action sentence
- Crisis response (Suicidal classification) handled separately in pipeline — always appends 988 resources

### Python environment note
- Python 3.14 (homebrew) — protobuf must be >=5.0 for chromadb/opentelemetry to work
- protobuf 4.25.9 was accidentally installed during llama.cpp conversion — upgraded back to 6.33.6
- gguf Python package (0.18.0) installed but NOT used for conversion — use `PYTHONPATH=llama.cpp/gguf-py` with cloned repo instead

### 7B vs 14B — resolved
- **mindslm-14b is now the production model** (registered in Ollama, API default updated)
- Val loss 0.453 vs 7B plateau 1.6526 — significantly better instruction following
- mindslm-7b kept in Ollama for comparison/ablation

---

## New Architecture

### Pipeline (after Phase 7-8)

```
User message
    │
    ├── GoEmotions classifier → 27 emotions → category (Anxiety/Depression/Suicidal/Normal)
    │
    ├── MiniLM embed → ChromaDB search → top 3 real therapist responses for this type of problem
    │
    ├── MiniLM embed → Past sessions DB → top 3 relevant things user said before
    │
    └── Prompt assembly:
            SYSTEM: category-specific therapist persona
            EXAMPLES: [retrieved real therapist responses]
            MEMORY: [relevant past user messages]
            USER: current message
            → Qwen2.5-14B-Instruct (Q4_K_M via Ollama, ~8.5GB)
            → Response
```

### Why 14B not 1.5B

- 14B Q4_K_M = ~8.5GB RAM. M3 Pro 18GB handles this comfortably (~15GB total with everything)
- 14B follows nuanced therapeutic instructions correctly; 1.5B memorizes and parrots generic phrases
- No fine-tuning needed for 14B — its instruction-following is good enough with strong prompts + RAG

### Why RAG

- Model sees REAL therapist responses (from Counsel Chat) for similar user problems at inference time
- Mimics the style of actual therapists, not synthetic AI-generated text
- Updatable without retraining — just add more data to ChromaDB

### Why Conversation Memory

- Core therapeutic value: therapist who remembers you
- "Last time you mentioned work stress — is that still going on?"
- Implemented as second RAG retrieval over user's own past messages (embedded + stored in ChromaDB per session)

---

## Frontend Rebuild — React + Vite

### Why React over vanilla JS

- PHQ-9 progress, breathing timer, voice recording, mood timeline = complex state across components
- Vanilla JS for this requires manual DOM updates and global state hacks
- React: each feature is a clean component with its own state, easy to animate, easy to extend

### Tech stack

| Layer | Tech |
|-------|------|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts (React-native, better than Chart.js for this) |
| Animations | Framer Motion |
| Voice | Web Audio API + MediaRecorder → POST to /api/transcribe |
| HTTP | fetch (no extra library needed) |

### Components to build

```
src/
├── App.jsx                    # Root, routing between Chat and History views
├── components/
│   ├── ChatInterface.jsx      # Main chat window with message list
│   ├── MessageBubble.jsx      # Single message + emotion tags + memory badge
│   ├── InputBar.jsx           # Text input + mic button + send
│   ├── PHQProgressBar.jsx     # PHQ-9/GAD-7 progress + score badge
│   ├── EmotionTags.jsx        # Animated emotion pill tags per message
│   ├── BreathingExercise.jsx  # Full-screen animated box breathing
│   ├── GroundingExercise.jsx  # 5-4-3-2-1 step-by-step modal
│   ├── ThoughtRecord.jsx      # CBT thought challenging form
│   ├── EscalationAlert.jsx    # Slide-in warning when PHQ-9 trending up
│   ├── VoiceRecorder.jsx      # Mic button + live waveform canvas
│   ├── MoodTimeline.jsx       # PHQ-9 line chart over sessions (Recharts)
│   ├── EmotionHeatmap.jsx     # Emotion frequency bars over time
│   └── SessionCard.jsx        # Summary card per past session
└── hooks/
    ├── useChat.js             # Chat state, send message, streaming
    ├── useVoice.js            # MediaRecorder, waveform, transcription
    └── useSession.js          # Session management, PHQ score, memory
```

### UI features per component

**BreathingExercise.jsx**
- Triggered automatically when GoEmotions detects fear/nervousness
- Full-screen overlay with CSS animated expanding/contracting circle
- Phases: Inhale (4s, blue) → Hold (4s, purple) → Exhale (4s, green) → Hold (2s)
- Timer countdown, cycle counter, skip button
- On complete: sends "I just did the breathing exercise" to chat

**GroundingExercise.jsx**
- Triggered on grief/sadness
- Step through 5 senses: 5 things you SEE → 4 HEAR → 3 TOUCH → 2 SMELL → 1 TASTE
- Input fields for each, progress indicator
- Framer Motion slide transitions between steps
- Completion feeds back to conversation

**VoiceRecorder.jsx**
- Hold-to-record mic button
- Canvas waveform animation using Web Audio API analyser
- On release: POST audio blob to /api/transcribe → Whisper → text appears in input bar
- Visual states: idle / recording (red pulse) / transcribing (spinner) / done

**EscalationAlert.jsx**
- Monitors PHQ-9 scores across last 3 sessions from SQLite
- Triggers if score increased 3+ points in 2+ consecutive sessions
- Framer Motion slide-down from top, amber/red gradient
- Buttons: "Call 988" (tel: link) / "Text HOME to 741741" / Dismiss

**MoodTimeline.jsx (History view)**
- Recharts LineChart of PHQ-9 score across sessions
- Recharts BarChart of top emotions by frequency
- Session cards with date, severity badge, top 3 emotions, message count
- Framer Motion stagger animation on card list

---

## New Backend Features

### Phase 7: RAG pipeline — rag.py

```python
# What it does:
# 1. Download Counsel Chat (nbertagnolli/counsel-chat from HuggingFace)
# 2. Download EmpatheticDialogues (facebook/empathetic_dialogues)
# 3. Embed all therapist responses with MiniLM
# 4. Store in ChromaDB (therapist_responses collection)
# 5. At inference: embed user message → query ChromaDB → top 3 retrieved
# 6. Inject retrieved examples into prompt as few-shot context
```

### Phase 8: Conversation Memory — memory.py

```python
# What it does:
# 1. After each user message: embed it and store in ChromaDB (user_memories collection, keyed by user/session)
# 2. At inference: retrieve top 3 semantically similar things user said in past sessions
# 3. Inject as memory context into prompt:
#    "This user previously mentioned: [past statement 1], [past statement 2]"
# 4. Model uses this to reference prior disclosures naturally
```

### Phase 11: Voice — /api/transcribe endpoint

```python
# POST /api/transcribe
# Receives: audio blob (webm/wav)
# Runs: whisper.cpp locally (mlx-whisper on Apple Silicon)
# Returns: { "text": "i keep waking up at night..." }
# Model: whisper-base or whisper-small (fast on M3 Pro)
```

### Phase 13: Confidence blending — update mindslm_pipeline_api.py

```python
# If suicidal_confidence > 0.25 (regardless of top category):
#     Always append crisis resources to system prompt
# If top two categories within 15% confidence of each other:
#     Blend their system prompts (anxiety + depression both addressed)
```

---

## PHQ-9 / GAD-7 Reference

### PHQ-9 Scoring

| Score | Severity | Action |
|-------|----------|--------|
| 0-4 | Minimal | Monitor |
| 5-9 | Mild | Watchful waiting |
| 10-14 | Moderate | Treatment plan |
| 15-19 | Moderately severe | Active treatment |
| 20-27 | Severe | Immediate referral |

### PHQ-9 Questions
1. Little interest or pleasure in doing things?
2. Feeling down, depressed, or hopeless?
3. Trouble falling/staying asleep, or sleeping too much?
4. Feeling tired or having little energy?
5. Poor appetite or overeating?
6. Feeling bad about yourself — failure, letting family down?
7. Trouble concentrating?
8. Moving/speaking slowly, or being fidgety/restless?
9. Thoughts of self-harm or being better off dead?

### GAD-7 Questions (Scoring: 0-4 Minimal, 5-9 Mild, 10-14 Moderate, 15-21 Severe)
1. Feeling nervous, anxious, or on edge?
2. Not being able to stop or control worrying?
3. Worrying too much about different things?
4. Trouble relaxing?
5. Being so restless it's hard to sit still?
6. Becoming easily annoyed or irritable?
7. Feeling afraid something awful might happen?

---

## SQLite Schema (existing, no changes needed)

```sql
CREATE TABLE sessions (
    id            TEXT PRIMARY KEY,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME,
    phq9_score    INTEGER,
    gad7_score    INTEGER,
    severity      TEXT,
    top_emotions  TEXT,
    message_count INTEGER DEFAULT 0
);

CREATE TABLE messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(id),
    role       TEXT,
    content    TEXT,
    emotions   TEXT,
    timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE screening_state (
    session_id TEXT PRIMARY KEY REFERENCES sessions(id),
    instrument TEXT,
    answers    TEXT,
    completed  BOOLEAN DEFAULT FALSE
);
```

---

## Hardware Budget (M3 Pro, 18GB)

| Component | RAM |
|-----------|-----|
| Qwen2.5-14B Q4_K_M (Ollama) | ~8.5GB |
| ChromaDB (therapist RAG + memory) | ~300MB |
| GoEmotions + MiniLM + TF-IDF | ~600MB |
| React dev server (Vite) | ~200MB |
| Python API (FastAPI) | ~200MB |
| macOS + browser | ~5GB |
| **Total** | **~15GB** ✓ |

---

## Build Order (Day by Day)

### Day 1 — Backend upgrade
1. `ollama pull qwen2.5:14b` (background, ~9GB)
2. Build `rag.py` — download Counsel Chat + EmpatheticDialogues, embed, ChromaDB
3. Build `memory.py` — per-session user message embedding + retrieval
4. Update `mindslm_pipeline_api.py` — swap model to 14B, add RAG + memory retrieval
5. Test: responses should already be dramatically better

### Day 2 — React frontend
1. `npm create vite@latest frontend-react -- --template react`
2. Install: `npm install tailwindcss framer-motion recharts`
3. Build components: ChatInterface, MessageBubble, InputBar, EmotionTags, PHQProgressBar
4. Build: BreathingExercise, GroundingExercise (CBT exercises)
5. Build: MoodTimeline, EmotionHeatmap, SessionCard (history view)
6. Wire all components to API

### Day 3 — Advanced features + polish
1. Build VoiceRecorder + /api/transcribe with mlx-whisper
2. Build EscalationAlert (PHQ-9 trend monitoring)
3. Add confidence blending to classifier
4. Framer Motion animations throughout
5. Dark/light theme

### Day 4 — Evaluation + paper
1. Run step5_evaluate.py when Gemini quota resets → fill results table
2. Update IEEE paper with new architecture (14B + RAG + React)
3. Demo prep

---

## File Structure (final)

```
MindSLM/
├── mindslm_pipeline_api.py    # Main FastAPI server (updated for 14B + RAG + memory)
├── rag.py                     # ChromaDB setup, Counsel Chat ingestion, retrieval
├── memory.py                  # Cross-session user memory embedding + retrieval
├── screening.py               # PHQ-9/GAD-7 state machine
├── database.py                # SQLite CRUD
├── mindslm.db                 # SQLite database
├── CONTEXT.md                 # This file
├── Modelfile                  # Ollama model definition
├── mindslm-f16.gguf           # Current 1.5B GGUF (kept for reference)
├── mindslm-merged/            # Merged HF model weights
├── models/
│   ├── best_text_model.joblib
│   └── label_encoder.joblib
├── frontend-react/            # NEW: React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   ├── InputBar.jsx
│   │   │   ├── PHQProgressBar.jsx
│   │   │   ├── EmotionTags.jsx
│   │   │   ├── BreathingExercise.jsx
│   │   │   ├── GroundingExercise.jsx
│   │   │   ├── ThoughtRecord.jsx
│   │   │   ├── EscalationAlert.jsx
│   │   │   ├── VoiceRecorder.jsx
│   │   │   ├── MoodTimeline.jsx
│   │   │   ├── EmotionHeatmap.jsx
│   │   │   └── SessionCard.jsx
│   │   └── hooks/
│   │       ├── useChat.js
│   │       ├── useVoice.js
│   │       └── useSession.js
│   ├── package.json
│   └── vite.config.js
├── frontend/                  # OLD: vanilla JS (keep until React is complete)
├── step1_download_datasets.py
├── step2_format_dataset.py
├── step3_finetune_kaggle.py
├── step4_export_ollama.py
├── step5_evaluate.py
└── evaluation_results/
```

---

## Final Project Pitch

MindSLM is a fully local, privacy-first mental health support system running on consumer hardware. It combines a 27-emotion GoEmotions classifier, clinically validated PHQ-9/GAD-7 screening, retrieval-augmented generation over real therapist conversations, and cross-session memory — all served through Qwen2.5-14B-Instruct running locally via Ollama. The React frontend features animated CBT exercises (box breathing, 5-4-3-2-1 grounding), voice input via Whisper, severity escalation alerts, and a longitudinal mood timeline. No data leaves the device.
