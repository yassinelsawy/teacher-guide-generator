# Teacher Guide Generator

Teacher Guide Generator is a FastAPI + React application that converts uploaded lesson PDFs into structured, editable teacher guides using Google Gemini.

## Website Features

### Upload and Generation (Generator Page)

- Drag-and-drop PDF upload with click-to-browse fallback.
- PDF file type validation (`.pdf` only).
- Multi-step progress spinner messages during generation:
  - Uploading file
  - PDF text extraction
  - Gemini generation
  - Finalization
- Friendly inline error messages for invalid files, network failures, and backend errors.
- Success state with auto-open behavior into the editor.
- Manual `Open in Editor` button after generation.

### AI Generation Pipeline

- PDF text extraction using `pdfplumber`.
- Gemini prompt designed to produce structured teacher-guide content.
- Resilient model selection:
  - primary model via `GEMINI_MODEL`
  - fallback models via `GEMINI_MODEL_FALLBACKS`
- Automatic retry with exponential backoff for quota/rate-limit responses.
- One-time token handoff flow:
  - `POST /upload` returns `{ token, file_name, guide }`
  - generated guide is stored server-side in a temporary in-memory token map
  - editor retrieves it once via `GET /guide/{token}`

### Guide Import on Generator Page

- `Import Guide (.html)` button on the upload page.
- HTML file parsing with `FileReader` and `DOMParser` before loading.
- Imported guides are mapped into the existing editor schema, persisted to local storage, and opened in the editor.

### Editor Experience

- Structured teacher-guide editor built with React + TypeScript.
- 9 editable sections:
  1. Lesson Info
  2. Overview (Lesson Scenario)
  3. Learning Outcomes
  4. Preparation
  5. Outline Overview
  6. Lesson Procedure
  7. Publishing Guide
  8. Glossary
  9. Bonus Activities
- Collapsible sections with badges/counts for content visibility.
- Preview mode toggle (read-only view).
- Save status indicator (`saving`, `saved locally`, `error`).
- Debounced autosave to browser local storage.
- Two-click reset protection.
- Token-based loading screen when opening editor from generator.
- Same-tab navigation for Generate Teacher Guide, Open in Editor, and Import HTML.

### Rich Text Editing

- Tiptap-based editor fields for rich content (for overview/instructions and section components).
- Rich text toolbar features include:
  - bold
  - italic
  - underline
  - bullet list
  - ordered list
  - undo/redo
- Image support:
  - upload from local file (base64)
  - insert by URL

### Export Options

- Export as standalone HTML document.
- Print-based PDF export flow in editor (`window.print()` with print styles).
- Backend HTML-to-PDF endpoint available at `POST /export-pdf` for server-side PDF generation.

### Demo and Preview Utilities

- `GET /demo` endpoint returns sample guide payload + HTML for quick UI testing.

### Deployment and Runtime Modes

- One-server mode: FastAPI serves upload page, API, and built editor bundle.
- Split dev mode: FastAPI backend + Vite dev server for editor.
- Vercel routing via `api/index.py` and `vercel.json`.

## Tech Stack

- Backend: FastAPI, Uvicorn, Jinja2
- AI: Google Gemini via `google-genai`
- PDF text extraction: `pdfplumber`
- PDF rendering/export: ReportLab
- Frontend editor: React, TypeScript, Vite, Tailwind, Radix UI, Tiptap

## Prerequisites

- Python 3.10+
- Node.js 18+
- Gemini API key from https://aistudio.google.com/apikey

## Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_FALLBACKS=gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-pro
```

Required:

- `GEMINI_API_KEY`

Optional:

- `GEMINI_MODEL`
- `GEMINI_MODEL_FALLBACKS`

## Local Setup

### 1) Install backend dependencies

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Install editor dependencies

```bash
cd editor
npm install
cd ..
```

## Run Options

### Option A: One-server mode (recommended)

Build editor assets, then serve everything from FastAPI:

```bash
cd editor
npm run build
cd ..
python main.py
```

Open:

- Generator: http://127.0.0.1:8000/
- Editor shell: http://127.0.0.1:8000/editor

### Option B: Split dev mode (Vite + FastAPI)

Run backend:

```bash
python main.py
```

Run editor dev server in a second terminal:

```bash
cd editor
npm run dev
```

Open editor at Vite URL (usually http://localhost:5173). API requests are proxied from `/api/*` to `http://localhost:8000/*`.

## API Endpoints

- `GET /` - Upload UI.
- `POST /upload` - Upload PDF, generate guide, return `{ token, file_name, guide }`.
- `GET /guide/{token}` - Fetch generated guide by token (one-time retrieval).
- `GET /demo` - Return sample guide payload + HTML for preview/testing.
- `GET /editor` - Serve built editor in one-server mode.
- `POST /export-pdf` - Convert HTML payload into downloadable PDF.

## Deployment (Vercel)

This repository includes Vercel support:

- `api/index.py` exposes the FastAPI app for serverless routing.
- `vercel.json` routes requests to the API app.

Before deploying frontend changes, rebuild the editor and commit generated files under `static/editor`:

```bash
cd editor
npm run build
cd ..
```

Set at least this environment variable in Vercel project settings:

- `GEMINI_API_KEY`

## Project Structure

```text
.
|- main.py                        # Thin runtime entrypoint (imports app from src)
|- src/                           # Backend application package
|  |- app.py                      # FastAPI routes and app wiring
|  |- config.py                   # Environment/config setup
|  |- services/
|  |  |- gemini_service.py        # Gemini prompt + generation logic
|  |  |- guide_service.py         # Guide transformation and HTML rendering
|  |  `- pdf_service.py           # HTML -> PDF conversion utilities
|  |- utils/
|  |  `- pdf_text.py              # PDF text extraction helpers
|  `- data/
|     `- sample_guide.py          # Demo/sample guide payload
|- api/
|  `- index.py                    # Vercel serverless entrypoint
|- editor/                        # React + TypeScript editor app
|  |- src/
|  |  |- App.tsx                  # Editor container
|  |  |- main.tsx                 # Editor bootstrap
|  |  |- components/              # UI components (sections, toolbar, primitives)
|  |  |- editor/                  # Guide normalization and import helpers
|  |  |- hooks/                   # React hooks (autosave)
|  |  |- services/                # Frontend export services
|  |  |- styles/                  # Base/editor/print style modules
|  |  |- utils/                   # Shared frontend utilities
|  |  `- types.ts                 # Teacher Guide domain types
|  `- public/                     # Editor public static assets
|- templates/
|  `- index.html                  # Upload page template
|- static/
|  |- app.js                      # Upload page interaction logic
|  |- styles/
|  |  `- upload.css               # Upload page stylesheet
|  `- editor/                     # Built editor assets (generated)
|- uploads/                       # Local temporary upload directory
|- requirements.txt
`- vercel.json
```
