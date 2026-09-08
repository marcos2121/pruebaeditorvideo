import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ProductBrief, ScriptBeat, ScriptStyleId } from "./types";
import { STYLE_BY_ID } from "./styles";

const BeatSchema = z.object({
  role: z.enum(["hook", "problem", "agitate", "solution", "feature", "proof", "benefit", "objection", "urgency", "cta"]),
  text: z.string(),
  emphasis: z.array(z.string()),
  emoji: z.string(),
});

const ScriptSchema = z.object({
  beats: z.array(BeatSchema),
  title: z.string(),
});

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function generateAiScript(brief: ProductBrief, styleId: ScriptStyleId, durationSec: number): Promise<ScriptBeat[] | null> {
  if (!aiAvailable()) return null;
  const style = STYLE_BY_ID[styleId];
  const client = new Anthropic();
  const lang = brief.language === "en" ? "English" : "Spanish (neutral, Latin America)";
  const structure = style.template.map((t, i) => `${i + 1}. ${t.role}`).join("\n");

  const system = `You write short-form video ad scripts (TikTok / Reels / Shorts) for dropshipping and affiliate marketers.
Rules:
- Output exactly ${style.template.length} beats, in this order of roles:
${structure}
- Each beat is ONE on-screen caption line: 4 to 11 words, punchy, spoken-language, no hashtags, no quotes.
- "emphasis" lists 1-3 words copied verbatim from the beat text that should be highlighted.
- "emoji" is a single emoji fitting the beat (or empty string).
- Style brief: ${style.prompt}
- Language: ${lang}.
- Never invent statistics that sound like fake medical or legal claims. Keep claims plausible.`;

  const user = `Product: ${brief.name}
Main benefit: ${brief.benefit}
Audience: ${brief.audience}
Price: ${brief.price || "n/a"}
Offer: ${brief.offer || "n/a"}
Preferred CTA: ${brief.cta || "n/a"}
Video length: ~${Math.round(durationSec)} seconds.
Write the script now.`;

  const model = process.env.SCROLLBREAK_MODEL || "claude-opus-5";
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(ScriptSchema), effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  if (response.stop_reason === "refusal") return null;
  const parsed = response.parsed_output;
  if (!parsed) return null;

  return parsed.beats.slice(0, style.template.length).map((b, i) => {
    const t = style.template[i];
    return {
      id: `b${i}`,
      role: t.role,
      text: b.text.trim(),
      emphasis: b.emphasis,
      emoji: b.emoji || undefined,
      at: t.at,
      span: t.span,
    };
  });
}
