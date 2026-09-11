"use client";
import { ArrowLeft, Wand2 } from "lucide-react";
import { useStudio } from "@/lib/store";
import { VISUAL_PRESETS } from "@/lib/styles";

export function LookStep() {
  const { preset, setPreset, setStep, removeSilence, setRemoveSilence, maxDuration, setMaxDuration, source, analysis, assets, brollMode, setBrollMode } = useStudio();
  const images = assets.filter((a) => a.kind === "image").length;
  const clips = assets.length - images;
  const silenceSec = analysis ? analysis.silences.reduce((a, s) => a + Math.max(0, s.end - s.start - 0.24), 0) : 0;
  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setStep(2)} className="mb-3 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Guion</button>
        <h2 className="font-display text-2xl font-bold">3. Estilo visual</h2>
        <p className="mt-1 text-sm text-white/55">Define el look de los subtítulos, el color y la intensidad de los zooms.</p>
      </div>

      <div className="grid gap-2">
        {VISUAL_PRESETS.map((p) => (
          <button key={p.id} onClick={() => setPreset(p.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${preset === p.id ? "border-volt-500/70 bg-volt-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}>
            <span className="flex -space-x-1.5">
              {p.swatch.map((c) => <span key={c} className="h-6 w-6 rounded-full ring-2 ring-ink-900" style={{ background: c }} />)}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{p.name}</span>
              <span className="block text-xs text-white/50">{p.description}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl p-4 glass">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">Eliminar silencios</span>
            <span className="block text-xs text-white/50">{analysis ? `Recorta ~${silenceSec.toFixed(1)} s de pausas` : "Sin análisis de audio disponible"}</span>
          </span>
          <input type="checkbox" checked={removeSilence} onChange={(e) => setRemoveSilence(e.target.checked)} className="h-5 w-5 accent-volt-500" />
        </label>
        {assets.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">B-roll</span>
              <span className="text-xs text-white/50">{images} {images === 1 ? "imagen" : "imágenes"} · {clips} {clips === 1 ? "clip" : "clips"}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {([["once", "Una vez"], ["fill", "Rellenar"], ["off", "Sin B-roll"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setBrollMode(id)} className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${brollMode === id ? "border-volt-500/70 bg-volt-500/10 text-white" : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25"}`}>{label}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-white/45">{brollMode === "once" ? "Cada imagen o clip aparece una vez, cerca de los beats de producto." : brollMode === "fill" ? "Repite tus recursos para cubrir cerca del 40 % de los cortes." : "Solo se usa el video principal."}</p>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Duración máxima</span>
            <span className="text-volt-400">{maxDuration} s</span>
          </div>
          <input type="range" min={15} max={Math.min(180, Math.max(20, Math.ceil(source?.duration ?? 60)))} value={maxDuration} onChange={(e) => setMaxDuration(Number(e.target.value))} className="mt-2 w-full" />
          <p className="mt-1 text-xs text-white/45">TikTok y Reels premian los 21–45 s. Shorts hasta 60 s.</p>
        </div>
      </div>

      <button onClick={() => setStep(4)} className="btn-primary w-full"><Wand2 className="h-4 w-4" /> Generar edición</button>
    </div>
  );
}
