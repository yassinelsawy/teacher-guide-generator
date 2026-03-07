# Teacher Guide Generator

A FastAPI web app that turns a publicly shared Google Drive PowerPoint into a structured, editable Teacher Lesson Guide using Google Gemini AI.

## Features

- Paste a public Google Drive link to a `.pptx` file → Gemini reads the presentation and generates a full Teacher Guide
- No server-side PPTX parsing — Gemini analyses the file directly via the Files API
- Structured sections: Session Overview, Learning Objectives, Preparation, Lesson Procedure (Initiate / Learn / Make / Share), Glossary, Bonus Activities
- Rich-text editor (Quill) — edit and format the generated guide directly in the browser
- Embed custom images into the guide from within the editor
- Export the finished guide as a styled **PDF** (via ReportLab)
- Demo mode — try it without a link
- Gemini API quota handling with automatic exponential-backoff retry and friendly error messages

## Tech Stack

- **Backend**: FastAPI + Python
- **AI**: Google Gemini (`gemini-2.0-flash-lite`) via `google-genai` (Files API + generate)
- **PDF generation**: `reportlab`
- **Frontend**: Vanilla JS, HTML, CSS + [Quill](https://quilljs.com/) rich-text editor

## How it works

```
User pastes Drive link
  → FastAPI extracts the file ID
  → Downloads the PPTX bytes from Google Drive
  → Uploads the PPTX to Gemini Files API
  → Calls gemini-2.0-flash-lite with the uploaded file + prompt
  → Returns generated HTML
  → HTML is loaded into the Quill editor
```

> **Note:** The shared Google Drive file must be set to **"Anyone with the link can view"**.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serve the main UI |
| `POST` | `/generate-from-link` | Accept `{"drive_link": "..."}`, return generated HTML guide |
| `GET` | `/demo` | Return a sample guide (no link required) |
| `POST` | `/export-pdf` | Accept HTML from the editor, return a PDF file |

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/teacher-guide-generator.git
cd teacher-guide-generator
```

### 2. Create a virtual environment

```bash
python -m venv .venv
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure your API key

Copy `.env.example` to `.env` and add your Gemini API key:

```bash
copy .env.example .env
```

Get a free key at https://aistudio.google.com/apikey

### 5. Run the server

```bash
uvicorn main:app --reload
```

Open http://127.0.0.1:8000 in your browser.

## Project Structure

```
.
├── main.py              # FastAPI app — routes, Drive download, Gemini Files API, PDF export
├── templates/
│   └── index.html       # HTML shell (Jinja2)
├── static/
│   ├── style.css        # All styles
│   └── app.js           # All frontend logic (Drive link input, Quill editor, PDF export)
├── requirements.txt
├── .env.example
└── .gitignore
```

