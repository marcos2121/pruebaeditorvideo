"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Link2, Scissors, Sparkles, Type, Upload, Wand2, Zap, ShieldCheck, Film, Timer, MousePointerClick } from "lucide-react";
import { SCRIPT_STYLES, VISUAL_PRESETS } from "@/lib/styles";
import { PhoneDemo } from "./PhoneDemo";

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

function Reveal({ children, i = 0, className = "" }: { children: React.ReactNode; i?: number; className?: string }) {
  return (
    <motion.div variants={fade} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className={className}>
      {children}
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-36 pb-20 noise">
      <div className="absolute inset-0 -z-10 bg-grid bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-violet-500/20 blur-[140px]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-volt-300 glass">
              <Sparkles className="h-3.5 w-3.5" /> Edición persuasiva con IA · Para dropshipping y afiliados
            </span>
          </Reveal>
          <Reveal i={1}>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Dale un video crudo.
              <br />
              <span className="text-gradient">Recibe un anuncio que vende.</span>
            </h1>
          </Reveal>
          <Reveal i={2}>
            <p className="mt-6 max-w-xl text-lg text-white/65">
              Sube un clip de 1 minuto o pega un enlace de Drive. ScrollBreak elimina silencios, corta al ritmo del audio, añade hook, subtítulos palabra por palabra, zooms, stickers y CTA. Con 5 estilos de guion que convierten.
            </p>
          </Reveal>
          <Reveal i={3} className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/studio" className="btn-primary text-base">
              Editar mi primer video <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#como-funciona" className="btn-ghost text-base">Ver cómo funciona</a>
          </Reveal>
          <Reveal i={4} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/50">
            {["Sin instalar nada", "Procesado en tu navegador", "Exporta 9:16 en 1080p", "Listo para TikTok, Reels y Shorts"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-volt-400" /> {t}</span>
            ))}
          </Reveal>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <PhoneDemo />
        </motion.div>
      </div>
    </section>
  );
}

