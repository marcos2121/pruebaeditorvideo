import type { Asset, EditPlan } from "../types";
import type { VisualPreset } from "../styles";
import { drawFrame, buildBlurredBackground, OUT_W, OUT_H, type OverlayPicture } from "./renderer";
import { timelineToSource, segmentStart } from "./planner";

interface LoadedAsset {
  asset: Asset;
  el: HTMLImageElement | HTMLVideoElement;
  bg?: HTMLCanvasElement;
  ready: boolean;
}

/**
 * Biblioteca de recursos de B-roll: crea y precarga los elementos <img> y <video>
 * (mudos) fuera del árbol de React y los entrega al renderer.
 */
class MediaLibrary {
  private items = new Map<string, LoadedAsset>();
  onSeeked?: () => void;

  async load(assets: Asset[]) {
    const wanted = new Set(assets.map((a) => a.id));
    for (const [id, item] of this.items) {
      if (!wanted.has(id)) { this.dispose(item); this.items.delete(id); }
    }
    await Promise.all(assets.filter((a) => !this.items.has(a.id)).map((a) => this.add(a)));
  }

  private async add(asset: Asset) {
    if (asset.kind === "image") {
      const el = new Image();
      el.decoding = "async";
      el.src = asset.objectUrl;
      const item: LoadedAsset = { asset, el, ready: false };
      this.items.set(asset.id, item);
      try { await el.decode(); } catch { await new Promise((r) => { el.onload = r; el.onerror = r; }); }
      const vertical = asset.width / asset.height <= (9 / 16) * 1.12;
      if (!vertical) item.bg = buildBlurredBackground(el, asset.width, asset.height);
      item.ready = el.naturalWidth > 0;
      return;
    }
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.src = asset.objectUrl;
    el.addEventListener("seeked", () => this.onSeeked?.());
    const item: LoadedAsset = { asset, el, ready: false };
    this.items.set(asset.id, item);
    await new Promise<void>((resolve) => {
      if (el.readyState >= 2) return resolve();
      el.addEventListener("loadeddata", () => resolve(), { once: true });
      el.addEventListener("error", () => resolve(), { once: true });
    });
    item.ready = el.readyState >= 2;
  }

  picture(id: string): OverlayPicture | null {
    const item = this.items.get(id);
    if (!item || !item.ready) return null;
    return { el: item.el, w: item.asset.width, h: item.asset.height, bg: item.bg };
  }

  clip(id: string): HTMLVideoElement | null {
    const item = this.items.get(id);
    return item && item.asset.kind === "clip" ? (item.el as HTMLVideoElement) : null;
  }

  private dispose(item: LoadedAsset) {
    if (item.el instanceof HTMLVideoElement) { item.el.pause(); item.el.removeAttribute("src"); item.el.load(); }
  }

  destroy() {
    for (const item of this.items.values()) this.dispose(item);
    this.items.clear();
  }
}

