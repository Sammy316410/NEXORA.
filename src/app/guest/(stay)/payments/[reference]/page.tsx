import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Clock, Loader2 } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { confirmPayment, getPayment } from "@/lib/payments/service";
import { getRequest } from "@/lib/requests";
import { computeFolio } from "@/lib/payments/folio";
import { listRequestItems } from "@/lib/orders";
import { db } from "@/lib/db";
import { fmtDateTime, fmtMinor } from "@/lib/format";
import { cancelMyRequest, chargeMyOrderToRoom, payForOrder, payMyBill } from "@/app/actions/guest";
import { ActionButton } from "@/components/client/action-button";
import { buttonClass } from "@/components/ui";
import { PaymentMethod, PaymentStatusChip, PROVIDER_LABEL, TestModeBadge } from "@/components/payments/payment-bits";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Payment" };

// Payment confirmation / receipt. Covers every outcome: succeeded, confirming
// (bank transfer), not completed, failed and cancelled, each with the next step.
export default async function PaymentResultPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const { hotel, room, reservation } = await requireGuest();
  let payment = await getPayment(decodeURIComponent(reference));
  if (!payment || payment.reservation_id !== reservation.id) notFound();
  if (payment.status === "pending" || payment.status === "initialized") {
    payment = (await confirmPayment(payment.reference)) ?? payment; // idempotent check with the gateway
  }

  const order = payment.request_id ? await getRequest(payment.request_id) : null;
  const items = order ? await listRequestItems(order.id) : [];
  const folio = payment.purpose === "bill" ? await computeFolio(db(), reservation.id) : null;
  const amount = fmtMinor(payment.amount_minor, payment.currency);
  const s = payment.status;
  const ok = s === "succeeded";
  const waiting = s === "pending";
  const notDone = s === "initialized";
  const bad = s === "failed" || s === "abandoned";
  const orderStillOpen = order?.status === "awaiting_payment";
  // Paid after a cancel, or paid twice: the engine flagged this exact payment for a refund.
  const refundDue = ok && !!order?.follow_up && !!order.follow_up_note?.includes(payment.reference);

  return (
    <div className="space-y-5">
      <section
        className={cn(
          "animate-rise rounded-2xl p-6 text-center",
          ok ? "bg-hotel text-white" : bad ? "border border-alert/25 bg-surface" : "border border-line bg-surface",
        )}
      >
        {ok ? (
          <CircleCheck className="mx-auto size-12" aria-hidden="true" />
        ) : waiting ? (
          <Loader2 className="mx-auto size-12 animate-spin text-hotel" aria-hidden="true" />
        ) : notDone ? (
          <Clock className="mx-auto size-12 text-muted" aria-hidden="true" />
        ) : (
          <CircleX className="mx-auto size-12 text-alert" aria-hidden="true" />
        )}
        <h1 className="mt-3 font-display text-2xl font-extrabold">
          {ok ? "Payment successful" : waiting ? "Confirming your payment…" : notDone ? "Payment not completed" : s === "abandoned" ? "Payment cancelled" : "Payment failed"}
        </h1>
        <p className={cn("mt-1 font-display text-3xl font-extrabold tabular-nums", ok ? "text-white" : "text-ink")}>{amount}</p>
        <p className={cn("mt-2 text-[15px]", ok ? "text-white/90" : "text-muted")}>
          {ok
            ? payment.purpose === "order"
              ? refundDue
                ? order?.status === "cancelled"
                  ? "This order was cancelled, so the hotel will refund this payment."
                  : "This order was already paid, so the hotel will refund this second payment."
                : "The kitchen has your order. You can follow it live."
              : `Thank you. ${folio && folio.balanceMinor > 0 ? `Remaining balance: ${fmtMinor(folio.balanceMinor, folio.currency)}.` : "Your bill is fully settled."}`
            : waiting
              ? "Bank transfers take a few seconds to confirm. This page updates by itself."
              : notDone
                ? "You left the payment page before finishing. Nothing was charged."
                : payment.failure_reason ?? "Nothing was charged."}
        </p>
      </section>

      {bad || notDone ? (
        <section className="space-y-2">
          {payment.purpose === "order" && orderStillOpen ? (
            <>
              <ActionButton action={payForOrder.bind(null, order!.id)} variant="hotel" size="xl" className="w-full" pendingText="Opening checkout…">
                {notDone ? "Continue to payment" : "Try again"}
              </ActionButton>
              <ActionButton action={chargeMyOrderToRoom.bind(null, order!.id)} variant="secondary" size="lg" className="w-full">
                Charge to Room {room.number} instead
              </ActionButton>
              <ActionButton
                action={cancelMyRequest.bind(null, order!.id)}
                variant="ghost"
                size="md"
                className="w-full text-muted"
                confirmText="Cancel this order? Nothing has been charged."
              >
                Cancel order
              </ActionButton>
            </>
          ) : payment.purpose === "bill" ? (
            <ActionButton action={payMyBill} variant="hotel" size="xl" className="w-full" pendingText="Opening checkout…">
              {notDone ? "Continue to payment" : "Try again"}
            </ActionButton>
          ) : null}
        </section>
      ) : null}

      {ok || waiting ? (
        <div className="grid gap-2">
          {order ? (
            <Link href={`/guest/requests/${order.id}`} className={buttonClass(ok ? "hotel" : "secondary", "xl", "w-full")}>
              Follow your order
            </Link>
          ) : (
            <Link href="/guest/bill" className={buttonClass(ok ? "hotel" : "secondary", "xl", "w-full")}>
              View your bill
            </Link>
          )}
        </div>
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-bold">Receipt</h2>
          <div className="flex items-center gap-1.5">
            <TestModeBadge mode={payment.mode} />
            <PaymentStatusChip status={payment.status} />
          </div>
        </div>
        {items.length ? (
          <ul className="mb-3 space-y-1 border-b border-line pb-3">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.quantity} × {i.name}
                </span>
                <span className="tabular-nums">{fmtMinor(i.unit_price_minor * i.quantity, payment.currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
          <dt className="text-muted">Amount</dt>
          <dd className="text-right font-semibold tabular-nums">{amount}</dd>
          <dt className="text-muted">For</dt>
          <dd className="text-right">{payment.purpose === "order" ? `Order ${order?.code ?? ""}` : "Room bill"}</dd>
          <dt className="text-muted">Method</dt>
          <dd className="text-right">
            <PaymentMethod p={payment} />
          </dd>
          <dt className="text-muted">Date</dt>
          <dd className="text-right">{fmtDateTime(payment.paid_at ?? payment.created_at, hotel.timezone)}</dd>
          <dt className="text-muted">Reference</dt>
          <dd className="text-right font-mono text-xs">{payment.reference}</dd>
          <dt className="text-muted">Processed by</dt>
          <dd className="text-right">{PROVIDER_LABEL[payment.provider] ?? payment.provider}</dd>
        </dl>
      </section>

      <Link href="/guest/bill" className="block text-center text-sm font-medium text-hotel">
        See all payments
      </Link>
    </div>
  );
}
