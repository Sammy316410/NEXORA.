import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { computeFolio } from "@/lib/payments/folio";
import { listPayments } from "@/lib/payments/service";
import { paymentsConfig } from "@/lib/payments/config";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtMinor } from "@/lib/format";
import { payMyBill } from "@/app/actions/guest";
import { ActionButton } from "@/components/client/action-button";
import { PaymentMethod, PaymentStatusChip, TestModeBadge } from "@/components/payments/payment-bits";

export const metadata: Metadata = { title: "Your bill" };

// G11: the running bill for the stay, pay the balance, and every payment attempt.
export default async function BillPage() {
  const { hotel, reservation } = await requireGuest();
  const [folio, attempts] = await Promise.all([
    computeFolio(db(), reservation.id),
    listPayments({ hotelId: hotel.id, reservationId: reservation.id, limit: 50 }),
  ]);
  const cfg = paymentsConfig();
  if (!folio) return null;
  const cur = folio.currency;
  const charges = folio.lines.filter((l) => l.kind === "charge");
  const paid = folio.lines.filter((l) => l.kind === "payment");

  return (
    <div className="space-y-5">
      <Link href="/guest/stay" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft className="size-4" aria-hidden="true" /> Your stay
      </Link>

      <section className="rounded-2xl bg-ink p-5 text-white">
        <p className="text-sm text-white/70">Balance due · booking {reservation.booking_ref}</p>
        <p className="mt-1 font-display text-4xl font-extrabold tabular-nums">{fmtMinor(Math.max(0, folio.balanceMinor), cur)}</p>
        <p className="mt-1 text-sm text-white/70">
          {fmtMinor(folio.chargesMinor, cur)} charged · {fmtMinor(folio.paidMinor, cur)} paid · checkout {fmtDate(reservation.check_out)}
        </p>
        {folio.balanceMinor > 0 ? (
          <ActionButton action={payMyBill} variant="secondary" size="xl" className="mt-4 w-full border-white bg-white" pendingText="Opening secure checkout…">
            Pay {fmtMinor(folio.balanceMinor, cur)}
          </ActionButton>
        ) : folio.balanceMinor < 0 ? (
          <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium">
            You have {fmtMinor(-folio.balanceMinor, cur)} in credit. The front desk will refund it.
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium">All settled. Thank you!</p>
        )}
        {cfg.mode === "test" && folio.balanceMinor > 0 ? <p className="mt-2 text-center text-[11px] text-white/60">Test mode: no real money is taken.</p> : null}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display font-bold">Charges</h2>
        <ul className="space-y-3 text-sm">
          {charges.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                <span className="block font-medium">{l.label}</span>
                {l.detail ? <span className="block text-xs text-muted">{l.detail}</span> : null}
              </span>
              <span className="font-semibold tabular-nums">{fmtMinor(l.amountMinor, cur)}</span>
            </li>
          ))}
        </ul>
        {paid.length ? (
          <>
            <h2 className="mt-5 mb-3 font-display font-bold">Payments</h2>
            <ul className="space-y-3 text-sm">
              {paid.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    <span className="block font-medium">{l.label}</span>
                    <span className="block text-xs text-muted">
                      {l.detail}
                      {l.at ? ` · ${fmtDateTime(l.at, hotel.timezone)}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold text-done tabular-nums">−{fmtMinor(l.amountMinor, cur)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">Transaction history</h2>
        {attempts.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
            {attempts.map((p) => (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <Link href={`/guest/payments/${encodeURIComponent(p.reference)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] font-semibold tabular-nums">
                      {fmtMinor(p.amount_minor, p.currency)} <TestModeBadge mode={p.mode} />
                    </span>
                    <span className="block text-[13px] text-muted">
                      {p.purpose === "order" ? "Order" : p.purpose === "deposit" ? "Paid at booking" : "Bill"} · <PaymentMethod p={p} /> ·{" "}
                      {fmtDateTime(p.paid_at ?? p.created_at, hotel.timezone)}
                    </span>
                  </span>
                  <PaymentStatusChip status={p.status} />
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
