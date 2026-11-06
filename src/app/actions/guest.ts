"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attempt, type ActionResult } from "@/lib/action-result";
import { accessProblem, endGuestSession, requireGuest, startGuestSession } from "@/lib/guest-session";
import { getReservationByToken } from "@/lib/hotel";
import { cancelRequest, chargeOrderToRoom, createRequest, EngineError, getRequest, leaveFeedback } from "@/lib/requests";
import { startCheckout } from "@/lib/payments/service";
import { computeFolio } from "@/lib/payments/folio";
import { PaymentError } from "@/lib/payments/types";
import type { Confidence, Priority } from "@/lib/types";

const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];
const CONFIDENCES: Confidence[] = ["high", "medium", "low"];

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** G1: confirm the last name on the booking, then start the guest session. */
export async function enterStay(token: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const lastName = String(formData.get("lastName") ?? "").trim();
  const res = await getReservationByToken(token);
  if (!res) return { ok: false, error: "This link isn't valid. Ask reception for a new one.", code: "invalid" };
  const problem = accessProblem(res);
  if (problem) redirect(`/guest/ended?reason=${problem}`);

  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db()
    .from("access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("reservation_id", res.id)
    .gte("created_at", since);
  const tries = count ?? 0;
  if (tries >= 5) {
    return { ok: false, error: "Too many tries. Please wait 10 minutes or contact reception.", code: "locked" };
  }
  if (!lastName || normalizeName(lastName) !== normalizeName(res.guest.last_name)) {
    await db().from("access_attempts").insert({ reservation_id: res.id });
    const left = 4 - tries;
    return {
      ok: false,
      error:
        left > 0
          ? `That doesn't match the name on the booking. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "That doesn't match the name on the booking. Please contact reception.",
      code: "mismatch",
    };
  }

  await startGuestSession(res);
  redirect("/guest");
}

/** G3: send a request. Duplicate guard unless the guest confirms with force=1. */
export async function submitRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireGuest();
  const serviceId = String(formData.get("serviceId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const note = String(formData.get("note") ?? "");
  const urgent = formData.get("urgent") === "on";
  const force = formData.get("force") === "1";
  const aiConfidence = String(formData.get("aiConfidence") ?? "") as Confidence;
  const aiEngine = String(formData.get("aiEngine") ?? "");
  const aiPriority = String(formData.get("aiPriority") ?? "") as Priority;
  const fromAi = CONFIDENCES.includes(aiConfidence) && (aiEngine === "claude" || aiEngine === "rules");

  let createdId = "";
  const result = await attempt(async () => {
    const req = await createRequest({
      hotelId: ctx.hotel.id,
      roomId: ctx.room.id,
      reservationId: ctx.reservation.id,
      guestId: ctx.guest.id,
      serviceId,
      quantity,
      note,
      priority: urgent ? "urgent" : fromAi && PRIORITIES.includes(aiPriority) ? aiPriority : undefined,
      source: "guest_portal",
      actor: { type: "guest", id: ctx.guest.id, name: ctx.guest.first_name },
      ai: fromAi ? { confidence: aiConfidence, engine: aiEngine } : null,
      checkDuplicate: !force,
    });
    createdId = req.id;
  });
  if (!result.ok) return result;
  revalidatePath("/guest", "layout");
  redirect(`/guest/requests/${createdId}?sent=1`);
}

/** G7: send several AI-suggested requests at once ("towels and a toothbrush"). */
export async function submitSuggestions(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireGuest();
  let items: { serviceId: string; quantity: number; note: string | null; priority: Priority | null; confidence: Confidence }[] = [];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const engine = formData.get("engine") === "claude" ? "claude" : "rules";
  const ids: string[] = [];
  const skipped: string[] = [];
  for (const item of items.slice(0, 3)) {
    try {
      const req = await createRequest({
        hotelId: ctx.hotel.id,
        roomId: ctx.room.id,
        reservationId: ctx.reservation.id,
        guestId: ctx.guest.id,
        serviceId: item.serviceId,
        quantity: item.quantity,
        note: item.note,
        priority: item.priority && PRIORITIES.includes(item.priority) ? item.priority : undefined,
        source: "guest_portal",
        actor: { type: "guest", id: ctx.guest.id, name: ctx.guest.first_name },
        ai: { confidence: CONFIDENCES.includes(item.confidence) ? item.confidence : "medium", engine },
        checkDuplicate: true,
      });
      ids.push(req.id);
    } catch (err) {
      if (err instanceof EngineError) skipped.push(err.message);
      else throw err;
    }
  }
  if (!ids.length) return { ok: false, error: skipped[0] ?? "Nothing was sent." };
  revalidatePath("/guest", "layout");
  redirect(ids.length === 1 ? `/guest/requests/${ids[0]}?sent=1` : `/guest/requests?sent=${ids.length}`);
}

async function ownRequest(requestId: string) {
  const ctx = await requireGuest();
  const req = await getRequest(requestId);
  if (!req || req.reservation_id !== ctx.reservation.id) throw new EngineError("Request not found.", "not_found");
  return { ctx, req };
}

export async function cancelMyRequest(requestId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { ctx } = await ownRequest(requestId);
    await cancelRequest(requestId, { type: "guest", id: ctx.guest.id, name: ctx.guest.first_name });
    revalidatePath("/guest", "layout");
    return { ok: true, message: "Request cancelled." };
  });
}

export async function rateRequest(requestId: string, value: "up" | "down", note: string | null): Promise<ActionResult> {
  return attempt(async () => {
    const { ctx } = await ownRequest(requestId);
    await leaveFeedback(requestId, value === "down" ? "down" : "up", note, {
      type: "guest",
      id: ctx.guest.id,
      name: ctx.guest.first_name,
    });
    revalidatePath("/guest", "layout");
    return {
      ok: true,
      message: value === "down" ? "Sorry about that. We've alerted the duty manager." : "Thanks for letting us know.",
    };
  });
}

// ---------------------------------------------------------------------------
// Orders and payments

/** Food and drinks: place an order, then pay now (gateway checkout) or charge it to the room. */
export async function placeOrder(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireGuest();
  let items: { menuItemId: string; quantity: number }[] = [];
  try {
    items = (JSON.parse(String(formData.get("items") ?? "[]")) as { menuItemId: string; quantity: number }[]).filter(
      (i) => typeof i.menuItemId === "string" && Number(i.quantity) > 0,
    );
  } catch {
    return { ok: false, error: "Something went wrong with your basket. Please try again." };
  }
  if (!items.length) return { ok: false, error: "Your basket is empty." };
  const method = formData.get("method") === "charge_to_room" ? "charge_to_room" : "pay_now";

  let orderId = "";
  let amountMinor = 0;
  let title = "";
  const created = await attempt(async () => {
    const order = await createRequest({
      hotelId: ctx.hotel.id,
      roomId: ctx.room.id,
      reservationId: ctx.reservation.id,
      guestId: ctx.guest.id,
      serviceId: "food-order",
      items,
      payment: method,
      note: String(formData.get("note") ?? ""),
      source: "guest_portal",
      actor: { type: "guest", id: ctx.guest.id, name: ctx.guest.first_name },
    });
    orderId = order.id;
    amountMinor = order.amount_minor;
    title = order.title;
  });
  if (!created.ok) return created;
  revalidatePath("/guest", "layout");
  if (method === "charge_to_room") redirect(`/guest/requests/${orderId}?sent=1`);

  let checkoutUrl = "";
  try {
    ({ checkoutUrl } = await startCheckout({
      hotelId: ctx.hotel.id,
      merchantName: ctx.hotel.name,
      reservationId: ctx.reservation.id,
      requestId: orderId,
      purpose: "order",
      amountMinor,
      description: `Room ${ctx.room.number} · ${title}`,
      email: ctx.guest.email,
    }));
  } catch (err) {
    console.error("[orders] checkout failed", err);
    redirect(`/guest/requests/${orderId}?payment=unavailable`);
  }
  redirect(checkoutUrl);
}

async function ownOrderAwaitingPayment(requestId: string) {
  const { ctx, req } = await ownRequest(requestId);
  if (req.status !== "awaiting_payment") throw new EngineError("This order is already confirmed.", "conflict");
  return { ctx, req };
}

/** Try paying for an order again (a new payment attempt with a new reference). */
export async function payForOrder(requestId: string): Promise<ActionResult> {
  let checkoutUrl = "";
  const result = await attempt(async () => {
    const { ctx, req } = await ownOrderAwaitingPayment(requestId);
    try {
      ({ checkoutUrl } = await startCheckout({
        hotelId: ctx.hotel.id,
        merchantName: ctx.hotel.name,
        reservationId: ctx.reservation.id,
        requestId: req.id,
        purpose: "order",
        amountMinor: req.amount_minor,
        description: `Room ${ctx.room.number} · ${req.title}`,
        email: ctx.guest.email,
      }));
    } catch (err) {
      throw new EngineError(err instanceof PaymentError ? err.message : "We couldn't start the payment. Please try again.", "invalid");
    }
  });
  if (!result.ok) return result;
  redirect(checkoutUrl);
}

export async function chargeMyOrderToRoom(requestId: string): Promise<ActionResult> {
  return attempt(async () => {
    const { ctx } = await ownOrderAwaitingPayment(requestId);
    await chargeOrderToRoom(requestId, { type: "guest", id: ctx.guest.id, name: ctx.guest.first_name });
    revalidatePath("/guest", "layout");
    return { ok: true, message: `Charged to Room ${ctx.room.number}. The kitchen has your order.` };
  });
}

/** Pay the whole outstanding balance of the stay. */
export async function payMyBill(): Promise<ActionResult> {
  let checkoutUrl = "";
  const result = await attempt(async () => {
    const ctx = await requireGuest();
    const folio = await computeFolio(db(), ctx.reservation.id);
    if (!folio || folio.balanceMinor <= 0) throw new EngineError("There's nothing left to pay. Thank you!", "invalid");
    try {
      ({ checkoutUrl } = await startCheckout({
        hotelId: ctx.hotel.id,
        merchantName: ctx.hotel.name,
        reservationId: ctx.reservation.id,
        purpose: "bill",
        amountMinor: folio.balanceMinor,
        description: `Room ${ctx.room.number} · bill for booking ${ctx.reservation.booking_ref}`,
        email: ctx.guest.email,
      }));
    } catch (err) {
      throw new EngineError(err instanceof PaymentError ? err.message : "We couldn't start the payment. Please try again.", "invalid");
    }
  });
  if (!result.ok) return result;
  redirect(checkoutUrl);
}

export async function leaveStay(): Promise<void> {
  await endGuestSession();
  redirect("/guest/ended?reason=signed-out");
}
