// Payment service: the only code that talks to a gateway. Everything else asks
// it to start a checkout or confirm a payment.
//
// Rules this file enforces:
// - Amounts are computed on the server (menu prices, the bill), never sent by the browser.
// - A payment is only "succeeded" after the gateway itself confirms it (verify),
//   whether the news arrives by the guest's redirect or by a signed webhook.
// - Confirmation is idempotent: the redirect and the webhook can both arrive.
// - The confirmed amount and currency must match what we asked for.
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { db } from "../db";
import { ping, topics } from "../realtime";
import { fmtMinor } from "../format";
import { markOrderPaid, markOrderPaymentFailed } from "../requests";
import { paymentsConfig } from "./config";
import { syncReservationBalance } from "./folio";
import { paystackProvider } from "./providers/paystack";
import { sandboxProvider } from "./providers/sandbox";
import { PaymentError, type PaymentProvider, type VerifyResult } from "./types";
import type { Payment } from "../types";

/** Settled for good. A failed or abandoned attempt can still turn into a late success at the gateway. */
const SETTLED = new Set(["succeeded", "refunded"]);

/** Which gateway answers may change a payment we hold in status `from`. */
function canMove(from: string, to: string): boolean {
  if (from === to || to === "initialized") return false;
  if (from === "initialized" || from === "pending") return true;
  return (from === "failed" || from === "abandoned") && to === "succeeded";
}
/** An unfinished checkout younger than this is reused instead of starting another. */
const OPEN_CHECKOUT_REUSE_MS = 20 * 60_000;

/** The provider configured for new payments. Throws if the configuration can't take payments. */
export function activeProvider(): PaymentProvider {
  const cfg = paymentsConfig();
  if (cfg.problem) throw new PaymentError(cfg.problem, "config");
  return providerById(cfg.providerId);
}

/** The provider a payment was made with (it is verified there even if config changes later). */
export function providerById(id: string): PaymentProvider {
  const cfg = paymentsConfig();
  if (id === "paystack") {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!key) throw new PaymentError("PAYSTACK_SECRET_KEY is not set.", "config");
    return paystackProvider(key);
  }
  if (id === "sandbox") return sandboxProvider(cfg.appUrl);
  throw new PaymentError(`Unknown payment provider "${id}".`, "config");
}

