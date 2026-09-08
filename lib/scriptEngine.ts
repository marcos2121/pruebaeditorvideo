import type { BeatRole, ProductBrief, ScriptBeat, ScriptStyleId } from "./types";
import { STYLE_BY_ID } from "./styles";

type Ctx = ProductBrief & { n: number };
type Gen = (c: Ctx) => { text: string; emphasis: string[]; emoji?: string };

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

const ES: Record<ScriptStyleId, Partial<Record<BeatRole, Gen[]>>> & { common: Record<BeatRole, Gen[]> } = {
  common: {
    hook: [
      (c) => ({ text: `Deja de perder tiempo con ${c.benefit.toLowerCase()}`, emphasis: ["Deja", "tiempo"], emoji: "🛑" }),
      (c) => ({ text: `Esto cambió cómo ${c.audience.toLowerCase()} hacen ${c.benefit.toLowerCase()}`, emphasis: ["cambió"], emoji: "🤯" }),
      (c) => ({ text: `Si eres ${c.audience.toLowerCase()}, necesitas ver esto`, emphasis: ["necesitas"], emoji: "👀" }),
    ],
    problem: [
      (c) => ({ text: `Todos intentan ${c.benefit.toLowerCase()} y fallan`, emphasis: ["fallan"] }),
      (c) => ({ text: `${c.audience} pierden horas y dinero cada semana`, emphasis: ["horas", "dinero"], emoji: "😩" }),
    ],
    agitate: [
      () => ({ text: "Y lo peor: nadie te dice por qué", emphasis: ["peor", "por qué"] }),
      () => ({ text: "Sigues probando cosas que no funcionan", emphasis: ["no funcionan"], emoji: "🙄" }),
    ],
    solution: [
      (c) => ({ text: `Hasta que probé ${c.name}`, emphasis: [c.name], emoji: "💡" }),
      (c) => ({ text: `${c.name} lo resuelve en segundos`, emphasis: [c.name, "segundos"], emoji: "⚡" }),
    ],
    feature: [
      (c) => ({ text: `${c.benefit} sin esfuerzo, sin complicaciones`, emphasis: ["sin esfuerzo"] }),
      (c) => ({ text: `Funciona desde el primer uso`, emphasis: ["primer uso"], emoji: "✅" }),
      () => ({ text: "Calidad premium, precio de locura", emphasis: ["premium", "locura"], emoji: "💎" }),
    ],
    proof: [
      () => ({ text: "Miles de personas ya lo usan cada día", emphasis: ["Miles"], emoji: "🔥" }),
      () => ({ text: "Valorado 4.8 sobre 5 por clientes reales", emphasis: ["4.8"], emoji: "⭐" }),
    ],
    benefit: [
      (c) => ({ text: `Resultado: ${c.benefit.toLowerCase()} de verdad`, emphasis: ["de verdad"], emoji: "🎯" }),
      () => ({ text: "Más tiempo, menos estrés, mejores resultados", emphasis: ["Más tiempo", "mejores"] }),
    ],
    objection: [
      () => ({ text: "¿Suena demasiado bueno? Yo pensé lo mismo", emphasis: ["lo mismo"], emoji: "🤔" }),
      () => ({ text: "Envío rápido y devolución garantizada", emphasis: ["garantizada"], emoji: "📦" }),
    ],
    urgency: [
      (c) => ({ text: c.offer ? `${c.offer} solo por tiempo limitado` : "Oferta solo por tiempo limitado", emphasis: ["tiempo limitado"], emoji: "⏰" }),
      () => ({ text: "Quedan pocas unidades en stock", emphasis: ["pocas unidades"], emoji: "🚨" }),
    ],
    cta: [
      (c) => ({ text: c.cta || "Toca el enlace y consíguelo ahora", emphasis: ["ahora"], emoji: "👇" }),
      (c) => ({ text: c.cta || `Consigue ${c.name} desde el enlace`, emphasis: ["enlace"], emoji: "🛒" }),
    ],
  },
  pas: {
    hook: [
      (c) => ({ text: `¿Cansado de que ${c.benefit.toLowerCase()} sea imposible?`, emphasis: ["Cansado", "imposible"], emoji: "😤" }),
      (c) => ({ text: `El error que cometen ${c.audience.toLowerCase()} todos los días`, emphasis: ["error"], emoji: "❌" }),
    ],
    agitate: [
      () => ({ text: "Cada día que pasa, te cuesta más", emphasis: ["más"], emoji: "📉" }),
    ],
  },
  ugc: {
    hook: [
      (c) => ({ text: `No esperaba que ${c.name} funcionara así`, emphasis: ["No esperaba"], emoji: "😳" }),
      () => ({ text: "Ok, tengo que contarles esto", emphasis: ["contarles"], emoji: "🗣️" }),
    ],
    problem: [
      (c) => ({ text: `Llevaba meses intentando ${c.benefit.toLowerCase()}`, emphasis: ["meses"] }),
    ],
    solution: [
      (c) => ({ text: `Un amigo me recomendó ${c.name}`, emphasis: [c.name], emoji: "💬" }),
    ],
    proof: [
      () => ({ text: "Y honestamente, no vuelvo atrás", emphasis: ["honestamente"], emoji: "🙌" }),
    ],
    cta: [
      (c) => ({ text: c.cta || "Les dejo el enlace donde lo compré", emphasis: ["enlace"], emoji: "👇" }),
    ],
  },
  listicle: {
    hook: [
      (c) => ({ text: `3 razones por las que ${c.audience.toLowerCase()} aman ${c.name}`, emphasis: ["3 razones", c.name], emoji: "🔥" }),
      (c) => ({ text: `3 cosas que nadie te dice de ${c.name}`, emphasis: ["3 cosas"], emoji: "🤫" }),
    ],
    feature: [
      (c) => ({ text: `${c.n}. ${c.benefit} en segundos`, emphasis: [`${c.n}.`], emoji: "⚡" }),
      (c) => ({ text: `${c.n}. Funciona en cualquier lugar`, emphasis: [`${c.n}.`], emoji: "🌍" }),
      (c) => ({ text: `${c.n}. Cuesta menos que un café a la semana`, emphasis: [`${c.n}.`], emoji: "☕" }),
      (c) => ({ text: `${c.n}. Se ve premium, se siente premium`, emphasis: [`${c.n}.`], emoji: "💎" }),
    ],
  },
  beforeafter: {
    hook: [
      (c) => ({ text: `Así era ${c.benefit.toLowerCase()} antes de ${c.name}`, emphasis: ["antes"], emoji: "😩" }),
      () => ({ text: "Antes vs después. Mira la diferencia", emphasis: ["Antes", "después"], emoji: "👀" }),
    ],
    problem: [
      () => ({ text: "ANTES: horas perdidas, cero resultados", emphasis: ["ANTES"], emoji: "⏳" }),
    ],
    agitate: [
      () => ({ text: "Frustración total cada vez que lo intentaba", emphasis: ["Frustración"] }),
    ],
    solution: [
      (c) => ({ text: `AHORA: ${c.name} lo hace por mí`, emphasis: ["AHORA"], emoji: "✨" }),
    ],
    benefit: [
      (c) => ({ text: `${c.benefit} en minutos, no en horas`, emphasis: ["minutos"], emoji: "🚀" }),
    ],
  },
  fomo: {
    hook: [
      (c) => ({ text: c.offer ? `${c.offer} en ${c.name}, solo hoy` : `${c.name} está en oferta solo hoy`, emphasis: ["solo hoy"], emoji: "🚨" }),
      (c) => ({ text: `Se está agotando: ${c.name}`, emphasis: ["agotando"], emoji: "⏰" }),
    ],
    urgency: [
      (c) => ({ text: c.price ? `Precio de hoy: ${c.price}. Mañana sube` : "El precio sube mañana", emphasis: [c.price || "sube"], emoji: "📈" }),
      () => ({ text: "Últimas unidades disponibles", emphasis: ["Últimas"], emoji: "🔥" }),
    ],
    cta: [
      (c) => ({ text: c.cta || "Toca el enlace antes de que se acabe", emphasis: ["ahora", "acabe"], emoji: "👇" }),
    ],
  },
};

