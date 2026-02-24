import json
import os
import re
import shutil
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pptx import Presentation
from google import genai

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini = genai.Client(api_key=GEMINI_API_KEY)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

STATIC_DIR = Path("static")
STATIC_DIR.mkdir(exist_ok=True)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="PPTX → Teacher Guide Generator")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_text_from_pptx(filepath: Path) -> tuple[str, str]:
    """Return (filename_stem, full_slide_text)."""
    prs = Presentation(filepath)
    lines: list[str] = []
    for slide_num, slide in enumerate(prs.slides, start=1):
        slide_lines: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        slide_lines.append(text)
        if slide_lines:
            lines.append(f"--- Slide {slide_num} ---")
            lines.extend(slide_lines)
    return filepath.stem, "\n".join(lines)


TEACHER_GUIDE_PROMPT = """\
You are an expert Instructional Designer and Teacher-Guide Author.
Analyze the slide content below and generate a comprehensive Teacher Lesson Guide.

Audience: Write for TEACHERS, not students.
Core Task: Translate slide content into teaching actions and scripts.

IMPORTANT: Return ONLY valid JSON — no markdown fences, no extra text, no explanation.
The JSON must follow this exact structure:

{{
  "session_overview": "2-3 sentence paragraph describing the lesson arc, flow, goal, and tools used.",
  "learning_objectives": [
    "Objective 1 starting with an action verb",
    "Objective 2 starting with an action verb",
    "Objective 3 starting with an action verb"
  ],
  "preparation": "Concise description of what the teacher must prepare: subject knowledge, materials, digital tools, and trial run advice.",
  "lesson_procedure": {{
    "initiate": "Step-by-step teacher instructions for opening the lesson: warm-up, recap, hook activity, questions to ask.",
    "learn": "Step-by-step teacher instructions for delivering the core content: what to say, how to explain, examples to use, interaction prompts.",
    "make": "Step-by-step instructions for the hands-on activity or practice: student tasks, teacher monitoring, support tips.",
    "share": "Instructions for the closing/presentation phase: how students share work, feedback approach, wrap-up questions."
  }},
  "glossary": [
    {{"term": "Term 1", "definition": "Simple age-appropriate definition"}},
    {{"term": "Term 2", "definition": "Simple age-appropriate definition"}}
  ],
  "bonus_activities": "Optional enrichment tasks for advanced or fast-finishing students. If none, write: No Bonus Activities."
}}

FILE NAME: {file_name}

SLIDE CONTENT:
{slide_text}
"""


def generate_teacher_guide(file_name: str, slide_text: str) -> dict:
    """Call Gemini with exponential backoff retry on 429, return parsed JSON dict."""
    prompt = TEACHER_GUIDE_PROMPT.format(
        file_name=file_name,
        slide_text=slide_text,
    )

    max_retries = 4
    delay = 10  # seconds before first retry
    last_exc: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = gemini.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=prompt,
            )
            raw = response.text.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
            raw = re.sub(r"\s*```$", "", raw)
            return json.loads(raw)
        except Exception as exc:
            last_exc = exc
            err_str = str(exc)
            # Retry only on 429 rate-limit errors
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                # Try to extract the retryDelay from the error message
                retry_match = re.search(r"retry[\s_-]?(?:in|delay)[:\s]+([\d.]+)s", err_str, re.IGNORECASE)
                suggested = float(retry_match.group(1)) if retry_match else delay
                wait = max(suggested, delay)
                if attempt < max_retries - 1:
                    time.sleep(wait)
                    delay = wait * 2
                    continue
                # All retries exhausted — raise friendly error
                raise RuntimeError(
                    "Gemini API daily quota exhausted for this API key. "
                    "Please add a new GEMINI_API_KEY to your .env file or enable billing at "
                    "https://aistudio.google.com/apikey"
                ) from exc
            raise  # re-raise non-429 errors immediately

    raise last_exc


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pptx"):
        return JSONResponse(
            status_code=400,
            content={"error": "Please upload a valid .pptx file."},
        )

    temp_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    try:
        with temp_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        file_name, slide_text = extract_text_from_pptx(temp_path)

        if not slide_text.strip():
            return JSONResponse(
                status_code=422,
                content={"error": "No readable text found in the uploaded PPTX."},
            )

        guide = generate_teacher_guide(file_name, slide_text)
        return JSONResponse(content={"guide": guide, "file_name": file_name})

    except json.JSONDecodeError as exc:
        return JSONResponse(
            status_code=500,
            content={"error": f"Gemini returned invalid JSON: {exc}"},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": str(exc)},
        )
    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.get("/demo")
