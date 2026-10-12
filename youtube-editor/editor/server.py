"""Servidor web local: subes el video (o pegas el enlace) y descargas el resultado editado."""
from __future__ import annotations

import json
import queue
import re
import shutil
import threading
import time
import traceback
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import ai, pipeline
from .config import AI_MODEL, DATA_DIR, EditOptions
from .fetch import DownloadError
from .media import Cancelled, FFmpegError, Runner
from .transcribe import whisper_available

STATIC = Path(__file__).resolve().parent.parent / "static"
JOBS_DIR = DATA_DIR / "trabajos"
UPLOADS_DIR = DATA_DIR / "subidas"
OUTPUT_NAMES = ("video_editado.mp4", "subtitulos.srt", "youtube.txt", "miniatura.jpg", "informe.json")
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mts", ".m2ts", ".wmv", ".flv", ".3gp"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".opus"}


class Job:
    def __init__(self, job_id: str, options: EditOptions, source: str, url: str | None = None,
                 upload: Path | None = None, music: Path | None = None):
        self.id = job_id
        self.dir = JOBS_DIR / job_id
        self.options = options
        self.source = source
        self.url = url
        self.upload = upload
        self.music = music
        self.created = time.time()
        self.status = "en_cola"
        self.stage = ""
        self.stage_progress = 0.0
        self.progress = 0.0
        self.logs: list[dict] = []
        self.error = ""
        self.report: dict | None = None
        self.started = 0.0
        self.finished = 0.0
        self.runner = Runner()
        self._lock = threading.Lock()

    # ---- callbacks del pipeline
    def set_progress(self, stage: str, frac: float) -> None:
        done = 0.0
        for key, _label, weight in pipeline.STAGES:
            if key == stage:
                done += weight * frac
                break
            done += weight
        with self._lock:
            self.stage, self.stage_progress, self.progress = stage, frac, min(done, 0.999)

    def log(self, message: str) -> None:
        with self._lock:
            self.logs.append({"t": time.time(), "msg": message})
        self.save()

    # ---- persistencia
    def to_dict(self) -> dict:
        outputs = []
        out = self.dir / "salida"
        for name in OUTPUT_NAMES:
            f = out / name
            if f.exists():
                outputs.append({"name": name, "size": f.stat().st_size})
        return {
            "id": self.id, "status": self.status, "source": self.source, "created": self.created,
            "stage": self.stage, "stage_progress": self.stage_progress, "progress": self.progress,
            "logs": self.logs[-200:], "error": self.error, "report": self.report, "outputs": outputs,
            "options": self.options.to_dict(), "started": self.started, "finished": self.finished,
        }

    def save(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        data = self.to_dict()
        data.update(url=self.url, upload=str(self.upload) if self.upload else None,
                    music=str(self.music) if self.music else None)
        tmp = self.dir / "job.json.tmp"
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.dir / "job.json")

    @classmethod
    def load(cls, path: Path) -> "Job":
        data = json.loads(path.read_text(encoding="utf-8"))
        job = cls(data["id"], EditOptions.from_dict(data.get("options")), data.get("source", ""), data.get("url"),
                  Path(data["upload"]) if data.get("upload") else None,
                  Path(data["music"]) if data.get("music") else None)
        for key in ("status", "stage", "stage_progress", "progress", "logs", "error", "report", "created",
                    "started", "finished"):
            if key in data:
                setattr(job, key, data[key])
        if job.status in ("en_cola", "procesando"):
            job.status = "error"
            job.error = "El programa se cerró mientras se procesaba. Vuelve a crear el trabajo."
        return job


class Manager:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.queue: queue.Queue[str] = queue.Queue()
        JOBS_DIR.mkdir(parents=True, exist_ok=True)
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        for f in JOBS_DIR.glob("*/job.json"):
            try:
                job = Job.load(f)
                self.jobs[job.id] = job
            except (OSError, ValueError, KeyError):
                continue
        threading.Thread(target=self._worker, daemon=True).start()

    def submit(self, job: Job) -> None:
        self.jobs[job.id] = job
        job.save()
        self.queue.put(job.id)

    def _worker(self) -> None:
        while True:
            job = self.jobs.get(self.queue.get())
            if not job or job.status != "en_cola":
                continue
            job.status = "procesando"
            job.started = time.time()
            job.log("Empezando la edición.")
            try:
                ctx = pipeline.JobContext(dir=job.dir, options=job.options, url=job.url, upload=job.upload,
                                          music=job.music, runner=job.runner, progress=job.set_progress, log=job.log)
                job.report = pipeline.run(ctx)
                job.status = "listo"
                job.progress = 1.0
                job.log("¡Listo! Tu video está editado.")
            except Cancelled:
                job.status = "cancelado"
                job.log("Trabajo cancelado.")
            except (DownloadError, FFmpegError) as exc:
                job.status = "error"
                job.error = str(exc)
                job.log("Error: " + str(exc).splitlines()[0])
            except Exception as exc:  # cualquier fallo inesperado se muestra en la página
                job.status = "error"
                job.error = f"{exc.__class__.__name__}: {exc}"
                job.log("Error inesperado: " + job.error)
                traceback.print_exc()
            finally:
                job.finished = time.time()
                job.save()


