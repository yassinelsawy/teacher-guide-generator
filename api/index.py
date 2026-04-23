"""Vercel serverless entrypoint for FastAPI app."""

import sys
from pathlib import Path

# Ensure project root is importable when this file is executed as a function entrypoint.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
	sys.path.insert(0, str(ROOT_DIR))

from src.app import app
