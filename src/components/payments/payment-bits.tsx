import { CircleCheck, CircleX, Clock, CreditCard, Hourglass, Landmark } from "lucide-react";
import { Chip } from "@/components/status";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/labels";
import type { Payment, PaymentStatus } from "@/lib/types";

const ICONS: Record<PaymentStatus, typeof CircleCheck> = {
  succeeded: CircleCheck,
  failed: CircleX,
  abandoned: CircleX,
  pending: Hourglass,
  initialized: Clock,
  refunded: CircleCheck,
};

export function PaymentStatusChip({ status }: { status: PaymentStatus }) {
  return (
    <Chip tone={PAYMENT_STATUS_TONE[status] ?? "neutral"} icon={ICONS[status]}>
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </Chip>
  );
}

export function TestModeBadge({ mode }: { mode: "test" | "live" }) {
  if (mode !== "test") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#92400E] uppercase" title="Sandbox payment: no real money moved">
      Test mode
    </span>
  );
}

export function PaymentMethod({ p }: { p: Pick<Payment, "channel" | "card_brand" | "card_last4" | "provider"> }) {
  if (p.channel === "card" && p.card_last4) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CreditCard className="size-4 text-muted" aria-hidden="true" />
        {(p.card_brand ?? "Card").replace(/^\w/, (c) => c.toUpperCase())} ••{p.card_last4}
      </span>
    );
  }
  if (p.channel === "bank_transfer") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Landmark className="size-4 text-muted" aria-hidden="true" /> Bank transfer
      </span>
    );
  }
  if (p.provider === "front_desk") return <span>Front desk</span>;
  return <span className="text-muted">—</span>;
}

export const PROVIDER_LABEL: Record<string, string> = {
  sandbox: "NEXORA Sandbox",
  paystack: "Paystack",
  front_desk: "Front desk",
};
