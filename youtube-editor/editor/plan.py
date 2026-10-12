"""Plan de cortes: qué partes del video original se quedan y cómo se mapean al video final.

Todo se trabaja en índices de fotograma (enteros) para que imagen y sonido queden
sincronizados al milímetro aunque haya cientos de cortes.
"""
from __future__ import annotations

import bisect
import re
from dataclasses import dataclass
from fractions import Fraction

import numpy as np

FILLER_RE = re.compile(r"^(e+h+m*|e+m+|m+|h+m+|u+h+m*|u+m+)$")

Segment = tuple[int, int]  # [frame_inicio, frame_fin)


@dataclass
class Word:
    start: float
    end: float
    text: str

    def to_dict(self) -> dict:
        return {"start": round(self.start, 3), "end": round(self.end, 3), "text": self.text}


def normalize_word(text: str) -> str:
    return re.sub(r"[^\wáéíóúüñ]", "", text.lower())


def is_filler(text: str) -> bool:
    return bool(FILLER_RE.match(normalize_word(text)))


# --------------------------------------------------------------------------- energía

def energy_db(samples: np.ndarray, sr: int, hop: float = 0.02) -> np.ndarray:
    """dBFS por ventana de `hop` segundos (audio mono int16)."""
    n = int(sr * hop)
    usable = len(samples) // n * n
    if usable == 0:
        return np.full(1, -90.0)
    frames = samples[:usable].astype(np.float32).reshape(-1, n) / 32768.0
    rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def auto_threshold(db: np.ndarray) -> float:
    """Umbral entre el ruido de fondo y el nivel de la voz, robusto a micrófonos distintos."""
    floor = float(np.percentile(db, 10))
    voice = float(np.percentile(db, 90))
    thr = floor + (voice - floor) * 0.3
    return min(max(thr, -55.0), -28.0)


def speech_regions(db: np.ndarray, hop: float, threshold: float) -> list[tuple[float, float]]:
    active = db > threshold
    regions: list[tuple[float, float]] = []
    start = None
    for i, on in enumerate(active):
        if on and start is None:
            start = i
        elif not on and start is not None:
            regions.append((start * hop, i * hop))
            start = None
    if start is not None:
        regions.append((start * hop, len(active) * hop))
    # descarta chasquidos aislados de menos de 80 ms
    return [r for r in regions if r[1] - r[0] >= 0.08]


# --------------------------------------------------------------------------- cortes

def _merge(intervals: list[tuple[float, float]], gap: float = 0.0) -> list[tuple[float, float]]:
    out: list[list[float]] = []
    for s, e in sorted(intervals):
        if out and s - out[-1][1] <= gap:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [(s, e) for s, e in out]


def _subtract(intervals: list[tuple[float, float]], cuts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    result = []
    cuts = sorted(cuts)
    for s, e in intervals:
        pieces = [(s, e)]
        for cs, ce in cuts:
            if ce <= s or cs >= e:
                continue
            nxt = []
            for ps, pe in pieces:
                if ce <= ps or cs >= pe:
                    nxt.append((ps, pe))
                    continue
                if cs > ps:
                    nxt.append((ps, cs))
                if ce < pe:
                    nxt.append((ce, pe))
            pieces = nxt
        result.extend(pieces)
    return result


def build_segments(
    duration: float,
    speech: list[tuple[float, float]],
    words: list[Word],
    fps: Fraction,
    min_silence: float = 0.6,
    keep_pause: float = 0.15,
    remove_fillers: bool = True,
) -> list[Segment]:
    """Devuelve los tramos a conservar como índices de fotograma [inicio, fin)."""
    spoken = [(w.start, w.end) for w in words if not is_filler(w.text)]
    intervals = _merge(speech + spoken)
    # Las pausas cortas forman parte del habla natural: solo se recortan las largas.
    intervals = _merge(intervals, gap=min_silence)
    intervals = [(max(0.0, s - keep_pause), min(duration, e + keep_pause)) for s, e in intervals]
    intervals = _merge(intervals)

    if remove_fillers:
        fillers = [(w.start, w.end) for w in words if is_filler(w.text) and w.end > w.start]
        intervals = [p for p in _subtract(intervals, fillers) if p[1] - p[0] >= 0.15]

    total_frames = int(duration * fps)
    segments: list[Segment] = []
    for s, e in intervals:
        fs = max(0, round(s * fps))
        fe = min(total_frames, round(e * fps))
        if fe - fs < 3:
            continue
        if segments and fs <= segments[-1][1]:
            segments[-1] = (segments[-1][0], max(segments[-1][1], fe))
        else:
            segments.append((fs, fe))
    if not segments and total_frames > 0:
        segments = [(0, total_frames)]
    return segments


# --------------------------------------------------------------------------- mapa de tiempos

class TimeMap:
    """Traduce tiempos del video original al video final (y al revés)."""

    def __init__(self, segments: list[Segment], fps: Fraction, offset: float = 0.0):
        self.segments = segments
        self.fps = fps
        self.offset = offset
        self.src_starts = [a / fps for a, _ in segments]
        self.src_ends = [b / fps for _, b in segments]
        self.out_starts: list[float] = []
        acc = 0
        for a, b in segments:
            self.out_starts.append(offset + acc / fps)
            acc += b - a
        self.frames = acc
        self.duration = float(acc / fps)

    def to_out(self, t: float) -> float | None:
        i = bisect.bisect_right(self.src_starts, t) - 1
        if i < 0 or t >= self.src_ends[i]:
            return None
        return self.out_starts[i] + (t - self.src_starts[i])

    def map_interval(self, s: float, e: float) -> tuple[float, float] | None:
        """Mapea un intervalo recortándolo a las partes que sobreviven."""
        i = max(0, bisect.bisect_right(self.src_starts, s) - 1)
        first = last = None
        while i < len(self.segments) and self.src_starts[i] < e:
            if self.src_ends[i] > s:
                a = max(s, self.src_starts[i])
                b = min(e, self.src_ends[i])
                if first is None:
                    first = self.out_starts[i] + (a - self.src_starts[i])
                last = self.out_starts[i] + (b - self.src_starts[i])
            i += 1
        if first is None or last is None or last - first < 0.02:
            return None
        return float(first), float(last)

    def out_to_src_segments(self, oa: float, ob: float) -> list[Segment]:
        """Tramos del original (en fotogramas) que forman el intervalo [oa, ob) del video final."""
        oa -= self.offset
        ob -= self.offset
        result: list[Segment] = []
        acc = 0
        for a, b in self.segments:
            length = b - a
            seg_oa, seg_ob = acc, acc + length
            fa = max(seg_oa, round(oa * self.fps))
            fb = min(seg_ob, round(ob * self.fps))
            if fb > fa:
                result.append((a + fa - seg_oa, a + fb - seg_oa))
            acc += length
        return result

    def boundaries(self) -> list[float]:
        """Instantes del video final donde hay un corte."""
        return [float(t) for t in self.out_starts[1:]]


def zoom_intervals(tm: TimeMap, resets: list[float], min_hold: float = 2.0) -> list[tuple[float, float]]:
    """Alterna plano normal / acercado en cada corte (sin cambiar más de una vez cada `min_hold` s).

    En los `resets` (inicios de capítulo) se vuelve siempre al plano normal.
    """
    zoomed = False
    last_change = tm.offset
    start = None
    out: list[tuple[float, float]] = []
    resets = sorted(resets)
    for t in tm.boundaries():
        if any(abs(t - r) < 1.0 for r in resets):
            new = False
        elif t - last_change >= min_hold:
            new = not zoomed
        else:
            new = zoomed
        if new != zoomed:
            if new:
                start = t
            elif start is not None:
                out.append((start, t))
            zoomed = new
            last_change = t
    if zoomed and start is not None:
        out.append((start, tm.offset + tm.duration))
    return out


def frame_select_expr(segments: list[Segment], base: int = 0) -> str:
    """Expresión de ffmpeg `select` que deja pasar solo los fotogramas de los tramos."""
    return "+".join(f"between(n,{a - base},{b - base - 1})" for a, b in segments)


def time_enable_expr(intervals: list[tuple[float, float]]) -> str:
    return "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in intervals) or "0"
