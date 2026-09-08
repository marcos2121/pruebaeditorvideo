import { NextResponse } from "next/server";
import { normalizeVideoUrl } from "@/lib/links";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 250 * 1024 * 1024;

function isPrivateHost(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return true;
  }
  if (h.includes(":")) return true; // IPv6 literal: bloqueado
  return false;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") || "";
  if (!raw) return NextResponse.json({ error: "Falta el parámetro url" }, { status: 400 });

  const { url, provider } = normalizeVideoUrl(raw);
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol) || isPrivateHost(target.hostname)) {
    return NextResponse.json({ error: "URL no permitida" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; ScrollBreak/1.0)", accept: "video/*,application/octet-stream,*/*" },
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo descargar el video", detail: String(e) }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `El origen respondió ${upstream.status}` }, { status: 502 });
  }

  const type = upstream.headers.get("content-type") || "";
  const length = Number(upstream.headers.get("content-length") || 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: "El archivo supera los 250 MB" }, { status: 413 });
  if (type.includes("text/html")) {
    return NextResponse.json({
      error: provider === "Google Drive"
        ? "Google Drive devolvió una página en lugar del archivo. Asegúrate de que el enlace sea público (\"Cualquier persona con el enlace\")."
        : "El enlace no apunta a un archivo de video directo. Usa un enlace de descarga directa o sube el archivo.",
    }, { status: 415 });
  }

  const headers = new Headers({
    "content-type": type.startsWith("video/") ? type : "video/mp4",
    "cache-control": "private, max-age=0",
    "x-scrollbreak-provider": provider,
  });
  if (length) headers.set("content-length", String(length));
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);

  return new Response(upstream.body, { status: 200, headers });
}
