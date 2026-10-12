# ⚡ ScrollBreak

**Convierte cualquier video crudo en un anuncio que rompe el scroll.**

Plataforma de edición automática para dropshipping y afiliados. Subes un clip de ~1 minuto (o pegas un enlace de Google Drive / Dropbox / URL directa), describes el producto en tres campos, eliges uno de los 5 estilos de guion y un look visual, y ScrollBreak genera un video vertical 1080×1920 listo para TikTok, Reels y Shorts.

## Qué hace el motor

| Función | Cómo |
|---|---|
| Elimina silencios | Analiza el audio en el navegador (Web Audio), detecta pausas > 0.45 s y las recorta con padding natural. |
| Cortes al ritmo | Detecta picos de energía y ajusta los cortes (1.2–4 s según el guion) a esos picos. |
| Zooms y transiciones | Punch-in, punch-out, whip, flash y glitch alternados y sincronizados con los picos. |
| Hook | Banner animado con el gancho durante los primeros segundos. |
| Subtítulos | Palabra por palabra, con resaltado de palabras clave, stroke y pop-in. |
| Stickers | Emoji animado por beat (según el preset). |
| CTA | Tarjeta pulsante de llamada a la acción al final. |
| Barra de progreso | Micro-señal de retención en la parte inferior. |
| Exportación | MP4 (Chrome/Edge/Safari 17+) o WebM, 1080×1920 a 30 fps con audio, renderizado en tu navegador. |

## 5 estilos de guion

1. **Dolor → Solución** (PAS): hook con el dolor, agitación, solución, prueba y CTA.
2. **Historia UGC**: narrativa en primera persona, tono de creador, objeción resuelta.
3. **3 Razones**: lista numerada de ritmo rápido.
4. **Antes vs Después**: contraste frustración / resultado.
5. **Oferta Relámpago**: escasez, precio, urgencia y CTA repetido.

Cada estilo define la estructura de beats, el ritmo de corte y el tono. Con `ANTHROPIC_API_KEY` configurada, Claude escribe el guion; sin clave, un motor de plantillas integrado lo genera. Siempre puedes editar cada frase, los emojis y las palabras resaltadas, o pegar tu propia transcripción para que los subtítulos coincidan con tu voz.

## 5 estilos visuales

Viral TikTok · Cinemático · Minimal Clean · Neon Hype · UGC Auténtico.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- Motor de edición 100 % en el cliente: Canvas 2D, Web Audio, MediaRecorder
- Guiones con IA: `@anthropic-ai/sdk` (structured outputs con Zod, modelo `claude-opus-5` con fallbacks del servidor)
- Estado: Zustand

No hay servidores de render ni colas: el video nunca sale del navegador del usuario. Las únicas rutas de servidor son `/api/plan` (guion) y `/api/fetch-video` (proxy para enlaces externos, con normalización de Drive/Dropbox/OneDrive y bloqueo de hosts privados).

## Editor para videos largos de YouTube

En [`youtube-editor/`](youtube-editor/) hay un segundo producto para **videos largos** (10 min a varias horas). Pegas el enlace de Drive o subes el video y te devuelve el MP4 editado: sin silencios ni muletillas, con zoom en los cortes, gancho al inicio, capítulos con transiciones, subtítulos animados, audio limpio a -14 LUFS, además de miniatura, `.srt` y título/descripción/etiquetas. Corre en tu propia computadora porque un video de 45 min no cabe en un servidor gratuito. Instrucciones en [`youtube-editor/README.md`](youtube-editor/README.md).

## Desarrollo

```bash
npm install
cp .env.example .env.local   # opcional: añade ANTHROPIC_API_KEY
npm run dev
```

Abre http://localhost:3000. El estudio está en `/studio`.

## Despliegue en Vercel

1. Importa el repositorio en Vercel (framework: Next.js, sin configuración extra).
2. En **Settings → Environment Variables** añade `ANTHROPIC_API_KEY` (opcional) y, si quieres, `SCROLLBREAK_MODEL`.
3. Deploy.

Notas:
- `/api/fetch-video` transmite el archivo por streaming con `maxDuration = 60`. Para enlaces muy grandes (> 250 MB) se devuelve un error; sube el archivo directamente.
- Los enlaces de Google Drive deben ser públicos ("Cualquier persona con el enlace").
- La exportación dura lo mismo que el video (grabación en tiempo real). Recomendado: Chrome o Edge de escritorio.

## Estructura

```
app/
  page.tsx                landing
  studio/page.tsx         estudio de edición
  api/plan/route.ts       generación de guion (IA o motor)
  api/fetch-video/route.ts proxy de enlaces
components/
  landing/                secciones de la landing
  studio/                 pasos del estudio, editor de guion, vista previa y exportación
lib/
  styles.ts               5 guiones + 5 presets visuales
  scriptEngine.ts         generador de guiones sin IA
  ai.ts                   generador de guiones con Claude
  engine/audio.ts         análisis de silencios y picos
  engine/planner.ts       construcción del plan de edición (cortes, zooms, beats)
  engine/renderer.ts      dibujo de cada fotograma (video, hook, subtítulos, CTA)
  engine/player.ts        reproductor de la línea de tiempo
  engine/exporter.ts      exportación con MediaRecorder
```
