"""Centralized backend configuration and environment loading."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL_FALLBACKS = [
    model.strip()
    for model in os.getenv(
        "GEMINI_MODEL_FALLBACKS",
        "gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-pro",
    ).split(",")
    if model.strip()
]

UPLOAD_DIR = Path("/tmp/uploads") if os.getenv("VERCEL") else Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

STATIC_DIR = Path("static")
STATIC_DIR.mkdir(exist_ok=True)
EDITOR_BUILD_INDEX = STATIC_DIR / "editor" / "index.html"

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
