import type { Asset, AudioAnalysis, EditPlan, EditSegment, ScriptBeat, ScriptStyleId, TimedBeat, Transition, VisualPresetId } from "../types";
import { STYLE_BY_ID, PRESET_BY_ID } from "../styles";
import { applyBroll, type BrollMode } from "./broll";

export interface PlannerInput {
  sourceDuration: number;
  analysis: AudioAnalysis | null;
  style: ScriptStyleId;
  preset: VisualPresetId;
  beats: ScriptBeat[];
  maxDuration?: number;
  removeSilence?: boolean;
  scriptSource: "ai" | "engine";
  seed?: number;
  /** Imágenes y clips extra para B-roll. */
  assets?: Asset[];
  brollMode?: BrollMode;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

function keptRanges(duration: number, analysis: AudioAnalysis | null, removeSilence: boolean) {
  const ranges: { start: number; end: number }[] = [];
  if (!analysis || !removeSilence || analysis.silences.length === 0) return [{ start: 0, end: duration }];
  const pad = 0.12;
  let cursor = 0;
  for (const s of analysis.silences) {
    const cutStart = Math.min(duration, s.start + pad);
    const cutEnd = Math.max(0, s.end - pad);
    if (cutEnd - cutStart < 0.2) continue;
    if (cutStart - cursor >= 0.3) ranges.push({ start: cursor, end: cutStart });
    cursor = cutEnd;
  }
  if (duration - cursor >= 0.3) ranges.push({ start: cursor, end: duration });
  return ranges.length ? ranges : [{ start: 0, end: duration }];
}

function avgEnergy(analysis: AudioAnalysis | null, a: number, b: number) {
  if (!analysis) return 1;
  const w = analysis.windowSec;
  const i0 = Math.max(0, Math.floor(a / w));
  const i1 = Math.min(analysis.energy.length - 1, Math.floor(b / w));
  if (i1 < i0) return analysis.loudness;
  let s = 0;
  for (let i = i0; i <= i1; i++) s += analysis.energy[i];
  return s / (i1 - i0 + 1);
}

export function buildPlan(input: PlannerInput): EditPlan {
  const style = STYLE_BY_ID[input.style];
  const preset = PRESET_BY_ID[input.preset];
  const rand = rng((input.seed ?? 7) * 2654435761);
  const maxDuration = input.maxDuration ?? 60;
  const analysis = input.analysis;

  let ranges = keptRanges(input.sourceDuration, analysis, input.removeSilence ?? true);
  const keptTotal = ranges.reduce((a, r) => a + (r.end - r.start), 0);
  const removedSilence = Math.max(0, input.sourceDuration - keptTotal);

  // Recorta al máximo permitido
  let budget = maxDuration * style.pace;
  const trimmed: typeof ranges = [];
  for (const r of ranges) {
    const len = r.end - r.start;
    if (budget <= 0.3) break;
    if (len <= budget) { trimmed.push(r); budget -= len; }
    else { trimmed.push({ start: r.start, end: r.start + budget }); budget = 0; }
  }
  ranges = trimmed;

  const peaks = analysis?.peaks ?? [];
  const [minCut, maxCut] = style.cutRhythm;
  let segments: EditSegment[] = [];
  let idx = 0;

  for (const r of ranges) {
    let t = r.start;
    while (r.end - t > 0.25) {
      let len = minCut + rand() * (maxCut - minCut);
      let end = Math.min(r.end, t + len);
      // Ajusta el corte a un pico cercano para sincronía con el audio
      const near = peaks.find((p) => p > t + minCut * 0.6 && Math.abs(p - end) < 0.45);
      if (near) end = Math.min(r.end, near);
      if (r.end - end < 0.6) end = r.end;

      const onPeak = peaks.some((p) => Math.abs(p - t) < 0.12);
      const energy = avgEnergy(analysis, t, end);
      const lowEnergy = analysis ? energy < analysis.loudness * 0.45 : false;
      const zi = preset.zoomIntensity;
      const pattern = idx % 4;
      let zoomFrom = 1, zoomTo = 1;
      if (pattern === 0) { zoomFrom = 1.0; zoomTo = 1 + 0.1 * zi; }
      else if (pattern === 1) { zoomFrom = 1 + 0.14 * zi; zoomTo = 1 + 0.06 * zi; }
      else if (pattern === 2) { zoomFrom = 1 + 0.04 * zi; zoomTo = 1 + 0.12 * zi; }
      else { zoomFrom = 1 + 0.18 * zi; zoomTo = 1 + 0.1 * zi; }
      if (onPeak) zoomFrom += 0.08 * zi;

      let transition: Transition = "cut";
      if (idx === 0) transition = "cut";
      else if (onPeak) transition = "punch";
      else if (input.preset === "neon" && idx % 5 === 2) transition = "glitch";
      else if (idx % 6 === 3) transition = "whip";
      else if (idx % 7 === 5 && preset.zoomIntensity >= 0.9) transition = "flash";

      let speed = style.pace;
      if (lowEnergy) speed *= 1.1;
      speed = Math.round(speed * 100) / 100;

      segments.push({
        id: `s${idx}`,
        srcIn: t,
        srcOut: end,
        speed,
        zoomFrom,
        zoomTo,
        anchorX: 0.5 + (rand() - 0.5) * 0.18,
        anchorY: 0.42 + (rand() - 0.5) * 0.16,
        transition,
        shake: onPeak ? 1 * preset.shakeIntensity : 0,
      });
      idx++;
      t = end;
    }
  }

  // B-roll: imágenes y clips sobre el video principal (no altera la duración ni el audio).
  const broll = applyBroll({ segments, assets: input.assets ?? [], beats: input.beats, mode: input.brollMode ?? "once", preset, rand });
  segments = broll.segments;

  const duration = segments.reduce((a, s) => a + (s.srcOut - s.srcIn) / s.speed, 0);

  // Beats en la línea de tiempo
  const beats: TimedBeat[] = input.beats.map((b) => {
    const start = b.at * duration;
    const end = Math.min(duration, Math.max(start + 1.2, (b.at + b.span) * duration - 0.15));
    return { ...b, start, end };
  });

  const hookBeat = beats.find((b) => b.role === "hook") ?? beats[0];
  const ctaBeat = [...beats].reverse().find((b) => b.role === "cta") ?? beats[beats.length - 1];

  return {
    id: `plan_${Date.now().toString(36)}`,
    style: input.style,
    preset: input.preset,
    sourceDuration: input.sourceDuration,
    duration,
    segments,
    beats,
    hook: { text: hookBeat?.text ?? "", emphasis: hookBeat?.emphasis ?? [], until: Math.min(duration, Math.max(2.4, hookBeat?.end ?? 3)) },
    cta: { text: ctaBeat?.text ?? "", sub: "", from: ctaBeat?.start ?? Math.max(0, duration - 4) },
    progressBar: true,
    stickers: preset.stickers,
    grain: preset.grain,
    removedSilence,
    scriptSource: input.scriptSource,
    brollCount: broll.count,
  };
}

/** Convierte tiempo de la línea de tiempo en tiempo del video fuente. */
export function timelineToSource(plan: EditPlan, t: number) {
  let acc = 0;
  for (let i = 0; i < plan.segments.length; i++) {
    const s = plan.segments[i];
    const len = (s.srcOut - s.srcIn) / s.speed;
    if (t < acc + len || i === plan.segments.length - 1) {
      const local = Math.max(0, Math.min(len, t - acc));
      return { index: i, segment: s, srcTime: s.srcIn + local * s.speed, progress: len > 0 ? local / len : 1, segStart: acc, segLen: len };
    }
    acc += len;
  }
  const s = plan.segments[0];
  return { index: 0, segment: s, srcTime: s?.srcIn ?? 0, progress: 0, segStart: 0, segLen: 0 };
}

export function segmentStart(plan: EditPlan, index: number) {
  let acc = 0;
  for (let i = 0; i < index; i++) acc += (plan.segments[i].srcOut - plan.segments[i].srcIn) / plan.segments[i].speed;
  return acc;
}
