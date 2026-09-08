"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LINES = [
  { text: "Deja de PERDER ventas con videos aburridos", hot: ["PERDER"], emoji: "🛑" },
  { text: "Esto ROMPE el scroll en 0.8 segundos", hot: ["ROMPE"], emoji: "⚡" },
  { text: "Subtítulos, zooms y HOOK automáticos", hot: ["HOOK"], emoji: "🎯" },
  { text: "Toca el enlace y consíguelo AHORA", hot: ["AHORA"], emoji: "👇" },
];

export function PhoneDemo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % LINES.length), 2200);
    return () => clearInterval(id);
  }, []);
  const line = LINES[i];
  const words = line.text.split(" ");
  return (
    <div className="relative mx-auto w-[280px] sm:w-[320px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-volt-500/20 blur-3xl" />
      <div className="absolute -inset-16 -z-10 rounded-full bg-violet-500/20 blur-3xl animate-float" />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[44px] border-[6px] border-ink-700 bg-ink-900 shadow-card">
        <div className="absolute left-1/2 top-3 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        <motion.div
          key={i}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1.18 }}
          transition={{ duration: 2.2, ease: "easeOut" }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#7c5cff_0%,transparent_55%),radial-gradient(ellipse_at_80%_80%,#ff4d1c_0%,transparent_50%),linear-gradient(160deg,#12121f,#06060b)]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.75)_100%)]" />
        <AnimatePresence mode="wait">
          {i === 0 && (
            <motion.div
              key="hook"
              initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: -2 }}
              exit={{ opacity: 0 }}
              className="absolute left-[9%] top-[18%] w-[82%] rounded-2xl bg-volt-500 px-4 py-3 text-center font-display text-lg font-bold uppercase leading-tight text-ink-950 shadow-glow"
            >
              ¿Tus videos no venden?
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute inset-x-4 top-[52%] text-center">
          <AnimatePresence mode="wait">
            <motion.p key={i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="font-display text-[22px] font-bold uppercase leading-[1.05] text-white [text-shadow:0_3px_0_#000,0_0_18px_rgba(0,0,0,0.9)]">
              {words.map((w, k) => (
                <motion.span key={k} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: k * 0.09 }} className={line.hot.includes(w) ? "text-volt-400" : ""}>
                  {w}{" "}
                </motion.span>
              ))}
            </motion.p>
          </AnimatePresence>
        </div>
        <motion.div key={`e${i}`} initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 12 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="absolute right-4 top-[38%] text-5xl drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]">
          {line.emoji}
        </motion.div>
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/15">
          <motion.div key={`p${i}`} initial={{ width: `${(i / LINES.length) * 100}%` }} animate={{ width: `${((i + 1) / LINES.length) * 100}%` }} transition={{ duration: 2.2, ease: "linear" }} className="h-full bg-volt-500" />
        </div>
      </div>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="absolute -right-28 top-16 hidden rounded-2xl px-3 py-2 text-xs glass sm:block">
        <div className="text-white/50">Silencios eliminados</div>
        <div className="font-display text-base font-bold text-volt-400">-8.4 s</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }} className="absolute -left-28 bottom-24 hidden rounded-2xl px-3 py-2 text-xs glass sm:block">
        <div className="text-white/50">Cortes sincronizados</div>
        <div className="font-display text-base font-bold text-violet-400">23 zooms</div>
      </motion.div>
    </div>
  );
}
