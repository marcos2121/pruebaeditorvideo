"""Transcripción palabra por palabra con faster-whisper (corre en tu propio equipo)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from .media import Cancelled
from .plan import Word

# Darle a Whisper un texto con muletillas hace que las transcriba en vez de "limpiarlas",
# así luego podemos recortarlas del video.
FILLER_PROMPT = {
    "es": "Eh... bueno, ehm, mmm, a ver, o sea, este... vale.",
    "en": "Um, uh... so, hmm, like, you know, uh, okay.",
}


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def transcribe(wav16k: Path, language: str, model_size: str, duration: float,
               on_progress: Callable[[float], None], check: Callable[[], None],
               cache: Path | None = None) -> tuple[list[Word], str]:
    if cache and cache.exists():
        data = json.loads(cache.read_text(encoding="utf-8"))
        return [Word(**w) for w in data["words"]], data["language"]

    lang = None if language in ("", "auto") else language

    def run(device: str, compute_type: str):
        from faster_whisper import WhisperModel

        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        segments, info = model.transcribe(
            str(wav16k),
            language=lang,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 400},
            beam_size=5,
            condition_on_previous_text=False,
            initial_prompt=FILLER_PROMPT.get(lang or "es"),
        )
        out: list[Word] = []
        for seg in segments:  # la transcripción ocurre mientras se recorre
            check()
            for w in seg.words or []:
                text = w.word.strip()
                if text and w.end > w.start:
                    out.append(Word(float(w.start), float(w.end), text))
            if duration:
                on_progress(min(1.0, seg.end / duration))
        return out, info

    try:
        words, info = run("auto", "default")
    except Cancelled:
        raise
    except Exception:
        # Típico en Windows con tarjeta NVIDIA sin las librerías CUDA: se repite en el procesador.
        on_progress(0.0)
        words, info = run("cpu", "int8")
    detected = info.language or (lang or "es")
    if cache:
        cache.write_text(json.dumps({"language": detected, "words": [w.to_dict() for w in words]}, ensure_ascii=False), encoding="utf-8")
    return words, detected
