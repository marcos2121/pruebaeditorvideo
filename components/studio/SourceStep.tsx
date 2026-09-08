"use client";
import { useCallback, useRef, useState } from "react";
import { UploadCloud, Link2, Loader2, CheckCircle2, AlertCircle, FileVideo } from "lucide-react";
import { useStudio } from "@/lib/store";
import { analyzeAudio } from "@/lib/engine/audio";
import { fetchRemoteVideo, sourceFromBlob, formatBytes, formatTime } from "@/lib/media";

export function SourceStep() {
  const { source, setSource, setAnalysis, setAnalyzing, analyzing, analysis, setStep } = useStudio();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = useCallback(async (blob: Blob, name: string, kind: "file" | "url") => {
    setError(null);
    setBusy("Leyendo el video…");
    try {
      if (!blob.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v)$/i.test(name)) throw new Error("El archivo no parece un video (MP4, MOV o WebM).");
      const src = await sourceFromBlob(blob, name, kind);
      if (src.duration > 600) throw new Error("El video supera los 10 minutos. Usa un clip más corto.");
      setSource(src);
      setBusy(null);
      setAnalyzing(true);
      const a = await analyzeAudio(blob);
      setAnalysis(a);
      setAnalyzing(false);
    } catch (e: any) {
      setError(e.message || String(e));
      setBusy(null);
      setAnalyzing(false);
    }
  }, [setSource, setAnalysis, setAnalyzing]);

  const onFile = (f?: File | null) => { if (f) ingest(f, f.name, "file"); };

  const onLink = async () => {
    if (!url.trim()) return;
    setError(null);
    setBusy("Descargando desde el enlace…");
    try {
      const blob = await fetchRemoteVideo(url.trim(), (r, t) => setBusy(t ? `Descargando… ${Math.round((r / t) * 100)}%` : `Descargando… ${formatBytes(r)}`));
      const name = url.split("/").pop()?.split("?")[0] || "video.mp4";
      await ingest(blob, name, "url");
    } catch (e: any) {
      setError(e.message || String(e));
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">1. Tu video</h2>
        <p className="mt-1 text-sm text-white/55">Sube un clip (ideal 30–90 s) o pega un enlace público de Drive, Dropbox o URL directa.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition ${drag ? "border-volt-500 bg-volt-500/10" : "border-white/15 bg-white/[0.02] hover:border-volt-500/50 hover:bg-white/[0.04]"}`}
      >
        <input ref={inputRef} type="file" accept="video/*,.mp4,.mov,.webm" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-volt-500/10 text-volt-400 ring-1 ring-volt-500/30 transition group-hover:scale-105">
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="mt-4 font-semibold">Arrastra tu video aquí o haz clic</p>
        <p className="mt-1 text-xs text-white/45">MP4, MOV, WebM · hasta 250 MB</p>
      </div>

      <div className="flex items-center gap-3 text-xs text-white/35"><span className="h-px flex-1 bg-white/10" />o desde un enlace<span className="h-px flex-1 bg-white/10" /></div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onLink()} placeholder="https://drive.google.com/file/d/…" className="input !pl-10" />
        </div>
        <button onClick={onLink} disabled={!url.trim() || !!busy} className="btn-ghost !px-4 text-sm">Cargar</button>
      </div>

      {busy && <div className="flex items-center gap-2 text-sm text-white/70"><Loader2 className="h-4 w-4 animate-spin text-volt-400" />{busy}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-flame-500/40 bg-flame-500/10 p-3 text-sm text-flame-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {source && (
        <div className="rounded-2xl p-4 glass">
          <div className="flex items-center gap-3">
            <FileVideo className="h-8 w-8 text-volt-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{source.name}</p>
              <p className="text-xs text-white/50">{formatTime(source.duration)} · {source.width}×{source.height} · {formatBytes(source.size)}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-volt-400" />
          </div>
          <div className="mt-3 text-xs text-white/55">
            {analyzing ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-volt-400" />Analizando audio: silencios y picos…</span>
            ) : analysis ? (
              <span>Audio analizado: <b className="text-white">{analysis.silences.length}</b> silencios · <b className="text-white">{analysis.peaks.length}</b> picos de energía</span>
            ) : (
              <span>Sin pista de audio analizable. Se editará por ritmo visual.</span>
            )}
          </div>
        </div>
      )}

      <button onClick={() => setStep(2)} disabled={!source || analyzing} className="btn-primary w-full">Continuar al guion</button>
    </div>
  );
}
