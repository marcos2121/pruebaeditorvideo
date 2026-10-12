"""Análisis del contenido con Claude: gancho, capítulos, títulos, descripción y etiquetas.

Si no hay clave de Anthropic configurada se usa un plan básico sin IA.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from .config import AI_MODEL

SCHEMA = {
    "type": "object",
    "properties": {
        "titles": {"type": "array", "items": {"type": "string"}},
        "description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "chapters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"start_seconds": {"type": "number"}, "title": {"type": "string"}},
                "required": ["start_seconds", "title"],
                "additionalProperties": False,
            },
        },
        "hook": {
            "type": "object",
            "properties": {
                "start_seconds": {"type": "number"},
                "end_seconds": {"type": "number"},
                "reason": {"type": "string"},
            },
            "required": ["start_seconds", "end_seconds", "reason"],
            "additionalProperties": False,
        },
        "keywords": {"type": "array", "items": {"type": "string"}},
        "thumbnail_text": {"type": "string"},
    },
    "required": ["titles", "description", "tags", "chapters", "hook", "keywords", "thumbnail_text"],
    "additionalProperties": False,
}

SYSTEM = """You are a senior YouTube editor and growth strategist. You receive the timestamped transcript of a long-form video that has already been cleaned of silences. Plan the packaging and structure of the edit.

Return:
- titles: 3 YouTube title options, max 70 characters each, curiosity-driven but honest to the content.
- description: 2 short paragraphs summarising what the viewer will learn/get, written for search (natural keywords, no hashtag spam, no timestamps - chapters are added separately).
- tags: 10-15 search tags.
- chapters: the natural topic sections of the video. First chapter starts at 0. Each chapter at least 60 seconds long; typically one every 3-8 minutes. Titles of 2-6 words, specific (not "Part 2"). Use the timestamp where the new topic actually starts.
- hook: the single most compelling, self-contained 12-30 second moment (a strong claim, result, emotional peak or surprising statement) that will be shown as a teaser at the very start. It must not be within the first 60 seconds. Start and end at sentence boundaries using the transcript timestamps.
- keywords: 10-30 important single words from the transcript (exactly as spoken) to highlight in the subtitles - concepts, numbers, names. No stop words.
- thumbnail_text: 2-4 punchy words for the thumbnail.

Write every text field in the same language as the transcript."""


@dataclass
class Chapter:
    start: float  # segundos en la línea de tiempo principal (sin el gancho)
    title: str


@dataclass
class ContentPlan:
    chapters: list[Chapter] = field(default_factory=list)
    hook: tuple[float, float] | None = None
    titles: list[str] = field(default_factory=list)
    description: str = ""
    tags: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    thumbnail_text: str = ""
    used_ai: bool = False
    note: str = ""


def ai_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def fmt_ts(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m:02d}:{sec:02d}"


def transcript_lines(words: list[tuple[float, float, str]], max_words: int = 22) -> list[tuple[float, str]]:
    """Agrupa palabras (ya en tiempo final) en líneas cortas con su marca de tiempo."""
    lines: list[tuple[float, str]] = []
    cur: list[str] = []
    start = 0.0
    for s, _e, text in words:
        if not cur:
            start = s
        cur.append(text)
        if len(cur) >= max_words or text.endswith((".", "?", "!")):
            lines.append((start, " ".join(cur)))
            cur = []
    if cur:
        lines.append((start, " ".join(cur)))
    return lines


def _clean(plan: ContentPlan, duration: float) -> ContentPlan:
    chapters = sorted((c for c in plan.chapters if 0 <= c.start < duration - 20), key=lambda c: c.start)
    kept: list[Chapter] = []
    for c in chapters:
        if kept and c.start - kept[-1].start < 30:
            continue
        kept.append(Chapter(c.start, c.title.strip()[:80] or "Capítulo"))
    if kept:
        kept[0].start = 0.0
    # YouTube exige al menos 3 capítulos para mostrarlos.
    plan.chapters = kept if len(kept) >= 3 else []

    if plan.hook:
        a, b = plan.hook
        if b - a > 35:
            b = a + 35
        if a < 30 or b - a < 6 or b > duration:
            plan.hook = None
        else:
            plan.hook = (a, b)
    plan.titles = [t.strip() for t in plan.titles if t.strip()][:3]
    plan.tags = [t.strip() for t in plan.tags if t.strip()][:20]
    plan.keywords = [k.strip() for k in plan.keywords if k.strip()][:40]
    return plan


def fallback_plan(lines: list[tuple[float, str]], duration: float) -> ContentPlan:
    plan = ContentPlan(note="Sin clave de Claude: capítulos automáticos por duración, sin gancho ni títulos sugeridos.")
    if duration >= 180 and lines:
        n = max(3, min(12, round(duration / 300)))
        step = duration / n
        for i in range(n):
            target = i * step
            start, text = min(lines, key=lambda line: abs(line[0] - target))
            words = text.split()[:6]
            title = " ".join(words).strip(" ,.;:¿?¡!").capitalize() or f"Parte {i + 1}"
            plan.chapters.append(Chapter(0.0 if i == 0 else start, title))
    return _clean(plan, duration)


def analyze(lines: list[tuple[float, str]], duration: float, language: str) -> ContentPlan:
    if not ai_available() or not lines:
        return fallback_plan(lines, duration)

    import anthropic

    transcript = "\n".join(f"[{fmt_ts(t)} | {t:.1f}s] {text}" for t, text in lines)
    user = (f"Video length: {fmt_ts(duration)} ({duration:.0f} seconds). Language code: {language}.\n"
            f"Timestamps are given as [mm:ss | seconds]; answer with seconds.\n\n<transcript>\n{transcript}\n</transcript>")
    try:
        client = anthropic.Anthropic()
        response = client.beta.messages.create(
            model=AI_MODEL,
            max_tokens=16000,
            system=SYSTEM,
            messages=[{"role": "user", "content": user}],
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}, "effort": "medium"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError:
        plan = fallback_plan(lines, duration)
        plan.note = "La clave de Anthropic no es válida; se usó el plan básico sin IA."
        return plan
    except anthropic.APIError as exc:
        plan = fallback_plan(lines, duration)
        plan.note = f"Claude no respondió ({exc.__class__.__name__}); se usó el plan básico sin IA."
        return plan

    if response.stop_reason in ("refusal", "max_tokens"):
        plan = fallback_plan(lines, duration)
        plan.note = "Claude no pudo analizar este video; se usó el plan básico sin IA."
        return plan

    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return fallback_plan(lines, duration)

    hook = data.get("hook") or {}
    plan = ContentPlan(
        chapters=[Chapter(float(c["start_seconds"]), str(c["title"])) for c in data.get("chapters", [])],
        hook=(float(hook["start_seconds"]), float(hook["end_seconds"])) if hook else None,
        titles=list(data.get("titles", [])),
        description=str(data.get("description", "")),
        tags=list(data.get("tags", [])),
        keywords=list(data.get("keywords", [])),
        thumbnail_text=str(data.get("thumbnail_text", "")),
        used_ai=True,
    )
    return _clean(plan, duration)