manager: Manager | None = None
app = FastAPI(title="Editor YouTube")


@app.on_event("startup")
def _startup() -> None:
    global manager
    manager = Manager()


def _jobs() -> Manager:
    assert manager is not None
    return manager


class JobRequest(BaseModel):
    url: str | None = None
    upload_id: str | None = None
    music_upload_id: str | None = None
    source_name: str | None = None
    options: dict | None = None


def _upload_path(upload_id: str | None, allowed: set[str]) -> Path | None:
    if not upload_id:
        return None
    if not re.fullmatch(r"[0-9a-f]{32}\.[a-z0-9]{2,5}", upload_id):
        raise HTTPException(400, "Archivo subido no válido.")
    path = UPLOADS_DIR / upload_id
    if path.suffix not in allowed or not path.exists():
        raise HTTPException(404, "No se encontró el archivo subido. Súbelo de nuevo.")
    return path


@app.get("/api/estado")
def estado() -> dict:
    return {
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "whisper": whisper_available(),
        "ia": ai.ai_available(),
        "modelo_ia": AI_MODEL,
        "etapas": [{"key": k, "label": label} for k, label, _ in pipeline.STAGES],
    }


@app.post("/api/subir")
async def subir(request: Request, nombre: str = "video.mp4") -> dict:
    ext = Path(nombre).suffix.lower()
    if ext not in VIDEO_EXT | AUDIO_EXT:
        raise HTTPException(400, f"Formato no soportado ({ext or 'sin extensión'}).")
    upload_id = uuid.uuid4().hex + ext
    path = UPLOADS_DIR / upload_id
    size = 0
    try:
        with open(path, "wb") as fh:
            async for chunk in request.stream():
                fh.write(chunk)
                size += len(chunk)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    if size < 1024:
        path.unlink(missing_ok=True)
        raise HTTPException(400, "El archivo está vacío.")
    return {"upload_id": upload_id, "size": size}


@app.post("/api/trabajos")
def crear(req: JobRequest) -> dict:
    options = EditOptions.from_dict(req.options)
    upload = _upload_path(req.upload_id, VIDEO_EXT)
    music = _upload_path(req.music_upload_id, AUDIO_EXT)
    url = (req.url or "").strip() or None
    if not upload and not url:
        raise HTTPException(400, "Pega un enlace o sube un video.")
    if url and not re.match(r"^https?://", url):
        raise HTTPException(400, "El enlace debe empezar por http:// o https://")
    job_id = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    job = Job(job_id, options, source=url or (req.source_name or "video subido")[:120], url=url)
    work = job.dir / "trabajo"
    work.mkdir(parents=True, exist_ok=True)
    if upload:
        job.upload = work / ("original" + upload.suffix)
        shutil.move(str(upload), job.upload)
    if music:
        job.music = work / ("musica" + music.suffix)
        shutil.move(str(music), job.music)
    _jobs().submit(job)
    return job.to_dict()


@app.get("/api/trabajos")
def listar() -> list[dict]:
    jobs = sorted(_jobs().jobs.values(), key=lambda j: j.created, reverse=True)
    return [{k: v for k, v in j.to_dict().items() if k != "logs"} for j in jobs]


def _job(job_id: str) -> Job:
    job = _jobs().jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Trabajo no encontrado.")
    return job


@app.get("/api/trabajos/{job_id}")
def ver(job_id: str) -> dict:
    return _job(job_id).to_dict()


@app.post("/api/trabajos/{job_id}/cancelar")
def cancelar(job_id: str) -> dict:
    job = _job(job_id)
    if job.status == "en_cola":
        job.status = "cancelado"
        job.save()
    elif job.status == "procesando":
        job.runner.cancel()
    return job.to_dict()


@app.delete("/api/trabajos/{job_id}")
def borrar(job_id: str) -> dict:
    job = _job(job_id)
    if job.status == "procesando":
        raise HTTPException(409, "Cancélalo primero.")
    shutil.rmtree(job.dir, ignore_errors=True)
    _jobs().jobs.pop(job_id, None)
    return {"ok": True}


@app.get("/api/trabajos/{job_id}/archivos/{name}")
def archivo(job_id: str, name: str, descargar: bool = False):
    if name not in OUTPUT_NAMES:
        raise HTTPException(404, "Archivo no encontrado.")
    path = _job(job_id).dir / "salida" / name
    if not path.exists():
        raise HTTPException(404, "Archivo no encontrado.")
    return FileResponse(path, filename=name if descargar else None)


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
