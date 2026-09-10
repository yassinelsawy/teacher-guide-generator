"""Gemini service wrapper for generating structured teacher guides."""

import json
import re
import time

import httpx
from google import genai
from google.genai import types

from src.config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_MODEL_FALLBACKS

# Total wall-clock budget for the whole generate call, in seconds. Kept well
# under Vercel's 60s hard function limit so cold starts and other overhead
# outside this budget can't push the request into a host-level hard kill
# (which returns a raw timeout error instead of our own clean JSON error).
GENERATE_TIME_BUDGET = 35.0


class GuideGenerationBusyError(RuntimeError):
    """Raised when Gemini is transiently unavailable within the time budget.

    Signals a retryable condition (overloaded/rate-limited) so the API layer can
    return a 503 asking the user to try again, rather than a generic 500.
    """

TEACHER_GUIDE_PROMPT = """\
You are an expert curriculum designer and lesson-flow analyst producing an instructor-facing Teacher Guide from a lesson slide deck.

Read the ENTIRE session content below before writing anything — do not draft from only the first few slides. Build a complete understanding of the lesson before producing the guide: its title, objectives, key vocabulary, the actual sequence of the material, any recap/review content, concepts being introduced, teacher demonstrations, discussion prompts and their expected responses, worked examples, hands-on activities or projects and their build steps, sharing/presentation procedures, reflection or evaluation content, homework, and any external links, videos, or a final expected project state. Then generate the guide from that full picture, following the order the material actually appears in rather than a reordering you find cleaner. Do not invent a lesson phase (e.g. homework, a recap) that the source doesn't contain.

Generate a complete Teacher Guide as a JSON object.

IMPORTANT RULES:
- Return ONLY valid JSON. No markdown code blocks. No explanations.
- Start immediately with {{ and end with }}.
- Ground every field in the supplied session content — never invent lesson concepts, facts, activities, vocabulary, or URLs that aren't actually present in the source. If something is clearly referenced but not concretely available (e.g. a mentioned but unlinked video), use a short descriptive bracketed placeholder such as "[Video Link - <topic>]" rather than guessing.
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
- Map lesson phases by meaning, not by whatever label the slide itself uses: prior-lesson or warm-up review → "Recap"; checking previously submitted/built student work specifically → "Task Review"; concept introduction, explanation, teacher-led discussion, demonstrations, guided questions → "Explore"; hands-on building, coding, or designing → "Make"; student presentation or peer sharing of finished work → "Share"; Q&A, reflection, or end-of-lesson checks for understanding → "Evaluate"; homework or take-home tasks → "Task at Home".
- Include 3–6 activities. The whole session lasts {session_minutes} minutes: assign each activity a "duration" in whole minutes — in multiples of 5 — so the activities together add up to about {session_minutes} minutes (never far above or below it). An "Evaluate" activity, when included, should get 5 minutes.

WRITE FOR THE TEACHER, NOT A SLIDE SUMMARY:
- For every activity, go beyond restating slide text: make explicit what the teacher should present or demonstrate, what to emphasize, what discussion questions to ask, what students should do (discuss, build, test, compare, share, reflect), and what a correct/expected response or result looks like — using the same terminology, software names, and project names the source material uses rather than generic paraphrases.
- For every "Make" activity, write "instructions" as an ordered list (<ol> with <li> items) of concrete, sequential steps — one action per step, in the order performed. Do NOT write Make instructions as a single prose paragraph. When the source establishes a clear final project state, end the instructions with a line in the exact form <p><strong>Expected Outcome:</strong> ...</p> — only when that end state is genuinely supported by the source, never invented.
- If the source contains a real hyperlink or video URL, preserve it exactly and place it inside the "instructions" (or "preparation"/"bonusActivities") of the activity where it's actually used, formatted as <a href="URL" target="_blank" rel="noopener noreferrer nofollow">Visible Text</a>. For a YouTube/video link, use visible text in the form "Video Link - Title". Never invent or guess a URL.
- Populate "glossary" with every term the source explicitly defines or calls out as key vocabulary — do not add unrelated general-knowledge definitions the slides don't mention.
- Prefer concrete, actionable instructions over vague ones — e.g. "Students work on the project" is not acceptable when the source describes actual steps to follow.

HTML RULES (for "overview", "preparation", "bonusActivities", and "instructions" fields ONLY):
- Use only: <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>, <a>

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
                # Bound each individual call to whatever's left of the budget (minus
                # a buffer for response handling), so one slow/hanging call can't run
                # past our own deadline and get hard-killed by the host's own function
                # timeout instead of surfacing a clean, retryable error.
                remaining = deadline - time.monotonic()
                call_timeout_ms = max(5_000, int((remaining - 2) * 1000))
                response = _gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        http_options=types.HttpOptions(timeout=call_timeout_ms)
                    ),
                )
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
                    # A 429 can mean a short-lived per-minute/per-request rate limit
                    # (retryable within seconds) or genuine per-day quota exhaustion
                    # (not retryable until reset). Gemini's error body distinguishes
                    # these via the violation's quotaId (e.g. "...PerDayPerProject...").
                    # Only the latter should produce the "try again tomorrow" message.
                    if re.search(r"per[\s_-]?day", err_str, re.IGNORECASE):
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

                is_timeout = isinstance(exc, httpx.TimeoutException) or "timeout" in err_str.lower()
                if "503" in err_str or "UNAVAILABLE" in err_str or "overloaded" in err_str.lower() or is_timeout:
                    hit_transient = True
                    if attempt < max_retries - 1 and backoff(per_model_delay):
                        per_model_delay *= 2
                        continue
                    # Overloaded/timed out even after retries (or out of budget) —
                    # try the next fallback model.
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
