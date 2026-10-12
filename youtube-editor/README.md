# ⚡ ScrollBreak · Editor YouTube

Una página web que **edita sola tus videos largos para YouTube**. Pegas el enlace de Google Drive (o subes el archivo), eliges el estilo y descargas el video editado, junto con los subtítulos, la miniatura y los textos para publicarlo.

Está pensado para videos de 10 minutos a varias horas, como tu grabación de 45 minutos.

## Qué hace automáticamente

| Paso | Qué hace |
|---|---|
| ✂️ Corte de silencios | Detecta las pausas largas y las quita, dejando un pequeño respiro para que no suene robótico. |
| 🗣️ Fuera muletillas | Encuentra «eh», «ehm» y «mmm» en la transcripción y los recorta. |
| 🔍 Zoom en los cortes | Alterna plano normal y acercado (112 %) para disimular los saltos, como si hubiera dos cámaras. |
| 🎣 Gancho al inicio *(IA)* | Claude elige el momento más potente (12–30 s) y lo pone como **avance** al principio. |
| 📚 Capítulos *(IA)* | Detecta los temas, muestra una tarjeta animada «CAPÍTULO N» y mete los capítulos en el MP4 y en la descripción. |
| ✨ Transiciones | Destello y *whoosh* solo entre capítulos y después del avance. Lo demás son cortes directos, como en la edición profesional. |
| 💬 Subtítulos | Animados, con la palabra que se está diciendo en amarillo y las palabras clave en verde. También se pueden elegir clásicos. Además genera el `.srt` para subirlo a YouTube. |
| 🏷️ Rótulo | Tu nombre o el de tu canal en la parte inferior al empezar. |
| 🎙️ Audio | Reducción de ruido, ecualizador y compresor. Música de fondo opcional que **baja sola cuando hablas**. Volumen final a **-14 LUFS**, el estándar de YouTube. |
| 🎨 Color | Un poco más de contraste, saturación y nitidez. |
| 📦 Entrega | `video_editado.mp4` (H.264 + AAC 320k, con capítulos), `subtitulos.srt`, `miniatura.jpg` y `youtube.txt` con 3 títulos, descripción con capítulos y etiquetas. |

> Las partes marcadas con *(IA)* necesitan una clave de Anthropic (ver más abajo). Sin clave, el editor hace todo lo demás y crea capítulos automáticos por tiempo.

## Por qué funciona en tu computadora

Un video de 45 minutos pesa varios GB y renderizarlo lleva tiempo de procesador. Los hostings gratuitos (Vercel, Netlify) cortan cualquier proceso a los pocos segundos o minutos. Por eso el editor es un programa que **corre en tu propia PC** y se usa desde el navegador en `http://localhost:8000`.

Ventajas: el video no sale de tu equipo, no pagas servidores y no tiene límite de duración. Si más adelante quieres tenerlo en internet, puedes usar el mismo Docker en un VPS (ver abajo).

## Instalación (una sola vez)

### Opción A: Windows, la más fácil

