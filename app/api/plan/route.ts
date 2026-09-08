import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAiScript, aiAvailable } from "@/lib/ai";
import { generateEngineScript } from "@/lib/scriptEngine";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  brief: z.object({
    name: z.string().min(1).max(80),
    benefit: z.string().min(1).max(160),
    audience: z.string().min(1).max(120),
    price: z.string().max(40).optional().default(""),
    offer: z.string().max(80).optional().default(""),
    cta: z.string().max(80).optional().default(""),
    link: z.string().max(300).optional().default(""),
    language: z.enum(["es", "en"]).default("es"),
  }),
  style: z.enum(["pas", "ugc", "listicle", "beforeafter", "fomo"]),
  duration: z.number().min(3).max(600).default(60),
  seed: z.number().optional().default(0),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Datos inválidos", detail: String(e) }, { status: 400 });
  }

  if (aiAvailable()) {
    try {
      const beats = await generateAiScript(body.brief, body.style, body.duration);
      if (beats && beats.length) return NextResponse.json({ beats, source: "ai" });
    } catch (e) {
      console.error("AI script failed, falling back to engine", e);
    }
  }
  const beats = generateEngineScript(body.brief, body.style, body.seed);
  return NextResponse.json({ beats, source: "engine", aiAvailable: aiAvailable() });
}
