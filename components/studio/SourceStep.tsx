"use client";
import { useCallback, useRef, useState } from "react";
import { UploadCloud, Link2, Loader2, CheckCircle2, AlertCircle, FileVideo, Images, ImageIcon, Film, X, ChevronUp, ChevronDown } from "lucide-react";
import { useStudio, MAX_ASSETS } from "@/lib/store";
import { analyzeAudio } from "@/lib/engine/audio";
import { fetchRemoteVideo, sourceFromBlob, assetFromFile, formatBytes, formatTime, MAX_CLIP_SECONDS } from "@/lib/media";
import type { Asset } from "@/lib/types";

export function SourceStep() {
  const { source, setSource, setAnalysis, setAnalyzing, analyzing, analysis, setStep, assets, addAssets, removeAsset, moveAsset } = useStudio();
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetDrag, setAssetDrag] = useState(false);
  const assetInputRef = useRef<HTMLInputElement>(null);

  const onAssets = useCallback(async (list?: FileList | null) => {
    if (!list?.length) return;
    setAssetError(null);
    setAssetBusy(true);
    const room = MAX_ASSETS - assets.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    const errors: string[] = [];
    if (files.length < list.length) errors.push(`Máximo ${MAX_ASSETS} recursos extra. Se omitieron ${list.length - files.length}.`);
    const loaded: Asset[] = [];
    for (const f of files) {
      try { loaded.push(await assetFromFile(f)); } catch (e: any) { errors.push(e.message || String(e)); }
    }
    if (loaded.length) addAssets(loaded);
    if (errors.length) setAssetError(errors.join(" "));
    setAssetBusy(false);
  }, [assets.length, addAssets]);
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

      <div className="space-y-3 border-t border-white/10 pt-5">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Images className="h-5 w-5 text-volt-400" /> Imágenes y clips extra <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">opcional</span></h3>
          <p className="mt-1 text-xs text-white/50">Fotos del producto y clips cortos (hasta {MAX_CLIP_SECONDS} s) que se insertan como B-roll sobre tu video. Tu voz sigue sonando; los clips van sin audio.</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setAssetDrag(true); }}
          onDragLeave={() => setAssetDrag(false)}
          onDrop={(e) => { e.preventDefault(); setAssetDrag(false); onAssets(e.dataTransfer.files); }}
          onClick={() => assetInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center text-sm transition ${assetDrag ? "border-volt-500 bg-volt-500/10" : "border-white/15 bg-white/[0.02] hover:border-volt-500/50 hover:bg-white/[0.04]"}`}
        >
          <input ref={assetInputRef} type="file" multiple accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" hidden onChange={(e) => { onAssets(e.target.files); e.target.value = ""; }} />
          {assetBusy ? (
            <span className="inline-flex items-center gap-2 text-white/70"><Loader2 className="h-4 w-4 animate-spin text-volt-400" />Leyendo recursos…</span>
          ) : (
            <span className="text-white/70">Arrastra fotos o clips aquí <span className="text-white/40">· JPG, PNG, WebP, MP4, MOV · {assets.length}/{MAX_ASSETS}</span></span>
          )}
        </div>

        {assetError && <div className="flex items-start gap-2 rounded-xl border border-flame-500/40 bg-flame-500/10 p-3 text-xs text-flame-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{assetError}</div>}

        {assets.length > 0 && (
          <ul className="space-y-1.5">
            {assets.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                <span className="grid h-12 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
                  {a.kind === "image" ? <img src={a.objectUrl} alt="" className="h-full w-full object-cover" /> : <video src={a.objectUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-semibold">{a.kind === "image" ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-volt-400" /> : <Film className="h-3.5 w-3.5 shrink-0 text-violet-400" />}<span className="truncate">{a.name}</span></span>
                  <span className="block text-[11px] text-white/45">{a.kind === "image" ? "Imagen" : `Clip · ${formatTime(a.duration)}`} · {a.width}×{a.height} · {formatBytes(a.size)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => moveAsset(a.id, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Subir"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => moveAsset(a.id, 1)} disabled={i === assets.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Bajar"><ChevronDown className="h-4 w-4" /></button>
                  <button onClick={() => removeAsset(a.id)} className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-flame-500/20 hover:text-flame-400" aria-label="Quitar"><X className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {assets.length > 0 && <p className="text-[11px] text-white/40">El orden de la lista es el orden en que aparecen en el video.</p>}
      </div>

      <button onClick={() => setStep(2)} disabled={!source || analyzing || assetBusy} className="btn-primary w-full">Continuar al guion</button>
    </div>
  );
}
