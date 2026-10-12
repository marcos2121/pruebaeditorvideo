"""Flujo completo: video crudo → video editado listo para YouTube."""
from __future__ import annotations

import json
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np

from . import ai, audio, fetch, render
from .config import FONT, EditOptions
from .media import Cancelled, Runner, probe, require_ffmpeg
from .plan import (TimeMap, Word, auto_keywords, auto_threshold, build_segments, emphasis_times, energy_db,
                   is_filler, motion_expr, speech_regions, zoom_intervals)
from .subtitles import Card, build_ass, build_srt
from .transcribe import transcribe, whisper_available

# (clave, nombre visible, peso en la barra de progreso)
STAGES = [
    ("descarga", "Descargando el video", 0.07),
    ("analisis", "Limpiando y analizando el audio", 0.05),
    ("transcripcion", "Transcribiendo palabra por palabra", 0.30),
    ("plan", "Planificando cortes, gancho y capítulos", 0.05),
    ("audio", "Montando el audio (whoosh, música, volumen)", 0.04),
    ("render", "Renderizando el video final", 0.47),
    ("extras", "Miniatura, subtítulos SRT y textos para YouTube", 0.02),
]

AUDIO_CLEAN = ("highpass=f=80,afftdn=nr=12:nf=-40:tn=1,equalizer=f=3500:t=q:w=1.2:g=2.5,"
               "acompressor=threshold=-20dB:ratio=3:attack=10:release=250:makeup=2")
AUDIO_LIGHT = "highpass=f=60,acompressor=threshold=-18dB:ratio=2.5:attack=10:release=250:makeup=1.5"


@dataclass
class JobContext:
    """Lo que el pipeline necesita del trabajo (lo implementa server.Job)."""
    dir: Path
    options: EditOptions
    url: str | None = None
    upload: Path | None = None
    music: Path | None = None
    runner: Runner = field(default_factory=Runner)
    progress: Callable[[str, float], None] = lambda stage, frac: None
    log: Callable[[str], None] = print


def _read_mono16(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16)


def _youtube_text(content: ai.ContentPlan, chapters: list[tuple[float, str]]) -> str:
    parts = []
    if content.titles:
        parts.append("TÍTULOS SUGERIDOS\n" + "\n".join(f"{i + 1}. {t}" for i, t in enumerate(content.titles)))
    desc = content.description.strip()
    if chapters:
        desc += ("\n\n" if desc else "") + "\n".join(f"{ai.fmt_ts(t)} {title}" for t, title in chapters)
    if desc:
        parts.append("DESCRIPCIÓN (cópiala tal cual en YouTube)\n" + desc)
    if content.tags:
        parts.append("ETIQUETAS\n" + ", ".join(content.tags))
    if content.thumbnail_text:
        parts.append("TEXTO PARA LA MINIATURA\n" + content.thumbnail_text)
    if not parts:
        parts.append("Configura tu clave de Claude (ANTHROPIC_API_KEY) para recibir títulos, descripción, "
                     "etiquetas y capítulos con nombre. Este video era demasiado corto para capítulos automáticos.")
    return "\n\n".join(parts) + "\n"


