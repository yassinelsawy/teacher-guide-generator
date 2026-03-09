import base64
import io
import json
import os
import re
import secrets
import shutil
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
from google import genai
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image as RLImage,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini = genai.Client(api_key=GEMINI_API_KEY)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

STATIC_DIR = Path("static")
STATIC_DIR.mkdir(exist_ok=True)

# Temporary in-memory store for generated guides (token → guide dict)
pending_guides: dict[str, dict] = {}

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="PDF → Teacher Guide Generator")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_text_from_pdf(filepath: Path) -> tuple[str, str]:
    """Return (filename_stem, full_page_text)."""
    lines: list[str] = []
    with pdfplumber.open(filepath) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if text and text.strip():
                lines.append(f"--- Page {page_num} ---")
                lines.append(text.strip())
    return filepath.stem, "\n".join(lines)


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


def generate_teacher_guide(file_name: str, slide_text: str) -> dict:
    """Call Gemini with exponential backoff retry on 429, return structured dict."""
    prompt = TEACHER_GUIDE_PROMPT.format(
        file_name=file_name,
        slide_text=slide_text,
    )

    max_retries = 4
    delay = 10
    last_exc: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = gemini.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=prompt,
            )
            raw = response.text.strip()
            # Strip accidental markdown fences
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
            raw = re.sub(r"\s*```$", "", raw)
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if not match:
                raise ValueError("Gemini did not return a JSON object")
            return json.loads(match.group(0))
        except Exception as exc:
            last_exc = exc
            err_str = str(exc)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                retry_match = re.search(r"retry[\s_-]?(?:in|delay)[:\s]+([\d.]+)s", err_str, re.IGNORECASE)
                suggested = float(retry_match.group(1)) if retry_match else delay
                wait = max(suggested, delay)
                if attempt < max_retries - 1:
                    time.sleep(wait)
                    delay = wait * 2
                    continue
                raise RuntimeError(
                    "Gemini API daily quota exhausted for this API key. "
                    "Please add a new GEMINI_API_KEY to your .env file or enable billing at "
                    "https://aistudio.google.com/apikey"
                ) from exc
            raise

    raise last_exc


def dict_to_teacher_guide(data: dict, file_name: str) -> dict:
    """Convert Gemini JSON output to full TeacherGuide structure with UUIDs."""
    lesson_procedure = []
    for act in data.get("lessonProcedure", []):
        lesson_procedure.append({
            "id": str(uuid.uuid4()),
            "activityType": act.get("activityType", "Explore"),
            "activityTitle": act.get("activityTitle", ""),
            "duration": int(act.get("duration", 10) or 10),
            "slideNumbers": "",
            "instructions": act.get("instructions", ""),
        })

    glossary = [
        {
            "id": str(uuid.uuid4()),
            "concept": g.get("concept", ""),
            "definition": g.get("definition", ""),
        }
        for g in data.get("glossary", [])
    ]

    outcomes = [o for o in data.get("learningOutcomes", []) if o]
    prep = [p for p in data.get("preparation", []) if p]
    bonus = [b for b in data.get("bonusActivities", []) if b]

    return {
        "lessonInfo": {
            "lessonName": data.get("lessonName", file_name.replace("_", " ")),
            "gradeLevel": "",
            "moduleLink": "",
            "slidesLink": "",
            "productionState": "Draft",
        },
        "overview": data.get("overview", ""),
        "learningOutcomes": outcomes or [""],
        "preparation": prep or [""],
        "outlineOverview": [],
        "lessonProcedure": lesson_procedure,
        "publishingGuide": [""],
        "glossary": glossary,
        "bonusActivities": bonus,
    }


