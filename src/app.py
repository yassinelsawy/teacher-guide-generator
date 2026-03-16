"""FastAPI application wiring for Teacher Guide Generator."""

import logging
import secrets
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from src.config import CORS_ORIGINS, EDITOR_BUILD_INDEX, UPLOAD_DIR
from src.data.sample_guide import SAMPLE_GUIDE
from src.services.gemini_service import generate_teacher_guide
from src.services.guide_service import dict_to_teacher_guide, teacher_guide_to_html
from src.services.pdf_service import export_pdf_buffer, safe_pdf_filename
from src.utils.pdf_text import extract_text_from_pdf

logger = logging.getLogger(__name__)

# Temporary in-memory store for generated guides (token -> guide dict)
pending_guides: dict[str, dict] = {}

app = FastAPI(title="PDF -> Teacher Guide Generator")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/editor", response_class=HTMLResponse)
async def editor_shell():
    """Serve the production editor bundle from this same FastAPI server."""
    if not EDITOR_BUILD_INDEX.exists():
        return HTMLResponse(
            status_code=503,
            content=(
                "Editor build not found. Run 'npm run build' in the 'editor' folder "
                "before starting the backend server."
            ),
        )

    return FileResponse(EDITOR_BUILD_INDEX)


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return JSONResponse(status_code=400, content={"error": "Please upload a valid .pdf file."})

    temp_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    try:
        with temp_path.open("wb") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)

        _, slide_text = extract_text_from_pdf(temp_path)
        file_name = Path(file.filename).stem

        if not slide_text.strip():
            return JSONResponse(status_code=422, content={"error": "No readable text found in the uploaded PDF."})

        gemini_data = generate_teacher_guide(file_name, slide_text)
        guide = dict_to_teacher_guide(gemini_data, file_name)
        token = secrets.token_urlsafe(16)
        pending_guides[token] = guide

        return JSONResponse(content={"token": token, "file_name": file_name, "guide": guide})
    except Exception:
        logger.exception("Guide generation failed for file '%s'", file.filename)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to generate the teacher guide. Please try again."},
        )
    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.get("/demo")
async def demo():
    """Return a sample Teacher Guide for UI preview."""
    html = teacher_guide_to_html(SAMPLE_GUIDE)
    return JSONResponse(content={"html": html, "guide": SAMPLE_GUIDE, "file_name": "Sample_Lesson_Introduction_to_AI"})


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

    try:
        buffer = export_pdf_buffer(html_content, file_name)
    except Exception:
        logger.exception("PDF export failed")
        return JSONResponse(status_code=500, content={"error": "Failed to export PDF."})

    safe_name = safe_pdf_filename(file_name)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )
