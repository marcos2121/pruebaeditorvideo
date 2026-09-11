"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Loader2, Volume2, VolumeX, Scissors, Zap, Clock, Sparkles, Images } from "lucide-react";
import { useStudio } from "@/lib/store";
import { PRESET_BY_ID } from "@/lib/styles";
import { Player } from "@/lib/engine/player";
import { exportVideo, pickMime } from "@/lib/engine/exporter";
import { formatTime, formatBytes } from "@/lib/media";

export function Preview() {
  const { source, plan, preset, step, assets } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; ext: string; size: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Crea / actualiza el player cuando hay plan
  useEffect(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !plan || !source) return;
    let cancelled = false;
    (async () => {
      try { await Promise.all([document.fonts.load("900 82px 'Space Grotesk'"), document.fonts.load("900 82px 'Inter'"), document.fonts.load("700 66px 'Space Grotesk'")]); } catch {}
      if (cancelled) return;
      const p = PRESET_BY_ID[preset];
      if (!playerRef.current || playerRef.current.video !== video) {
        playerRef.current?.destroy();
        const pl = new Player(video, canvas, plan, p);
        pl.onTime = (t) => setTime(t);
        pl.onEnded = () => setPlaying(false);
        playerRef.current = pl;
        await pl.setAssets(assets);
        if (cancelled) return;
        const start = () => { pl.seek(0); setReady(true); };
        if (video.readyState >= 1) start(); else video.addEventListener("loadedmetadata", start, { once: true });
      } else {
        playerRef.current.setPlan(plan, p);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, preset, source]);

  // Sincroniza la biblioteca de B-roll cuando cambian los recursos
  useEffect(() => { playerRef.current?.setAssets(assets); }, [assets]);

  useEffect(() => () => { playerRef.current?.destroy(); playerRef.current = null; }, []);
  useEffect(() => { setResult(null); }, [plan]);

  const toggle = async () => {
    const pl = playerRef.current;
    if (!pl) return;
    if (pl.playing) { pl.pause(); setPlaying(false); }
    else { try { await pl.play(); setPlaying(true); } catch (e: any) { setErr("No se pudo reproducir: " + e.message); } }
  };

  const onScrub = (v: number) => { playerRef.current?.pause(); setPlaying(false); playerRef.current?.seek(v); };

  const doExport = async () => {
    const pl = playerRef.current;
    if (!pl) return;
    setErr(null);
    setResult(null);
    pl.pause();
    setPlaying(false);
    setExporting(0);
    try {
      const { blob, ext } = await exportVideo(pl, (p) => setExporting(p));
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url: URL.createObjectURL(blob), ext, size: blob.size });
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setExporting(null);
      setPlaying(false);
    }
  };

  const mime = typeof window !== "undefined" ? pickMime() : "";
  const cuts = plan?.segments.length ?? 0;
  const zooms = plan?.segments.filter((s) => s.transition !== "cut").length ?? 0;

  return (
    <div className="flex h-full flex-col items-center gap-5">
      <div className="relative w-full max-w-[360px]">
        <div className="absolute -inset-8 -z-10 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative aspect-[9/16] overflow-hidden rounded-[36px] border-[5px] border-ink-700 bg-black shadow-card">
          <video ref={videoRef} src={source?.objectUrl} playsInline preload="auto" muted={muted} className="absolute h-px w-px opacity-0" />
          <canvas ref={canvasRef} className="h-full w-full" />
          {!plan && (
            <div className="absolute inset-0 grid place-items-center bg-ink-900/90 p-8 text-center text-sm text-white/50">
              {source ? (step < 4 ? "Completa los pasos para ver la vista previa." : "Generando edición…") : "Sube un video para empezar."}
            </div>
          )}
          {plan && ready && !playing && exporting === null && (
            <button onClick={toggle} className="absolute inset-0 grid place-items-center bg-black/25 transition hover:bg-black/35">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-volt-500 text-ink-950 shadow-glow"><Play className="ml-1 h-7 w-7" /></span>
            </button>
          )}
          {exporting !== null && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 text-center text-xs text-white">
              <div className="mb-2 inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Renderizando {Math.round(exporting * 100)}%</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-volt-500 transition-all" style={{ width: `${exporting * 100}%` }} /></div>
            </div>
          )}
        </div>
      </div>

      {plan && (
        <div className="w-full max-w-[360px] space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={toggle} disabled={exporting !== null} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15">{playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}</button>
            <input type="range" min={0} max={plan.duration} step={0.05} value={time} onChange={(e) => onScrub(Number(e.target.value))} className="flex-1" />
            <span className="w-[76px] text-right font-mono text-xs text-white/60">{formatTime(time)}</span>
            <button onClick={() => setMuted((m) => !m)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/15">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          </div>

          <div className={`grid gap-2 text-center ${plan.brollCount > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
            <Stat icon={Clock} label="Duración" value={`${plan.duration.toFixed(1)} s`} />
            <Stat icon={Scissors} label="Silencio quitado" value={`-${plan.removedSilence.toFixed(1)} s`} />
            <Stat icon={Zap} label="Cortes / efectos" value={`${cuts} / ${zooms}`} />
            {plan.brollCount > 0 && <Stat icon={Images} label="B-roll" value={`${plan.brollCount}`} />}
          </div>

          <button onClick={doExport} disabled={exporting !== null || !ready} className="btn-primary w-full">
            {exporting !== null ? <><Loader2 className="h-4 w-4 animate-spin" /> Exportando en tiempo real…</> : <><Sparkles className="h-4 w-4" /> Exportar 1080×1920 {mime.startsWith("video/mp4") ? "MP4" : "WebM"}</>}
          </button>
          <p className="text-center text-[11px] text-white/40">El render dura lo mismo que el video. No cambies de pestaña durante la exportación.</p>

          {result && (
            <a href={result.url} download={`scrollbreak-${plan.style}-${plan.preset}.${result.ext}`} className="btn-ghost w-full border-volt-500/50 text-volt-300">
              <Download className="h-4 w-4" /> Descargar video ({formatBytes(result.size)})
            </a>
          )}
          {err && <p className="rounded-xl border border-flame-500/40 bg-flame-500/10 p-3 text-xs text-flame-400">{err}</p>}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3 glass">
      <Icon className="mx-auto h-4 w-4 text-volt-400" />
      <div className="mt-1 font-display text-sm font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}