def teacher_guide_to_html(guide: dict) -> str:
    """Convert TeacherGuide dict to HTML for Quill display and PDF export."""
    parts: list[str] = []

    lesson_name = guide.get("lessonInfo", {}).get("lessonName", "")
    if lesson_name:
        parts.append(f"<h1>{lesson_name}</h1>")

    overview = guide.get("overview", "")
    if overview:
        parts.append("<h2>Session Overview</h2>")
        parts.append(overview)

    outcomes = [o for o in guide.get("learningOutcomes", []) if o]
    if outcomes:
        parts.append("<h2>Learning Outcomes</h2>")
        parts.append("<ul>" + "".join(f"<li>{o}</li>" for o in outcomes) + "</ul>")

    prep = [p for p in guide.get("preparation", []) if p]
    if prep:
        parts.append("<h2>Preparation</h2>")
        parts.append("<ul>" + "".join(f"<li>{p}</li>" for p in prep) + "</ul>")

    procedure = guide.get("lessonProcedure", [])
    if procedure:
        parts.append("<h2>Lesson Procedure</h2>")
        for act in procedure:
            header = (
                f"{act.get('activityTitle', '')} "
                f"[{act.get('activityType', '')}] \u00b7 "
                f"{act.get('duration', 10)} min"
            )
            parts.append(f"<h3>{header}</h3>")
            if act.get("instructions"):
                parts.append(act["instructions"])

    pub = [s for s in guide.get("publishingGuide", []) if s]
    if pub:
        parts.append("<h2>Publishing Guide</h2>")
        parts.append("<ol>" + "".join(f"<li>{s}</li>" for s in pub) + "</ol>")

    glossary = guide.get("glossary", [])
    if glossary:
        parts.append("<h2>Glossary</h2>")
        parts.append(
            "<ul>" + "".join(
                f"<li><strong>{g.get('concept', '')}:</strong> {g.get('definition', '')}</li>"
                for g in glossary
            ) + "</ul>"
        )

    bonus = [b for b in guide.get("bonusActivities", []) if b]
    if bonus:
        parts.append("<h2>Bonus Activities</h2>")
        parts.append("<ul>" + "".join(f"<li>{b}</li>" for b in bonus) + "</ul>")

    return "\n".join(parts)


SAMPLE_GUIDE: dict = {
    "lessonInfo": {
        "lessonName": "Introduction to Artificial Intelligence",
        "gradeLevel": "",
        "moduleLink": "",
        "slidesLink": "",
        "productionState": "Draft",
    },
    "overview": (
        "<p>In this session, students are introduced to Artificial Intelligence through "
        "hands-on exploration and guided discussion. The lesson flows from a warm-up "
        "into a structured explanation of how AI works, followed by a design task where "
        "students map out a simple AI solution to a real-world problem.</p>"
    ),
    "learningOutcomes": [
        "Recognise the definition of Artificial Intelligence and distinguish it from regular software.",
        "Identify at least three real-world examples of AI in everyday life.",
        "Analyse how data is used to train AI models using a simple visual example.",
        "Design a basic flowchart describing how an AI system would solve a chosen problem.",
        "Apply critical thinking to evaluate the benefits and limitations of AI tools.",
    ],
    "preparation": [
        "Review: machine learning basics, supervised vs unsupervised learning, common AI applications.",
        "You Will Need: Slides, Teacher Guide, printed AI example cards, internet-connected devices.",
        "You May Need: A backup offline activity; do a trial run of the Teachable Machine demo.",
    ],
    "outlineOverview": [],
    "lessonProcedure": [
        {
            "id": "demo-a1",
            "activityType": "Recap",
            "activityTitle": "Initiate",
            "duration": 10,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Quick poll: ask students to raise their hand if they used AI today.</p>"
                "<p>2. Show a 60-second clip of AI in action (voice assistant, self-driving car).</p>"
                "<p>3. Ask: <strong>What made the computer able to do that?</strong> Allow 3\u20134 responses.</p>"
            ),
        },
        {
            "id": "demo-a2",
            "activityType": "Explore",
            "activityTitle": "Learn",
            "duration": 15,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Display Slide 3: Definition. Ask a student to rephrase it.</p>"
                "<p>2. Analogy: <em>Teaching an AI is like teaching a child through examples.</em></p>"
                "<p>3. Walk through: Data \u2192 Training \u2192 Model \u2192 Prediction.</p>"
            ),
        },
        {
            "id": "demo-a3",
            "activityType": "Make",
            "activityTitle": "Make",
            "duration": 20,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Distribute the AI Problem Solver worksheet.</p>"
                "<p>2. Students choose a real problem and draw a 4-step flowchart.</p>"
                "<p>3. Early finishers: add a <strong>What could go wrong?</strong> box.</p>"
            ),
        },
        {
            "id": "demo-a4",
            "activityType": "Share",
            "activityTitle": "Share",
            "duration": 10,
            "slideNumbers": "",
            "instructions": (
                "<p>1. Ask 2\u20133 volunteers to share their flowcharts.</p>"
                "<p>2. Prompt: <strong>Does this AI need a lot of data or a little?</strong></p>"
                "<p>3. Close: <em>Next lesson \u2014 train our own AI using Teachable Machine.</em></p>"
            ),
        },
    ],
    "publishingGuide": [""],
    "glossary": [
        {"id": "demo-g1", "concept": "Artificial Intelligence (AI)", "definition": "A computer system that performs tasks normally requiring human intelligence."},
        {"id": "demo-g2", "concept": "Machine Learning", "definition": "AI that learns from data examples instead of fixed rules."},
        {"id": "demo-g3", "concept": "Training Data", "definition": "Examples used to teach an AI model how to make decisions."},
        {"id": "demo-g4", "concept": "Algorithm", "definition": "A step-by-step set of instructions a computer follows to solve a problem."},
        {"id": "demo-g5", "concept": "Model", "definition": "The result of AI training \u2014 can make predictions based on what it learned."},
    ],
    "bonusActivities": [
        "Explore Teachable Machine and train a model to recognise gestures using a webcam.",
        "Research an AI bias case and write a paragraph explaining what went wrong and how to fix it.",
        "Create a 4-panel comic strip showing how an AI learns to do one task.",
    ],
}


