# Teacher Guide Generator

A FastAPI web app that converts PDF lesson content into structured, editable Teacher Lesson Guides using Google Gemini AI.

## Features

- Upload a `.pdf` file -> AI generates a full Teacher Guide
- Rich editor for: overview, learning outcomes, preparation, lesson procedure, glossary, and bonus activities
- Insert images inside rich-text fields (upload from device or paste image URL)
- Export the finished guide as PDF
- Demo mode for quick UI preview without uploading a file
- Gemini API quota handling with automatic retry and friendly error messages

## Tech Stack

- **Backend**: FastAPI + Python
- **AI**: Google Gemini (`gemini-2.0-flash-lite`) via `google-genai`
- **PDF parsing**: `pdfplumber`
- **Editor**: React + TypeScript + Vite + Tiptap
- **PDF export**: ReportLab

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

### 5. Build the editor bundle (required for one-server mode)

```bash
cd editor
npm install
npm run build
cd ..
```

### 6. Run the server

```bash
python main.py
```

Open http://127.0.0.1:8000 in your browser.

The upload page and editor are both served from the same FastAPI server:

- Generator: `http://127.0.0.1:8000/`
- Editor: `http://127.0.0.1:8000/editor`

## Deploy to Vercel

This project is configured for Vercel serverless deployment using:

- `api/index.py` as the Vercel Python function entrypoint
- `vercel.json` for routing all requests to FastAPI

### 1. Push your code to GitHub

Vercel deploys from your repository.

### 2. Import the project in Vercel

1. Go to Vercel dashboard -> **Add New Project**
2. Select this repository
3. Keep the default framework detection

### 3. Configure environment variables

In Vercel Project Settings -> **Environment Variables**, add:

- `GEMINI_API_KEY` = your Gemini API key

### 4. Deploy

Vercel will install Python dependencies from `requirements.txt` and deploy automatically.

### 5. Build frontend bundle before deploy

If you changed code in `editor/`, run this locally and commit generated `static/editor` files before deploying:

```bash
cd editor
npm install
npm run build
cd ..
```

## Project Structure

```
.
├── main.py              # FastAPI app — routes, Gemini call, PPTX extraction
├── templates/
│   └── index.html       # HTML shell (Jinja2)
├── static/
│   ├── style.css        # All styles
│   └── app.js           # All frontend logic
├── requirements.txt
├── .env.example
└── .gitignore
```
