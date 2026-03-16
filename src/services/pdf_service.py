"""PDF rendering service for converting guide HTML into downloadable PDFs."""

import base64
import io
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image as RLImage,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


def build_pdf_styles() -> dict:
    base = getSampleStyleSheet()
    accent = colors.HexColor("#4f46e5")

    return {
        "h1": ParagraphStyle(
            "TG_H1",
            parent=base["Normal"],
            fontSize=22,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#1a202c"),
            spaceAfter=6,
            spaceBefore=0,
            leading=28,
        ),
        "h2": ParagraphStyle(
            "TG_H2",
            parent=base["Normal"],
            fontSize=14,
            fontName="Helvetica-Bold",
            textColor=accent,
            spaceAfter=4,
            spaceBefore=14,
            leading=18,
        ),
        "h3": ParagraphStyle(
            "TG_H3",
            parent=base["Normal"],
            fontSize=12,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#374151"),
            spaceAfter=3,
            spaceBefore=8,
            leading=16,
        ),
        "body": ParagraphStyle(
            "TG_Body",
            parent=base["Normal"],
            fontSize=10.5,
            fontName="Helvetica",
            textColor=colors.HexColor("#374151"),
            spaceAfter=6,
            leading=16,
            alignment=TA_LEFT,
        ),
    }


