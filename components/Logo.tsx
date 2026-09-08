import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-volt-500 shadow-glow">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-950" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        Scroll<span className="text-volt-400">Break</span>
      </span>
    </Link>
  );
}