# ── PDF Styles ────────────────────────────────────────────────────────────────

def build_pdf_styles() -> dict:
    base = getSampleStyleSheet()
    accent = colors.HexColor("#4f46e5")

    return {
        "h1": ParagraphStyle(
            "TG_H1",
            parent=base["Normal"],
            fontSize=22,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#1a202c"),
            spaceAfter=6,
            spaceBefore=0,
            leading=28,
        ),
        "h2": ParagraphStyle(
            "TG_H2",
            parent=base["Normal"],
            fontSize=14,
            fontName="Helvetica-Bold",
            textColor=accent,
            spaceAfter=4,
            spaceBefore=14,
            leading=18,
        ),
        "h3": ParagraphStyle(
            "TG_H3",
            parent=base["Normal"],
            fontSize=12,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#374151"),
            spaceAfter=3,
            spaceBefore=8,
            leading=16,
        ),
        "body": ParagraphStyle(
            "TG_Body",
            parent=base["Normal"],
            fontSize=10.5,
            fontName="Helvetica",
            textColor=colors.HexColor("#374151"),
            spaceAfter=6,
            leading=16,
            alignment=TA_LEFT,
        ),
    }


def html_to_platypus(html_content: str, styles: dict) -> list:
    """Convert Quill-generated HTML to a list of ReportLab Platypus flowables."""
    flowables = []

    def clean_inner(text: str) -> str:
        """Keep only ReportLab-safe inline tags: <b> <i> <u> <br/>."""
        # Unwrap span tags (keep inner text)
        text = re.sub(r"<span\b[^>]*>(.*?)</span>", r"\1", text, flags=re.DOTALL | re.IGNORECASE)
        # Normalize strong/em to b/i
        text = re.sub(r"<strong\b[^>]*>", "<b>", text, flags=re.IGNORECASE)
        text = re.sub(r"</strong>", "</b>", text, flags=re.IGNORECASE)
        text = re.sub(r"<em\b[^>]*>", "<i>", text, flags=re.IGNORECASE)
        text = re.sub(r"</em>", "</i>", text, flags=re.IGNORECASE)
        # Normalize br — keep as <br/> (ReportLab's self-closing form)
        text = re.sub(r"<br\s*/?>", "\x00BR\x00", text, flags=re.IGNORECASE)
        # Strip all remaining unknown tags (keep b, i, u and their closing forms)
        text = re.sub(r"<(?!/?(?:b|i|u)\b)[^>]+>", "", text, flags=re.IGNORECASE)
        # Restore <br/>
        text = text.replace("\x00BR\x00", "<br/>")
        # Decode common HTML entities to plain text / safe XML
        replacements = [
            ("&nbsp;", " "), ("&mdash;", "—"), ("&ndash;", "–"),
            ("&rarr;", "→"), ("&larr;", "←"), ("&ldquo;", "\u201c"),
            ("&rdquo;", "\u201d"), ("&lsquo;", "\u2018"), ("&rsquo;", "\u2019"),
            ("&hellip;", "…"), ("&copy;", "©"), ("&reg;", "®"),
        ]
        for entity, char in replacements:
            text = text.replace(entity, char)
        # Fix bare & that could break ReportLab's XML parser
        text = re.sub(r"&(?!(?:amp|lt|gt|#\d+);)", "&amp;", text)
        return text.strip()

    pos = 0
    length = len(html_content)

    while pos < length:
        ws = re.match(r"\s+", html_content[pos:])
        if ws:
            pos += ws.end()
            continue

        # Quill wraps images in <p><img ...></p> — handle before generic block match
        img_in_p = re.match(
            r'<p\b[^>]*>\s*(<img\b[^>]*src="([^"]+)"[^>]*/?>\s*)+</p>',
            html_content[pos:],
            re.DOTALL | re.IGNORECASE,
        )
        if img_in_p:
            for img_match in re.finditer(
                r'<img\b[^>]*src="([^"]+)"[^>]*/?>',
                img_in_p.group(0),
                re.IGNORECASE,
            ):
                src = img_match.group(1)
                try:
                    if src.startswith("data:image"):
                        _, b64data = src.split(",", 1)
                        img_bytes = base64.b64decode(b64data)
                    else:
                        import urllib.request
                        with urllib.request.urlopen(src) as resp:
                            img_bytes = resp.read()
                    from PIL import Image as PILImage
                    pil = PILImage.open(io.BytesIO(img_bytes))
                    orig_w, orig_h = pil.size
                    max_w = 14 * cm
                    scale = max_w / orig_w
                    pil_rgb = pil.convert('RGB')
                    out_buf = io.BytesIO()
                    pil_rgb.save(out_buf, format='JPEG', quality=90)
                    out_buf.seek(0)
                    rl_img = RLImage(out_buf, width=max_w, height=orig_h * scale)
                    flowables.append(Spacer(1, 0.2 * cm))
                    flowables.append(rl_img)
                    flowables.append(Spacer(1, 0.2 * cm))
                except Exception:
                    pass
            pos += img_in_p.end()
            continue

        block = re.match(
            r"<(h1|h2|h3|p|ul|ol)\b[^>]*>(.*?)</\1>",
            html_content[pos:],
            re.DOTALL | re.IGNORECASE,
        )
        if block:
            tag = block.group(1).lower()
            inner = clean_inner(block.group(2))

            try:
                if tag == "h1":
                    flowables.append(Paragraph(inner, styles["h1"]))
                    flowables.append(Spacer(1, 0.3 * cm))

                elif tag == "h2":
                    flowables.append(Spacer(1, 0.4 * cm))
                    flowables.append(Paragraph(inner, styles["h2"]))
                    flowables.append(Spacer(1, 0.15 * cm))

                elif tag == "h3":
                    flowables.append(Spacer(1, 0.2 * cm))
                    flowables.append(Paragraph(inner, styles["h3"]))
                    flowables.append(Spacer(1, 0.1 * cm))

                elif tag == "p":
                    if inner:
                        flowables.append(Paragraph(inner, styles["body"]))
                        flowables.append(Spacer(1, 0.15 * cm))

                elif tag in ("ul", "ol"):
                    items_raw = re.findall(
                        r"<li\b[^>]*>(.*?)</li>", block.group(2), re.DOTALL | re.IGNORECASE
                    )
                    list_items = [
                        ListItem(
                            Paragraph(clean_inner(item), styles["body"]),
                            leftIndent=12,
                            spaceAfter=3,
                        )
                        for item in items_raw
                    ]
                    if list_items:
                        flowables.append(
                            ListFlowable(
                                list_items,
                                bulletType="bullet" if tag == "ul" else "1",
                                leftIndent=20,
                                bulletFontSize=8,
                            )
                        )
                        flowables.append(Spacer(1, 0.2 * cm))
            except Exception:
                pass  # skip blocks that still fail

            pos += block.end()
            continue

        # Handle <img> tags (base64 or URL)
        img_tag = re.match(
            r'<img\b[^>]*src="([^"]+)"[^>]*/?>',
            html_content[pos:],
            re.IGNORECASE,
        )
        if img_tag:
            src = img_tag.group(1)
            try:
                if src.startswith('data:image'):
                    _, b64data = src.split(',', 1)
                    img_bytes = base64.b64decode(b64data)
                else:
                    import urllib.request
                    with urllib.request.urlopen(src) as resp:
                        img_bytes = resp.read()
                from PIL import Image as PILImage
                pil = PILImage.open(io.BytesIO(img_bytes))
                orig_w, orig_h = pil.size
                max_w = 14 * cm
                scale = max_w / orig_w
                pil_rgb = pil.convert('RGB')
                out_buf = io.BytesIO()
                pil_rgb.save(out_buf, format='JPEG', quality=90)
                out_buf.seek(0)
                rl_img = RLImage(out_buf, width=max_w, height=orig_h * scale)
                flowables.append(Spacer(1, 0.2 * cm))
                flowables.append(rl_img)
                flowables.append(Spacer(1, 0.2 * cm))
            except Exception:
                pass
            pos += img_tag.end()
            continue

        pos += 1

    return flowables


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        return JSONResponse(status_code=400, content={"error": "Please upload a valid .pdf file."})

    temp_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    try:
        with temp_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        file_name, slide_text = extract_text_from_pdf(temp_path)

        if not slide_text.strip():
            return JSONResponse(status_code=422, content={"error": "No readable text found in the uploaded PDF."})

        gemini_data = generate_teacher_guide(file_name, slide_text)
        guide = dict_to_teacher_guide(gemini_data, file_name)
        token = secrets.token_urlsafe(16)
        pending_guides[token] = guide
        return JSONResponse(content={"token": token, "file_name": file_name})

    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.get("/demo")
