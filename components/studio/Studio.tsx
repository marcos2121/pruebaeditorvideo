"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "../Logo";
import { useStudio } from "@/lib/store";
import { buildPlan } from "@/lib/engine/planner";
import { SourceStep } from "./SourceStep";
import { BriefStep } from "./BriefStep";
import { LookStep } from "./LookStep";
import { ScriptEditor } from "./ScriptEditor";
import { Preview } from "./Preview";
import { RotateCcw } from "lucide-react";

const STEPS = ["Video", "Guion", "Estilo", "Editar"];

export function Studio() {
  const s = useStudio();

  // Reconstruye el plan cuando cambia cualquier ingrediente
  useEffect(() => {
    if (!s.source || s.step < 4 || !s.beats.length) return;
    const plan = buildPlan({
      sourceDuration: s.source.duration,
      analysis: s.analysis,
      style: s.style,
      preset: s.preset,
      beats: s.beats,
      maxDuration: s.maxDuration,
      removeSilence: s.removeSilence,
      scriptSource: s.scriptSource,
      seed: s.seed,
      assets: s.assets,
      brollMode: s.brollMode,
    });
    s.setPlan(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.source, s.step, s.beats, s.style, s.preset, s.maxDuration, s.removeSilence, s.analysis, s.seed, s.assets, s.brollMode]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Logo />
          <ol className="hidden items-center gap-2 md:flex">
            {STEPS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4;
              const active = s.step === n, done = s.step > n;
              return (
                <li key={label} className="flex items-center gap-2">
                  <button onClick={() => done && s.setStep(n)} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-volt-500 text-ink-950" : done ? "bg-white/10 text-white hover:bg-white/15" : "text-white/35"}`}>
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-black/20 text-[10px]">{n}</span>{label}
                  </button>
                  {i < STEPS.length - 1 && <span className="h-px w-6 bg-white/10" />}
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2">
            <button onClick={s.reset} className="btn-ghost !px-3 !py-1.5 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Nuevo</button>
            <Link href="/" className="hidden text-xs text-white/50 hover:text-white sm:block">Inicio</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-5 py-8 lg:grid-cols-[440px_1fr]">
        <section className="rounded-3xl p-6 glass">
          {s.step === 1 && <SourceStep />}
          {s.step === 2 && <BriefStep />}
          {s.step === 3 && <LookStep />}
          {s.step === 4 && <ScriptEditor />}
        </section>
        <section className="lg:sticky lg:top-24 lg:self-start">
          <Preview />
        </section>
      </main>
    </div>
  );
}
