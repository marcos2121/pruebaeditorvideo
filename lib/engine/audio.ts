import type { AudioAnalysis } from "../types";

/**
 * Analiza el audio del video en el navegador: energía por ventana,
 * silencios y picos. Sirve para cortar muertos y sincronizar zooms.
 */
export async function analyzeAudio(blob: Blob, windowSec = 0.05): Promise<AudioAnalysis | null> {
  try {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const buf = await blob.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    await ctx.close();

    const ch = audio.numberOfChannels;
    const sr = audio.sampleRate;
    const win = Math.max(1, Math.floor(windowSec * sr));
    const total = Math.floor(audio.length / win);
    const energy = new Array<number>(total).fill(0);

    for (let c = 0; c < ch; c++) {
      const data = audio.getChannelData(c);
      for (let w = 0; w < total; w++) {
        let sum = 0;
        const off = w * win;
        for (let i = 0; i < win; i++) {
          const v = data[off + i];
          sum += v * v;
        }
        energy[w] += Math.sqrt(sum / win) / ch;
      }
    }

    const sorted = [...energy].sort((a, b) => a - b);
    const loudness = sorted[Math.floor(sorted.length * 0.7)] || 0.01;
    const floor = Math.max(0.004, loudness * 0.12);

    // Silencios
    const silences: { start: number; end: number }[] = [];
    let silentFrom = -1;
    for (let w = 0; w <= total; w++) {
      const quiet = w < total && energy[w] < floor;
      if (quiet && silentFrom < 0) silentFrom = w;
      if (!quiet && silentFrom >= 0) {
        const start = silentFrom * windowSec;
        const end = w * windowSec;
        if (end - start >= 0.45) silences.push({ start, end });
        silentFrom = -1;
      }
    }

    // Picos (onsets): subida brusca de energía respecto a la media local
    const peaks: number[] = [];
    let last = -10;
    for (let w = 4; w < total - 1; w++) {
      const prev = (energy[w - 1] + energy[w - 2] + energy[w - 3] + energy[w - 4]) / 4;
      if (energy[w] > prev * 1.9 && energy[w] > loudness * 0.8 && w - last > 10) {
        peaks.push(w * windowSec);
        last = w;
      }
    }

    return { duration: audio.duration, windowSec, energy, silences, peaks, loudness };
  } catch (e) {
    console.warn("analyzeAudio failed", e);
    return null;
  }
}
