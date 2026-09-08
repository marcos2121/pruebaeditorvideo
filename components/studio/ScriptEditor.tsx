"use client";
import { useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Sparkles, ClipboardPaste } from "lucide-react";
import { useStudio } from "@/lib/store";
import { SCRIPT_STYLES, VISUAL_PRESETS, STYLE_BY_ID } from "@/lib/styles";
import { useGenerateScript } from "./BriefStep";

const ROLE_LABEL: Record<string, string> = {
  hook: "Hook", problem: "Problema", agitate: "Agitación", solution: "Solución", feature: "Característica", proof: "Prueba", benefit: "Beneficio", objection: "Objeción", urgency: "Urgencia", cta: "CTA",
};

export function ScriptEditor() {
  const { beats, updateBeat, style, setStyle, preset, setPreset, generating, scriptSource, setStep, reseed, setBeats } = useStudio();
  const generate = useGenerateScript();
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  const regen = async () => { reseed(); await generate(); };

  const applyTranscript = () => {
    const sentences = transcript.replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (!sentences.length) return;
    const template = STYLE_BY_ID[style].template;
    const per = Math.max(1, Math.ceil(sentences.length / template.length));
    const next = template.map((t, i) => {
      const chunk = sentences.slice(i * per, (i + 1) * per).join(" ");
      const prev = beats[i];
      return { id: `b${i}`, role: t.role, at: t.at, span: t.span, text: chunk || prev?.text || "", emphasis: prev?.emphasis ?? [], emoji: prev?.emoji };
    });
    setBeats(next, "engine");
    setShowTranscript(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setStep(3)} className="mb-3 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Estilo</button>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">4. Guion y ajustes</h2>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${scriptSource === "ai" ? "bg-violet-500/20 text-violet-400" : "bg-white/10 text-white/60"}`}>{scriptSource === "ai" ? "Escrito con IA" : "Motor integrado"}</span>
        </div>
        <p className="mt-1 text-sm text-white/55">Edita cualquier frase. Los cambios se ven al instante en la vista previa.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Guion</label>
          <select className="input" value={style} onChange={async (e) => { setStyle(e.target.value as any); setTimeout(() => generate(), 0); }}>
            {SCRIPT_STYLES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Estilo visual</label>
          <select className="input" value={preset} onChange={(e) => setPreset(e.target.value as any)}>
            {VISUAL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={regen} disabled={generating} className="btn-ghost flex-1 !py-2 text-sm">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerar guion
        </button>
        <button onClick={() => setShowTranscript((v) => !v)} className="btn-ghost !py-2 text-sm"><ClipboardPaste className="h-4 w-4" /> Mi transcripción</button>
      </div>

      {showTranscript && (
        <div className="space-y-2 rounded-2xl p-3 glass">
          <p className="text-xs text-white/55">Pega lo que dices en el video y lo repartimos entre los beats para que los subtítulos coincidan con tu voz.</p>
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={4} className="input" placeholder="Hola, hoy les traigo… " />
          <button onClick={applyTranscript} className="btn-primary w-full !py-2 text-sm"><Sparkles className="h-4 w-4" /> Sincronizar con mi voz</button>
        </div>
      )}

      <div className="space-y-2">
        {beats.map((b, i) => (
          <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-volt-400">{i + 1}. {ROLE_LABEL[b.role] ?? b.role}</span>
              <input value={b.emoji ?? ""} onChange={(e) => updateBeat(b.id, { emoji: e.target.value.slice(0, 4) || undefined })} className="w-12 rounded-lg border border-white/10 bg-transparent text-center text-lg" placeholder="😀" />
            </div>
            <textarea value={b.text} onChange={(e) => updateBeat(b.id, { text: e.target.value })} rows={2} className="w-full resize-none bg-transparent text-sm outline-none" />
            <input value={b.emphasis.join(", ")} onChange={(e) => updateBeat(b.id, { emphasis: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="mt-1 w-full bg-transparent text-xs text-white/45 outline-none" placeholder="palabras a resaltar, separadas por coma" />
          </div>
        ))}
      </div>
    </div>
  );
}
