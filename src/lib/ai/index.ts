import "server-only";
import { Anthropic, claudeAvailable, classifyWithClaude } from "./claude";
import { classifyWithRules, type Suggestion } from "./rules";
import type { Service } from "../types";

export type { Suggestion } from "./rules";

export interface Classification {
  engine: "claude" | "rules";
  items: Suggestion[];
}

/** Claude when configured, keyword rules otherwise or on any Claude failure. */
export async function classifyRequest(text: string, services: Service[], hotelName: string): Promise<Classification> {
  const guestVisible = services.filter((s) => s.active);
  if (claudeAvailable()) {
    try {
      return { engine: "claude", items: await classifyWithClaude(text, guestVisible, hotelName) };
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        console.warn("[ai] Claude rate limited; using keyword rules");
      } else if (err instanceof Anthropic.APIError) {
        console.warn(`[ai] Claude API error ${err.status}; using keyword rules`);
      } else {
        console.warn("[ai] Claude classification failed; using keyword rules", err);
      }
    }
  }
  const valid = new Set(guestVisible.map((s) => s.id));
  const items = classifyWithRules(text).filter((i) => valid.has(i.serviceId));
  return {
    engine: "rules",
    items: items.length
      ? items
      : [{ serviceId: "general-help", quantity: 1, priority: null, confidence: "low", note: text.slice(0, 300) }],
  };
}
