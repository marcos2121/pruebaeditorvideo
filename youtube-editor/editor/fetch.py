"""Descarga de videos desde Google Drive, Dropbox, OneDrive o un enlace directo."""
from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Callable
from urllib.parse import urlencode, urlparse

import requests

CHUNK = 1024 * 1024
UA = {"User-Agent": "Mozilla/5.0 (editor-youtube)"}


class DownloadError(RuntimeError):
    pass


def drive_id(url: str) -> str | None:
    m = re.search(r"/(?:file/d|open|uc)/([\w-]{20,})", url) or re.search(r"[?&]id=([\w-]{20,})", url)
    return m.group(1) if m else None


def normalize(url: str) -> str:
    url = url.strip()
    host = urlparse(url).netloc.lower()
    if "dropbox.com" in host:
        url = re.sub(r"([?&])dl=0", r"\1dl=1", url)
        if "dl=1" not in url and "raw=1" not in url:
            url += ("&" if "?" in url else "?") + "dl=1"
    elif "1drv.ms" in host or "onedrive.live.com" in host:
        url += ("&" if "?" in url else "?") + "download=1"
    return url


def _filename(resp: requests.Response, fallback: str) -> str:
    cd = resp.headers.get("content-disposition", "")
    m = re.search(r"filename\*=UTF-8''([^;]+)", cd) or re.search(r'filename="?([^";]+)"?', cd)
    name = m.group(1) if m else fallback
    name = re.sub(r"[^\w.\- ]", "_", name).strip() or fallback
    if not Path(name).suffix:
        name += ".mp4"
    return name


def _stream(resp: requests.Response, dest_dir: Path, fallback: str,
            on_progress: Callable[[float, int], None] | None, check: Callable[[], None]) -> Path:
    total = int(resp.headers.get("content-length") or 0)
    path = dest_dir / ("original" + Path(_filename(resp, fallback)).suffix.lower())
    done = 0
    with open(path, "wb") as fh:
        for chunk in resp.iter_content(CHUNK):
            check()
            fh.write(chunk)
            done += len(chunk)
            if on_progress:
                on_progress(done / total if total else 0.0, done)
    if done < 1024:
        raise DownloadError("La descarga está vacía. Revisa que el enlace sea correcto y público.")
    return path


def _is_html(resp: requests.Response) -> bool:
    return resp.headers.get("content-type", "").startswith("text/html")


def _drive(file_id: str, dest_dir: Path, on_progress, check) -> Path:
    session = requests.Session()
    session.headers.update(UA)
    url = "https://drive.usercontent.google.com/download?" + urlencode(
        {"id": file_id, "export": "download", "confirm": "t"})
    resp = session.get(url, stream=True, timeout=60)
    if _is_html(resp):
        # Archivo grande: Drive muestra un aviso de "no se pudo analizar en busca de virus".
        page = resp.text
        action = re.search(r'<form[^>]+action="([^"]+)"', page)
        inputs = dict(re.findall(r'<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"', page))
        if action and inputs:
            target = html.unescape(action.group(1))
            resp = session.get(target, params=inputs, stream=True, timeout=60)
    if _is_html(resp) or resp.status_code >= 400:
        raise DownloadError(
            "Google Drive no dejó descargar el archivo. Abre el archivo en Drive → Compartir → "
            "'Cualquier persona con el enlace' y vuelve a pegar el enlace.")
    return _stream(resp, dest_dir, "video.mp4", on_progress, check)


def download(url: str, dest_dir: Path, on_progress: Callable[[float, int], None] | None = None,
             check: Callable[[], None] = lambda: None) -> Path:
    if not re.match(r"^https?://", url.strip()):
        raise DownloadError("El enlace debe empezar por http:// o https://")
    dest_dir.mkdir(parents=True, exist_ok=True)
    fid = drive_id(url) if "google.com" in urlparse(url).netloc else None
    if fid:
        return _drive(fid, dest_dir, on_progress, check)
    url = normalize(url)
    resp = requests.get(url, stream=True, timeout=60, headers=UA, allow_redirects=True)
    if resp.status_code >= 400:
        raise DownloadError(f"El servidor respondió {resp.status_code}. ¿El enlace es público?")
    if _is_html(resp):
        raise DownloadError("El enlace abre una página web, no un archivo de video. Usa un enlace de descarga directa.")
    name = Path(urlparse(url).path).name or "video.mp4"
    return _stream(resp, dest_dir, name, on_progress, check)

