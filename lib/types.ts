export type ScriptStyleId = "pas" | "ugc" | "listicle" | "beforeafter" | "fomo";
export type VisualPresetId = "viral" | "cinematic" | "clean" | "neon" | "raw";
export type Language = "es" | "en";

export interface ProductBrief {
  name: string;
  benefit: string;
  audience: string;
  price?: string;
  offer?: string;
  cta?: string;
  link?: string;
  language: Language;
}

export type BeatRole =
  | "hook"
  | "problem"
  | "agitate"
  | "solution"
  | "feature"
  | "proof"
  | "benefit"
  | "objection"
  | "urgency"
  | "cta";

export interface ScriptBeat {
  id: string;
  role: BeatRole;
  /** Texto del subtítulo / voz. Corto, máximo ~12 palabras. */
  text: string;
  /** Palabras a resaltar en color de acento. */
  emphasis: string[];
  /** Emoji opcional que aparece como sticker. */
  emoji?: string;
  /** Posición relativa 0..1 dentro del video (inicio). */
  at: number;
  /** Duración relativa 0..1. */
  span: number;
}

export type Transition = "cut" | "punch" | "whip" | "flash" | "glitch";

export type AssetKind = "image" | "clip";

/** Imagen o clip corto que se inserta como B-roll sobre el video principal. */
export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  objectUrl: string;
  size: number;
  mime: string;
  width: number;
  height: number;
  /** Solo para clips (segundos). Las imágenes tienen 0. */
  duration: number;
}

/** Recurso visual que sustituye la imagen del video principal durante un segmento. */
export interface SegmentOverlay {
  assetId: string;
  kind: AssetKind;
  /** Punto de entrada dentro del clip (segundos). 0 para imágenes. */
  in: number;
}

export interface EditSegment {
  id: string;
  srcIn: number;
  srcOut: number;
  speed: number;
  zoomFrom: number;
  zoomTo: number;
  /** Punto de anclaje del zoom en coordenadas 0..1 */
  anchorX: number;
  anchorY: number;
  transition: Transition;
  shake: number;
  /** Si existe, el segmento muestra este recurso (imagen o clip) en lugar del video principal. El audio sigue siendo el del video principal. */
  overlay?: SegmentOverlay;
}

export interface TimedBeat extends ScriptBeat {
  start: number;
  end: number;
}

export interface EditPlan {
  id: string;
  style: ScriptStyleId;
  preset: VisualPresetId;
  sourceDuration: number;
  duration: number;
  segments: EditSegment[];
  beats: TimedBeat[];
  hook: { text: string; emphasis: string[]; until: number };
  cta: { text: string; sub: string; from: number };
  progressBar: boolean;
  stickers: boolean;
  grain: boolean;
  removedSilence: number;
  scriptSource: "ai" | "engine";
  /** Número de inserciones de B-roll (imágenes + clips). */
  brollCount: number;
}

export interface AudioAnalysis {
  duration: number;
  windowSec: number;
  energy: number[];
  silences: { start: number; end: number }[];
  peaks: number[];
  loudness: number;
}

export interface SourceMedia {
  kind: "file" | "url";
  name: string;
  objectUrl: string;
  size: number;
  mime: string;
  duration: number;
  width: number;
  height: number;
}
