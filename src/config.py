"""Centralized backend configuration and environment loading."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_MODEL_FALLBACKS = [
    model.strip()
    for model in os.getenv(
        "GEMINI_MODEL_FALLBACKS",
        # Chain of currently-available models across separate capacity pools, so a
        # transient 503/429 on one has a healthy alternative. The retired 1.5-*
        # models were removed — they 404 and only wasted the fallback chain.
        "gemini-2.5-flash-lite,gemini-2.5-flash,gemini-flash-lite-latest,gemini-3.5-flash",
    ).split(",")
    if model.strip()
]

UPLOAD_API_BASE_URL = os.getenv("UPLOAD_API_BASE_URL", "").strip().rstrip("/")

STATIC_DIR = Path("static")
EDITOR_BUILD_INDEX = STATIC_DIR / "editor" / "index.html"

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
