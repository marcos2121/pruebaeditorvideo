import type { Asset, EditSegment, ScriptBeat } from "../types";
import type { VisualPreset } from "../styles";

export type BrollMode = "off" | "once" | "fill";

export interface BrollInput {
  segments: EditSegment[];
  assets: Asset[];
  beats: ScriptBeat[];
  mode: BrollMode;
  preset: VisualPreset;
  rand: () => number;
}

/** Duración máxima (en la línea de tiempo) que se muestra una imagen fija. */
const MAX_IMAGE_SEC = 2.6;
/** Duración mínima de un inserto para que se perciba. */
const MIN_INSERT_SEC = 0.9;
/** Resto mínimo de video principal que se deja tras un inserto; si es menor, se reajusta. */
const MIN_REST_SEC = 0.35;
/** Beats en los que tiene sentido mostrar el producto. */
const PRODUCT_ROLES = new Set(["solution", "feature", "benefit", "proof", "objection", "urgency"]);

const segLen = (s: EditSegment) => (s.srcOut - s.srcIn) / s.speed;

/**
 * Inserta imágenes y clips como B-roll sobre la línea de tiempo.
 *
 * - El primer segmento (hook) y el último (CTA) siempre muestran el video principal.
 * - Nunca hay dos insertos seguidos: el video principal sigue siendo el protagonista.
 * - Los insertos se colocan preferentemente donde empiezan los beats de producto
 *   (solución, característica, beneficio, prueba…), y si sobran recursos se reparten.
 * - Si el recurso es más corto que el segmento, el segmento se divide y el resto vuelve al video principal.
 * - La duración total no cambia: el audio del video principal sigue intacto.
 */
export function applyBroll(input: BrollInput): { segments: EditSegment[]; count: number } {
  const { assets, beats, mode, preset, rand } = input;
  const segments = input.segments.map((s) => ({ ...s }));
  if (mode === "off" || !assets.length || segments.length < 3) return { segments, count: 0 };

  const duration = segments.reduce((a, s) => a + segLen(s), 0);
  const starts: number[] = [];
  let acc = 0;
  for (const s of segments) { starts.push(acc); acc += segLen(s); }

  // Candidatos elegibles: ni el primero ni el último, y con longitud suficiente.
  const eligible = new Set<number>();
  for (let i = 1; i < segments.length - 1; i++) if (segLen(segments[i]) >= MIN_INSERT_SEC) eligible.add(i);
  if (!eligible.size) return { segments, count: 0 };

  const target = mode === "once" ? assets.length : Math.max(assets.length, Math.floor(segments.length * 0.4));

  // 1) Segmentos cuyo inicio está más cerca del inicio de un beat de producto.
  const chosen: number[] = [];
  const taken = new Set<number>();
  const blocked = (i: number) => taken.has(i) || taken.has(i - 1) || taken.has(i + 1);
  const productTimes = beats.filter((b) => PRODUCT_ROLES.has(b.role)).map((b) => b.at * duration).sort((a, b) => a - b);
  for (const t of productTimes) {
    if (chosen.length >= target) break;
    let best = -1, bestD = Infinity;
    for (const i of eligible) {
      if (blocked(i)) continue;
      const d = Math.abs(starts[i] - t);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0 && bestD < duration * 0.12) { chosen.push(best); taken.add(best); }
  }

  // 2) Relleno equiespaciado para los recursos restantes.
  if (chosen.length < target) {
    const want = target - chosen.length;
    for (let k = 0; k < want; k++) {
      const t = duration * (0.12 + ((k + 0.5) / want) * 0.76);
      let best = -1, bestD = Infinity;
      for (const i of eligible) {
        if (blocked(i)) continue;
        const d = Math.abs(starts[i] - t);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0) break;
      chosen.push(best); taken.add(best);
    }
  }
  chosen.sort((a, b) => a - b);

  // 3) Asigna recursos en orden y divide segmentos cuando el recurso es más corto.
  const out: EditSegment[] = [];
  let count = 0;
  const zi = Math.max(0.5, preset.zoomIntensity);
  const assignment = new Map<number, Asset>();
  chosen.forEach((i, k) => assignment.set(i, assets[k % assets.length]));

  segments.forEach((seg, i) => {
    const asset = assignment.get(i);
    if (!asset) { out.push(seg); return; }
    const len = segLen(seg);
    let show: number;
    let inPoint = 0;
    if (asset.kind === "image") {
      show = Math.min(len, MAX_IMAGE_SEC);
    } else {
      const need = len * seg.speed;
      if (asset.duration >= need + 0.1) {
        inPoint = rand() * (asset.duration - need - 0.1);
        show = len;
      } else {
        show = Math.max(0, asset.duration - 0.1) / seg.speed;
      }
    }
    // Si el resto del segmento quedaría demasiado corto, la imagen lo absorbe;
    // un clip no puede alargarse, así que se acorta el inserto para dejar un resto útil.
    const rest = len - show;
    if (rest > 0.02 && rest < MIN_REST_SEC) {
      if (asset.kind === "image") show = len;
      else show = len - MIN_REST_SEC;
    }
    if (show < MIN_INSERT_SEC) { out.push(seg); return; }

    const first: EditSegment = {
      ...seg,
      id: `${seg.id}b`,
      srcOut: seg.srcIn + show * seg.speed,
      overlay: { assetId: asset.id, kind: asset.kind, in: Math.round(inPoint * 100) / 100 },
    };
    if (asset.kind === "image") {
      // Ken Burns: acercamiento lento y centrado sobre la foto.
      const dir = count % 2 === 0;
      first.zoomFrom = dir ? 1.02 : 1.16 * zi;
      first.zoomTo = dir ? 1.16 * zi : 1.02;
      first.anchorX = 0.5 + (rand() - 0.5) * 0.08;
      first.anchorY = 0.5 + (rand() - 0.5) * 0.08;
      first.shake = 0;
    }
    out.push(first);
    count++;

    if (len - show >= MIN_REST_SEC - 1e-6) {
      out.push({
        ...seg,
        id: `${seg.id}r`,
        srcIn: first.srcOut,
        zoomFrom: seg.zoomTo,
        transition: "cut",
        shake: 0,
      });
    } else {
      first.srcOut = seg.srcOut;
    }
  });

  return { segments: out, count };
}
