"""Construcción de los comandos de ffmpeg para el render final."""
from __future__ import annotations

import json
import math
import re
import shutil
from pathlib import Path
from typing import Callable

from .media import MediaInfo, Runner, filter_escape, font_file
from .plan import Segment, frame_select_expr, time_enable_expr

PRESETS = {"alta": ("medium", "18"), "rapida": ("veryfast", "20")}
LOUDNESS = "I=-14:TP=-1.5:LRA=11"  # estándar de YouTube


def output_size(info: MediaInfo) -> tuple[int, int]:
    return info.width // 2 * 2, info.height // 2 * 2


def _x264(quality: str, fps) -> list[str]:
    preset, crf = PRESETS.get(quality, PRESETS["alta"])
    return ["-c:v", "libx264", "-preset", preset, "-crf", crf, "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-g", str(round(float(fps) * 2)), "-bf", "2"]


def render_teaser(runner: Runner, src: Path, info: MediaInfo, pieces: list[Segment], out: Path) -> None:
    """El gancho se renderiza aparte (es un trozo del medio del video) y luego se pega al principio."""
    W, H = output_size(info)
    base = pieces[0][0]
    seek = info.align + base / info.fps
    last = (pieces[-1][1] - base) / info.fps + 1
    vf = (f"setpts=PTS-STARTPTS,fps={info.fps}:start_time=0,select='{frame_select_expr(pieces, base)}',"
          f"setpts=N/FRAME_RATE/TB,scale={W}:{H},setsar=1")
    runner.ffmpeg(["-ss", f"{float(seek):.4f}", "-t", f"{float(last):.3f}", "-i", str(src), "-an", "-vf", vf,
                   "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p", str(out)])


def measure_loudness(runner: Runner, wav: Path) -> dict | None:
    err = runner.capture(["-i", str(wav), "-af", f"loudnorm={LOUDNESS}:print_format=json", "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        values = [float(data[k]) for k in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")]
    except (ValueError, KeyError):
        return None
    if not all(math.isfinite(v) for v in values) or values[0] < -60:
        return {"silent": True}  # audio mudo o casi mudo: no se normaliza
    return data


def loudnorm_filter(measured: dict | None) -> str:
    if measured and measured.get("silent"):
        return "aresample=48000"
    if not measured:
        return f"loudnorm={LOUDNESS},aresample=48000"
    return (f"loudnorm={LOUDNESS}:measured_I={measured['input_i']}:measured_TP={measured['input_tp']}"
            f":measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}"
            f":offset={measured['target_offset']}:linear=true,aresample=48000")


def chapters_metadata(chapters: list[tuple[float, str]], total: float) -> str:
    def esc(text: str) -> str:
        return re.sub(r"([=;#\\\n])", r"\\\1", text)

    lines = [";FFMETADATA1"]
    for i, (start, title) in enumerate(chapters):
        end = chapters[i + 1][0] if i + 1 < len(chapters) else total
        lines += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={int(start * 1000)}", f"END={int(end * 1000)}",
                  f"title={esc(title)}"]
    return "\n".join(lines) + "\n"


def render_main(
    runner: Runner,
    workdir: Path,
    src: Path,
    info: MediaInfo,
    segments: list[Segment],
    teaser: Path | None,
    audio_wav: Path,
    ass: Path | None,
    zooms: list[tuple[float, float]],
    zoom_level: float,
    color: bool,
    quality: str,
    chapters_file: Path | None,
    out: Path,
    total: float,
    on_progress: Callable[[float], None],
) -> None:
    W, H = output_size(info)
    expr_file = workdir / "graph.txt"
    inputs: list[str] = []
    graph: list[str] = []

    idx = 0
    if teaser:
        inputs += ["-i", str(teaser)]
        graph.append(f"[{idx}:v]setpts=PTS-STARTPTS,fps={info.fps}:start_time=0,scale={W}:{H},setsar=1[tv]")
        idx += 1
    main_idx = idx
    inputs += ["-i", str(src)]
    idx += 1
    audio_idx = idx
    inputs += ["-i", str(audio_wav)]
    idx += 1

    graph.append(
        f"[{main_idx}:v]setpts=PTS-{float(info.align):.6f}/TB,fps={info.fps}:start_time=0,"
        f"select='{frame_select_expr(segments)}',setpts=N/FRAME_RATE/TB,scale={W}:{H},setsar=1[m0]")
    last = "m0"
    if zooms:
        zw, zh = round(W * zoom_level / 2) * 2, round(H * zoom_level / 2) * 2
        graph.append("[m0]split[ma][mb]")
        graph.append(f"[mb]scale={zw}:{zh},crop={W}:{H}[mz]")
        graph.append(f"[ma][mz]overlay=0:0:enable='{time_enable_expr(zooms)}'[m1]")
        last = "m1"
    if teaser:
        graph.append(f"[tv][{last}]concat=n=2:v=1:a=0[v0]")
        last = "v0"
    post = []
    if color:
        post.append("eq=contrast=1.05:saturation=1.12,unsharp=5:5:0.35")
    if ass:
        fonts = Path(__file__).resolve().parent.parent / "fonts"
        sub = f"subtitles={ass.name}"
        if fonts.is_dir():
            sub += f":fontsdir='{filter_escape(str(fonts))}'"
        post.append(sub)
    post.append("format=yuv420p")
    graph.append(f"[{last}]{','.join(post)}[vout]")
    expr_file.write_text(";\n".join(graph), encoding="utf-8")

    meta = []
    if chapters_file:
        meta = ["-i", str(chapters_file)]
        meta_idx = idx
        idx += 1

    measured = measure_loudness(runner, audio_wav)
    args = [*inputs, *meta, "-filter_complex_script", str(expr_file),
            "-map", "[vout]", "-map", f"{audio_idx}:a", "-af", loudnorm_filter(measured),
            *_x264(quality, info.fps), "-r", str(info.fps),
            "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart"]
    if chapters_file:
        args += ["-map_metadata", str(meta_idx), "-map_chapters", str(meta_idx)]
    args.append(str(out))
    runner.ffmpeg(args, total=total, on_progress=on_progress, cwd=workdir)


def thumbnail(runner: Runner, src: Path, at: float, text: str, workdir: Path, out: Path) -> None:
    font = font_file("Montserrat")
    vf = ("scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,"
          "eq=contrast=1.12:saturation=1.3:brightness=0.02")
    if text and font:
        # Copiar la fuente evita problemas de rutas con ":" (C:/Windows/...) dentro del filtro.
        shutil.copyfile(font, workdir / "miniatura_fuente")
        words = text.upper().split()
        mid = (len(words) + 1) // 2
        (workdir / "thumb.txt").write_text(" ".join(words[:mid]) + ("\n" + " ".join(words[mid:]) if words[mid:] else ""), encoding="utf-8")
        vf += (",drawbox=x=0:y=0:w=iw*0.62:h=ih:color=black@0.45:t=fill"
               ",drawtext=fontfile=miniatura_fuente:textfile=thumb.txt:fontsize=118:fontcolor=0xFFD400"
               ":borderw=8:bordercolor=black:line_spacing=6:x=60:y=(h-text_h)/2")
    runner.ffmpeg(["-ss", f"{at:.2f}", "-i", str(src), "-frames:v", "1", "-vf", vf, "-q:v", "2", str(out)], cwd=workdir)
