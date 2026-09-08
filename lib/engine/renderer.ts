import type { EditPlan, TimedBeat } from "../types";
import type { VisualPreset } from "../styles";
import { timelineToSource } from "./planner";

export const OUT_W = 1080;
export const OUT_H = 1920;

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

let grainCanvas: HTMLCanvasElement | null = null;
function getGrain() {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 180;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface Word { text: string; hot: boolean; width: number }

function layoutWords(ctx: CanvasRenderingContext2D, text: string, emphasis: string[], maxWidth: number, upper: boolean) {
  const norm = (s: string) => s.toLowerCase().replace(/[.,!?¿¡:;"'()]/g, "");
  const hotSet = new Set(emphasis.flatMap((e) => e.split(/\s+/)).map(norm).filter(Boolean));
  const words: Word[] = text.split(/\s+/).filter(Boolean).map((w) => {
    const t = upper ? w.toUpperCase() : w;
    return { text: t, hot: hotSet.has(norm(w)), width: ctx.measureText(t).width };
  });
  const space = ctx.measureText(" ").width;
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lw = 0;
  for (const w of words) {
    const add = (line.length ? space : 0) + w.width;
    if (lw + add > maxWidth && line.length) { lines.push(line); line = [w]; lw = w.width; }
    else { line.push(w); lw += add; }
  }
  if (line.length) lines.push(line);
  return { lines, space, total: words.length };
}

export interface FrameContext {
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement | HTMLCanvasElement;
  plan: EditPlan;
  preset: VisualPreset;
  t: number;
  videoW: number;
  videoH: number;
}

export function drawFrame({ ctx, video, plan, preset, t, videoW, videoH }: FrameContext) {
  const W = OUT_W, H = OUT_H;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const info = timelineToSource(plan, t);
  const seg = info.segment;
  const segT = t - info.segStart;

  // --- Zoom & movimiento ---
  let zoom = seg.zoomFrom + (seg.zoomTo - seg.zoomFrom) * easeOut(clamp(info.progress, 0, 1));
  let dx = 0, dy = 0, flash = 0, glitch = 0;
  if (seg.transition === "punch" && segT < 0.28) zoom += 0.12 * (1 - segT / 0.28) * preset.zoomIntensity;
  if (seg.transition === "whip" && segT < 0.18) dx = (1 - segT / 0.18) * 90 * (info.index % 2 ? 1 : -1);
  if (seg.transition === "flash" && segT < 0.22) flash = 1 - segT / 0.22;
  if (seg.transition === "glitch" && segT < 0.16) glitch = 1 - segT / 0.16;
  if (seg.shake > 0 && segT < 0.3) {
    const k = (1 - segT / 0.3) * 14 * seg.shake;
    dx += (pseudoRandom(t * 60) - 0.5) * k;
    dy += (pseudoRandom(t * 60 + 9) - 0.5) * k;
  }

  // --- Video (cover) ---
  const vw = videoW || 1080, vh = videoH || 1920;
  const cover = Math.max(W / vw, H / vh);
  const scale = cover * zoom;
  const dw = vw * scale, dh = vh * scale;
  const ax = seg.anchorX, ay = seg.anchorY;
  // Posición para mantener el anclaje centrado y sin bordes
  let x = W / 2 - dw * ax - (W / 2 - W * ax) * (zoom - 1) + dx;
  let y = H / 2 - dh * ay - (H / 2 - H * ay) * (zoom - 1) + dy;
  x = clamp(x, W - dw, 0);
  y = clamp(y, H - dh, 0);

  ctx.filter = preset.filter;
  try {
    if (glitch > 0) {
      const slices = 6;
      const sh = H / slices;
      for (let i = 0; i < slices; i++) {
        const off = (pseudoRandom(i * 3 + Math.floor(t * 30)) - 0.5) * 60 * glitch;
        ctx.drawImage(video, 0, (i * sh - y) / scale, vw, sh / scale, x + off, i * sh, dw, sh);
      }
    } else {
      ctx.drawImage(video, x, y, dw, dh);
    }
  } catch { /* frame no listo */ }
  ctx.filter = "none";

  if (glitch > 0) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255,59,123,${0.18 * glitch})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  // --- Viñeta ---
  if (preset.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${preset.vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Grano ---
  if (plan.grain) {
    ctx.globalAlpha = 0.06;
    ctx.globalCompositeOperation = "overlay";
    const gr = getGrain();
    const ox = Math.floor(pseudoRandom(t * 31) * 256), oy = Math.floor(pseudoRandom(t * 17) * 256);
    ctx.save();
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(gr, "repeat")!;
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // --- Hook ---
  const inHook = t < plan.hook.until && plan.hook.text;
  if (inHook) drawHook(ctx, plan, preset, t);

  // --- Subtítulo activo ---
  const beat = plan.beats.find((b) => t >= b.start && t < b.end && !(inHook && b.role === "hook"));
  const inCta = t >= plan.cta.from && plan.cta.text;
  if (beat && !(inCta && beat.role === "cta")) drawCaption(ctx, beat, preset, t, W, H);

  // --- CTA ---
  if (inCta) drawCta(ctx, plan, preset, t, W, H);

  // --- Flash ---
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * flash})`;
    ctx.fillRect(0, 0, W, H);
  }

  // --- Barra de progreso ---
  if (plan.progressBar) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, H - 14, W, 14);
    ctx.fillStyle = preset.accent;
    ctx.fillRect(0, H - 14, W * clamp(t / plan.duration, 0, 1), 14);
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHook(ctx: CanvasRenderingContext2D, plan: EditPlan, preset: VisualPreset, t: number) {
  const W = OUT_W;
  const pop = easeOutBack(clamp((t + 0.06) / 0.35, 0, 1));
  const fade = plan.hook.until - t < 0.3 ? clamp((plan.hook.until - t) / 0.3, 0, 1) : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = preset.captionFont.replace(/(\d+)px/, (_, n) => `${Math.round(Number(n) * 0.92)}px`);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const upper = preset.captionUppercase;
  const { lines, space } = layoutWords(ctx, plan.hook.text, plan.hook.emphasis, W * 0.8, upper);
  const lineH = 92;
  const padX = 44, padY = 30;
  const boxW = Math.min(W * 0.9, Math.max(...lines.map((l) => l.reduce((a, w) => a + w.width, 0) + space * (l.length - 1))) + padX * 2);
  const boxH = lines.length * lineH + padY * 2;
  const cx = W / 2, cy = 420;
  ctx.translate(cx, cy);
  ctx.rotate(-0.025);
  ctx.scale(pop, pop);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = preset.hookBg;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 28);
  ctx.fill();
  ctx.shadowColor = "transparent";
  let y = -boxH / 2 + padY + lineH / 2;
  for (const line of lines) {
    const total = line.reduce((a, w) => a + w.width, 0) + space * (line.length - 1);
    let x = -total / 2;
    for (const w of line) {
      ctx.textAlign = "left";
      ctx.fillStyle = w.hot ? (preset.hookBg === preset.accent ? "#ffffff" : preset.accent) : preset.hookColor;
      if (w.hot && preset.hookBg === preset.accent) {
        // resalta con fondo oscuro
        ctx.fillStyle = "#06060b";
      }
      ctx.fillText(w.text, x, y);
      x += w.width + space;
    }
    y += lineH;
  }
  ctx.restore();
}

function drawCaption(ctx: CanvasRenderingContext2D, beat: TimedBeat, preset: VisualPreset, t: number, W: number, H: number) {
  const local = t - beat.start;
  const dur = beat.end - beat.start;
  ctx.save();
  ctx.font = preset.captionFont;
  ctx.textBaseline = "middle";
  const { lines, space, total } = layoutWords(ctx, beat.text, beat.emphasis, W * 0.86, preset.captionUppercase);
  const lineH = parseInt(preset.captionFont.match(/(\d+)px/)?.[1] ?? "70") * 1.22;
  const revealPerWord = Math.min(0.11, (dur * 0.55) / Math.max(1, total));
  const shown = Math.floor(local / revealPerWord) + 1;

  const baseY = H * 0.66 - (lines.length * lineH) / 2;
  const pop = easeOutBack(clamp(local / 0.25, 0, 1));
  ctx.translate(W / 2, baseY + (lines.length * lineH) / 2);
  ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop);
  ctx.translate(-W / 2, -(baseY + (lines.length * lineH) / 2));

  if (preset.captionBg && preset.captionBg !== "rgba(0,0,0,0.0)") {
    const maxW = Math.max(...lines.map((l) => l.reduce((a, w) => a + w.width, 0) + space * (l.length - 1)));
    ctx.fillStyle = preset.captionBg;
    roundRect(ctx, W / 2 - maxW / 2 - 40, baseY - 16, maxW + 80, lines.length * lineH + 32, 26);
    ctx.fill();
  }

  let idx = 0;
  let y = baseY + lineH / 2;
  for (const line of lines) {
    const totalW = line.reduce((a, w) => a + w.width, 0) + space * (line.length - 1);
    let x = W / 2 - totalW / 2;
    for (const w of line) {
      const visible = idx < shown;
      const isCurrent = idx === shown - 1;
      if (visible) {
        const s = isCurrent ? 1 + 0.12 * (1 - clamp((local - idx * revealPerWord) / 0.12, 0, 1)) : 1;
        ctx.save();
        ctx.translate(x + w.width / 2, y);
        ctx.scale(s, s);
        ctx.textAlign = "center";
        if (preset.captionStroke) {
          ctx.lineJoin = "round";
          ctx.lineWidth = 16;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.strokeText(w.text, 0, 0);
        } else {
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 6;
        }
        ctx.fillStyle = w.hot || isCurrent ? preset.captionHighlight : preset.captionColor;
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
      }
      x += w.width + space;
      idx++;
    }
    y += lineH;
  }

  // Sticker emoji
  if (preset.stickers && beat.emoji) {
    const p = easeOutBack(clamp(local / 0.4, 0, 1));
    const wob = Math.sin(t * 6) * 0.06;
    ctx.save();
    ctx.translate(W * 0.82, H * 0.5);
    ctx.rotate(0.18 + wob);
    ctx.scale(p, p);
    ctx.font = "160px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 30;
    ctx.fillText(beat.emoji, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawCta(ctx: CanvasRenderingContext2D, plan: EditPlan, preset: VisualPreset, t: number, W: number, H: number) {
  const local = t - plan.cta.from;
  const pop = easeOutBack(clamp(local / 0.4, 0, 1));
  const pulse = 1 + Math.sin(t * 5) * 0.025;
  ctx.save();
  // oscurece un poco
  ctx.fillStyle = `rgba(0,0,0,${0.28 * clamp(local / 0.4, 0, 1)})`;
  ctx.fillRect(0, 0, W, H);

  ctx.font = preset.captionFont.replace(/(\d+)px/, (_, n) => `${Math.round(Number(n) * 0.82)}px`);
  ctx.textBaseline = "middle";
  const { lines, space } = layoutWords(ctx, plan.cta.text, [], W * 0.72, preset.captionUppercase);
  const lineH = 84;
  const boxW = Math.min(W * 0.88, Math.max(...lines.map((l) => l.reduce((a, w) => a + w.width, 0) + space * (l.length - 1))) + 120);
  const boxH = lines.length * lineH + 70;
  ctx.translate(W / 2, H * 0.6);
  ctx.scale(pop * pulse, pop * pulse);
  ctx.shadowColor = preset.ctaBg;
  ctx.shadowBlur = 60;
  ctx.fillStyle = preset.ctaBg;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = preset.ctaColor;
  let y = -boxH / 2 + 35 + lineH / 2;
  for (const line of lines) {
    const totalW = line.reduce((a, w) => a + w.width, 0) + space * (line.length - 1);
    let x = -totalW / 2;
    ctx.textAlign = "left";
    for (const w of line) { ctx.fillText(w.text, x, y); x += w.width + space; }
    y += lineH;
  }
  // Flecha
  const bounce = Math.abs(Math.sin(t * 4)) * 26;
  ctx.font = "140px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("👇", 0, boxH / 2 + 120 + bounce);
  ctx.restore();
}
