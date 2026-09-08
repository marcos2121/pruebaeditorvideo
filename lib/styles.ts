import type { ScriptStyleId, VisualPresetId, BeatRole } from "./types";

export interface BeatTemplate {
  role: BeatRole;
  at: number;
  span: number;
}

export interface ScriptStyle {
  id: ScriptStyleId;
  name: string;
  tagline: string;
  description: string;
  bestFor: string;
  icon: string;
  accent: string;
  /** Estructura de beats (tiempos relativos). */
  template: BeatTemplate[];
  /** Ritmo de corte objetivo en segundos. */
  cutRhythm: [number, number];
  /** Velocidad de reproducción base. */
  pace: number;
  /** Instrucción para el modelo. */
  prompt: string;
}

export const SCRIPT_STYLES: ScriptStyle[] = [
  {
    id: "pas",
    name: "Dolor → Solución",
    tagline: "Problema, agitación, solución.",
    description:
      "Abre con el dolor exacto del cliente, lo agita hasta que duela y presenta tu producto como la única salida. El clásico que más convierte en frío.",
    bestFor: "Productos que resuelven un problema evidente (gadgets, hogar, belleza).",
    icon: "🔥",
    accent: "#ff4d1c",
    template: [
      { role: "hook", at: 0, span: 0.09 },
      { role: "problem", at: 0.09, span: 0.13 },
      { role: "agitate", at: 0.22, span: 0.13 },
      { role: "solution", at: 0.35, span: 0.15 },
      { role: "feature", at: 0.5, span: 0.14 },
      { role: "benefit", at: 0.64, span: 0.14 },
      { role: "proof", at: 0.78, span: 0.1 },
      { role: "cta", at: 0.88, span: 0.12 },
    ],
    cutRhythm: [1.6, 3.2],
    pace: 1.0,
    prompt:
      "Estructura Problema-Agitación-Solución. El hook nombra el dolor en primera persona o pregunta directa. Agita con consecuencias concretas. La solución se presenta como descubrimiento.",
  },
  {
    id: "ugc",
    name: "Historia UGC",
    tagline: "\"No esperaba que esto funcionara...\"",
    description:
      "Narrativa en primera persona como si lo contara un amigo. Genera confianza, se siente orgánico y esquiva la resistencia a los anuncios.",
    bestFor: "Afiliados, TikTok Shop, reseñas honestas, productos de estilo de vida.",
    icon: "🎥",
    accent: "#7c5cff",
    template: [
      { role: "hook", at: 0, span: 0.1 },
      { role: "problem", at: 0.1, span: 0.14 },
      { role: "solution", at: 0.24, span: 0.16 },
      { role: "feature", at: 0.4, span: 0.14 },
      { role: "benefit", at: 0.54, span: 0.14 },
      { role: "objection", at: 0.68, span: 0.12 },
      { role: "proof", at: 0.8, span: 0.08 },
      { role: "cta", at: 0.88, span: 0.12 },
    ],
    cutRhythm: [2.2, 4.0],
    pace: 1.0,
    prompt:
      "Tono conversacional, primera persona, como un creador contando una experiencia real. Sin lenguaje de vendedor. Incluye una duda inicial y cómo se resolvió.",
  },
  {
    id: "listicle",
    name: "3 Razones",
    tagline: "Lista rápida, ritmo brutal.",
    description:
      "Un hook numérico y tres razones en ráfaga. Cortes cada 2 segundos, zooms en cada punto. Ideal para retener hasta el final.",
    bestFor: "Productos con varias funciones, comparativas, top de ventas.",
    icon: "⚡",
    accent: "#9dff00",
    template: [
      { role: "hook", at: 0, span: 0.1 },
      { role: "feature", at: 0.1, span: 0.2 },
      { role: "feature", at: 0.3, span: 0.2 },
      { role: "feature", at: 0.5, span: 0.2 },
      { role: "benefit", at: 0.7, span: 0.12 },
      { role: "urgency", at: 0.82, span: 0.06 },
      { role: "cta", at: 0.88, span: 0.12 },
    ],
    cutRhythm: [1.2, 2.2],
    pace: 1.06,
    prompt:
      "Formato lista numerada: '3 razones por las que...'. Cada razón empieza con el número (1., 2., 3.) y es una frase corta y contundente.",
  },
  {
    id: "beforeafter",
    name: "Antes vs Después",
    tagline: "Transformación visual.",
    description:
      "Contrasta la vida sin el producto contra la vida con él. Cambio de ritmo y color entre la primera y la segunda mitad para un efecto dramático.",
    bestFor: "Belleza, fitness, limpieza, organización, cualquier resultado visible.",
    icon: "✨",
    accent: "#ffd23b",
    template: [
      { role: "hook", at: 0, span: 0.09 },
      { role: "problem", at: 0.09, span: 0.15 },
      { role: "agitate", at: 0.24, span: 0.12 },
      { role: "solution", at: 0.36, span: 0.14 },
      { role: "benefit", at: 0.5, span: 0.16 },
      { role: "proof", at: 0.66, span: 0.12 },
      { role: "urgency", at: 0.78, span: 0.1 },
      { role: "cta", at: 0.88, span: 0.12 },
    ],
    cutRhythm: [1.8, 3.4],
    pace: 1.0,
    prompt:
      "Contraste ANTES (frustración, gris) vs DESPUÉS (alivio, resultado). Usa la palabra 'antes' y 'ahora'. La segunda mitad es entusiasta y concreta.",
  },
  {
    id: "fomo",
    name: "Oferta Relámpago",
    tagline: "Escasez, urgencia, acción.",
    description:
      "Va directo a la oferta: precio, descuento, stock limitado y un CTA repetido. Máxima presión de venta para audiencias ya calientes.",
    bestFor: "Retargeting, lanzamientos, liquidaciones, promos de temporada.",
    icon: "⏰",
    accent: "#ff3b7b",
    template: [
      { role: "hook", at: 0, span: 0.09 },
      { role: "benefit", at: 0.09, span: 0.14 },
      { role: "feature", at: 0.23, span: 0.14 },
      { role: "proof", at: 0.37, span: 0.12 },
      { role: "urgency", at: 0.49, span: 0.14 },
      { role: "objection", at: 0.63, span: 0.12 },
      { role: "urgency", at: 0.75, span: 0.1 },
      { role: "cta", at: 0.85, span: 0.15 },
    ],
    cutRhythm: [1.3, 2.6],
    pace: 1.04,
    prompt:
      "Urgencia y escasez reales: descuento, unidades limitadas, 'solo hoy'. Repite el CTA dos veces. Menciona el precio o la oferta explícitamente si existe.",
  },
];

