"""Montaje del audio: cortes exactos a la muestra, efectos de transición y música con ducking.

Se procesa por bloques para que un video de horas no necesite gigas de RAM.
"""
from __future__ import annotations

import wave
from fractions import Fraction
from pathlib import Path

import numpy as np

from .plan import Segment

SR = 48000
CH = 2
FADE = int(SR * 0.004)  # 4 ms en cada corte para evitar chasquidos
BLOCK = SR * 10


def _open_write(path: Path) -> wave.Wave_write:
    w = wave.open(str(path), "wb")
    w.setnchannels(CH)
    w.setsampwidth(2)
    w.setframerate(SR)
    return w


def assemble(clean_wav: Path, pieces: list[Segment], fps: Fraction, out_path: Path) -> int:
    """Concatena los tramos (en fotogramas) del audio limpio. Devuelve el total de muestras."""
    fade_in = np.linspace(0.0, 1.0, FADE, dtype=np.float32)[:, None]
    fade_out = fade_in[::-1]
    written = 0
    cum_frames = 0
    with wave.open(str(clean_wav), "rb") as src, _open_write(out_path) as dst:
        total_src = src.getnframes()
        for a, b in pieces:
            out_start = round(cum_frames / fps * SR)
            cum_frames += b - a
            out_end = round(cum_frames / fps * SR)
            n = out_end - out_start
            start = round(a / fps * SR)
            src.setpos(min(start, total_src))
            raw = src.readframes(n)
            chunk = np.frombuffer(raw, dtype=np.int16).reshape(-1, CH).astype(np.float32)
            if len(chunk) < n:  # el audio original es un poco más corto que el video
                chunk = np.vstack([chunk, np.zeros((n - len(chunk), CH), np.float32)])
            if n > 2 * FADE:
                chunk[:FADE] *= fade_in
                chunk[-FADE:] *= fade_out
            dst.writeframes(chunk.astype(np.int16).tobytes())
            written += n
    return written


def whoosh(duration: float = 0.7, seed: int = 7) -> np.ndarray:
    """Efecto 'whoosh' sintetizado: ruido con un filtro que barre y paneo de izquierda a derecha."""
    rng = np.random.default_rng(seed)
    n = int(SR * duration)
    noise = rng.standard_normal(n).astype(np.float32)
    x = np.linspace(0, 1, n, dtype=np.float32)
    peak = 0.45
    sweep = np.where(x < peak, x / peak, 1 - (x - peak) / (1 - peak))
    cutoff = 300 + 5200 * sweep ** 2
    alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
    out = np.empty(n, np.float32)
    y = 0.0
    for i in range(n):
        y += alpha[i] * (noise[i] - y)
        out[i] = y
    env = np.where(x < peak, (x / peak) ** 2, ((1 - x) / (1 - peak)) ** 1.5)
    out *= env
    out /= np.max(np.abs(out)) + 1e-9
    out *= 0.22
    pan = x
    return np.stack([out * np.sqrt(1 - pan), out * np.sqrt(pan)], axis=1) * 32767


def pop(duration: float = 0.09) -> np.ndarray:
    """'Pop' corto para los botones y tarjetas: tono que cae de 900 a 250 Hz."""
    n = int(SR * duration)
    x = np.arange(n, dtype=np.float32) / SR
    freq = 900 * (250 / 900) ** (x / duration)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = np.sin(phase) * np.exp(-x * 45) * 0.28
    return np.stack([tone, tone], axis=1).astype(np.float32) * 32767


def mix(voice_wav: Path, out_path: Path, whooshes: list[float], music_wav: Path | None,
        music_db: float, pops: list[float] = ()) -> None:
    """Voz + efectos (whoosh, pop) + música (que baja sola cuando hablas y sube un poco en las pausas)."""
    wh, pp = whoosh(), pop()
    effects = [(int(t * SR) - int(len(wh) * 0.45), wh) for t in whooshes] + [(int(t * SR), pp) for t in pops]

    base = 10 ** (music_db / 20)
    lifted = 10 ** ((music_db + 6) / 20)
    env_block = int(SR * 0.05)
    gain_state = base

    music = wave.open(str(music_wav), "rb") if music_wav else None
    with wave.open(str(voice_wav), "rb") as voice, _open_write(out_path) as dst:
        total = voice.getnframes()
        pos = 0
        while pos < total:
            n = min(BLOCK, total - pos)
            v = np.frombuffer(voice.readframes(n), np.int16).reshape(-1, CH).astype(np.float32)
            out = v.copy()

            for s, fx in effects:
                a, b = max(s, pos), min(s + len(fx), pos + n)
                if a < b:
                    out[a - pos:b - pos] += fx[a - s:b - s]

            if music is not None:
                m_raw = music.readframes(n)
                m = np.frombuffer(m_raw, np.int16).reshape(-1, CH).astype(np.float32)
                if len(m) < n:
                    m = np.vstack([m, np.zeros((n - len(m), CH), np.float32)])
                # envolvente de la voz cada 50 ms → ganancia de la música suavizada
                blocks = max(1, n // env_block)
                gains = np.empty(blocks, np.float32)
                for i in range(blocks):
                    seg = v[i * env_block:(i + 1) * env_block]
                    rms = np.sqrt(np.mean(seg * seg) + 1e-9) / 32768
                    target = base if 20 * np.log10(rms + 1e-9) > -42 else lifted
                    coef = 0.5 if target < gain_state else 0.04  # baja rápido, sube despacio
                    gain_state += (target - gain_state) * coef
                    gains[i] = gain_state
                g = np.repeat(gains, env_block)
                if len(g) < n:
                    g = np.concatenate([g, np.full(n - len(g), gains[-1], np.float32)])
                out += m * g[:n, None]

            out *= 0.85  # margen; la normalización final sube el volumen a -14 LUFS
            dst.writeframes(np.clip(out, -32768, 32767).astype(np.int16).tobytes())
            pos += n
    if music is not None:
        music.close()
