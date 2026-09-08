"use client";
import { useState } from "react";
import { Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { useStudio } from "@/lib/store";
import { SCRIPT_STYLES } from "@/lib/styles";
import { generateEngineScript } from "@/lib/scriptEngine";

export function useGenerateScript() {
  const { brief, style, source, seed, setBeats, setGenerating } = useStudio();
  return async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, style, duration: source?.duration ?? 60, seed }),
      });
      if (!res.ok) throw new Error("api");
      const data = await res.json();
      setBeats(data.beats, data.source);
      return data.source as "ai" | "engine";
    } catch {
      setBeats(generateEngineScript(brief, style, seed), "engine");
      return "engine" as const;
    } finally {
      setGenerating(false);
    }
  };
}

export function BriefStep() {
  const { brief, setBrief, style, setStyle, setStep, generating } = useStudio();
  const generate = useGenerateScript();
  const [err, setErr] = useState<string | null>(null);
  const valid = brief.name.trim() && brief.benefit.trim() && brief.audience.trim();

  const go = async () => {
    if (!valid) { setErr("Completa nombre, beneficio y audiencia."); return; }
    setErr(null);
    await generate();
    setStep(3);
  };

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setStep(1)} className="mb-3 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Video</button>
        <h2 className="font-display text-2xl font-bold">2. Producto y guion</h2>
        <p className="mt-1 text-sm text-white/55">Tres campos bastan. La IA escribe los subtítulos, el hook y el CTA en el estilo que elijas.</p>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="label">Producto</label>
          <input className="input" placeholder="Ej: Mini proyector portátil 4K" value={brief.name} onChange={(e) => setBrief({ name: e.target.value })} />
        </div>
        <div>
          <label className="label">Beneficio principal</label>
          <input className="input" placeholder="Ej: cine en casa en cualquier pared" value={brief.benefit} onChange={(e) => setBrief({ benefit: e.target.value })} />
        </div>
        <div>
          <label className="label">Audiencia</label>
          <input className="input" placeholder="Ej: parejas jóvenes que viven en apartamentos" value={brief.audience} onChange={(e) => setBrief({ audience: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Precio (opcional)</label>
            <input className="input" placeholder="$49" value={brief.price} onChange={(e) => setBrief({ price: e.target.value })} />
          </div>
          <div>
            <label className="label">Oferta (opcional)</label>
            <input className="input" placeholder="50% de descuento" value={brief.offer} onChange={(e) => setBrief({ offer: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="label">CTA (opcional)</label>
            <input className="input" placeholder="Toca el enlace en mi bio" value={brief.cta} onChange={(e) => setBrief({ cta: e.target.value })} />
          </div>
          <div>
            <label className="label">Idioma</label>
            <select className="input" value={brief.language} onChange={(e) => setBrief({ language: e.target.value as "es" | "en" })}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Estilo de guion</label>
        <div className="grid gap-2">
          {SCRIPT_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${style === s.id ? "border-volt-500/70 bg-volt-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold">{s.name}<span className="text-xs font-normal" style={{ color: s.accent }}>{s.tagline}</span></span>
                <span className="mt-0.5 block text-xs text-white/50">{s.bestFor}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-sm text-flame-400">{err}</p>}
      <button onClick={go} disabled={generating} className="btn-primary w-full">
        {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Escribiendo guion…</> : <><Sparkles className="h-4 w-4" /> Generar guion y continuar</>}
      </button>
    </div>
  );
}