async def demo():
    """Return a sample Teacher Guide for UI preview."""
    guide = SAMPLE_GUIDE
    html = teacher_guide_to_html(guide)
    return JSONResponse(content={"html": html, "guide": guide, "file_name": "Sample_Lesson_Introduction_to_AI"})


@app.get("/guide/{token}")
async def get_pending_guide(token: str):
    """Retrieve a generated guide by token (one-time, consumed on read)."""
    guide = pending_guides.pop(token, None)
    if guide is None:
        return JSONResponse(status_code=404, content={"error": "Guide not found or already retrieved."})
    return JSONResponse(content=guide)


@app.post("/export-pdf")
async def export_pdf(request: Request):
    """Accept HTML content and return a professionally styled PDF."""
    body = await request.json()
    html_content = body.get("html", "")
    file_name = body.get("file_name", "teacher_guide")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2.5 * cm,
        leftMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
        title=file_name,
        author="Teacher Guide Generator",
    )

    styles = build_pdf_styles()
    try:
        flowables = html_to_platypus(html_content, styles)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"HTML parsing failed: {exc}"})

    if not flowables:
        flowables = [Paragraph("No content to export.", styles["body"])]

    try:
        doc.build(flowables)
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"PDF build failed: {exc}"})

    buffer.seek(0)

    safe_name = re.sub(r"[^\w\-]", "_", file_name)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )
