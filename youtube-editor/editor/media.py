"""Utilidades de ffmpeg / ffprobe."""
from __future__ import annotations

import json
import shutil
import subprocess
import threading
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Callable

STANDARD_FPS = [Fraction(24000, 1001), Fraction(24), Fraction(25), Fraction(30000, 1001), Fraction(30),
                Fraction(50), Fraction(60000, 1001), Fraction(60)]


class Cancelled(Exception):
    pass


class FFmpegError(RuntimeError):
    pass


@dataclass
class MediaInfo:
    duration: float
    width: int
    height: int
    fps: Fraction
    has_audio: bool
    align: float  # segundos entre el inicio del archivo y la primera muestra de audio


def require_ffmpeg() -> None:
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise FFmpegError(f"No se encontró {tool}. Instálalo y vuelve a intentarlo.")


def _parse_rate(value: str | None) -> Fraction | None:
    try:
        r = Fraction(value)  # "30000/1001"
        return r if r > 0 else None
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def snap_fps(rate: Fraction | None) -> Fraction:
    if rate is None:
        return Fraction(30)
    return min(STANDARD_FPS, key=lambda s: abs(float(s) - float(rate)))


def probe(path: Path) -> MediaInfo:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise FFmpegError("No se pudo leer el archivo. ¿Es un video válido?\n" + out.stderr[-500:])
    data = json.loads(out.stdout)
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"
                  and not s.get("disposition", {}).get("attached_pic")), None)
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
    if video is None:
        raise FFmpegError("El archivo no tiene pista de video.")
    width, height = int(video["width"]), int(video["height"])
    rotation = 0
    for side in video.get("side_data_list", []) or []:
        if "rotation" in side:
            rotation = int(side["rotation"])
    if "rotate" in video.get("tags", {}):
        rotation = int(video["tags"]["rotate"])
    if abs(rotation) % 180 == 90:
        width, height = height, width
    duration = float(data.get("format", {}).get("duration") or video.get("duration") or 0)
    file_start = float(data.get("format", {}).get("start_time") or 0)
    audio_start = float(audio.get("start_time") or file_start) if audio else file_start
    rate = _parse_rate(video.get("avg_frame_rate")) or _parse_rate(video.get("r_frame_rate"))
    return MediaInfo(
        duration=duration,
        width=width,
        height=height,
        fps=snap_fps(rate),
        has_audio=audio is not None,
        align=max(0.0, audio_start - file_start) if audio else 0.0,
    )


class Runner:
    """Ejecuta ffmpeg con barra de progreso y posibilidad de cancelar."""

    def __init__(self) -> None:
        self._proc: subprocess.Popen | None = None
        self._lock = threading.Lock()
        self.cancelled = False

    def cancel(self) -> None:
        self.cancelled = True
        with self._lock:
            if self._proc and self._proc.poll() is None:
                self._proc.kill()

    def check(self) -> None:
        if self.cancelled:
            raise Cancelled()

    def ffmpeg(self, args: list[str], total: float | None = None,
               on_progress: Callable[[float], None] | None = None, cwd: Path | None = None) -> None:
        self.check()
        cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-progress", "pipe:1", "-nostats", *args]
        with self._lock:
            self._proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                          cwd=str(cwd) if cwd else None)
        proc = self._proc
        stderr_chunks: list[str] = []
        reader = threading.Thread(target=lambda: stderr_chunks.append(proc.stderr.read()), daemon=True)
        reader.start()
        assert proc.stdout is not None
        for line in proc.stdout:
            if on_progress and total and line.startswith("out_time_us="):
                try:
                    us = int(line.split("=", 1)[1])
                    on_progress(min(1.0, max(0.0, us / 1e6 / total)))
                except ValueError:
                    pass
        proc.wait()
        reader.join(timeout=5)
        self.check()
        if proc.returncode != 0:
            raise FFmpegError("ffmpeg falló:\n" + "".join(stderr_chunks)[-1500:])

    def capture(self, args: list[str]) -> str:
        """Ejecuta ffmpeg y devuelve stderr (para filtros que informan por ahí, como loudnorm)."""
        self.check()
        cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", *args]
        with self._lock:
            self._proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        _, err = self._proc.communicate()
        self.check()
        if self._proc.returncode != 0:
            raise FFmpegError("ffmpeg falló:\n" + err[-1500:])
        return err


def font_file(family: str) -> str | None:
    """Ruta a un archivo de fuente negrita (para drawtext)."""
    if shutil.which("fc-match"):
        for query in (f"{family}:style=Bold", f"{family}:bold", "DejaVu Sans:bold", "sans:bold"):
            out = subprocess.run(["fc-match", "-f", "%{file}", query], capture_output=True, text=True)
            if out.returncode == 0 and out.stdout and Path(out.stdout).exists():
                return out.stdout
    for candidate in ("C:/Windows/Fonts/arialbd.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if Path(candidate).exists():
            return candidate
    return None


def filter_escape(value: str) -> str:
    """Escapa un valor para usarlo dentro de una opción de filtro de ffmpeg."""
    return value.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