async def demo():
    """Return sample Teacher Guide data for UI preview."""
    sample = {
        "file_name": "Sample_Lesson_Introduction_to_AI",
        "guide": {
            "session_overview": (
                "In this session, students are introduced to the concept of Artificial Intelligence "
                "through hands-on exploration and guided discussion. The lesson flows from a curiosity-"
                "driven warm-up activity into a structured explanation of how AI works, followed by a "
                "creative design task where students map out a simple AI solution to a real-world problem."
            ),
            "learning_objectives": [
                "Recognize the definition of Artificial Intelligence and distinguish it from regular software.",
                "Identify at least three real-world examples of AI in everyday life.",
                "Analyze how data is used to train AI models using a simple visual example.",
                "Design a basic flowchart that describes how an AI system would solve a chosen problem.",
                "Apply critical thinking to evaluate the benefits and limitations of AI tools.",
            ],
            "preparation": (
                "Subject Knowledge: Review the basics of machine learning, supervised vs unsupervised learning, "
                "and common AI applications (image recognition, chatbots, recommendation systems). "
                "You Will Need: Slides (provided), Teacher Guide, printed AI example cards, internet-connected "
                "devices for students, and access to a simple AI demo site (e.g., Teachable Machine). "
                "You May Need: A backup offline activity in case of connectivity issues; do a trial run of "
                "the Teachable Machine demo before class."
            ),
            "lesson_procedure": {
                "initiate": (
                    "1. Start with a quick poll: Ask students to raise their hands if they used AI today. "
                    "Accept all answers and validate them.\n"
                    "2. Show a short 60-second video clip of AI in action (voice assistant, self-driving car, "
                    "recommendation engine).\n"
                    "3. Ask: 'What do you think made the computer able to do that?' Allow 3–4 responses.\n"
                    "4. Write the word AI on the board and say: 'By the end of today, you will be able to "
                    "explain exactly what this means and how it works.'"
                ),
                "learn": (
                    "1. Display Slide 3: Definition. Read it aloud, then ask a student to rephrase it in "
                    "their own words.\n"
                    "2. Use the analogy: 'Teaching an AI is like teaching a child — you show it many examples "
                    "until it learns the pattern.'\n"
                    "3. Slide 4 — Show the training data diagram. Walk through each step: Data → Training → "
                    "Model → Prediction.\n"
                    "4. Pause and ask: 'If we trained an AI on only pictures of cats, what would happen if "
                    "we showed it a dog?' Wait for responses.\n"
                    "5. Slide 5 — Real-world examples. For each example, ask students where they have seen it."
                ),
                "make": (
                    "1. Distribute the 'AI Problem Solver' worksheet (or project it on screen).\n"
                    "2. Students choose a real problem (e.g., detecting ripe fruit, filtering spam emails).\n"
                    "3. They draw a simple 4-step flowchart: Problem → Data Needed → How AI Learns → Output.\n"
                    "4. Circulate the room. For students who are stuck, ask: 'What information would a human "
                    "need to solve this? That is likely the data your AI needs.'\n"
                    "5. Early finishers: Challenge them to add a 'What could go wrong?' box to their flowchart."
                ),
                "share": (
                    "1. Ask 2–3 volunteers to share their flowcharts with the class.\n"
                    "2. For each presentation, prompt the audience: 'Does this AI need a lot of data or a "
                    "little? Why?'\n"
                    "3. Wrap up by asking the full class: 'Name one thing AI is great at and one thing humans "
                    "still do better.'\n"
                    "4. Close with: 'Next lesson we will actually train our own AI model using Teachable Machine.'"
                ),
            },
            "glossary": [
                {"term": "Artificial Intelligence (AI)", "definition": "A computer system that can perform tasks that normally require human intelligence, like recognising images or understanding speech."},
                {"term": "Machine Learning", "definition": "A type of AI where the computer learns from examples (data) instead of being told exact rules."},
                {"term": "Training Data", "definition": "A large collection of examples used to teach an AI model how to make decisions."},
                {"term": "Algorithm", "definition": "A step-by-step set of instructions a computer follows to solve a problem."},
                {"term": "Model", "definition": "The result of training an AI — a program that can make predictions based on what it has learned."},
            ],
            "bonus_activities": (
                "1. Explore Google's Teachable Machine (teachablemachine.withgoogle.com) and train a model "
                "to recognise hand gestures using only the webcam.\n"
                "2. Research one AI system that had a bias problem (e.g., facial recognition accuracy "
                "disparities) and write a short paragraph explaining what went wrong and how it could be fixed.\n"
                "3. Create a short comic strip (4 panels) telling the story of how an AI learns to do one task."
            ),
        },
    }
    return JSONResponse(content=sample)
