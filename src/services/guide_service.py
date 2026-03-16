"""Guide transformation helpers for AI output and HTML rendering."""

import uuid


def dict_to_teacher_guide(data: dict, file_name: str) -> dict:
    """Convert Gemini JSON output to full TeacherGuide structure with UUIDs."""
    lesson_procedure = []
    for act in data.get("lessonProcedure", []):
        lesson_procedure.append(
            {
                "id": str(uuid.uuid4()),
                "activityType": act.get("activityType", "Explore"),
                "activityTitle": act.get("activityTitle", ""),
                "duration": int(act.get("duration", 10) or 10),
                "slideNumbers": "",
                "instructions": act.get("instructions", ""),
            }
        )

    glossary = [
        {
            "id": str(uuid.uuid4()),
            "concept": g.get("concept", ""),
            "definition": g.get("definition", ""),
        }
        for g in data.get("glossary", [])
    ]

    outcomes = [o for o in data.get("learningOutcomes", []) if o]
    prep = [p for p in data.get("preparation", []) if p]
    bonus = [b for b in data.get("bonusActivities", []) if b]

    return {
        "lessonInfo": {
            "lessonName": data.get("lessonName", file_name.replace("_", " ")),
            "gradeLevel": "",
            "moduleLink": "",
            "slidesLink": "",
            "productionState": "Draft",
        },
        "overview": data.get("overview", ""),
        "learningOutcomes": outcomes or [""],
        "preparation": prep or [""],
        "outlineOverview": [],
        "lessonProcedure": lesson_procedure,
        "publishingGuide": [""],
        "glossary": glossary,
        "bonusActivities": bonus,
    }


def teacher_guide_to_html(guide: dict) -> str:
    """Convert TeacherGuide dict to HTML for preview and export use cases."""
    parts: list[str] = []

    lesson_name = guide.get("lessonInfo", {}).get("lessonName", "")
    if lesson_name:
        parts.append(f"<h1>{lesson_name}</h1>")

    overview = guide.get("overview", "")
    if overview:
        parts.append("<h2>Session Overview</h2>")
        parts.append(overview)

    outcomes = [o for o in guide.get("learningOutcomes", []) if o]
    if outcomes:
        parts.append("<h2>Learning Outcomes</h2>")
        parts.append("<ul>" + "".join(f"<li>{o}</li>" for o in outcomes) + "</ul>")

    prep = [p for p in guide.get("preparation", []) if p]
    if prep:
        parts.append("<h2>Preparation</h2>")
        parts.append("<ul>" + "".join(f"<li>{p}</li>" for p in prep) + "</ul>")

    procedure = guide.get("lessonProcedure", [])
    if procedure:
        parts.append("<h2>Lesson Procedure</h2>")
        for act in procedure:
            header = (
                f"{act.get('activityTitle', '')} "
                f"[{act.get('activityType', '')}] · "
                f"{act.get('duration', 10)} min"
            )
            parts.append(f"<h3>{header}</h3>")
            if act.get("instructions"):
                parts.append(act["instructions"])

    pub = [s for s in guide.get("publishingGuide", []) if s]
    if pub:
        parts.append("<h2>Publishing Guide</h2>")
        parts.append("<ol>" + "".join(f"<li>{s}</li>" for s in pub) + "</ol>")

    glossary = guide.get("glossary", [])
    if glossary:
        parts.append("<h2>Glossary</h2>")
        parts.append(
            "<ul>"
            + "".join(
                f"<li><strong>{g.get('concept', '')}:</strong> {g.get('definition', '')}</li>"
                for g in glossary
            )
            + "</ul>"
        )

    bonus = [b for b in guide.get("bonusActivities", []) if b]
    if bonus:
        parts.append("<h2>Bonus Activities</h2>")
        parts.append("<ul>" + "".join(f"<li>{b}</li>" for b in bonus) + "</ul>")

    return "\n".join(parts)
