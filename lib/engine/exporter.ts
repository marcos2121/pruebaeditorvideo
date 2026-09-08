import type { Player } from "./player";

const audioGraph = new WeakMap<HTMLVideoElement, { ctx: AudioContext; source: MediaElementAudioSourceNode }>();

export function pickMime() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  return "";
}

export function getAudioGraph(video: HTMLVideoElement) {
  let g = audioGraph.get(video);
  if (!g) {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const source = ctx.createMediaElementSource(video);
    source.connect(ctx.destination);
    g = { ctx, source };
    audioGraph.set(video, g);
  }
  return g;
}

export interface ExportResult { blob: Blob; mime: string; ext: string }

/**
 * Exporta el video final grabando el canvas en tiempo real con MediaRecorder.
 * Todo ocurre en el navegador: sin servidores de render.
 */
export async function exportVideo(player: Player, onProgress?: (p: number) => void, fps = 30): Promise<ExportResult> {
  const mime = pickMime();
  if (!mime) throw new Error("Tu navegador no soporta MediaRecorder. Usa Chrome, Edge o Safari 17+.");

  const canvasStream = player.canvas.captureStream(fps);
  const { ctx, source } = getAudioGraph(player.video);
  if (ctx.state === "suspended") await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

  const wasMuted = player.video.muted;
  player.video.muted = false;
  player.video.volume = 1;

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 192_000 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] }));
    recorder.onerror = () => reject(new Error("Error al grabar el video"));
  });

  const prevOnTime = player.onTime;
  const prevOnEnded = player.onEnded;
  player.onTime = (t) => { prevOnTime?.(t); onProgress?.(Math.min(0.99, t / player.plan.duration)); };

  await player.seek(0);
  await new Promise((r) => setTimeout(r, 120));
  recorder.start(250);
  const ended = new Promise<void>((resolve) => { player.onEnded = () => { prevOnEnded?.(); resolve(); }; });
  await player.play();
  await ended;
  await new Promise((r) => setTimeout(r, 200));
  recorder.stop();
  const blob = await done;

  player.onTime = prevOnTime;
  player.onEnded = prevOnEnded;
  player.video.muted = wasMuted;
  source.disconnect(dest);
  stream.getTracks().forEach((tr) => tr.stop());
  onProgress?.(1);

  return { blob, mime, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
}