export class Player {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  plan: EditPlan;
  preset: VisualPreset;
  time = 0;
  playing = false;
  onTime?: (t: number) => void;
  onEnded?: () => void;
  private raf = 0;
  private segIndex = 0;
  private destroyed = false;
  private library = new MediaLibrary();
  private activeClip: HTMLVideoElement | null = null;

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, plan: EditPlan, preset: VisualPreset) {
    this.video = video;
    this.canvas = canvas;
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.plan = plan;
    this.preset = preset;
    this.video.addEventListener("seeked", this.onSeeked);
    this.library.onSeeked = this.onSeeked;
  }

  setPlan(plan: EditPlan, preset: VisualPreset) {
    this.plan = plan;
    this.preset = preset;
    this.time = Math.min(this.time, plan.duration);
    if (!this.playing) this.seek(this.time);
  }

  /** Carga (o descarga) los recursos de B-roll y redibuja. */
  async setAssets(assets: Asset[]) {
    await this.library.load(assets);
    if (!this.destroyed && !this.playing) this.draw();
  }

  private onSeeked = () => {
    if (!this.playing) this.draw();
  };

  draw() {
    if (this.destroyed) return;
    drawFrame({
      ctx: this.ctx,
      video: this.video,
      plan: this.plan,
      preset: this.preset,
      t: this.time,
      videoW: this.video.videoWidth,
      videoH: this.video.videoHeight,
      resolveOverlay: (id) => this.library.picture(id),
    });
  }

  /** Coloca el clip de B-roll del segmento actual en el instante correcto. */
  private syncClip(info: ReturnType<typeof timelineToSource>) {
    const ov = info.segment.overlay;
    const clip = ov?.kind === "clip" ? this.library.clip(ov.assetId) : null;
    if (this.activeClip && this.activeClip !== clip) { this.activeClip.pause(); this.activeClip = null; }
    if (!clip || !ov) return;
    const local = Math.max(0, this.time - info.segStart);
    const target = ov.in + local * info.segment.speed;
    if (this.playing) {
      if (clip.paused || Math.abs(clip.currentTime - target) > 0.35) {
        clip.currentTime = target;
        clip.playbackRate = info.segment.speed;
        clip.play().catch(() => {});
      }
    } else if (Math.abs(clip.currentTime - target) > 0.03) {
      clip.currentTime = target;
    }
    this.activeClip = clip;
  }

  async seek(t: number) {
    this.time = Math.max(0, Math.min(this.plan.duration, t));
    const info = timelineToSource(this.plan, this.time);
    this.segIndex = info.index;
    this.syncClip(info);
    if (Math.abs(this.video.currentTime - info.srcTime) > 0.03) {
      this.video.currentTime = info.srcTime;
    } else {
      this.draw();
    }
    this.onTime?.(this.time);
  }

  async play() {
    if (this.playing) return;
    if (this.time >= this.plan.duration - 0.05) this.time = 0;
    const info = timelineToSource(this.plan, this.time);
    this.segIndex = info.index;
    this.video.currentTime = info.srcTime;
    this.video.playbackRate = info.segment.speed;
    this.playing = true;
    try { await this.video.play(); } catch (e) { this.playing = false; throw e; }
    this.syncClip(info);
    this.loop();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.video.pause();
    this.activeClip?.pause();
    this.draw();
  }

  private loop = () => {
    if (!this.playing || this.destroyed) return;
    const seg = this.plan.segments[this.segIndex];
    if (!seg) { this.finish(); return; }
    const ct = this.video.currentTime;
    if (ct >= seg.srcOut - 0.02 || this.video.ended) {
      this.segIndex++;
      const next = this.plan.segments[this.segIndex];
      if (!next) { this.finish(); return; }
      this.video.currentTime = next.srcIn;
      this.video.playbackRate = next.speed;
      this.time = segmentStart(this.plan, this.segIndex);
    } else {
      const local = Math.max(0, (ct - seg.srcIn) / seg.speed);
      this.time = segmentStart(this.plan, this.segIndex) + local;
    }
    const cur = this.plan.segments[this.segIndex];
    const segStart = segmentStart(this.plan, this.segIndex);
    this.syncClip({ index: this.segIndex, segment: cur, srcTime: this.video.currentTime, progress: 0, segStart, segLen: (cur.srcOut - cur.srcIn) / cur.speed });
    this.draw();
    this.onTime?.(this.time);
    this.raf = requestAnimationFrame(this.loop);
  };

  private finish() {
    this.playing = false;
    this.video.pause();
    this.activeClip?.pause();
    this.activeClip = null;
    this.time = this.plan.duration;
    this.draw();
    this.onTime?.(this.time);
    this.onEnded?.();
  }

  destroy() {
    this.destroyed = true;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.video.removeEventListener("seeked", this.onSeeked);
    this.library.destroy();
  }
}