def html_to_platypus(html_content: str, styles: dict) -> list:
    """Convert Quill-generated HTML to a list of ReportLab flowables."""
    flowables = []

    def clean_inner(text: str) -> str:
        text = re.sub(r"<span\b[^>]*>(.*?)</span>", r"\1", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<strong\b[^>]*>", "<b>", text, flags=re.IGNORECASE)
        text = re.sub(r"</strong>", "</b>", text, flags=re.IGNORECASE)
        text = re.sub(r"<em\b[^>]*>", "<i>", text, flags=re.IGNORECASE)
        text = re.sub(r"</em>", "</i>", text, flags=re.IGNORECASE)
        text = re.sub(r"<br\s*/?>", "\x00BR\x00", text, flags=re.IGNORECASE)
        text = re.sub(r"<(?!/?(?:b|i|u)\b)[^>]+>", "", text, flags=re.IGNORECASE)
        text = text.replace("\x00BR\x00", "<br/>")

        replacements = [
            ("&nbsp;", " "),
            ("&mdash;", "—"),
            ("&ndash;", "–"),
            ("&rarr;", "→"),
            ("&larr;", "←"),
            ("&ldquo;", "“"),
            ("&rdquo;", "”"),
            ("&lsquo;", "‘"),
            ("&rsquo;", "’"),
            ("&hellip;", "…"),
            ("&copy;", "©"),
            ("&reg;", "®"),
        ]
        for entity, char in replacements:
            text = text.replace(entity, char)

        text = re.sub(r"&(?!(?:amp|lt|gt|#\d+);)", "&amp;", text)
        return text.strip()

    pos = 0
    length = len(html_content)

    while pos < length:
        ws = re.match(r"\s+", html_content[pos:])
        if ws:
            pos += ws.end()
            continue

        img_in_p = re.match(
            r'<p\b[^>]*>\s*(<img\b[^>]*src="([^"]+)"[^>]*/?>\s*)+</p>',
            html_content[pos:],
            re.DOTALL | re.IGNORECASE,
        )
        if img_in_p:
            for img_match in re.finditer(r'<img\b[^>]*src="([^"]+)"[^>]*/?>', img_in_p.group(0), re.IGNORECASE):
                src = img_match.group(1)
                try:
                    if src.startswith("data:image"):
                        _, b64data = src.split(",", 1)
                        img_bytes = base64.b64decode(b64data)
                    else:
                        import urllib.request

                        with urllib.request.urlopen(src) as resp:
                            img_bytes = resp.read()

                    from PIL import Image as PILImage

                    pil = PILImage.open(io.BytesIO(img_bytes))
                    orig_w, orig_h = pil.size
                    max_w = 14 * cm
                    scale = max_w / orig_w
                    pil_rgb = pil.convert("RGB")
                    out_buf = io.BytesIO()
                    pil_rgb.save(out_buf, format="JPEG", quality=90)
                    out_buf.seek(0)
                    rl_img = RLImage(out_buf, width=max_w, height=orig_h * scale)
                    flowables.append(Spacer(1, 0.2 * cm))
                    flowables.append(rl_img)
                    flowables.append(Spacer(1, 0.2 * cm))
                except Exception:
                    pass

            pos += img_in_p.end()
            continue

        block = re.match(
            r"<(h1|h2|h3|p|ul|ol)\b[^>]*>(.*?)</\1>",
            html_content[pos:],
            re.DOTALL | re.IGNORECASE,
        )
        if block:
            tag = block.group(1).lower()
            inner = clean_inner(block.group(2))

            try:
                if tag == "h1":
                    flowables.append(Paragraph(inner, styles["h1"]))
                    flowables.append(Spacer(1, 0.3 * cm))
                elif tag == "h2":
                    flowables.append(Spacer(1, 0.4 * cm))
                    flowables.append(Paragraph(inner, styles["h2"]))
                    flowables.append(Spacer(1, 0.15 * cm))
                elif tag == "h3":
                    flowables.append(Spacer(1, 0.2 * cm))
                    flowables.append(Paragraph(inner, styles["h3"]))
                    flowables.append(Spacer(1, 0.1 * cm))
                elif tag == "p":
                    if inner:
                        flowables.append(Paragraph(inner, styles["body"]))
                        flowables.append(Spacer(1, 0.15 * cm))
                elif tag in ("ul", "ol"):
                    items_raw = re.findall(r"<li\b[^>]*>(.*?)</li>", block.group(2), re.DOTALL | re.IGNORECASE)
                    list_items = [
                        ListItem(Paragraph(clean_inner(item), styles["body"]), leftIndent=12, spaceAfter=3)
                        for item in items_raw
                    ]
                    if list_items:
                        flowables.append(
                            ListFlowable(
                                list_items,
                                bulletType="bullet" if tag == "ul" else "1",
                                leftIndent=20,
                                bulletFontSize=8,
                            )
                        )
                        flowables.append(Spacer(1, 0.2 * cm))
            except Exception:
                pass

            pos += block.end()
            continue

        img_tag = re.match(r'<img\b[^>]*src="([^"]+)"[^>]*/?>', html_content[pos:], re.IGNORECASE)
        if img_tag:
            src = img_tag.group(1)
            try:
                if src.startswith("data:image"):
                    _, b64data = src.split(",", 1)
                    img_bytes = base64.b64decode(b64data)
                else:
                    import urllib.request

                    with urllib.request.urlopen(src) as resp:
                        img_bytes = resp.read()

                from PIL import Image as PILImage

                pil = PILImage.open(io.BytesIO(img_bytes))
                orig_w, orig_h = pil.size
                max_w = 14 * cm
                scale = max_w / orig_w
                pil_rgb = pil.convert("RGB")
                out_buf = io.BytesIO()
                pil_rgb.save(out_buf, format="JPEG", quality=90)
                out_buf.seek(0)
                rl_img = RLImage(out_buf, width=max_w, height=orig_h * scale)
                flowables.append(Spacer(1, 0.2 * cm))
                flowables.append(rl_img)
                flowables.append(Spacer(1, 0.2 * cm))
            except Exception:
                pass

            pos += img_tag.end()
            continue

        pos += 1

    return flowables


def export_pdf_buffer(html_content: str, file_name: str) -> io.BytesIO:
    """Build a reportlab PDF in memory from guide HTML content."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2.5 * cm,
        leftMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
        title=file_name,
        author="Teacher Guide Generator",
    )

    styles = build_pdf_styles()
    flowables = html_to_platypus(html_content, styles)
    if not flowables:
        flowables = [Paragraph("No content to export.", styles["body"])]

    doc.build(flowables)
    buffer.seek(0)
    return buffer


def safe_pdf_filename(file_name: str) -> str:
    """Return a file-system safe filename stem for PDF download."""
    return re.sub(r"[^\w\-]", "_", file_name)
