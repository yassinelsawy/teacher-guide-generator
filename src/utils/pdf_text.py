"""PDF text extraction utilities used by guide generation."""

from pathlib import Path

import pdfplumber


def extract_text_from_pdf(filepath: Path) -> tuple[str, str]:
    """Return (filename_stem, full_page_text)."""
    lines: list[str] = []
    with pdfplumber.open(filepath) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if text and text.strip():
                lines.append(f"--- Page {page_num} ---")
                lines.append(text.strip())

    return filepath.stem, "\n".join(lines)
