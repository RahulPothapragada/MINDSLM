"""
MindSLM — Conversational PHQ-9 / GAD-7 Screening Engine

Embeds clinically validated screening questions into natural conversation.
The LLM weaves these into dialogue — they're not presented as a form.
"""

import re
import database as db

# ==============================
# PHQ-9 (Depression Screening)
# ==============================
PHQ9_QUESTIONS = [
    "little interest or pleasure in doing things",
    "feeling down, depressed, or hopeless",
    "trouble falling or staying asleep, or sleeping too much",
    "feeling tired or having little energy",
    "poor appetite or overeating",
    "feeling bad about yourself, or that you are a failure or have let yourself or your family down",
    "trouble concentrating on things, such as reading or watching television",
    "moving or speaking so slowly that others could have noticed, or being so fidgety or restless",
    "thoughts that you would be better off dead, or of hurting yourself",
]

# ==============================
# GAD-7 (Anxiety Screening)
# ==============================
GAD7_QUESTIONS = [
    "feeling nervous, anxious, or on edge",
    "not being able to stop or control worrying",
    "worrying too much about different things",
    "trouble relaxing",
    "being so restless that it is hard to sit still",
    "becoming easily annoyed or irritable",
    "feeling afraid, as if something awful might happen",
]

# ==============================
# Severity mapping
# ==============================
def phq9_severity(score: int) -> str:
    if score <= 4:  return "minimal"
    if score <= 9:  return "mild"
    if score <= 14: return "moderate"
    if score <= 19: return "moderately_severe"
    return "severe"

def gad7_severity(score: int) -> str:
    if score <= 4:  return "minimal"
    if score <= 9:  return "mild"
    if score <= 14: return "moderate"
    return "severe"


# ==============================
# Score extraction from user response
# ==============================
# Maps user language to PHQ/GAD 0-3 scale
SCORE_PATTERNS = {
    0: [r"\bnot at all\b", r"\bnever\b", r"\bnope\b", r"\bno\b", r"\bfine\b",
        r"\bgood\b", r"\bgreat\b", r"\bokay\b", r"\bnah\b", r"\brarely\b"],
    1: [r"\bseveral days\b", r"\bsometimes\b", r"\ba little\b", r"\bbit\b",
        r"\boccasionally\b", r"\bnow and then\b", r"\bhere and there\b",
        r"\bonce in a while\b", r"\bkind of\b", r"\bsort of\b"],
    2: [r"\bmore than half\b", r"\boften\b", r"\bfrequently\b", r"\ba lot\b",
        r"\bmost days\b", r"\busually\b", r"\bpretty much\b", r"\bquite a bit\b",
        r"\bregularly\b"],
    3: [r"\bnearly every day\b", r"\balways\b", r"\bconstantly\b", r"\ball the time\b",
        r"\bevery day\b", r"\bevery night\b", r"\bnon.?stop\b", r"\bcant stop\b",
        r"\bcan.?t stop\b", r"\byes\b", r"\bdefinitely\b", r"\babsolutely\b",
        r"\bextremely\b", r"\bterrible\b"],
}

def extract_score(user_response: str) -> int:
    """Extract a 0-3 severity score from natural language response."""
    text = user_response.lower().strip()

    # Check patterns from most severe to least
    for score in [3, 2, 1, 0]:
        for pattern in SCORE_PATTERNS[score]:
            if re.search(pattern, text):
                return score

    # Default: if they're describing the problem at all, assume at least 1
    # Short affirmations default higher
    if len(text) < 15:
        return 2  # short responses to mental health Qs tend to be confirmations
    return 1


# ==============================
# Screening state machine
# ==============================
class ScreeningEngine:
    """Manages conversational screening flow for a session."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state = db.get_screening_state(session_id)

    @property
    def active(self) -> bool:
        return self.state is not None and not self.state["completed"]

    @property
    def completed(self) -> bool:
        return self.state is not None and self.state["completed"]

    @property
    def instrument(self) -> str | None:
        return self.state["instrument"] if self.state else None

    @property
    def progress(self) -> tuple[int, int]:
        """Returns (answered, total)."""
        if not self.state:
            return (0, 0)
        total = 9 if self.state["instrument"] == "phq9" else 7
        answered = len(self.state["answers"])
        return (answered, total)

    @property
    def current_question_text(self) -> str | None:
        if not self.active:
            return None
        qs = PHQ9_QUESTIONS if self.state["instrument"] == "phq9" else GAD7_QUESTIONS
        idx = self.state["current_q"]
        if idx < len(qs):
            return qs[idx]
        return None

    def start(self, instrument: str = "phq9"):
        """Begin a screening."""
        db.upsert_screening_state(self.session_id, instrument, {}, 0, False)
        self.state = db.get_screening_state(self.session_id)

    def should_start(self, classification: str, message_count: int) -> str | None:
        """Decide whether to begin screening based on classification and conversation progress.
        Returns instrument name or None."""
        if self.state is not None:  # already started or completed
            return None
        if message_count < 2:  # don't screen on first message
            return None
        if classification in ("Depression", "Suicidal"):
            return "phq9"
        if classification == "Anxiety":
            return "gad7"
        return None

    def record_answer(self, user_response: str) -> dict:
        """Record user's answer to current screening question, advance state.
        Returns {score, question_idx, answered, total, completed, final_score, severity}."""
        if not self.active:
            return {}

        score = extract_score(user_response)
        q_idx = self.state["current_q"]
        answers = self.state["answers"]
        answers[str(q_idx)] = score

        instrument = self.state["instrument"]
        qs = PHQ9_QUESTIONS if instrument == "phq9" else GAD7_QUESTIONS
        next_q = q_idx + 1
        completed = next_q >= len(qs)

        db.upsert_screening_state(self.session_id, instrument, answers, next_q, completed)
        self.state = db.get_screening_state(self.session_id)

        result = {
            "score": score,
            "question_idx": q_idx,
            "answered": len(answers),
            "total": len(qs),
            "completed": completed,
        }

        if completed:
            final_score = sum(answers.values())
            if instrument == "phq9":
                severity = phq9_severity(final_score)
            else:
                severity = gad7_severity(final_score)
            result["final_score"] = final_score
            result["severity"] = severity

            # Update session
            update_kwargs = {"severity": severity}
            if instrument == "phq9":
                update_kwargs["phq9_score"] = final_score
            else:
                update_kwargs["gad7_score"] = final_score
            db.update_session(self.session_id, **update_kwargs)

        return result

    def get_prompt_injection(self) -> str:
        """Returns text to inject into the system prompt for screening-aware generation."""
        if not self.active:
            if self.completed:
                final = sum(self.state["answers"].values())
                instrument = self.state["instrument"].upper().replace("PHQ", "PHQ-").replace("GAD", "GAD-")
                sev = self.state["answers"]
                severity = phq9_severity(final) if "phq" in self.state["instrument"] else gad7_severity(final)
                return f"\n\nScreening complete. {instrument} score: {final} ({severity}). Acknowledge the result naturally and suggest next steps based on severity. Do not repeat the questions."

            return ""

        q_text = self.current_question_text
        answered, total = self.progress
        instrument_label = "PHQ-9 (depression)" if self.state["instrument"] == "phq9" else "GAD-7 (anxiety)"

        return f"""

SCREENING ({instrument_label}, {answered + 1}/{total}):
Before ending your response, ask ONE natural follow-up question about: {q_text}
Rephrase it in your own words as a therapist would — never quote it directly.
Do not mention PHQ-9 or GAD-7. Ask only this one question."""
