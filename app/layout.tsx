import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScrollBreak — Convierte cualquier video en un anuncio que rompe el scroll",
  description:
    "Sube un video de 1 minuto o pega un enlace de Drive. ScrollBreak lo corta, lo subtitula, le pone hook, zooms y CTA con 5 estilos de guion probados para dropshipping y afiliados.",
  openGraph: {
    title: "ScrollBreak",
    description: "Edición de video persuasiva para dropshipping y afiliados, en segundos.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#06060b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