def run(job: JobContext) -> dict:
    require_ffmpeg()
    opts = job.options
    runner = job.runner
    work = job.dir / "trabajo"
    outdir = job.dir / "salida"
    work.mkdir(parents=True, exist_ok=True)
    outdir.mkdir(parents=True, exist_ok=True)

    # 1. Fuente --------------------------------------------------------------
    job.progress("descarga", 0.0)
    if job.upload:
        src = job.upload
    else:
        existing = sorted(work.glob("original.*"))
        if existing:
            src = existing[0]
        else:
            job.log("Descargando desde el enlace…")
            src = fetch.download(job.url or "", work, lambda f, _n: job.progress("descarga", f), runner.check)
    info = probe(src)
    fps = info.fps
    job.log(f"Video: {info.width}×{info.height}, {float(fps):.2f} fps, {ai.fmt_ts(info.duration)} de duración.")
    job.progress("descarga", 1.0)

    # 2. Audio limpio + audio de análisis ------------------------------------
    job.progress("analisis", 0.0)
    clean = work / "voz_limpia.wav"
    analysis = work / "analisis.wav"
    if info.has_audio:
        chain = AUDIO_CLEAN if opts.denoise else AUDIO_LIGHT
        graph = (f"[0:a:0]{chain},asplit=2[a][b];"
                 "[a]aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo[ca];"
                 "[b]aresample=16000,aformat=sample_fmts=s16:channel_layouts=mono[an]")
        runner.ffmpeg(["-i", str(src), "-filter_complex", graph,
                       "-map", "[ca]", "-c:a", "pcm_s16le", str(clean),
                       "-map", "[an]", "-c:a", "pcm_s16le", str(analysis)],
                      total=info.duration, on_progress=lambda f: job.progress("analisis", f))
    else:
        job.log("El video no tiene audio: no habrá cortes de silencios ni subtítulos.")
        runner.ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{info.duration:.3f}",
                       "-c:a", "pcm_s16le", str(clean)])
    job.progress("analisis", 1.0)

    # 3. Transcripción --------------------------------------------------------
    words: list[Word] = []
    warnings: list[str] = []
    language = opts.language if opts.language != "auto" else "es"
    speech: list[tuple[float, float]] = []
    if info.has_audio:
        samples = _read_mono16(analysis)
        db = energy_db(samples, 16000)
        speech = speech_regions(db, 0.02, auto_threshold(db))
        del samples
        if whisper_available():
            job.log(f"Transcribiendo con Whisper ({opts.whisper_model}). Es la parte más lenta…")
            try:
                words, language = transcribe(analysis, opts.language, opts.whisper_model, info.duration,
                                             lambda f: job.progress("transcripcion", f), runner.check,
                                             cache=work / "transcripcion.json")
                job.log(f"Transcripción lista: {len(words)} palabras.")
            except Cancelled:
                raise
            except Exception as exc:  # sin subtítulos, pero el resto de la edición sigue
                job.log(f"No se pudo transcribir ({exc.__class__.__name__}: {exc}). Se sigue sin subtítulos.")
                warnings.append(f"No se pudo transcribir el audio, por eso no hay subtítulos ({exc.__class__.__name__}: "
                                f"{str(exc)[:160]}).")
        else:
            job.log("faster-whisper no está instalado: se cortan silencios pero no habrá subtítulos.")
            warnings.append("Falta faster-whisper: no hay subtítulos. Vuelve a ejecutar la instalación.")
    job.progress("transcripcion", 1.0)

    # 4. Plan -----------------------------------------------------------------
    job.progress("plan", 0.0)
    segments = build_segments(info.duration, speech, words, fps, opts.min_silence, opts.keep_pause,
                              opts.remove_fillers)
    main = TimeMap(segments, fps)
    fillers = sum(1 for w in words if is_filler(w.text))
    job.log(f"Cortes: {len(segments)} tramos; se eliminan {ai.fmt_ts(info.duration - main.duration)} "
            f"de silencios{' y ' + str(fillers) + ' muletillas' if opts.remove_fillers and fillers else ''}.")

    def mapped(tm: TimeMap) -> list[tuple[float, float, str]]:
        out = []
        for w in words:
            if opts.remove_fillers and is_filler(w.text):
                continue
            iv = tm.map_interval(w.start, w.end)
            if iv:
                out.append((iv[0], iv[1], w.text))
        return out

    lines = ai.transcript_lines(mapped(main))
    if ai.ai_available():
        job.log("Claude está analizando el contenido (gancho, capítulos, títulos)…")
    content = ai.analyze(lines, main.duration, language)
    if content.note:
        job.log(content.note)
        if ai.ai_available():
            warnings.append(content.note)
    if not content.keywords:
        content.keywords = auto_keywords(words)
    job.progress("plan", 0.7)

    teaser_pieces = []
    if opts.hook and content.hook:
        teaser_pieces = main.out_to_src_segments(*content.hook)
    teaser_tm = TimeMap(teaser_pieces, fps) if teaser_pieces else None
    teaser_dur = teaser_tm.duration if teaser_tm else 0.0
    if teaser_tm:
        job.log(f"Gancho: {ai.fmt_ts(content.hook[0])}–{ai.fmt_ts(content.hook[1])} se muestra como avance al inicio.")
    final_main = TimeMap(segments, fps, offset=teaser_dur)
    total = teaser_dur + main.duration

    chapters = [(0.0 if i == 0 else teaser_dur + c.start, c.title) for i, c in enumerate(content.chapters)]
    cards: list[Card] = []
    if opts.chapter_cards and content.used_ai:
        cards = [Card(teaser_dur + c.start, c.title, i + 1) for i, c in enumerate(content.chapters) if i > 0]
    flashes: list[float] = []
    if opts.transitions:
        if teaser_tm:
            flashes.append(teaser_dur)
        flashes += [c.start for c in cards]
    zooms = zoom_intervals(main, [c.start for c in content.chapters]) if opts.zoom_cuts else []
    main_words = mapped(main)
    punches = emphasis_times(main_words, content.keywords) if opts.motion else []
    zoom = motion_expr(main, zooms, opts.zoom_level, opts.motion, punches)
    cta_at = None
    if opts.cta and total >= 45:
        # tras el gancho y el rótulo, hacia el primer tercio, en un momento sin tarjeta de capítulo
        cta_at = teaser_dur + max(12.0, min(main.duration * 0.3, 240.0))
        while any(abs(cta_at - c.start) < 5 for c in cards):
            cta_at += 6
    pops = [c.start for c in cards] + ([cta_at] if cta_at is not None else [])

    final_words = (mapped(teaser_tm) if teaser_tm else []) + mapped(final_main)
    breaks = [teaser_dur] if teaser_tm else []
    job.progress("plan", 1.0)

    # 5. Audio ----------------------------------------------------------------
    job.progress("audio", 0.0)
    voice = work / "voz_montada.wav"
    audio.assemble(clean, teaser_pieces + segments, fps, voice)
    job.progress("audio", 0.4)
    music_wav = None
    if job.music:
        music_wav = work / "musica.wav"
        runner.ffmpeg(["-stream_loop", "-1", "-i", str(job.music), "-t", f"{total:.3f}",
                       "-af", f"afade=t=in:d=2,afade=t=out:st={max(0.0, total - 4):.3f}:d=4",
                       "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(music_wav)])
    mixed = work / "mezcla.wav"
    audio.mix(voice, mixed, flashes, music_wav, opts.music_volume_db, pops)
    job.progress("audio", 1.0)

    # 6. Render ---------------------------------------------------------------
    W, H = render.output_size(info)
    teaser_file = None
    if teaser_pieces:
        job.log("Preparando el avance del inicio…")
        teaser_file = work / "avance.mp4"
        render.render_teaser(runner, src, info, teaser_pieces, teaser_file)

    ass_path = None
    if (opts.subtitles != "off" and final_words) or cards or flashes or opts.creator_name or cta_at is not None:
        ass_path = work / "subs.ass"
        ass_path.write_text(build_ass(
            W, H, FONT, final_words, opts.subtitles, content.keywords, breaks, cards, flashes,
            (0.0, teaser_dur) if teaser_tm else None, opts.creator_name, teaser_dur + 1.0, cta_at,
        ), encoding="utf-8")

    chapters_file = None
    if chapters:
        chapters_file = work / "capitulos.txt"
        chapters_file.write_text(render.chapters_metadata(chapters, total), encoding="utf-8")

    final = outdir / "video_editado.mp4"
    job.log("Renderizando el video final. Tarda más o menos lo que dura el video…")
    render.render_main(runner, work, src, info, segments, teaser_file, mixed, ass_path, zoom,
                       opts.color, opts.quality, chapters_file, final, total,
                       lambda f: job.progress("render", f))
    job.progress("render", 1.0)

    # 7. Extras ---------------------------------------------------------------
    job.progress("extras", 0.0)
    if final_words:
        (outdir / "subtitulos.srt").write_text(build_srt(final_words, breaks), encoding="utf-8")
    (outdir / "youtube.txt").write_text(_youtube_text(content, chapters), encoding="utf-8")
    thumb_src = teaser_pieces[0][0] if teaser_pieces else segments[len(segments) // 3][0]
    try:
        render.thumbnail(runner, src, float(thumb_src / fps) + info.align + 0.5, content.thumbnail_text, work,
                         outdir / "miniatura.jpg", vertical=H > W)
    except Exception as exc:  # la miniatura es opcional
        job.log(f"No se pudo crear la miniatura: {exc}")
        warnings.append("No se pudo crear la miniatura.")

    for tmp in (clean, analysis, voice, mixed, music_wav, teaser_file):
        if tmp and tmp.exists():
            tmp.unlink()

    report = {
        "duracion_original": round(info.duration, 2),
        "duracion_final": round(total, 2),
        "segundos_eliminados": round(info.duration - main.duration, 2),
        "cortes": len(segments),
        "muletillas": fillers if opts.remove_fillers else 0,
        "palabras": len(words),
        "idioma": language,
        "usa_ia": content.used_ai,
        "gancho": round(teaser_dur, 2),
        "capitulos": [{"tiempo": ai.fmt_ts(t), "titulo": title} for t, title in chapters],
        "titulos": content.titles,
        "descripcion": content.description,
        "etiquetas": content.tags,
        "nota": content.note,
        "golpes_zoom": len(punches),
        "avisos": warnings,
    }
    (outdir / "informe.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    job.progress("extras", 1.0)
    return report
