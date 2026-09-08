"use client";
import { create } from "zustand";
import type { AudioAnalysis, EditPlan, ProductBrief, ScriptBeat, ScriptStyleId, SourceMedia, VisualPresetId } from "./types";

export type Step = 1 | 2 | 3 | 4;

interface StudioState {
  step: Step;
  source: SourceMedia | null;
  analysis: AudioAnalysis | null;
  analyzing: boolean;
  brief: ProductBrief;
  style: ScriptStyleId;
  preset: VisualPresetId;
  beats: ScriptBeat[];
  scriptSource: "ai" | "engine";
  generating: boolean;
  plan: EditPlan | null;
  removeSilence: boolean;
  maxDuration: number;
  seed: number;
  setStep: (s: Step) => void;
  setSource: (s: SourceMedia | null) => void;
  setAnalysis: (a: AudioAnalysis | null) => void;
  setAnalyzing: (b: boolean) => void;
  setBrief: (b: Partial<ProductBrief>) => void;
  setStyle: (s: ScriptStyleId) => void;
  setPreset: (p: VisualPresetId) => void;
  setBeats: (b: ScriptBeat[], source: "ai" | "engine") => void;
  updateBeat: (id: string, patch: Partial<ScriptBeat>) => void;
  setGenerating: (b: boolean) => void;
  setPlan: (p: EditPlan | null) => void;
  setRemoveSilence: (b: boolean) => void;
  setMaxDuration: (n: number) => void;
  reseed: () => void;
  reset: () => void;
}

const defaultBrief: ProductBrief = {
  name: "",
  benefit: "",
  audience: "",
  price: "",
  offer: "",
  cta: "",
  link: "",
  language: "es",
};

export const useStudio = create<StudioState>((set) => ({
  step: 1,
  source: null,
  analysis: null,
  analyzing: false,
  brief: defaultBrief,
  style: "pas",
  preset: "viral",
  beats: [],
  scriptSource: "engine",
  generating: false,
  plan: null,
  removeSilence: true,
  maxDuration: 60,
  seed: 1,
  setStep: (step) => set({ step }),
  setSource: (source) => set({ source, plan: null, analysis: null }),
  setAnalysis: (analysis) => set({ analysis }),
  setAnalyzing: (analyzing) => set({ analyzing }),
  setBrief: (b) => set((s) => ({ brief: { ...s.brief, ...b } })),
  setStyle: (style) => set({ style }),
  setPreset: (preset) => set({ preset }),
  setBeats: (beats, scriptSource) => set({ beats, scriptSource }),
  updateBeat: (id, patch) => set((s) => ({ beats: s.beats.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
  setGenerating: (generating) => set({ generating }),
  setPlan: (plan) => set({ plan }),
  setRemoveSilence: (removeSilence) => set({ removeSilence }),
  setMaxDuration: (maxDuration) => set({ maxDuration }),
  reseed: () => set((s) => ({ seed: s.seed + 1 })),
  reset: () => set({ step: 1, source: null, analysis: null, beats: [], plan: null, brief: defaultBrief }),
}));
