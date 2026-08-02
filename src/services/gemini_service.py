"""Gemini service wrapper for generating structured teacher guides."""

import json
import re
import time

from google import genai

from src.config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_MODEL_FALLBACKS

# Total wall-clock budget for the whole generate call, in seconds. Kept safely
# below the Vercel function timeout (see vercel.json `maxDuration`) so we can
# return a clean error to the client instead of being hard-killed mid-request.
GENERATE_TIME_BUDGET = 45.0


class GuideGenerationBusyError(RuntimeError):
    """Raised when Gemini is transiently unavailable within the time budget.

    Signals a retryable condition (overloaded/rate-limited) so the API layer can
    return a 503 asking the user to try again, rather than a generic 500.
    """

TEACHER_GUIDE_PROMPT = """\
You are a professional curriculum designer.

Generate a complete Teacher Guide as a JSON object.

IMPORTANT RULES:
- Return ONLY valid JSON. No markdown code blocks. No explanations.
- Start immediately with {{ and end with }}.
- Use this EXACT structure:

{{
  "lessonName": "Session Title Here",
  "overview": "<p>One or two paragraph overview of the session.</p>",
  "learningOutcomes": [
    "Outcome 1 as plain text",
    "Outcome 2 as plain text"
  ],
  "preparation": "<ul><li>Preparation item 1</li><li>Preparation item 2</li></ul>",
  "lessonProcedure": [
    {{
      "activityTitle": "Initiate",
      "activityType": "Recap",
      "duration": 10,
      "instructions": "<p>Step-by-step instructions...</p>"
    }},
    {{
      "activityTitle": "Explore the Concept",
      "activityType": "Explore",
      "duration": 15,
      "instructions": "<p>...</p>"
    }},
    {{
      "activityTitle": "Build the Project",
      "activityType": "Make",
      "duration": 20,
      "instructions": "<ol><li>First step the instructor walks students through.</li><li>Second step.</li><li>Third step.</li></ol>"
    }}
  ],
  "glossary": [
    {{
      "concept": "Term",
      "definition": "Plain text definition"
    }}
  ],
  "bonusActivities": "<ul><li>Bonus activity 1</li></ul>"
}}

ACTIVITY TYPE RULES:
- Use ONLY these exact activityType values: "Recap", "Task Review", "Explore", "Make", "Evaluate", "Share", "Task at Home"
- Map lesson phases: Initiate → "Recap", Learn/Explore → "Explore", Make/Create → "Make", Share/Present → "Share", Review → "Task Review", Evaluate → "Evaluate"
- Include 3–6 activities. The whole session lasts {session_minutes} minutes: assign each activity a "duration" in whole minutes so the activities together add up to about {session_minutes} minutes (never far above or below it).
- For every "Make" activity, write the "instructions" as an ordered list (<ol> with <li> items) of clear, sequential project steps the instructor can follow — one concrete action per step, in the order they should be performed. Do NOT write Make instructions as a single prose paragraph.

HTML RULES (for "overview", "preparation", "bonusActivities", and "instructions" fields ONLY):
- Use only: <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>

Write for TEACHERS (not students). Use clear, academic language.

FILE NAME: {file_name}

Session content:
{slide_text}
"""

_gemini_client = genai.Client(api_key=GEMINI_API_KEY)


def generate_teacher_guide(
    file_name: str,
    slide_text: str,
    *,
    session_minutes: int = 45,
    time_budget: float = GENERATE_TIME_BUDGET,
) -> dict:
    """Call Gemini with fallback models and deadline-aware retry logic.

    ``session_minutes`` is the total lesson length the teacher chose; it is fed
    into the prompt so the generated activity durations target that total.

    All backoff sleeps are bounded by ``time_budget`` so the total wall-clock
    time stays under the serverless function timeout. When transient errors
    (503/429) persist past the budget, raises :class:`GuideGenerationBusyError`
    so the caller can surface a retryable "server busy" message.
    """
    prompt = TEACHER_GUIDE_PROMPT.format(
        file_name=file_name, slide_text=slide_text, session_minutes=session_minutes
    )

    deadline = time.monotonic() + time_budget
    max_retries = 4
    base_delay = 2.0
    # Minimum time we expect a Gemini call to need; don't bother retrying if
    # less than this remains — we'd only time out mid-call.
    min_call_budget = 8.0
    last_exc: Exception | None = None
    hit_transient = False
    hit_quota = False
    model_candidates = [GEMINI_MODEL] + [m for m in GEMINI_MODEL_FALLBACKS if m != GEMINI_MODEL]
    tried_models: list[str] = []

    def backoff(want: float) -> bool:
        """Sleep up to ``want`` seconds without crossing the deadline.

        Returns True if there is still enough budget left to attempt another
        Gemini call afterwards, False if we should give up.
        """
        remaining = deadline - time.monotonic()
        if remaining <= min_call_budget:
            return False
        time.sleep(min(want, remaining - min_call_budget))
        return (deadline - time.monotonic()) > min_call_budget

    for model_name in model_candidates:
        if deadline - time.monotonic() <= min_call_budget:
            break
        tried_models.append(model_name)
        per_model_delay = base_delay

        for attempt in range(max_retries):
            try:
                response = _gemini_client.models.generate_content(model=model_name, contents=prompt)
                raw = response.text.strip()
                raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
                raw = re.sub(r"\s*```$", "", raw)
                match = re.search(r"\{.*\}", raw, re.DOTALL)
                if not match:
                    raise ValueError("Gemini did not return a JSON object")
                return json.loads(match.group(0))
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                err_str = str(exc)

                if "NOT_FOUND" in err_str or "no longer available" in err_str.lower():
                    break

                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    hit_transient = True
                    hit_quota = True
                    retry_match = re.search(r"retry[\s_-]?(?:in|delay)[:\s]+([\d.]+)s", err_str, re.IGNORECASE)
                    suggested = float(retry_match.group(1)) if retry_match else per_model_delay
                    wait = max(suggested, per_model_delay)
                    # If the suggested wait can't fit in our budget, retrying is
                    # pointless — move on to the next fallback model immediately.
                    if attempt < max_retries - 1 and backoff(wait):
                        per_model_delay = wait * 2
                        continue
                    break

                if "503" in err_str or "UNAVAILABLE" in err_str or "overloaded" in err_str.lower():
                    hit_transient = True
                    if attempt < max_retries - 1 and backoff(per_model_delay):
                        per_model_delay *= 2
                        continue
                    # Overloaded even after retries (or out of budget) — try the
                    # next fallback model.
                    break

                raise

    # Out of budget or models. Distinguish quota exhaustion (needs a new key or
    # billing — retrying won't help) from transient overload (retryable) from a
    # hard configuration problem, so the client gets an actionable message.
    if hit_quota:
        raise GuideGenerationBusyError(
            "The daily limit for AI guide generation has been reached. "
            "Please try again tomorrow, or contact the administrator to raise the limit."
        ) from last_exc

    if hit_transient:
        raise GuideGenerationBusyError(
            "The AI service is busy or the document is too large to process in time. "
            "Please wait a moment and try again."
        ) from last_exc

    raise RuntimeError(
        "No available Gemini model could be used for this API key. "
        f"Tried: {', '.join(tried_models)}. "
        "Set GEMINI_MODEL or GEMINI_MODEL_FALLBACKS in .env to models available in your account."
    ) from last_exc