export function newReference(): string {
  return `NXP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function describeMethod(p: Pick<Payment, "channel" | "card_brand" | "card_last4" | "provider" | "mode">): string {
  const via =
    p.channel === "card" && p.card_last4
      ? `${(p.card_brand ?? "card").replace(/^\w/, (c) => c.toUpperCase())} ••${p.card_last4}`
      : p.channel === "bank_transfer"
        ? "bank transfer"
        : p.channel ?? "card";
  return p.mode === "test" ? `${via}, ${p.provider === "sandbox" ? "sandbox" : "test mode"}` : via;
}

function later(task: () => Promise<void>) {
  const run = () => task().catch((err) => console.error("[payments] background task failed", err));
  try {
    after(run);
  } catch {
    void run();
  }
}

export async function getPayment(reference: string): Promise<Payment | null> {
  const { data } = await db().from("payments").select("*").eq("reference", reference).maybeSingle();
  return (data as Payment | null) ?? null;
}

export interface StartCheckoutInput {
  hotelId: string;
  merchantName: string;
  reservationId: string | null;
  requestId?: string | null;
  purpose: "order" | "bill";
  amountMinor: number;
  description: string;
  email: string | null;
}

/** Record the attempt, ask the gateway for a checkout page, return where to send the guest. */
export async function startCheckout(input: StartCheckoutInput): Promise<{ reference: string; checkoutUrl: string }> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new PaymentError("Nothing to pay.", "invalid");
  const cfg = paymentsConfig();
  const provider = activeProvider();

  // A double tap, or Back then Pay again: send the guest to the checkout that is
  // already open rather than opening a second one they could also pay.
  let open = db()
    .from("payments")
    .select("reference, checkout_url")
    .eq("hotel_id", input.hotelId)
    .eq("purpose", input.purpose)
    .eq("provider", provider.id)
    .eq("amount_minor", input.amountMinor)
    .eq("status", "initialized")
    .not("checkout_url", "is", null)
    .gte("created_at", new Date(Date.now() - OPEN_CHECKOUT_REUSE_MS).toISOString());
  open = input.requestId ? open.eq("request_id", input.requestId) : open.is("request_id", null);
  open = input.reservationId ? open.eq("reservation_id", input.reservationId) : open.is("reservation_id", null);
  const { data: existing } = await open.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.checkout_url) return { reference: existing.reference as string, checkoutUrl: existing.checkout_url as string };

  const reference = newReference();
  const email = input.email?.trim() || `guest+${reference.toLowerCase()}@example.com`;

  const { error } = await db().from("payments").insert({
    hotel_id: input.hotelId,
    reservation_id: input.reservationId,
    request_id: input.requestId ?? null,
    purpose: input.purpose,
    provider: provider.id,
    mode: provider.mode,
    reference,
    amount_minor: input.amountMinor,
    currency: cfg.currency,
    status: "initialized",
    payer_email: email,
  });
  if (error) throw new Error(`Could not record the payment: ${error.message}`);

  try {
    const init = await provider.initialize({
      reference,
      amountMinor: input.amountMinor,
      currency: cfg.currency,
      email,
      merchantName: input.merchantName,
      description: input.description,
      callbackUrl: `${cfg.appUrl}/pay/return`,
      metadata: { purpose: input.purpose, reservation_id: input.reservationId, request_id: input.requestId ?? null },
    });
    await db()
      .from("payments")
      .update({ checkout_url: init.checkoutUrl, provider_reference: init.providerReference, updated_at: new Date().toISOString() })
      .eq("reference", reference);
    return { reference, checkoutUrl: init.checkoutUrl };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await db()
      .from("payments")
      .update({ status: "failed", failure_reason: "Couldn't start the payment. Please try again.", updated_at: new Date().toISOString() })
      .eq("reference", reference);
    console.error("[payments] initialize failed", reason);
    throw new PaymentError("We couldn't start the payment. Please try again in a moment.", "provider");
  }
}

/** Ask the gateway what happened to a payment and apply it. Safe to call any number of times. */
export async function confirmPayment(reference: string): Promise<Payment | null> {
  const payment = await getPayment(reference);
  if (!payment) return null;
  if (SETTLED.has(payment.status)) return payment;
  let result: VerifyResult;
  try {
    result = await providerById(payment.provider).verify(reference);
  } catch (err) {
    console.error("[payments] verify failed", err);
    return payment; // leave it as it is; the webhook or a later return will settle it
  }
  return applyResult(payment, result);
}

async function applyResult(payment: Payment, gateway: VerifyResult): Promise<Payment> {
  let result = gateway;
  if (result.status === "succeeded") {
    const amountOk = result.amountMinor === payment.amount_minor;
    const currencyOk = !result.currency || result.currency.toUpperCase() === payment.currency.toUpperCase();
    if (!amountOk || !currencyOk) {
      console.error(`[payments] ${payment.reference}: amount/currency mismatch`, result);
      result = { ...result, status: "failed", failureReason: "Amount didn't match the order, so the payment wasn't accepted" };
    }
  }
  if (!canMove(payment.status, result.status)) return payment;

  const { data: updated } = await db()
    .from("payments")
    .update({
      status: result.status,
      failure_reason: result.status === "failed" || result.status === "abandoned" ? result.failureReason ?? "Payment not completed" : null,
      channel: result.channel,
      card_brand: result.cardBrand,
      card_last4: result.cardLast4,
      paid_at: result.status === "succeeded" ? result.paidAt ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .eq("status", payment.status) // only if nobody else moved it since we read it
    .select("*")
    .maybeSingle();
  if (!updated) return (await getPayment(payment.reference)) ?? payment; // settled by a parallel call
  const settled = updated as Payment;

  const { data: res } = settled.reservation_id
    ? await db().from("reservations").select("room:rooms(number)").eq("id", settled.reservation_id).maybeSingle()
    : { data: null };
  const room = (res?.room as unknown as { number: string } | null)?.number ?? null;
  const amount = fmtMinor(settled.amount_minor, settled.currency);

  if (settled.status === "succeeded") {
    if (settled.purpose === "order" && settled.request_id) await markOrderPaid(settled.request_id, describeMethod(settled), settled.reference);
    if (settled.reservation_id) await syncReservationBalance(db(), settled.reservation_id);
  } else if ((settled.status === "failed" || settled.status === "abandoned") && settled.purpose === "order" && settled.request_id) {
    await markOrderPaymentFailed(settled.request_id, settled.failure_reason ?? "Payment not completed");
  }

  const kind = settled.status === "succeeded" ? "payment_succeeded" : settled.status === "pending" ? "payment_pending" : "payment_failed";
  later(async () => {
    await ping([
      { topic: topics.hotel(settled.hotel_id), payload: { kind, room, amount, reference: settled.reference, purpose: settled.purpose } },
      ...(settled.reservation_id
        ? [
            {
              topic: topics.stay(settled.reservation_id),
              payload: {
                kind,
                reference: settled.reference,
                message:
                  settled.purpose === "order"
                    ? null // the order's own update carries the message
                    : settled.status === "succeeded"
                      ? `Payment received: ${amount}. Thank you.`
                      : settled.status === "pending"
                        ? null
                        : `Payment didn't go through: ${settled.failure_reason ?? "not completed"}`,
              },
            },
          ]
        : []),
    ]);
  });
  return settled;
}

/** Guest abandoned the checkout page: mark the attempt so they can start a fresh one. */
export async function abandonPayment(reference: string): Promise<void> {
  const payment = await getPayment(reference);
  if (!payment || (payment.status !== "initialized" && payment.status !== "pending")) return;
  await applyResult(payment, {
    status: "abandoned",
    amountMinor: null,
    currency: null,
    paidAt: null,
    channel: null,
    cardBrand: null,
    cardLast4: null,
    failureReason: "Payment cancelled before it was completed",
  });
}

export interface PaymentListFilter {
  hotelId: string;
  reservationId?: string;
  requestId?: string;
  since?: string;
  statuses?: string[];
  limit?: number;
}

export async function listPayments(f: PaymentListFilter): Promise<Payment[]> {
  let q = db().from("payments").select("*").eq("hotel_id", f.hotelId);
  if (f.reservationId) q = q.eq("reservation_id", f.reservationId);
  if (f.requestId) q = q.eq("request_id", f.requestId);
  if (f.since) q = q.gte("created_at", f.since);
  if (f.statuses?.length) q = q.in("status", f.statuses);
  const { data } = await q.order("created_at", { ascending: false }).limit(f.limit ?? 200);
  return (data as Payment[]) ?? [];
}
