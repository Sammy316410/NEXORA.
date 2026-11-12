import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleCheck, Phone, ThumbsDown, ThumbsUp } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getRequest } from "@/lib/requests";
import { fmtTime, fmtMinor } from "@/lib/format";
import { dueState, isOpen } from "@/lib/sla";
import { DEPARTMENT_LABEL } from "@/lib/labels";
import { cancelMyRequest, chargeMyOrderToRoom, payForOrder, rateRequest } from "@/app/actions/guest";
import { listRequestItems, paymentsForRequest } from "@/lib/orders";
import { PaymentMethod, TestModeBadge } from "@/components/payments/payment-bits";
import { ServiceIcon } from "@/components/icons";
import { StatusChip } from "@/components/status";
import { GuestTimeline } from "@/components/guest/progress";
import { FeedbackCard } from "@/components/guest/feedback";
import { ActionButton } from "@/components/client/action-button";

export const metadata: Metadata = { title: "Your request" };

// G4 + G5: confirmation (after sending) and the live tracker.
export default async function TrackerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; payment?: string }>;
}) {
  const [{ id }, { sent, payment: paymentFlag }] = await Promise.all([params, searchParams]);
  const { hotel, guest, room, reservation } = await requireGuest();
  const request = await getRequest(id);
  if (!request || request.reservation_id !== reservation.id) notFound();
  const isOrder = request.amount_minor > 0;
  const [items, attempts] = isOrder ? await Promise.all([listRequestItems(request.id), paymentsForRequest(request.id)]) : [[], []];
  const lastAttempt = attempts[0];
  const paidWith = attempts.find((p) => p.status === "succeeded");
  const awaiting = request.status === "awaiting_payment";

  const tz = hotel.timezone;
  const dept = DEPARTMENT_LABEL[request.department_id] ?? "Our team";
  const due = dueState(request);
  const isAmenity = request.service?.category === "amenities";
  const what = isAmenity
    ? `will bring ${request.quantity > 1 ? `${request.quantity} ${request.service.name.replace(/^Extra /i, "").toLowerCase()}` : request.service.name.toLowerCase()} to Room ${room.number}`
    : `has your request for Room ${room.number}`;

  return (
    <div className="space-y-5">
      <Link href="/guest/requests" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft className="size-4" aria-hidden="true" /> My requests
      </Link>

      {sent === "1" && request.status === "pending" ? (
        <section className="animate-rise rounded-2xl bg-hotel p-5 text-white">
          <CircleCheck className="size-9" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-extrabold">Got it, {guest.first_name}.</p>
          <p className="mt-1 text-[15px] text-white/90">
            {dept} {what}, usually within {request.service?.resolution_target_min ?? 15} minutes.
          </p>
          <p className="mt-3 text-xs text-white/75">Reference {request.code}, if you call reception.</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-hotel/10 text-hotel">
            <ServiceIcon icon={request.service?.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl leading-tight font-extrabold">{request.title}</h1>
            <p className="text-sm text-muted">
              Room {room.number} · sent {fmtTime(request.created_at, tz)}
            </p>
          </div>
          <StatusChip status={request.status} guest size="md" />
        </div>
        {request.note ? <p className="mt-4 rounded-xl bg-subtle px-3 py-2.5 text-sm text-ink">“{request.note}”</p> : null}

        {isOrder ? (
          <div className="mt-4 rounded-xl bg-subtle px-3 py-3 text-sm">
            <ul className="space-y-1">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.quantity} × {i.name}
                  </span>
                  <span className="tabular-nums">{fmtMinor(i.unit_price_minor * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{fmtMinor(request.amount_minor)}</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              {request.payment_status === "paid" && paidWith ? (
                <>
                  Paid · <PaymentMethod p={paidWith} /> <TestModeBadge mode={paidWith.mode} />
                </>
              ) : request.payment_status === "charged_to_room" ? (
                `Charged to Room ${room.number}`
              ) : request.payment_status === "failed" ? (
                "Payment didn't go through"
              ) : request.payment_status === "awaiting" ? (
                "Waiting for payment"
              ) : null}
            </p>
          </div>
        ) : null}

        {awaiting ? (
          <div className="mt-5 space-y-2 rounded-2xl border border-progress/30 bg-progress-bg p-4">
            <p className="font-display font-bold text-progress">
              {paymentFlag === "unavailable"
                ? "We couldn't open the payment page."
                : request.payment_status === "failed"
                  ? `Payment didn't go through${lastAttempt?.failure_reason ? `: ${lastAttempt.failure_reason}` : "."}`
                  : "Your order is waiting for payment."}
            </p>
            <p className="text-sm text-progress">The kitchen starts as soon as it&apos;s paid or charged to your room.</p>
            {lastAttempt?.status === "initialized" && lastAttempt.checkout_url && paymentFlag !== "unavailable" ? (
              <a href={lastAttempt.checkout_url} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-hotel text-base font-semibold text-white">
                Continue to payment
              </a>
            ) : (
              <ActionButton action={payForOrder.bind(null, request.id)} variant="hotel" size="xl" className="w-full" pendingText="Opening checkout…">
                Pay {fmtMinor(request.amount_minor)}
              </ActionButton>
            )}
            <ActionButton action={chargeMyOrderToRoom.bind(null, request.id)} variant="secondary" size="lg" className="w-full">
              Charge to Room {room.number} instead
            </ActionButton>
          </div>
        ) : null}

        <div className="mt-6">
          {awaiting ? null : request.status === "cancelled" ? (
            <p className="text-sm text-muted">You cancelled this request at {fmtTime(request.cancelled_at ?? request.updated_at, tz)}.</p>
          ) : (
            <GuestTimeline request={request} tz={tz} />
          )}
        </div>

        {isOpen(request.status) && request.due_at ? (
          <p className="mt-5 rounded-xl bg-subtle px-3 py-2.5 text-sm">
            {due.kind === "overdue" ? (
              <span className="text-progress">Taking longer than usual — we&apos;ve nudged the team.</span>
            ) : (
              <>
                Expected by <span className="font-semibold tabular-nums">{fmtTime(request.due_at, tz)}</span>
              </>
            )}
          </p>
        ) : null}

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <span className="size-2 animate-pulse-soft rounded-full bg-[#1FA35B]" aria-hidden="true" /> Updates automatically
        </p>
      </section>

      {request.status === "completed" && !request.guest_feedback ? <FeedbackCard rate={rateRequest.bind(null, request.id)} /> : null}
      {request.guest_feedback ? (
        <p className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          {request.guest_feedback === "up" ? <ThumbsUp className="size-4" aria-hidden="true" /> : <ThumbsDown className="size-4" aria-hidden="true" />}
          {request.guest_feedback === "up" ? "Thanks for your feedback." : "We've alerted the duty manager."}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {request.status === "pending" || awaiting ? (
          <ActionButton
            action={cancelMyRequest.bind(null, request.id)}
            variant="secondary"
            size="lg"
            className="w-full"
            confirmText={
              awaiting
                ? "Cancel this order? Nothing has been charged."
                : request.payment_status === "paid"
                  ? `Cancel this order? ${dept} hasn't started yet, and the hotel will refund your payment.`
                  : `Cancel this request? ${dept} hasn't started yet.`
            }
          >
            {awaiting || request.amount_minor > 0 ? "Cancel order" : "Cancel request"}
          </ActionButton>
        ) : null}
        {hotel.phone ? (
          <a href={`tel:${hotel.phone.replace(/\s/g, "")}`} className="flex min-h-12 items-center justify-center gap-2 text-sm font-medium text-hotel">
            <Phone className="size-4" aria-hidden="true" /> Call reception
          </a>
        ) : null}
      </div>
    </div>
  );
}
