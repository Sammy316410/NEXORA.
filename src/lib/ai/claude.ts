import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Service } from "../types";
import type { Suggestion } from "./rules";

// Claude Opus 5.5 at low effort: fast enough for a live suggestion, and the
// server-side fallback ("default") re-runs a policy-declined request on a
// substitute model inside the same call. Override with NEXORA_AI_MODEL.
const MODEL = process.env.NEXORA_AI_MODEL?.trim() || "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());
}

function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const ClassificationSchema = z.object({
  requests: z.array(
    z.object({
      service_id: z.string(),
      quantity: z.number().int(),
      priority: z.enum(["low", "normal", "high", "urgent"]),
      confidence: z.enum(["high", "medium", "low"]),
      note: z.string(),
    }),
  ),
});

function catalogText(services: Service[]): string {
  return services
    .map(
      (s) =>
        `- ${s.id}: ${s.name} (${s.category}${s.has_quantity ? `, quantity up to ${s.max_quantity}` : ""}; default priority ${s.default_priority})`,
    )
    .join("\n");
}

/** Claude sorts a guest's message into catalogue services. Throws on any failure (caller falls back to rules). */
export async function classifyWithClaude(text: string, services: Service[], hotelName: string): Promise<Suggestion[]> {
  const ids = new Set(services.map((s) => s.id));
  const response = await anthropic().beta.messages.parse(
    {
      model: MODEL,
      max_tokens: 2000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ClassificationSchema) },
      system: `You route guest requests at ${hotelName}, a hotel. Map the guest's message to one or more services from this catalogue, and nothing else:
${catalogText(services)}

Rules:
- One entry per distinct thing the guest needs ("towels and a toothbrush" is two entries).
- Use general-help only when nothing in the catalogue fits.
- Use safety-concern for anything about personal safety (strangers, knocking, threats).
- priority: urgent for safety, water coming through a ceiling, no power, or a guest locked out; otherwise the service's default unless the message clearly signals more urgency.
- quantity: what the guest asked for, 1 if unstated.
- note: the useful specifics in the guest's own words (a time, a dish, where the leak is), at most one short sentence. Empty string if none.
- confidence: high when the mapping is obvious, medium when you had to choose between services, low when you are guessing.`,
      messages: [{ role: "user", content: text.slice(0, 1000) }],
    },
    { timeout: 8000, maxRetries: 0 },
  );

  if (response.stop_reason === "refusal") throw new Error("Claude declined to classify this request");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude returned no parseable classification");

  const items = parsed.requests
    .filter((r) => ids.has(r.service_id))
    .slice(0, 3)
    .map<Suggestion>((r) => ({
      serviceId: r.service_id,
      quantity: Math.max(1, Math.min(r.quantity, 10)),
      priority: r.priority,
      confidence: r.confidence,
      note: r.note.trim() || null,
    }));
  if (!items.length) throw new Error("Claude matched no catalogue service");
  return items;
}

/** Three short bullets about today's operations, from verified numbers only. */
export async function summarizeWithClaude(stats: unknown, hotelName: string): Promise<string[]> {
  const response = await anthropic().beta.messages.create(
    {
      model: MODEL,
      max_tokens: 3000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: `You write a shift summary for the duty manager at ${hotelName}. Use only the numbers in the JSON you are given; never invent figures. Write exactly three lines, each starting with "- ", each under 22 words and each containing at least one number from the data. Prefer what needs action now (overdue, waiting, repeat problems, slow departments). When you suggest a cause, call it a possible cause.`,
      messages: [{ role: "user", content: JSON.stringify(stats) }],
    },
    { timeout: 15000, maxRetries: 1 },
  );
  if (response.stop_reason === "refusal") throw new Error("Claude declined to summarise");
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .slice(0, 3);
  if (lines.length === 0) throw new Error("Claude returned no summary lines");
  return lines;
}

export { Anthropic };
