from __future__ import annotations

import os
from dataclasses import asdict, dataclass, fields
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_env_file(path: Path) -> None:
    """Lee claves del archivo .env (ANTHROPIC_API_KEY=...) sin pisar variables ya definidas."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        if value:
            os.environ.setdefault(key.strip(), value)


_load_env_file(ROOT / ".env")

DATA_DIR = Path(os.environ.get("YT_EDITOR_DATA", ROOT / "datos"))
AI_MODEL = os.environ.get("YT_EDITOR_MODEL", "claude-opus-5-5")
FONT = os.environ.get("YT_EDITOR_FONT", "Montserrat")

WHISPER_MODELS = ("tiny", "base", "small", "medium", "large-v3")


@dataclass
class EditOptions:
    # Transcripción
    language: str = "es"            # "auto" para detectar
    whisper_model: str = "small"

    # Cortes
    min_silence: float = 0.6        # pausas más largas que esto se recortan
    keep_pause: float = 0.15        # margen que se deja antes/después de hablar
    remove_fillers: bool = True     # "eh", "ehm", "mmm"...
    zoom_cuts: bool = True          # alterna plano normal / acercado en los cortes
    zoom_level: float = 1.12
    motion: bool = True             # acercamiento lento en cada toma + golpe de zoom en palabras clave

    # Estructura (requiere clave de Claude para gancho y capítulos con título)
    hook: bool = True
    chapter_cards: bool = True
    transitions: bool = True        # destello + whoosh entre capítulos
    creator_name: str = ""          # rótulo inferior al empezar el video
    cta: bool = True                # botón animado "Suscríbete"

    # Imagen y sonido
    subtitles: str = "highlight"    # highlight | caps | classic | off
    color: bool = True
    denoise: bool = True
    music_volume_db: float = -26.0

    # Exportación
    quality: str = "alta"           # alta | rapida

    @classmethod
    def from_dict(cls, data: dict | None) -> "EditOptions":
        opts = cls()
        if not data:
            return opts
        for f in fields(cls):
            if f.name not in data or data[f.name] is None:
                continue
            default = getattr(opts, f.name)
            value = data[f.name]
            try:
                if isinstance(default, bool):
                    value = value if isinstance(value, bool) else str(value).lower() in ("1", "true", "si", "sí", "on")
                elif isinstance(default, float):
                    value = float(value)
                elif isinstance(default, str):
                    value = str(value).strip()
            except (TypeError, ValueError):
                continue
            setattr(opts, f.name, value)
        opts.validate()
        return opts

    def validate(self) -> None:
        if self.whisper_model not in WHISPER_MODELS:
            self.whisper_model = "small"
        if self.subtitles not in ("highlight", "caps", "classic", "off"):
            self.subtitles = "highlight"
        if self.quality not in ("alta", "rapida"):
            self.quality = "alta"
        self.min_silence = min(max(self.min_silence, 0.25), 3.0)
        self.keep_pause = min(max(self.keep_pause, 0.05), 0.6)
        self.zoom_level = min(max(self.zoom_level, 1.03), 1.3)
        self.music_volume_db = min(max(self.music_volume_db, -40.0), -12.0)
        self.creator_name = self.creator_name[:60]

    def to_dict(self) -> dict:
        return asdict(self)
