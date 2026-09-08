"use client";
import Link from "next/link";
import { Logo } from "../Logo";
import { ArrowRight } from "lucide-react";

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-full px-4 py-2 glass sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          <a href="#como-funciona" className="hover:text-white">Cómo funciona</a>
          <a href="#guiones" className="hover:text-white">Guiones</a>
          <a href="#estilos" className="hover:text-white">Estilos</a>
          <a href="#precios" className="hover:text-white">Precios</a>
        </nav>
        <Link href="/studio" className="btn-primary !px-5 !py-2 text-sm">
          Abrir estudio <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
