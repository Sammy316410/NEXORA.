"use client";

import { useActionState, useState } from "react";
import { CreditCard, Landmark, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

interface Card {
  number: string;
  label: string;
}

type GatewayResult = { redirectTo: string } | { error: string };

export function SandboxCheckout({
  cardAction,
  transferAction,
  cancelAction,
  cards,
  amount,
}: {
  cardAction: (prev: GatewayResult | null, formData: FormData) => Promise<GatewayResult>;
  transferAction: () => Promise<GatewayResult>;
  cancelAction: () => Promise<GatewayResult>;
  cards: readonly Card[];
  amount: string;
}) {
  const [tab, setTab] = useState<"card" | "transfer">("card");
  const [card, setCard] = useState(cards[0].number);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Like a real gateway, hand the guest back to the hotel with a full page load,
  // so the hotel's return URL runs as a normal request.
  const finish = (result: GatewayResult): { error: string } | null => {
    if ("redirectTo" in result) {
      setLeaving(true);
      window.location.assign(result.redirectTo);
      return null;
    }
    return result;
  };
  const [state, formAction, pending] = useActionState(
    async (prev: { error: string } | null, fd: FormData) => finish(await cardAction(prev, fd)),
    null,
  );
  const busy = pending || leaving;
  const run = async (action: () => Promise<GatewayResult>) => {
    setError(null);
    setLeaving(true);
    const failed = finish(await action());
    if (failed) {
      setLeaving(false);
      setError(failed.error);
    }
  };
  const pretty = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");

  return (
    <div>
      <div role="tablist" className="grid grid-cols-2 border-b border-[#E5E7EB] text-sm font-semibold">
        {(
          [
            ["card", "Card", CreditCard],
            ["transfer", "Bank transfer", Landmark],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("flex items-center justify-center gap-2 py-3", tab === key ? "border-b-2 border-[#0B6E4F] text-[#0B6E4F]" : "text-[#6B7280]")}
          >
            <Icon className="size-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === "card" ? (
        <form action={formAction} className="space-y-4 p-6">
          <div>
            <label htmlFor="card" className="mb-1.5 block text-sm font-medium text-[#111827]">
              Card number
            </label>
            <input
              id="card"
              name="card"
              inputMode="numeric"
              autoComplete="off"
              value={pretty(card)}
              onChange={(e) => setCard(e.target.value.replace(/\D/g, "").slice(0, 19))}
              className="h-12 w-full rounded-lg border border-[#D1D5DB] px-3 font-mono text-[15px] tracking-wider"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111827]">Expiry</label>
              <input value="12 / 30" readOnly className="h-12 w-full rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-3 font-mono text-[15px]" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111827]">CVV</label>
              <input value="408" readOnly className="h-12 w-full rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-3 font-mono text-[15px]" />
            </div>
          </div>
          {state?.error ? (
            <p role="alert" className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
              {state.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0B6E4F] text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
            Pay {amount}
          </button>
          <fieldset className="rounded-lg border border-dashed border-[#D1D5DB] p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide text-[#6B7280] uppercase">Sandbox test cards</legend>
            <ul className="space-y-1">
              {cards.map((c) => (
                <li key={c.number}>
                  <button type="button" onClick={() => setCard(c.number)} className="flex w-full justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#F3F4F6]">
                    <span className="font-mono">{pretty(c.number)}</span>
                    <span className="text-[#6B7280]">{c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        </form>
      ) : (
        <div className="space-y-4 p-6 text-sm">
          <div className="rounded-lg bg-[#F9FAFB] p-4">
            <p className="text-[#6B7280]">Transfer exactly</p>
            <p className="text-2xl font-bold text-[#111827]">{amount}</p>
            <p className="mt-3 text-[#6B7280]">To account</p>
            <p className="font-mono text-lg font-semibold tracking-wider">9900 1234 56</p>
            <p className="text-[#6B7280]">Sandbox Bank · NEXORA Sandbox</p>
          </div>
          <p className="text-[#6B7280]">In the sandbox, the bank confirms your transfer about 6 seconds after you tap the button below.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(transferAction)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0B6E4F] text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            I&apos;ve sent the money
          </button>
        </div>
      )}

      <div className="border-t border-[#E5E7EB] px-6 py-4 text-center">
        {error ? (
          <p role="alert" className="mb-3 rounded-lg bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(cancelAction)}
          className="text-sm font-medium text-[#6B7280] hover:text-[#111827] disabled:opacity-60"
        >
          Cancel payment and go back
        </button>
      </div>
    </div>
  );
}