export const STYLE_BY_ID = Object.fromEntries(SCRIPT_STYLES.map((s) => [s.id, s])) as Record<ScriptStyleId, ScriptStyle>;

export interface VisualPreset {
  id: VisualPresetId;
  name: string;
  description: string;
  swatch: string[];
  accent: string;
  captionBg: string;
  captionColor: string;
  captionHighlight: string;
  captionFont: string;
  captionUppercase: boolean;
  captionStroke: boolean;
  filter: string;
  vignette: number;
  grain: boolean;
  stickers: boolean;
  zoomIntensity: number;
  shakeIntensity: number;
  hookBg: string;
  hookColor: string;
  ctaBg: string;
  ctaColor: string;
}

export const VISUAL_PRESETS: VisualPreset[] = [
  {
    id: "viral",
    name: "Viral TikTok",
    description: "Subtítulos gigantes, zooms agresivos y emojis. El estilo que domina el For You.",
    swatch: ["#9dff00", "#ffffff", "#000000"],
    accent: "#9dff00",
    captionBg: "rgba(0,0,0,0.0)",
    captionColor: "#ffffff",
    captionHighlight: "#9dff00",
    captionFont: "900 82px 'Space Grotesk', 'Inter', system-ui, sans-serif",
    captionUppercase: true,
    captionStroke: true,
    filter: "contrast(1.12) saturate(1.28) brightness(1.03)",
    vignette: 0.35,
    grain: false,
    stickers: true,
    zoomIntensity: 1.0,
    shakeIntensity: 1.0,
    hookBg: "#9dff00",
    hookColor: "#06060b",
    ctaBg: "#9dff00",
    ctaColor: "#06060b",
  },
  {
    id: "cinematic",
    name: "Cinemático",
    description: "Look de película: grano fino, viñeta, color cálido y tipografía elegante.",
    swatch: ["#ffd23b", "#f5f0e6", "#1a1410"],
    accent: "#ffd23b",
    captionBg: "rgba(0,0,0,0.0)",
    captionColor: "#f5f0e6",
    captionHighlight: "#ffd23b",
    captionFont: "700 66px 'Space Grotesk', 'Inter', system-ui, sans-serif",
    captionUppercase: false,
    captionStroke: false,
    filter: "contrast(1.18) saturate(0.92) sepia(0.14) brightness(0.98)",
    vignette: 0.6,
    grain: true,
    stickers: false,
    zoomIntensity: 0.6,
    shakeIntensity: 0.3,
    hookBg: "rgba(0,0,0,0.65)",
    hookColor: "#f5f0e6",
    ctaBg: "#ffd23b",
    ctaColor: "#1a1410",
  },
  {
    id: "clean",
    name: "Minimal Clean",
    description: "Blanco, ordenado y premium. Perfecto para marcas de skincare, tech y hogar.",
    swatch: ["#ffffff", "#111111", "#7c5cff"],
    accent: "#7c5cff",
    captionBg: "rgba(255,255,255,0.92)",
    captionColor: "#111111",
    captionHighlight: "#7c5cff",
    captionFont: "800 62px 'Inter', system-ui, sans-serif",
    captionUppercase: false,
    captionStroke: false,
    filter: "contrast(1.05) saturate(1.05) brightness(1.06)",
    vignette: 0.15,
    grain: false,
    stickers: false,
    zoomIntensity: 0.5,
    shakeIntensity: 0.0,
    hookBg: "#ffffff",
    hookColor: "#111111",
    ctaBg: "#111111",
    ctaColor: "#ffffff",
  },
  {
    id: "neon",
    name: "Neon Hype",
    description: "Colores eléctricos, glitches y flashes. Energía máxima para gadgets y gaming.",
    swatch: ["#ff3b7b", "#3bf0ff", "#0a0014"],
    accent: "#ff3b7b",
    captionBg: "rgba(0,0,0,0.0)",
    captionColor: "#ffffff",
    captionHighlight: "#3bf0ff",
    captionFont: "900 78px 'Space Grotesk', 'Inter', system-ui, sans-serif",
    captionUppercase: true,
    captionStroke: true,
    filter: "contrast(1.2) saturate(1.5) hue-rotate(-6deg)",
    vignette: 0.5,
    grain: true,
    stickers: true,
    zoomIntensity: 1.2,
    shakeIntensity: 1.3,
    hookBg: "#ff3b7b",
    hookColor: "#ffffff",
    ctaBg: "#3bf0ff",
    ctaColor: "#0a0014",
  },
  {
    id: "raw",
    name: "UGC Auténtico",
    description: "Sin filtros ni artificios. Subtítulos sencillos y cortes suaves para parecer orgánico.",
    swatch: ["#ffffff", "#ffe600", "#222222"],
    accent: "#ffe600",
    captionBg: "rgba(0,0,0,0.0)",
    captionColor: "#ffffff",
    captionHighlight: "#ffe600",
    captionFont: "800 64px 'Inter', system-ui, sans-serif",
    captionUppercase: false,
    captionStroke: true,
    filter: "contrast(1.04) saturate(1.08)",
    vignette: 0.2,
    grain: false,
    stickers: true,
    zoomIntensity: 0.55,
    shakeIntensity: 0.2,
    hookBg: "rgba(0,0,0,0.6)",
    hookColor: "#ffffff",
    ctaBg: "#ffe600",
    ctaColor: "#222222",
  },
];

export const PRESET_BY_ID = Object.fromEntries(VISUAL_PRESETS.map((p) => [p.id, p])) as Record<VisualPresetId, VisualPreset>;