export function Marquee() {
  const items = ["TikTok Shop", "Instagram Reels", "YouTube Shorts", "Amazon Afiliados", "Shopify", "Hotmart", "Temu Affiliate", "Meta Ads", "AliExpress"];
  return (
    <div className="border-y border-white/5 bg-white/[0.02] py-4">
      <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
        <div className="flex shrink-0 animate-marquee gap-12 pr-12 text-sm font-semibold uppercase tracking-[0.2em] text-white/35">
          {[...items, ...items].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: Upload, title: "1. Sube o pega el enlace", text: "Arrastra tu video o pega un link de Google Drive, Dropbox o cualquier URL directa. Hasta 250 MB." },
    { icon: Wand2, title: "2. Elige guion y estilo", text: "Describe el producto en 3 campos. Escoge uno de los 5 guiones y un look visual. La IA escribe el copy." },
    { icon: Film, title: "3. Exporta y publica", text: "Revisa la vista previa, ajusta cualquier frase y descarga en 9:16 Full HD. Listo para subir." },
  ];
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-volt-400">Cómo funciona</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">De video crudo a anuncio en 3 pasos.</h2>
      </Reveal>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.title} i={i} className="group relative rounded-3xl p-7 glass transition hover:border-volt-500/40">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-volt-500/10 text-volt-400 ring-1 ring-volt-500/30">
              <s.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-display text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-white/60">{s.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Scripts() {
  return (
    <section id="guiones" className="relative py-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.12),transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">5 estilos de guion</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Estructuras que ya demostraron vender.</h2>
          <p className="mt-4 max-w-2xl text-white/60">Cada estilo define el orden de los beats, el ritmo de corte y el tono del copy. La IA rellena el guion con tu producto y tú lo editas en un clic.</p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SCRIPT_STYLES.map((s, i) => (
            <Reveal key={s.id} i={i} className="relative overflow-hidden rounded-3xl p-7 glass">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: s.accent }} />
              <div className="flex items-center gap-3">
                <span className="text-3xl">{s.icon}</span>
                <div>
                  <h3 className="font-display text-xl font-bold">{s.name}</h3>
                  <p className="text-sm" style={{ color: s.accent }}>{s.tagline}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-white/65">{s.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {s.template.slice(0, 5).map((t, k) => (
                  <span key={k} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-white/50">{t.role}</span>
                ))}
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/40">+{Math.max(0, s.template.length - 5)}</span>
              </div>
              <p className="mt-4 text-xs text-white/45"><span className="font-semibold text-white/60">Ideal para:</span> {s.bestFor}</p>
            </Reveal>
          ))}
          <Reveal i={5} className="flex flex-col justify-between rounded-3xl bg-gradient-to-br from-volt-500 to-volt-300 p-7 text-ink-950">
            <div>
              <h3 className="font-display text-2xl font-bold leading-tight">¿Y si no sabes cuál usar?</h3>
              <p className="mt-3 text-ink-950/70">Genera los 5 en segundos y compáralos en la vista previa. Cambiar de guion no toca tu video original.</p>
            </div>
            <Link href="/studio" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white">
              Probar ahora <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const feats = [
    { icon: Scissors, title: "Corte de silencios automático", text: "Analiza el audio en tu navegador, detecta pausas y muertos, y los elimina con padding natural." },
    { icon: Zap, title: "Zooms al ritmo del audio", text: "Detecta picos de energía y sincroniza punch-ins, whips y flashes para que no haya un segundo plano." },
    { icon: Type, title: "Subtítulos palabra por palabra", text: "Captions gigantes con resaltado de palabras clave, stroke y pop-in. Legibles con el móvil en silencio." },
    { icon: MousePointerClick, title: "Hook + CTA integrados", text: "Banner de gancho en los primeros 3 segundos y tarjeta de llamada a la acción pulsante al final." },
    { icon: Timer, title: "Barra de progreso y stickers", text: "Micro-señales de retención: barra de avance, emojis animados y transiciones cada 2 segundos." },
    { icon: ShieldCheck, title: "Privado por diseño", text: "El video nunca sale de tu navegador. El renderizado ocurre localmente, sin colas ni servidores." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-flame-400">Motor de edición</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Todo lo que hace un editor pro, en automático.</h2>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {feats.map((f, i) => (
          <Reveal key={f.title} i={i} className="rounded-3xl p-6 glass">
            <f.icon className="h-6 w-6 text-volt-400" />
            <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm text-white/60">{f.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Presets() {
  return (
    <section id="estilos" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-volt-400">5 estilos visuales</p>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Un look para cada nicho.</h2>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {VISUAL_PRESETS.map((p, i) => (
          <Reveal key={p.id} i={i} className="rounded-3xl p-5 glass">
            <div className="flex gap-1.5">
              {p.swatch.map((c) => <span key={c} className="h-6 w-6 rounded-full ring-1 ring-white/10" style={{ background: c }} />)}
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">{p.name}</h3>
            <p className="mt-1 text-sm text-white/60">{p.description}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Pricing() {
  const plans = [
    { name: "Starter", price: "Gratis", desc: "Para probar el flujo completo.", features: ["3 exportaciones al mes", "5 guiones + 5 estilos", "Marca de agua discreta", "1080x1920"], cta: "Empezar gratis", hot: false },
    { name: "Creator", price: "$19", per: "/mes", desc: "Para afiliados que publican a diario.", features: ["Exportaciones ilimitadas", "Sin marca de agua", "Guiones con IA ilimitados", "Enlaces de Drive y Dropbox", "Soporte prioritario"], cta: "Elegir Creator", hot: true },
    { name: "Agencia", price: "$59", per: "/mes", desc: "Para equipos y tiendas con varias marcas.", features: ["Todo lo de Creator", "5 asientos", "Presets de marca personalizados", "Procesamiento por lotes", "API de generación de guiones"], cta: "Hablar con ventas", hot: false },
  ];
  return (
    <section id="precios" className="relative py-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,rgba(157,255,0,0.1),transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-volt-400">Precios</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Menos que un editor freelance por un solo video.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} i={i} className={`relative rounded-3xl p-7 ${p.hot ? "border border-volt-500/60 bg-volt-500/[0.06] shadow-glow" : "glass"}`}>
              {p.hot && <span className="absolute -top-3 left-6 rounded-full bg-volt-500 px-3 py-1 text-xs font-bold text-ink-950">Más popular</span>}
              <h3 className="font-display text-xl font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-white/55">{p.desc}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                {p.per && <span className="pb-1 text-white/50">{p.per}</span>}
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-white/75">
                {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-volt-400" />{f}</li>)}
              </ul>
              <Link href="/studio" className={`mt-7 w-full ${p.hot ? "btn-primary" : "btn-ghost"}`}>{p.cta}</Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FAQ() {
  const qs = [
    { q: "¿Necesito saber editar?", a: "No. Subes el video, describes el producto en tres campos y eliges un estilo. ScrollBreak decide cortes, zooms, subtítulos y CTA por ti. Puedes cambiar cualquier frase antes de exportar." },
    { q: "¿Qué formatos y enlaces acepta?", a: "MP4, MOV y WebM subidos desde tu dispositivo, o enlaces públicos de Google Drive, Dropbox, OneDrive y URLs directas de video." },
    { q: "¿Los subtítulos coinciden con lo que digo en el video?", a: "Los subtítulos siguen el guion generado (hook, beneficios, CTA). Si quieres que coincidan con tu voz, pega tu transcripción en el editor de guion y se sincronizan automáticamente." },
    { q: "¿Dónde se procesa mi video?", a: "En tu navegador. El análisis de audio y el render final ocurren localmente, así que tu material nunca se sube a un servidor de terceros." },
    { q: "¿Funciona en móvil?", a: "La vista previa sí. Para exportar recomendamos Chrome o Edge de escritorio, que soportan grabación MP4 nativa." },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <Reveal className="text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight">Preguntas frecuentes</h2>
      </Reveal>
      <div className="mt-10 space-y-3">
        {qs.map((x, i) => (
          <Reveal key={x.q} i={i}>
            <details className="group rounded-2xl p-5 glass">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                {x.q}
                <span className="text-white/40 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-white/60">{x.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <Reveal className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-violet-500 via-ink-800 to-ink-950 p-10 text-center sm:p-16">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-volt-500/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-flame-500/30 blur-3xl" />
        <h2 className="relative font-display text-4xl font-bold tracking-tight sm:text-5xl">Tu próximo video viral está a un clic.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-white/70">Deja de gastar horas en CapCut. Sube tu clip, elige el guion y publica hoy mismo.</p>
        <Link href="/studio" className="btn-primary relative mt-8 text-base">
          Abrir ScrollBreak Studio <ArrowRight className="h-4 w-4" />
        </Link>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 text-sm text-white/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <span>© {new Date().getFullYear()} ScrollBreak. Hecho para vender.</span>
        <div className="flex items-center gap-6">
          <span className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Drive · Dropbox · URL</span>
          <Link href="/studio" className="hover:text-white">Estudio</Link>
        </div>
      </div>
    </footer>
  );
}