1. Instala **Python 3.11 o superior** desde [python.org](https://www.python.org/downloads/). Marca la casilla *«Add Python to PATH»*.
2. Instala **ffmpeg**: abre *PowerShell* y escribe `winget install Gyan.FFmpeg`.
3. Descarga esta carpeta `youtube-editor` y haz doble clic en **`iniciar.bat`**.

La primera vez tarda unos minutos en instalar todo. Después se abre el navegador solo.

### Opción B: Mac / Linux

```bash
brew install ffmpeg          # Mac (en Ubuntu: sudo apt install ffmpeg)
cd youtube-editor
./iniciar.sh
```

### Opción C: Docker

```bash
cd youtube-editor
docker build -t editor-youtube .
docker run --rm -p 127.0.0.1:8000:8000 -v "$PWD/datos:/datos" --env-file .env editor-youtube
```

Luego abre http://localhost:8000. Si no tienes archivo `.env`, quita `--env-file .env`.

### Activar la IA (gancho, capítulos y títulos)

1. Crea una clave en [console.anthropic.com](https://console.anthropic.com).
2. Copia `.env.example` como `.env` y pega la clave en `ANTHROPIC_API_KEY=`.
3. Reinicia el editor. Arriba a la derecha debe aparecer «IA Claude ✓».

Analizar un video de 45 minutos usa una sola llamada a Claude (unos 15–20 mil tokens), así que cuesta unos pocos céntimos de dólar.

## Uso paso a paso

1. **Sube el video a Google Drive.** Clic derecho → *Compartir* → *Cualquier persona con el enlace* → *Copiar enlace*.
2. Abre el editor, pega el enlace en **«1. Tu video»**. También puedes ir a *Subir archivo* y arrastrar el video.
3. En **«2. Estilo»** escribe tu nombre o canal, elige el estilo de subtítulos y, si quieres, una canción de fondo.
4. Pulsa **«⚡ Editar mi video»** y deja la ventana abierta.
5. Al terminar verás el video, el resumen (duración antes y después, cortes, muletillas) y los botones de descarga.
6. En YouTube Studio:
   - sube `video_editado.mp4`;
   - pega título, descripción y etiquetas de `youtube.txt` (los capítulos ya van dentro de la descripción);
   - en *Subtítulos*, sube `subtitulos.srt`;
   - usa `miniatura.jpg` como miniatura o como base para la tuya.

### ¿Cuánto tarda?

Con un video de 45 min en una PC normal:

| Etapa | Tiempo aproximado |
|---|---|
| Transcripción, precisión «Equilibrada» | 10–30 min (2–5 min con tarjeta NVIDIA) |
| Render final, calidad «Alta» | 20–45 min |

Si tienes prisa, elige precisión «Rápida» y exportación «Rápida».

La primera vez que transcribe, descarga el modelo de Whisper (de 150 MB a 3 GB según la precisión), así que necesita internet.

## Ajustes avanzados

- **Cortar pausas más largas que:** 0,6 s por defecto. Súbelo a 0,9 s si quieres un ritmo más pausado, o bájalo a 0,4 s para un estilo más rápido.
- **Respiro antes/después de hablar:** margen que se deja alrededor de cada frase.
- **Intensidad del zoom:** entre 105 % y 125 %.

## Detalles técnicos

- Los cortes se calculan **en fotogramas exactos** y el audio se corta a la muestra. Imagen y sonido quedan sincronizados aunque haya cientos de cortes. Está comprobado con una prueba de destellos y pitidos: el desfase queda por debajo de un fotograma y no se acumula.
- Todo el video final sale de **una sola pasada de ffmpeg**: selección de fotogramas, zoom alterno y subtítulos ASS con las tarjetas, el destello y el rótulo. El avance se renderiza aparte y se pega al inicio.
- La transcripción usa [faster-whisper](https://github.com/SYSTRAN/faster-whisper) con marcas de tiempo por palabra, y le da a Whisper un texto con muletillas para que no las «limpie».
- La IA usa la API de Claude (`claude-opus-5-5` por defecto, configurable con `YT_EDITOR_MODEL`) con salida JSON estructurada. Si falla o no hay clave, se usa el plan sin IA.
- Variables de entorno: `YT_EDITOR_DATA` (carpeta de trabajos), `YT_EDITOR_PORT`, `YT_EDITOR_HOST`, `YT_EDITOR_FONT` (fuente de los subtítulos, por defecto Montserrat) y `YT_EDITOR_MODEL`.

```
editor/
  server.py       web + cola de trabajos
  pipeline.py     orquesta todo el proceso
  fetch.py        descarga de Drive / Dropbox / OneDrive / enlace directo
  transcribe.py   Whisper palabra por palabra
  plan.py         silencios, muletillas, mapa de tiempos, zoom
  ai.py           gancho, capítulos y textos con Claude
  audio.py        montaje de audio, whoosh y música con ducking
  subtitles.py    subtítulos ASS/SRT y gráficos animados
  render.py       comandos de ffmpeg, volumen -14 LUFS, miniatura
static/index.html la página
tests/            pruebas (python -m unittest discover -s tests -t .)
```

## Seguridad

El editor escucha solo en tu equipo (`127.0.0.1`). No tiene usuarios ni contraseña, así que **no lo expongas a internet tal cual**. Si lo instalas en un servidor, ponlo detrás de un proxy con autenticación.
