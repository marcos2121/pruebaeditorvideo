import type { SourceMedia } from "./types";

export function probeVideo(objectUrl: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = objectUrl;
    v.onloadedmetadata = () => {
      const done = () => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      if (v.duration === Infinity || Number.isNaN(v.duration)) {
        // Algunos WebM sin duración: forzamos lectura
        v.currentTime = 1e9;
        v.ontimeupdate = () => { v.ontimeupdate = null; done(); };
      } else done();
    };
    v.onerror = () => reject(new Error("No se pudo leer el video. Prueba con MP4 (H.264)."));
  });
}

export async function sourceFromBlob(blob: Blob, name: string, kind: SourceMedia["kind"]): Promise<SourceMedia> {
  const objectUrl = URL.createObjectURL(blob);
  const meta = await probeVideo(objectUrl);
  return { kind, name, objectUrl, size: blob.size, mime: blob.type || "video/mp4", ...meta };
}

export async function fetchRemoteVideo(url: string, onProgress?: (received: number, total: number) => void): Promise<Blob> {
  const res = await fetch(`/api/fetch-video?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const total = Number(res.headers.get("content-length") || 0);
  const type = res.headers.get("content-type") || "video/mp4";
  if (!res.body) return res.blob();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received, total);
  }
  return new Blob(chunks as BlobPart[], { type });
}

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const d = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${d}`;
}

export function formatBytes(b: number) {
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${Math.round(b / 1e3)} KB`;
}
