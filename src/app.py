"""FastAPI application wiring for Teacher Guide Generator."""

import logging
import secrets
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from src.config import CORS_ORIGINS, EDITOR_BUILD_INDEX, UPLOAD_API_BASE_URL, UPLOAD_DIR
from src.data.sample_guide import SAMPLE_GUIDE
from src.services.gemini_service import GuideGenerationBusyError, generate_teacher_guide
from src.services.guide_service import dict_to_teacher_guide, teacher_guide_to_html
from src.services.pdf_service import export_pdf_buffer, safe_pdf_filename
from src.utils.pdf_text import extract_text_from_pdf

logger = logging.getLogger(__name__)

# Temporary in-memory store for generated guides (token -> guide dict)
pending_guides: dict[str, dict] = {}

# Upper bound on PDF text sent to Gemini. Large decks can push generation past
# the serverless timeout; this keeps latency predictable without losing the gist.
MAX_SLIDE_TEXT_CHARS = 60_000


class ImmutableStaticFiles(StaticFiles):
    """Serves content-hashed build assets with cache-forever headers.

    Vite fingerprints these filenames by content hash, so a changed file always
    gets a new name — safe to cache indefinitely and avoids stale HTML shells
    referencing since-deleted asset files after a redeploy.
    """

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


app = FastAPI(title="PDF -> Teacher Guide Generator")
# Must be mounted before the general /static mount so its more specific
# prefix takes precedence for editor asset requests.
_editor_assets_dir = EDITOR_BUILD_INDEX.parent / "assets"
if _editor_assets_dir.is_dir():
    app.mount(
        "/static/editor/assets",
        ImmutableStaticFiles(directory=_editor_assets_dir),
        name="editor-assets",
    )
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
    response = templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "request": request,
            "upload_api_base_url": UPLOAD_API_BASE_URL,
        },
    )
    response.headers["Cache-Control"] = "no-store"
    return response


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

    response = FileResponse(EDITOR_BUILD_INDEX)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.post("/upload")
async def upload(file: UploadFile = File(...), session_minutes: int = Form(default=45)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return JSONResponse(status_code=400, content={"error": "Please upload a valid .pdf file."})

    # Clamp the teacher-supplied session length to a sane range.
    session_minutes = max(10, min(240, session_minutes))

    temp_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    try:
        with temp_path.open("wb") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)

        _, slide_text = extract_text_from_pdf(temp_path)
        file_name = Path(file.filename).stem

        if not slide_text.strip():
            return JSONResponse(status_code=422, content={"error": "No readable text found in the uploaded PDF."})

        # Cap the prompt size: very long decks slow generation enough to risk the
        # serverless timeout, and the guide only needs a representative sample.
        if len(slide_text) > MAX_SLIDE_TEXT_CHARS:
            slide_text = slide_text[:MAX_SLIDE_TEXT_CHARS]

        gemini_data = generate_teacher_guide(file_name, slide_text, session_minutes=session_minutes)
        guide = dict_to_teacher_guide(gemini_data, file_name, session_minutes=session_minutes)
        token = secrets.token_urlsafe(16)
        pending_guides[token] = guide

        return JSONResponse(content={"token": token, "file_name": file_name, "guide": guide})
    except GuideGenerationBusyError as exc:
        logger.warning("Guide generation busy/timed out for file '%s': %s", file.filename, exc)
        return JSONResponse(status_code=503, content={"error": str(exc)})
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
