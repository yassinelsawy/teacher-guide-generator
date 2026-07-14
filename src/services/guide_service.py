"""Guide transformation helpers for AI output and HTML rendering."""

import uuid


def _normalize_durations(activities: list[dict], session_minutes: int) -> None:
    """Rescale activity ``duration`` values in place to sum to ``session_minutes``.

    Gemini is prompted to target the session length, but its arithmetic is
    unreliable, so we proportionally rescale its durations to the exact total and
    absorb rounding drift into the longest activities — keeping every activity at
    a minimum of one minute. Skipped when the session is too short to give each
    activity at least a minute (then the model's own values are kept).
    """
    if not activities or session_minutes <= 0 or session_minutes < len(activities):
        return

    weights = [max(1, int(a.get("duration", 1) or 1)) for a in activities]
    total = sum(weights)
    scaled = [max(1, round(w / total * session_minutes)) for w in weights]

    drift = session_minutes - sum(scaled)
    while drift > 0:  # hand extra minutes to the longest activities first
        i = max(range(len(scaled)), key=lambda k: scaled[k])
        scaled[i] += 1
        drift -= 1
    while drift < 0:  # trim from the longest activities still above one minute
        candidates = [k for k in range(len(scaled)) if scaled[k] > 1]
        i = max(candidates, key=lambda k: scaled[k])
        scaled[i] -= 1
        drift += 1

    for act, minutes in zip(activities, scaled):
        act["duration"] = minutes


def dict_to_teacher_guide(
    data: dict, file_name: str, session_minutes: int | None = None
) -> dict:
    """Convert Gemini JSON output to full TeacherGuide structure with UUIDs.

    When ``session_minutes`` is given, activity durations are normalized so they
    add up to exactly that many minutes.
    """
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

    if session_minutes:
        _normalize_durations(lesson_procedure, session_minutes)

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

    # Auto-fill the Outline Overview from the generated procedure so the section
    # isn't empty after PDF generation. Each activity maps to one outline row.
    outline_overview = [
        {
            "id": str(uuid.uuid4()),
            "type": "",
            "sectionName": act["activityTitle"],
            "pedagogy": act["activityType"],
            "durationMinutes": act["duration"],
            "slideNumbers": act["slideNumbers"],
        }
        for act in lesson_procedure
    ]

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
        "outlineOverview": outline_overview,
        "lessonProcedure": lesson_procedure,
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
