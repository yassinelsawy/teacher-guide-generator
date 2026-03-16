"""Gemini service wrapper for generating structured teacher guides."""

import json
import re
import time

from google import genai

from src.config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_MODEL_FALLBACKS

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
  "preparation": [
    "Preparation item 1 as plain text",
    "Preparation item 2 as plain text"
  ],
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
    }}
  ],
  "glossary": [
    {{
      "concept": "Term",
      "definition": "Plain text definition"
    }}
  ],
  "bonusActivities": [
    "Bonus activity 1 as plain text"
  ]
}}

ACTIVITY TYPE RULES:
- Use ONLY these exact activityType values: "Recap", "Task Review", "Explore", "Make", "Evaluate", "Share", "Task at Home"
- Map lesson phases: Initiate → "Recap", Learn/Explore → "Explore", Make/Create → "Make", Share/Present → "Share", Review → "Task Review", Evaluate → "Evaluate"
- Include 3–6 activities. Estimate duration in minutes (default 10).

HTML RULES (for "overview" and "instructions" fields ONLY):
- Use only: <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>

Write for TEACHERS (not students). Use clear, academic language.

FILE NAME: {file_name}

Session content:
{slide_text}
"""

_gemini_client = genai.Client(api_key=GEMINI_API_KEY)


def generate_teacher_guide(file_name: str, slide_text: str) -> dict:
    """Call Gemini with fallback models and retry logic for quota errors."""
    prompt = TEACHER_GUIDE_PROMPT.format(file_name=file_name, slide_text=slide_text)

    max_retries = 4
    delay = 10
    last_exc: Exception | None = None
    model_candidates = [GEMINI_MODEL] + [m for m in GEMINI_MODEL_FALLBACKS if m != GEMINI_MODEL]
    tried_models: list[str] = []

    for model_name in model_candidates:
        tried_models.append(model_name)
        per_model_delay = delay

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
                    retry_match = re.search(r"retry[\s_-]?(?:in|delay)[:\s]+([\d.]+)s", err_str, re.IGNORECASE)
                    suggested = float(retry_match.group(1)) if retry_match else per_model_delay
                    wait = max(suggested, per_model_delay)
                    if attempt < max_retries - 1:
                        time.sleep(wait)
                        per_model_delay = wait * 2
                        continue
                    raise RuntimeError(
                        "Gemini API daily quota exhausted for this API key. "
                        "Please add a new GEMINI_API_KEY to your .env file or enable billing at "
                        "https://aistudio.google.com/apikey"
                    ) from exc

                raise

    raise RuntimeError(
        "No available Gemini model could be used for this API key. "
        f"Tried: {', '.join(tried_models)}. "
        "Set GEMINI_MODEL or GEMINI_MODEL_FALLBACKS in .env to models available in your account."
    ) from last_exc
