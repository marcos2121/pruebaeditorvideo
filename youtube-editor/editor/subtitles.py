"""Subtítulos (ASS para quemar en el video, SRT para subir a YouTube) y gráficos animados.

Los rótulos de capítulo, el destello de transición, la etiqueta del gancho y el rótulo con el
nombre del creador también se dibujan como eventos ASS: así todo sale en una sola pasada de ffmpeg.
"""
from __future__ import annotations

from dataclasses import dataclass

from .plan import normalize_word

WHITE = "&H00FFFFFF&"
YELLOW = "&H0000D4FF&"   # #FFD400
VOLT = "&H0000FF9D&"     # #9DFF00 (color de marca)
BLACK = "&H00000000&"

TimedWord = tuple[float, float, str]


@dataclass
class Card:
    start: float
    title: str
    number: int


def _ts(t: float) -> str:
    t = max(0.0, t)
    cs = int(round(t * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _srt_ts(t: float) -> str:
    ms = int(round(max(0.0, t) * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _esc(text: str) -> str:
    return text.replace("\\", "/").replace("{", "(").replace("}", ")")


def chunk_words(words: list[TimedWord], max_chars: int, max_dur: float, breaks: list[float] = (),
                max_gap: float = 0.7) -> list[list[TimedWord]]:
    chunks: list[list[TimedWord]] = []
    cur: list[TimedWord] = []
    for w in words:
        if cur:
            prev = cur[-1]
            length = sum(len(x[2]) + 1 for x in cur) + len(w[2])
            hard_break = any(prev[1] - 0.01 <= b <= w[0] + 0.01 for b in breaks)
            if (length > max_chars or w[0] - prev[1] > max_gap or w[1] - cur[0][0] > max_dur
                    or prev[2].endswith((".", "?", "!")) or hard_break):
                chunks.append(cur)
                cur = []
        cur.append(w)
    if cur:
        chunks.append(cur)
    return chunks


def _two_lines(text_words: list[str]) -> str:
    text = " ".join(text_words)
    if len(text) <= 42:
        return text
    best, best_diff = 1, 10**9
    for i in range(1, len(text_words)):
        a, b = " ".join(text_words[:i]), " ".join(text_words[i:])
        diff = abs(len(a) - len(b))
        if diff < best_diff:
            best, best_diff = i, diff
    return " ".join(text_words[:best]) + "\n" + " ".join(text_words[best:])


def build_srt(words: list[TimedWord], breaks: list[float] = ()) -> str:
    chunks = chunk_words(words, max_chars=84, max_dur=5.0, breaks=breaks)
    out = []
    for i, ch in enumerate(chunks):
        end = ch[-1][1] + 0.25
        if i + 1 < len(chunks):
            end = min(end, chunks[i + 1][0][0])
        out.append(f"{i + 1}\n{_srt_ts(ch[0][0])} --> {_srt_ts(end)}\n{_two_lines([w[2] for w in ch])}\n")
    return "\n".join(out)


def build_ass(
    width: int,
    height: int,
    font: str,
    words: list[TimedWord],
    style: str,
    keywords: list[str],
    breaks: list[float],
    cards: list[Card],
    flashes: list[float],
    teaser: tuple[float, float] | None,
    creator: str,
    creator_at: float,
) -> str:
    W, H = width, height
    fs = round(H * 0.055)
    out = round(H * 0.0042)
    margin_v = round(H * 0.075)
    margin_h = round(W * 0.08)
    styles = [
        f"Style: Sub,{font},{fs},{WHITE},{WHITE},{BLACK},&H96000000&,-1,0,0,0,100,100,0,0,1,{out},{max(1, out // 2)},2,{margin_h},{margin_h},{margin_v},1",
        f"Style: Chapter,{font},{round(H * 0.085)},{WHITE},{WHITE},{BLACK},&H64000000&,-1,0,0,0,100,100,0,0,1,{round(out * 0.8)},2,5,{margin_h},{margin_h},0,1",
        f"Style: Label,{font},{round(H * 0.034)},{VOLT},{VOLT},{BLACK},&H64000000&,-1,0,0,0,100,100,6,0,1,{round(out * 0.6)},1,5,0,0,0,1",
        f"Style: Tag,{font},{round(H * 0.03)},{BLACK},{BLACK},{VOLT},&H00000000&,-1,0,0,0,100,100,4,0,3,{round(H * 0.01)},0,7,0,0,0,1",
        f"Style: Lower,{font},{round(H * 0.042)},{WHITE},{WHITE},&H40000000&,&H00000000&,-1,0,0,0,100,100,1,0,3,{round(H * 0.014)},0,1,0,0,0,1",
        f"Style: Shape,{font},20,{WHITE},{WHITE},{BLACK},{BLACK},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
    ]
    events: list[str] = []

    def ev(layer: int, start: float, end: float, st: str, text: str) -> None:
        if end > start:
            events.append(f"Dialogue: {layer},{_ts(start)},{_ts(end)},{st},,0,0,0,,{text}")

    rect = f"m 0 0 l {W} 0 {W} {H} 0 {H}"

    # --- subtítulos
    if style != "off" and words:
        kw = {normalize_word(k) for k in keywords if k}
        highlight = style == "highlight"
        chunks = chunk_words(words, max_chars=32 if highlight else 84, max_dur=3.0 if highlight else 5.0,
                             breaks=breaks)
        for ci, ch in enumerate(chunks):
            chunk_end = ch[-1][1] + 0.25
            if ci + 1 < len(chunks):
                chunk_end = min(chunk_end, chunks[ci + 1][0][0])
            if not highlight:
                ev(0, ch[0][0], chunk_end, "Sub", _esc(_two_lines([w[2] for w in ch])).replace("\n", "\\N"))
                continue
            for wi, w in enumerate(ch):
                start = ch[0][0] if wi == 0 else w[0]
                end = ch[wi + 1][0] if wi + 1 < len(ch) else chunk_end
                parts = []
                for xi, x in enumerate(ch):
                    word = _esc(x[2])
                    if xi == wi:
                        parts.append(f"{{\\c{YELLOW}}}{word}{{\\c{WHITE}}}")
                    elif normalize_word(x[2]) in kw:
                        parts.append(f"{{\\c{VOLT}}}{word}{{\\c{WHITE}}}")
                    else:
                        parts.append(word)
                pop = "{\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}" if wi == 0 else ""
                ev(0, start, end, "Sub", pop + " ".join(parts))

    # --- rótulos de capítulo
    for card in cards:
        s, e = card.start, card.start + 2.8
        ev(2, s, e, "Shape", f"{{\\an7\\pos(0,0)\\p1\\1c{BLACK}\\1a&H90&\\fad(200,400)}}{rect}")
        ev(3, s + 0.1, e, "Label", f"{{\\an5\\pos({W // 2},{round(H * 0.4)})\\fad(200,350)}}CAPÍTULO {card.number}")
        ev(3, s + 0.1, e, "Chapter",
           f"{{\\an5\\pos({W // 2},{round(H * 0.5)})\\fad(200,350)\\fscx85\\fscy85\\t(0,300,\\fscx100\\fscy100)}}"
           f"{_esc(card.title.upper())}")
        bar_w, bar_h = round(W * 0.08), max(4, round(H * 0.008))
        ev(3, s + 0.2, e, "Shape",
           f"{{\\an7\\pos({(W - bar_w) // 2},{round(H * 0.585)})\\p1\\1c{VOLT}\\fad(250,350)}}"
           f"m 0 0 l {bar_w} 0 {bar_w} {bar_h} 0 {bar_h}")

    # --- destellos de transición
    for t in flashes:
        ev(5, max(0.0, t - 0.03), t + 0.4, "Shape", f"{{\\an7\\pos(0,0)\\p1\\1c{WHITE}\\1a&H30&\\fad(0,370)}}{rect}")

    # --- etiqueta del gancho
    if teaser:
        ev(4, teaser[0] + 0.2, teaser[1] - 0.2, "Tag",
           f"{{\\an7\\pos({round(W * 0.04)},{round(H * 0.05)})\\fad(200,200)}}AVANCE")

    # --- rótulo con el nombre del creador
    if creator:
        s, e = creator_at, creator_at + 5.0
        x, y = round(W * 0.05), round(H * 0.74)
        ev(4, s, e, "Lower",
           f"{{\\an1\\pos({x + round(W * 0.012)},{y})\\fad(300,300)\\clip(0,0,0,{H})\\t(0,400,\\clip(0,0,{W},{H}))}}"
           f"{_esc(creator)}")
        bar_h = round(H * 0.07)
        ev(4, s, e, "Shape",
           f"{{\\an7\\pos({x - round(W * 0.004)},{y - bar_h + round(H * 0.012)})\\p1\\1c{VOLT}\\fad(300,300)}}"
           f"m 0 0 l {max(4, round(W * 0.005))} 0 {max(4, round(W * 0.005))} {bar_h} 0 {bar_h}")

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{chr(10).join(styles)}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    return header + "\n".join(events) + "\n"
