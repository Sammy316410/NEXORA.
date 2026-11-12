// Keyword rules: the always-available way to sort a guest's free text into
// services. Claude (src/lib/ai/claude.ts) does better when ANTHROPIC_API_KEY is
// set; the UI is identical either way.
import type { Confidence, Priority } from "../types";

export interface Suggestion {
  serviceId: string;
  quantity: number;
  priority: Priority | null;
  confidence: Confidence;
  note: string | null;
}

interface Rule {
  service: string;
  match: RegExp;
  /** Bumps priority to urgent when this also matches. */
  urgentIf?: RegExp;
  priority?: Priority;
  /** Services this rule overrides when both match (e.g. safety beats "door"). */
  excludes?: string[];
}

const RULES: Rule[] = [
  {
    service: "safety-concern",
    match: /knock|unsafe|scared|stranger|harass|threat|intruder|someone (is |keeps )?(at|outside|knocking on) my door|security/i,
    priority: "urgent",
    excludes: ["door-lock"],
  },
  { service: "extra-towels", match: /\btowels?\b/i },
  { service: "toiletries", match: /toiletr|\bsoap\b|shampoo|tooth ?brush|tooth ?paste|lotion|shower gel|razor|conditioner/i },
  { service: "extra-pillows", match: /\bpillows?\b/i },
  { service: "blanket", match: /blanket|duvet|cold at night/i },
  { service: "drinking-water", match: /(drinking|bottled?) water|water bottles?|more water|bottle of water/i },
  {
    service: "room-cleaning",
    match: /clean (my|the) room|room (needs )?clean|tidy|make up (my|the) room|housekeep|(room|bathroom|floor) is dirty|dirty room|trash|rubbish|\bbin\b|vacuum|\bmop\b/i,
  },
  { service: "turndown", match: /turn ?down/i },
  { service: "change-linen", match: /linen|bed ?sheets?|\bsheets\b|change (the |my )?bed/i },
  {
    service: "ac-cooling",
    match: /\ba\/?c\b|air ?con|aircon|cooling|too hot|room is hot|so hot|\bheat\b|\bfan\b/i,
  },
  {
    service: "leak",
    match: /leak|drip|flood|plumb|toilet (is )?(blocked|not flushing|broken)|\bsink\b|shower (is )?(broken|not working)|no (hot )?water|water (is )?(everywhere|on the floor)/i,
    urgentIf: /ceiling|flood|everywhere|burst|pouring/i,
  },
  {
    service: "power-lights",
    match: /no power|power (is )?(off|out|gone)|\blights?\b|bulb|socket|electric|\bswitch\b|blackout/i,
    urgentIf: /no power|blackout|sparks?|smoke|burning/i,
  },
  { service: "tv-wifi", match: /\btv\b|television|\bremote\b|wi-?fi|internet|network|channels?/i },
  { service: "door-lock", match: /\bdoor\b|\block\b|key ?card|locked out|safe (is )?(locked|not opening)/i, urgentIf: /locked out/i },
  { service: "late-checkout", match: /late check-?out|check ?out later|extend (my )?stay|stay (a bit |an hour )?longer/i, excludes: ["checkout-help"] },
  { service: "checkout-help", match: /check-?out|\bbill\b|invoice|\bpay\b|payment/i },
  { service: "luggage-help", match: /luggage|\bbags?\b|suitcase|porter/i },
  { service: "taxi", match: /taxi|\bcab\b|uber|\bbolt\b|\bride\b|airport (transfer|pickup|drop)|\bcar\b/i },
  { service: "wake-up-call", match: /wake|alarm/i },
  {
    service: "food-order",
    match: /\bfood\b|\beat\b|hungry|dinner|lunch|breakfast|\bmenu\b|sandwich|room service|\border\b|jollof|\brice\b|snack|coffee|\btea\b|\bjuice\b|\bdrinks?\b|soup|burger|pizza|suya|chicken/i,
  },
];

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1, couple: 2 };

function quantityFor(text: string, service: string): number {
  const noun: Record<string, string> = {
    "extra-towels": "towels?",
    "extra-pillows": "pillows?",
    blanket: "blankets?",
    "drinking-water": "(?:bottles?|water)",
  };
  const word = noun[service];
  if (!word) return 1;
  const m = text.match(new RegExp(`(\\d+|one|two|three|four|five|six|a couple of|an?)\\s+(?:more\\s+|extra\\s+|clean\\s+|fresh\\s+|bottles? of\\s+)?${word}`, "i"));
  if (!m) return 1;
  const raw = m[1].toLowerCase().replace("a couple of", "couple");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : NUMBER_WORDS[raw] ?? 1;
}

/** Sort free text into one or more services. Always returns at least one item. */
export function classifyWithRules(text: string): Suggestion[] {
  const clean = text.trim();
  if (!clean) return [];

  const hits = RULES.filter((r) => r.match.test(clean));
  const excluded = new Set(hits.flatMap((r) => r.excludes ?? []));
  const kept = hits.filter((r) => !excluded.has(r.service));

  if (kept.length === 0) {
    return [{ serviceId: "general-help", quantity: 1, priority: null, confidence: "low", note: clean.slice(0, 300) }];
  }

  const confidence: Confidence = kept.length === 1 ? "high" : kept.length === 2 ? "medium" : "low";
  return kept.slice(0, 3).map((r) => ({
    serviceId: r.service,
    quantity: quantityFor(clean, r.service),
    priority: r.urgentIf?.test(clean) ? "urgent" : r.priority ?? null,
    confidence,
    note: clean.slice(0, 300),
  }));
}
