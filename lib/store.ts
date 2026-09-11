"use client";
import { create } from "zustand";
import type { Asset, AudioAnalysis, EditPlan, ProductBrief, ScriptBeat, ScriptStyleId, SourceMedia, VisualPresetId } from "./types";

export type BrollMode = "off" | "once" | "fill";
export const MAX_ASSETS = 12;

export type Step = 1 | 2 | 3 | 4;

interface StudioState {
  step: Step;
  source: SourceMedia | null;
  /** Imágenes y clips extra que se insertan como B-roll. */
  assets: Asset[];
  brollMode: BrollMode;
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
  addAssets: (a: Asset[]) => void;
  removeAsset: (id: string) => void;
  moveAsset: (id: string, dir: -1 | 1) => void;
  setBrollMode: (m: BrollMode) => void;
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
  assets: [],
  brollMode: "once",
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
  addAssets: (a) => set((s) => ({ assets: [...s.assets, ...a].slice(0, MAX_ASSETS) })),
  removeAsset: (id) =>
    set((s) => {
      const gone = s.assets.find((a) => a.id === id);
      if (gone) URL.revokeObjectURL(gone.objectUrl);
      return { assets: s.assets.filter((a) => a.id !== id) };
    }),
  moveAsset: (id, dir) =>
    set((s) => {
      const i = s.assets.findIndex((a) => a.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.assets.length) return {};
      const next = [...s.assets];
      [next[i], next[j]] = [next[j], next[i]];
      return { assets: next };
    }),
  setBrollMode: (brollMode) => set({ brollMode }),
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
  reset: () =>
    set((s) => {
      s.assets.forEach((a) => URL.revokeObjectURL(a.objectUrl));
      return { step: 1, source: null, assets: [], analysis: null, beats: [], plan: null, brief: defaultBrief };
    }),
}));
