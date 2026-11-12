"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { FormError, Textarea, buttonClass } from "@/components/ui";
import { AIChip } from "@/components/status";
import { ServiceIcon } from "@/components/icons";
import { SubmitButton } from "@/components/client/submit-button";

interface Item {
  serviceId: string;
  serviceName: string;
  icon: string;
  department: string;
  quantity: number;
  priority: string | null;
  confidence: "high" | "medium" | "low";
  note: string | null;
  guestVisible: boolean;
}

const EXAMPLES = ["My AC is leaking water", "Two more towels and a toothbrush", "Someone keeps knocking on my door"];

export function Describe({ sendAll }: { sendAll: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult> }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [engine, setEngine] = useState<"claude" | "rules">("rules");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, formAction] = useActionState(sendAll, null);

  const findService = () =>
    start(async () => {
      setError(null);
      const res = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That didn't work. Please try again.");
        return;
      }
      setItems(data.items);
      setEngine(data.engine);
    });

  const detailsHref = (i: Item) => {
    const q = new URLSearchParams({ ai: i.confidence, engine });
    if (i.quantity > 1) q.set("qty", String(i.quantity));
    if (i.note) q.set("note", i.note);
    if (i.priority) q.set("prio", i.priority);
    return `/guest/request/${i.serviceId}?${q.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="describe" className="mb-2 block font-display text-lg font-bold">
          Tell us what you need
        </label>
        <Textarea
          id="describe"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setItems(null);
          }}
          maxLength={1000}
          placeholder="In your own words, e.g. My AC is leaking water"
          className="min-h-28"
        />
        {!text ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[13px] text-muted hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!items ? (
        <button
          type="button"
          disabled={pending || text.trim().length < 3}
          onClick={findService}
          className={buttonClass("hotel", "xl", "w-full")}
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-5" aria-hidden="true" />}
          {pending ? "Finding the right team…" : "Find the right service"}
        </button>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}

      {items ? (
        <section className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted">{items.length > 1 ? `Looks like ${items.length} things:` : "Looks like:"}</p>
            <AIChip label="Suggested automatically" title={engine === "claude" ? "Sorted by Claude. You can change it." : "Sorted by keyword rules. You can change it."} />
          </div>
          {items.map((i) => (
            <div key={i.serviceId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-hotel/10 text-hotel">
                <ServiceIcon icon={i.icon} className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] font-bold">
                  {i.serviceName}
                  {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                </p>
                <p className="text-[13px] text-muted">
                  {i.department}
                  {i.priority === "urgent" ? " · treated as urgent" : ""}
                  {i.confidence === "low" ? " · needs a human look" : ""}
                </p>
              </div>
              {items.length === 1 ? null : (
                <Link href={detailsHref(i)} className="text-sm font-medium text-hotel">
                  Edit
                </Link>
              )}
            </div>
          ))}

          {items.length === 1 ? (
            <Link href={detailsHref(items[0])} className={buttonClass("hotel", "xl", "w-full")}>
              Continue <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          ) : (
            <form action={formAction}>
              <input type="hidden" name="engine" value={engine} />
              <input
                type="hidden"
                name="items"
                value={JSON.stringify(items.map(({ serviceId, quantity, note, priority, confidence }) => ({ serviceId, quantity, note, priority, confidence })))}
              />
              {state && !state.ok ? <FormError>{state.error}</FormError> : null}
              <SubmitButton variant="hotel" size="xl" className="w-full" pendingText="Sending…">
                Send all {items.length}
              </SubmitButton>
            </form>
          )}
          <Link href="/guest/request" className="block text-center text-sm font-medium text-muted">
            Not right? Choose from the list
          </Link>
        </section>
      ) : null}
    </div>
  );
}
