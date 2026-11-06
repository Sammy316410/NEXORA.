"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, TriangleExclamationPoint, WifiOff } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { FormError, Label, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client/submit-button";
import { AIChip } from "@/components/status";
import { cn } from "@/lib/cn";

export interface RequestFormService {
  id: string;
  name: string;
  hasQuantity: boolean;
  maxQuantity: number;
  askUrgent: boolean;
  needsNote: boolean;
  resolutionTargetMin: number;
  category: string;
}

const PLACEHOLDERS: Record<string, string> = {
  "food-order": "What would you like? e.g. Jollof rice and a bottle of water",
  "wake-up-call": "What time? e.g. 6:30 tomorrow",
  "general-help": "Tell us what you need",
  "late-checkout": "What time would you like to leave? e.g. 2 pm",
  taxi: "Where to, and when? e.g. Airport at 5 pm",
};

export function RequestForm({
  service,
  roomNumber,
  action,
  prefill,
}: {
  service: RequestFormService;
  roomNumber: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  prefill: { quantity?: number; note?: string; aiConfidence?: string; aiEngine?: string; aiPriority?: string };
}) {
  const [state, formAction] = useActionState(action, null);
  const [qty, setQty] = useState(Math.min(Math.max(prefill.quantity ?? 1, 1), service.maxQuantity));
  const [offline, setOffline] = useState(false);
  const duplicate = state && !state.ok && state.code === "duplicate";

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <form action={formAction} className="space-y-5 pb-28">
      <input type="hidden" name="serviceId" value={service.id} />
      {prefill.aiConfidence ? (
        <>
          <input type="hidden" name="aiConfidence" value={prefill.aiConfidence} />
          <input type="hidden" name="aiEngine" value={prefill.aiEngine ?? "rules"} />
          <input type="hidden" name="aiPriority" value={prefill.aiPriority ?? ""} />
          <AIChip label="Suggested automatically" />
        </>
      ) : null}

      {service.hasQuantity ? (
        <div>
          <Label>How many?</Label>
          <input type="hidden" name="quantity" value={qty} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Fewer"
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex size-12 items-center justify-center rounded-xl border border-line-strong bg-surface disabled:opacity-40"
            >
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <span className="min-w-8 text-center font-display text-3xl font-extrabold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              aria-label="More"
              disabled={qty >= service.maxQuantity}
              onClick={() => setQty((q) => Math.min(service.maxQuantity, q + 1))}
              className="flex size-12 items-center justify-center rounded-xl border border-line-strong bg-surface disabled:opacity-40"
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <Label htmlFor="note">{service.needsNote ? "Tell us a little more" : "Anything we should know?"}</Label>
        <Textarea
          id="note"
          name="note"
          required={service.needsNote}
          maxLength={500}
          defaultValue={prefill.note ?? ""}
          placeholder={PLACEHOLDERS[service.id] ?? "Optional, e.g. Please leave them by the door"}
        />
      </div>

      {service.askUrgent ? (
        <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <input type="checkbox" name="urgent" defaultChecked={prefill.aiPriority === "urgent"} className="size-5 accent-[var(--color-hotel)]" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Is this urgent?</span>
            <span className="block text-[13px] text-muted">A water leak, no power, or you can&apos;t get in.</span>
          </span>
          <TriangleExclamationPoint className="size-5 text-alert" aria-hidden="true" />
        </label>
      ) : null}

      <div className="rounded-2xl bg-surface px-4 py-3 text-sm">
        <span className="text-muted">Delivering to</span> <span className="font-semibold">Room {roomNumber}</span>
        <span className="text-muted"> · As soon as possible</span>
      </div>

      {duplicate && state && !state.ok ? (
        <div role="alert" className="space-y-3 rounded-2xl border border-progress/30 bg-progress-bg p-4 text-sm">
          <p className="font-semibold text-progress">{state.error}</p>
          <div className="flex flex-wrap gap-2">
            {state.existingId ? (
              <Link href={`/guest/requests/${state.existingId}`} className="rounded-xl bg-ink px-4 py-2.5 font-medium text-white">
                Track that request
              </Link>
            ) : null}
            <button type="submit" name="force" value="1" className="rounded-xl border border-line-strong bg-surface px-4 py-2.5 font-medium">
              Send another anyway
            </button>
          </div>
        </div>
      ) : state && !state.ok ? (
        <FormError>{state.error}</FormError>
      ) : null}

      {offline ? (
        <p className="flex items-center gap-2 text-sm text-progress">
          <WifiOff className="size-4" aria-hidden="true" /> You&apos;re offline. We&apos;ll send it when you&apos;re back.
        </p>
      ) : null}

      <div className={cn("fixed inset-x-0 bottom-16 z-20 mx-auto max-w-[480px] border-t border-line bg-hotel-canvas/95 px-4 pt-3 pb-3 backdrop-blur")}>
        <p className="mb-2 text-center text-[13px] text-muted">Usually within {service.resolutionTargetMin} minutes</p>
        <SubmitButton variant="hotel" size="xl" className="w-full" pendingText="Sending…">
          Send request
        </SubmitButton>
      </div>
    </form>
  );
}
