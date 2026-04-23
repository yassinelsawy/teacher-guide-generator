# Teacher Guide Generator

Teacher Guide Generator is a FastAPI + React application that turns lesson PDFs into structured, editable teacher guides with Gemini, then opens them in a browser-based editor.

## What The App Does

### Generator Page

- Upload a `.pdf` by drag-and-drop or file picker.
- Extract readable text from the PDF and send it to Gemini.
- Show progress while the app uploads, extracts text, generates content, and finalizes the guide.
- Return the generated guide in a one-time token flow and open it in the editor.
- Import an existing guide from an HTML file and load it into the editor.

### Editor

- Edit the guide in 9 structured sections:
  1. Lesson Info
  2. Overview
  3. Learning Outcomes
  4. Preparation
  5. Outline Overview
  6. Lesson Procedure
  7. Publishing Guide
  8. Glossary
  9. Bonus Activities
- Collapse sections, preview read-only output, and autosave locally.
- Export the guide as standalone HTML.
- Print the guide to PDF using the browser print flow.

### Backend

- `POST /upload` uploads a PDF and returns a guide payload plus a token.
- `GET /guide/{token}` loads a generated guide once.
- `GET /demo` returns a sample guide for testing.
- `POST /export-pdf` converts HTML into a PDF.

## Tech Stack

- Backend: FastAPI, Uvicorn, Jinja2
- AI: Google Gemini via `google-genai`
- PDF text extraction: `pdfplumber`
- PDF export: ReportLab
- Editor: React, TypeScript, Vite, Tailwind, Radix UI, Tiptap

## Requirements

- Python 3.10+
- Node.js 18+
- Gemini API key from https://aistudio.google.com/apikey

## Configuration

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_FALLBACKS=gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-pro
UPLOAD_API_BASE_URL=
```

Required:

- `GEMINI_API_KEY`

Optional:

- `GEMINI_MODEL`
- `GEMINI_MODEL_FALLBACKS`
- `UPLOAD_API_BASE_URL` - Optional API base URL for the upload page. Leave blank for same-origin.

## Local Setup

Install backend dependencies:

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Install editor dependencies:

```bash
cd editor
npm install
cd ..
```

## Run Locally

### Option 1: FastAPI only

Run the backend:

```bash
uvicorn src.app:app --reload
```

Open:

- Generator: http://127.0.0.1:8000/
- Editor shell: http://127.0.0.1:8000/editor

### Option 2: Backend + Vite dev server

Run the backend:

```bash
uvicorn src.app:app --reload
```

Run the editor in another terminal:

```bash
cd editor
npm run dev
```

Then open the Vite editor URL, usually http://localhost:5173.

### Option 3: Build editor assets and run one server

Build the editor first:

```bash
cd editor
npm run build
cd ..
```

Then run the backend:

```bash
uvicorn src.app:app --reload
```

## Deployment

### Vercel

- `api/index.py` is the serverless entrypoint.
- `vercel.json` routes requests to the FastAPI app.
- Set `GEMINI_API_KEY` in Vercel project settings.
- Rebuild the editor before deploying frontend changes:

```bash
cd editor
npm run build
cd ..
```

### Local Hosting Mode

The backend serves the generator page and built editor bundle from the same FastAPI app when `static/editor` has been built.

## API Endpoints

- `GET /` - Upload page.
- `POST /upload` - Upload a PDF and generate a teacher guide.
- `GET /guide/{token}` - Retrieve a generated guide once.
- `GET /demo` - Sample guide payload for preview/testing.
- `GET /editor` - Built editor shell.
- `POST /export-pdf` - HTML to PDF export.

## Project Structure

```text
.
|- api/
|  `- index.py                    # Vercel serverless entrypoint
|- editor/                        # React + TypeScript editor source
|  |- src/
|  |- index.html
|  |- package.json
|  |- tsconfig.json
|  `- vite.config.ts
|- src/                           # FastAPI backend
|  |- app.py                      # Routes and app wiring
|  |- config.py                   # Environment and path config
|  |- data/
|  |- services/
|  `- utils/
|- static/                        # Upload page assets and built editor output
|- templates/
|  `- index.html                  # Upload page template
|- requirements.txt
`- vercel.json
```

## Notes

- The generator stores uploaded guides temporarily in memory by token.
- The editor autosaves to browser local storage.
- The app expects the Gemini API key to be configured in your environment.