const EN: typeof ES = {
  common: {
    hook: [
      (c) => ({ text: `Stop struggling with ${c.benefit.toLowerCase()}`, emphasis: ["Stop"], emoji: "🛑" }),
      (c) => ({ text: `If you're ${c.audience.toLowerCase()}, watch this`, emphasis: ["watch this"], emoji: "👀" }),
    ],
    problem: [(c) => ({ text: `${c.audience} waste hours and money every week`, emphasis: ["hours", "money"], emoji: "😩" })],
    agitate: [() => ({ text: "And nobody tells you why", emphasis: ["why"] })],
    solution: [(c) => ({ text: `Until I tried ${c.name}`, emphasis: [c.name], emoji: "💡" })],
    feature: [(c) => ({ text: `${c.benefit}, zero effort`, emphasis: ["zero effort"], emoji: "✅" })],
    proof: [() => ({ text: "Thousands already use it daily", emphasis: ["Thousands"], emoji: "🔥" })],
    benefit: [(c) => ({ text: `Real ${c.benefit.toLowerCase()}, finally`, emphasis: ["finally"], emoji: "🎯" })],
    objection: [() => ({ text: "Fast shipping, money-back guarantee", emphasis: ["guarantee"], emoji: "📦" })],
    urgency: [(c) => ({ text: c.offer ? `${c.offer} for a limited time` : "Limited time offer", emphasis: ["limited"], emoji: "⏰" })],
    cta: [(c) => ({ text: c.cta || "Tap the link and get yours now", emphasis: ["now"], emoji: "👇" })],
  },
  pas: { hook: [(c) => ({ text: `Tired of ${c.benefit.toLowerCase()} being impossible?`, emphasis: ["Tired", "impossible"], emoji: "😤" })] },
  ugc: { hook: [(c) => ({ text: `I didn't expect ${c.name} to work like this`, emphasis: ["didn't expect"], emoji: "😳" })] },
  listicle: {
    hook: [(c) => ({ text: `3 reasons ${c.audience.toLowerCase()} love ${c.name}`, emphasis: ["3 reasons"], emoji: "🔥" })],
    feature: [
      (c) => ({ text: `${c.n}. ${c.benefit} in seconds`, emphasis: [`${c.n}.`], emoji: "⚡" }),
      (c) => ({ text: `${c.n}. Works anywhere`, emphasis: [`${c.n}.`], emoji: "🌍" }),
      (c) => ({ text: `${c.n}. Looks premium, feels premium`, emphasis: [`${c.n}.`], emoji: "💎" }),
    ],
  },
  beforeafter: {
    hook: [() => ({ text: "Before vs after. Look at the difference", emphasis: ["Before", "after"], emoji: "👀" })],
    problem: [() => ({ text: "BEFORE: hours wasted, zero results", emphasis: ["BEFORE"], emoji: "⏳" })],
    solution: [(c) => ({ text: `NOW: ${c.name} does it for me`, emphasis: ["NOW"], emoji: "✨" })],
  },
  fomo: {
    hook: [(c) => ({ text: `${c.name} is on sale today only`, emphasis: ["today only"], emoji: "🚨" })],
    urgency: [(c) => ({ text: c.price ? `Today's price: ${c.price}. Goes up tomorrow` : "Price goes up tomorrow", emphasis: [c.price || "tomorrow"], emoji: "📈" })],
  },
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Genera un guion completo sin IA a partir de los templates. */
export function generateEngineScript(brief: ProductBrief, styleId: ScriptStyleId, seed = 0): ScriptBeat[] {
  const style = STYLE_BY_ID[styleId];
  const dict = brief.language === "en" ? EN : ES;
  const base = hash(brief.name + brief.benefit) + seed;
  let featureCount = 0;
  return style.template.map((t, i) => {
    const specific = dict[styleId]?.[t.role];
    const generic = dict.common[t.role];
    const pool = [...(specific ?? []), ...generic];
    if (t.role === "feature") featureCount++;
    const ctx: Ctx = { ...brief, n: featureCount };
    const gen = t.role === "feature" && specific?.length ? specific[(featureCount - 1) % specific.length] : pick(pool, base + i * 7);
    const out = gen(ctx);
    return { id: `b${i}`, role: t.role, at: t.at, span: t.span, ...out };
  });
}
