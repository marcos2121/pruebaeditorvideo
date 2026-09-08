import type { EditPlan } from "../types";
import type { VisualPreset } from "../styles";
import { drawFrame, OUT_W, OUT_H } from "./renderer";
import { timelineToSource, segmentStart } from "./planner";

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

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, plan: EditPlan, preset: VisualPreset) {
    this.video = video;
    this.canvas = canvas;
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.plan = plan;
    this.preset = preset;
    this.video.addEventListener("seeked", this.onSeeked);
  }

  setPlan(plan: EditPlan, preset: VisualPreset) {
    this.plan = plan;
    this.preset = preset;
    this.time = Math.min(this.time, plan.duration);
    if (!this.playing) this.seek(this.time);
  }

  private onSeeked = () => {
    if (!this.playing) this.draw();
  };

  draw() {
    if (this.destroyed) return;
    drawFrame({ ctx: this.ctx, video: this.video, plan: this.plan, preset: this.preset, t: this.time, videoW: this.video.videoWidth, videoH: this.video.videoHeight });
  }

  async seek(t: number) {
    this.time = Math.max(0, Math.min(this.plan.duration, t));
    const info = timelineToSource(this.plan, this.time);
    this.segIndex = info.index;
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
    this.loop();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.video.pause();
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
    this.draw();
    this.onTime?.(this.time);
    this.raf = requestAnimationFrame(this.loop);
  };

  private finish() {
    this.playing = false;
    this.video.pause();
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
  }
}
