# Teacher Guide Generator

Teacher Guide Generator is a FastAPI + React application that converts uploaded lesson PDFs into structured, editable teacher guides using Google Gemini.

## Latest Features

- PDF upload flow with drag-and-drop UI and guided progress states.
- AI guide generation from PDF text extraction (`pdfplumber`) using Gemini.
- Resilient model handling:
	- configurable primary model (`GEMINI_MODEL`, default `gemini-2.5-flash`)
	- automatic fallback model list (`GEMINI_MODEL_FALLBACKS`)
	- retry with exponential backoff for quota/rate-limit errors.
- Token-based handoff from generator to editor (`/upload` -> `/editor?token=...`), with one-time retrieval via `/guide/{token}`.
- Rich teacher guide editor (React + TypeScript + Tiptap) with 9 editable sections:
	- Lesson Info
	- Overview
	- Learning Outcomes
	- Preparation
	- Outline Overview
	- Lesson Procedure
	- Publishing Guide
	- Glossary
	- Bonus Activities
- Autosave to browser local storage with debounce and save-status indicators.
- Preview mode toggle and print-ready export flow.
- JSON export that removes internal editor-only IDs.
- Two-click reset protection for clearing the guide.
- Demo endpoint (`/demo`) for quick UI testing without uploading a file.
- Server-side PDF export endpoint (`/export-pdf`) that supports text formatting, lists, and embedded images from HTML content.
- One-server production mode where FastAPI serves both generator and built editor bundle.

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

Only `GEMINI_API_KEY` is required. The model variables are optional overrides.

## Local Setup

### 1. Install backend dependencies

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Install editor dependencies

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
- `GET /demo` - Return sample guide payload for preview/testing.
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
|- main.py                 # Core FastAPI app and routes
|- api/index.py            # Vercel entrypoint
|- templates/index.html    # Upload page template
|- static/app.js           # Upload page client logic
|- static/style.css        # Upload page styles
|- static/editor/          # Built editor assets (from Vite build)
|- editor/                 # React + TypeScript source
|- requirements.txt
|- vercel.json
`- uploads/                # Local temporary upload directory
```
