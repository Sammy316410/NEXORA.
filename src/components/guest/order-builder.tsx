"use client";

import { useActionState, useMemo, useState } from "react";
import { BedDouble, CreditCard, Minus, Plus } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { FormError, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client/submit-button";
import { cn } from "@/lib/cn";

interface Item {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceMinor: number;
}

const CATEGORY_TITLES: Record<string, string> = { mains: "Mains", light: "Light bites", drinks: "Drinks", desserts: "Desserts" };

export function OrderBuilder({
  items,
  roomNumber,
  currency,
  testMode,
  action,
}: {
  items: Item[];
  roomNumber: string;
  currency: string;
  testMode: boolean;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"pay_now" | "charge_to_room">("pay_now");
  const [state, formAction] = useActionState(action, null);
  const money = useMemo(() => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }), [currency]);

  const lines = items.filter((i) => (qty[i.id] ?? 0) > 0);
  const total = lines.reduce((a, i) => a + i.priceMinor * (qty[i.id] ?? 0), 0);
  const count = lines.reduce((a, i) => a + (qty[i.id] ?? 0), 0);
  const change = (id: string, delta: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + delta)) }));
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <form action={formAction} className="space-y-6 pb-40">
      <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ menuItemId: l.id, quantity: qty[l.id] })))} />
      <input type="hidden" name="method" value={method} />

      {categories.map((c) => (
        <section key={c}>
          <h2 className="mb-2 text-sm font-semibold text-muted">{CATEGORY_TITLES[c] ?? c}</h2>
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
            {items
              .filter((i) => i.category === c)
              .map((i) => {
                const n = qty[i.id] ?? 0;
                return (
                  <li key={i.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{i.name}</p>
                      {i.description ? <p className="text-[13px] text-muted">{i.description}</p> : null}
                      <p className="mt-0.5 text-sm font-semibold text-hotel tabular-nums">{money.format(i.priceMinor / 100)}</p>
                    </div>
                    {n === 0 ? (
                      <button
                        type="button"
                        onClick={() => change(i.id, 1)}
                        className="flex h-10 items-center gap-1 rounded-full border border-line-strong px-4 text-sm font-semibold"
                        aria-label={`Add ${i.name}`}
                      >
                        <Plus className="size-4" aria-hidden="true" /> Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => change(i.id, -1)} aria-label={`One less ${i.name}`} className="flex size-10 items-center justify-center rounded-full border border-line-strong">
                          <Minus className="size-4" aria-hidden="true" />
                        </button>
                        <span className="w-5 text-center font-display font-extrabold tabular-nums" aria-live="polite">
                          {n}
                        </span>
                        <button type="button" onClick={() => change(i.id, 1)} aria-label={`One more ${i.name}`} className="flex size-10 items-center justify-center rounded-full bg-hotel text-white">
                          <Plus className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <div>
        <label htmlFor="note" className="mb-1.5 block text-sm font-medium">
          Anything the kitchen should know?
        </label>
        <Textarea id="note" name="note" maxLength={300} placeholder="e.g. Less pepper, please" className="min-h-20" />
      </div>

      {count > 0 ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">How would you like to pay?</legend>
          {(
            [
              ["pay_now", CreditCard, "Pay now", "Card or bank transfer. The kitchen starts as soon as it's paid."],
              ["charge_to_room", BedDouble, `Charge to Room ${roomNumber}`, "Added to your bill. Settle any time before checkout."],
            ] as const
          ).map(([value, Icon, title, sub]) => (
            <label
              key={value}
              className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface p-4", method === value ? "border-hotel ring-2 ring-hotel/20" : "border-line")}
            >
              <input type="radio" name="method_choice" checked={method === value} onChange={() => setMethod(value)} className="size-5 accent-[var(--color-hotel)]" />
              <Icon className="size-5 text-hotel" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="block text-[13px] text-muted">{sub}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {state && !state.ok ? <FormError>{state.error}</FormError> : null}

      <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-[480px] border-t border-line bg-hotel-canvas/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">{count ? `${count} item${count === 1 ? "" : "s"}` : "Your basket is empty"}</span>
          <span className="font-display text-lg font-extrabold tabular-nums">{money.format(total / 100)}</span>
        </div>
        <SubmitButton variant="hotel" size="xl" className="w-full" pendingText={method === "pay_now" ? "Opening secure checkout…" : "Placing order…"}>
          {count === 0 ? "Add something to order" : method === "pay_now" ? `Pay ${money.format(total / 100)}` : `Place order · charge to room`}
        </SubmitButton>
        {testMode && method === "pay_now" && count > 0 ? <p className="mt-1.5 text-center text-[11px] text-muted">Test mode: no real money is taken.</p> : null}
      </div>
    </form>
  );
}
