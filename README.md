# Teacher Guide Generator

A FastAPI web app that converts PowerPoint presentations into structured, editable Teacher Lesson Guides using Google Gemini AI.

## Features

- Upload a `.pptx` file → AI generates a full Teacher Guide
- Editable sections: overview, objectives, preparation, lesson procedure (Initiate / Learn / Make / Share), glossary, bonus activities
- Download the guide as a `.txt` file
- Demo mode — try it without uploading a file
- Gemini API quota handling with automatic retry and friendly error messages

## Tech Stack

- **Backend**: FastAPI + Python
- **AI**: Google Gemini (`gemini-2.0-flash-lite`) via `google-genai`
- **PPTX parsing**: `python-pptx`
- **Frontend**: Vanilla JS, HTML, CSS (no frameworks)

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
