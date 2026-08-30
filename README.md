# Teacher Guide Generator

Turn a lesson PDF into a structured, editable teacher guide in seconds.

Teacher Guide Generator is a **FastAPI + React** application that extracts text from an uploaded lesson PDF, sends it to **Google Gemini**, and returns a structured teacher guide. The guide opens in a browser-based editor where you can refine every section, add rich text and images, reorder content, and export to standalone HTML or PDF.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [Local Setup](#local-setup)
- [Running the App](#running-the-app)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Notes & Behavior](#notes--behavior)

---

## Features

### Generator page
- Upload a `.pdf` by drag-and-drop or file picker.
- Extract readable text from the PDF and generate a guide with Gemini.
- Live progress while the app uploads, extracts text, generates, and finalizes.
- Success toast on completion, then auto-opens the editor.
- Import an existing guide from an HTML file to keep editing it.
- Friendly message when the Gemini daily quota is reached, plus automatic model fallback on transient errors.
- Branded iSchool header and a document-style browser-tab favicon.

### Editor
The guide is organized into nine structured sections, plus custom sections:

1. **Lesson Info** – name, grade level, module/slides links, production state
2. **Overview** – rich-text session summary
3. **Learning Outcomes**
4. **Preparation** – rich-text checklist (supports nested bullets and links)
5. **Outline Overview** – table of sections, pedagogy, and duration
6. **Lesson Procedure** – typed activities (Recap, Explore, Make, Evaluate, Share, etc.) with rich-text instructions
7. **Glossary**
8. **Bonus Activities** – rich-text checklist (supports nested bullets and links)
9. **Custom Sections** – add sections of any type, rename them, and reorder with drag-and-drop

Editor capabilities:
- Rich text editing (Tiptap) for overview and activity instructions.
- Inline image upload with crop/resize, plus drag-to-reposition inside the editor.
- Collapse/expand sections and a read-only preview mode.
- Global undo button.
- Autosave to browser local storage.
- Back button to return to the generator.
- Export as standalone HTML, or print/export to PDF.

---

## How It Works

```
PDF file ──▶ pdf.js (browser text extraction) ──▶ POST /generate ──▶ Gemini (structured guide)
                                                                          │
                            browser local storage ◀── React editor ◀── one-time token
                                                                          │
                                                            HTML export / PDF export
```

1. The PDF never leaves the browser: `pdf.js` extracts the slide text client-side, keeping the request body small regardless of PDF size (avoids serverless body-size limits). The server truncates it to 60k characters before generation.
2. The extracted text is sent as JSON to `POST /generate`.
3. Gemini generates a structured guide, which is returned with a one-time retrieval token.
4. The editor loads the guide and autosaves edits locally.
5. Exports render either standalone HTML or a ReportLab-generated PDF.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI, Uvicorn, Jinja2 |
| AI | Google Gemini via `google-genai` |
| PDF text extraction | `pdf.js` (client-side, in the browser) |
| PDF export | ReportLab |
| Editor | React, TypeScript, Vite, Tailwind CSS, Radix UI, Tiptap, dnd-kit |
| Hosting | Vercel serverless (or single FastAPI server) |

---

## Requirements

- Python 3.10+
- Node.js 18+
- A Gemini API key — get one free at <https://aistudio.google.com/apikey>

---

## Configuration

Create a `.env` file in the project root (see `.env.example`):

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_MODEL_FALLBACKS=gemini-2.5-flash-lite,gemini-2.5-flash,gemini-flash-lite-latest,gemini-3.5-flash
UPLOAD_API_BASE_URL=
```

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | — | Your Gemini API key. |
| `GEMINI_MODEL` | | `gemini-2.5-flash-lite` | Primary generation model. |
| `GEMINI_MODEL_FALLBACKS` | | see above | Comma-separated models tried on transient 503/429 errors. |
| `UPLOAD_API_BASE_URL` | | *(blank)* | API base URL for the upload page. Leave blank for same-origin requests. |

---

## Local Setup

Install backend dependencies:

```bash
python -m venv .venv
.\.venv\Scripts\activate        # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
```

Install editor dependencies:

```bash
cd editor
npm install
cd ..
```

---

## Running the App

### Option 1 — FastAPI only (uses the built editor bundle)

```bash
uvicorn src.app:app --reload
```

- Generator: <http://127.0.0.1:8000/>
- Editor shell: <http://127.0.0.1:8000/editor>

> The `/editor` route needs a built bundle in `static/editor`. If it isn't built yet, run `npm run build` in `editor/` first (see Option 3).

### Option 2 — Backend + Vite dev server (best for editor development)

Terminal 1:

```bash
uvicorn src.app:app --reload
```

Terminal 2:

```bash
cd editor
npm run dev
```

Then open the Vite URL, usually <http://localhost:5173>.

### Option 3 — Build editor assets and run a single server

```bash
cd editor
npm run build      # outputs to static/editor
cd ..
uvicorn src.app:app --reload
```

---

## Deployment

### Vercel

- `api/index.py` is the serverless entrypoint.
- `vercel.json` routes all requests to the FastAPI app (60s max duration).
- Set `GEMINI_API_KEY` in the Vercel project settings.
- PDF text is extracted client-side (`pdf.js`) before the request reaches the server, so uploads stay well under Vercel's serverless body-size limit regardless of PDF size.
- Rebuild the editor before deploying frontend changes:

```bash
cd editor
npm run build
cd ..
```

### Self-hosting

The backend serves both the generator page and the built editor bundle from the same FastAPI app once `static/editor` has been built. Run it behind any ASGI server (e.g. Uvicorn/Gunicorn).

---

## API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Generator / upload page. |
| `GET` | `/editor` | Built editor shell. |
| `POST` | `/generate` | Generate a guide from `{ file_name, slide_text, session_minutes }` (text already extracted client-side); returns `{ token, file_name, guide }`. |
| `GET` | `/guide/{token}` | Retrieve a generated guide once (consumed on read). |
| `GET` | `/demo` | Sample guide payload for preview/testing. |
| `POST` | `/export-pdf` | Convert `{ html, file_name }` into a downloadable PDF. |

---

## Project Structure

```text
.
├─ api/
│  └─ index.py                 # Vercel serverless entrypoint
├─ editor/                     # React + TypeScript editor source
│  ├─ src/
│  │  ├─ components/           # UI components
│  │  ├─ editor/               # Section editors
│  │  ├─ services/             # API calls
│  │  ├─ types.ts             # Shared guide domain models
│  │  └─ App.tsx
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.ts
├─ src/                        # FastAPI backend
│  ├─ app.py                   # Routes and app wiring
│  ├─ config.py                # Environment and path config
│  ├─ data/sample_guide.py     # Demo guide payload
│  └─ services/                # Gemini, guide, and PDF services
├─ static/                     # Upload page assets (incl. pdf.js text extraction) + built editor output
├─ templates/index.html        # Upload page template
├─ requirements.txt
└─ vercel.json
```

---

## Notes & Behavior

- Generated guides are stored **temporarily in memory** by token and are consumed on first read.
- The editor **autosaves to browser local storage**, so work survives a refresh.
- Older saved guides are **normalized on load** so custom sections stay safe across app updates.
- Very long PDFs are truncated to 60,000 characters of extracted text before generation.
- On transient Gemini errors (503/429), the app retries and falls back through the configured model chain; when the daily quota is exhausted it shows a clear, user-friendly message.
