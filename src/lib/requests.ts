// The Guest Promise Engine: every change to a request goes through here, so every
// change gets (1) a guarded state transition, (2) a history event naming who did
// it, (3) a realtime ping to every open screen, and (4) a mirror to Workpeg.
import { after } from "next/server";
import { db } from "./db";
import { ping, topics, type PingMessage } from "./realtime";
import { syncRequestToWorkpeg } from "./workpeg";
import { pushGuestRequestToPeg } from "./workpeg-permissions";
import { syncReservationBalance } from "./payments/folio";
import { firstName, fmtAgo, fmtMinor, fmtTime, DEFAULT_TZ } from "./format";
import { DEPARTMENT_LABEL, PRIORITY_LABEL } from "./labels";
import { dueTargetMinutes, OPEN_STATUSES } from "./sla";
import type {
  Actor,
  Confidence,
  Priority,
  RequestEvent,
  RequestSource,
  RequestStatus,
  RequestView,
  Service,
  ServiceRequest,
  Staff,
} from "./types";

export const REQUEST_SELECT =
  "*, room:rooms(id, number, floor, room_type, landmark), service:services(id, name, icon, category, action_verb, resolution_target_min, response_target_min), guest:guests(id, first_name, last_name, title), assignee:staff(id, full_name, department_id, on_duty)";

export class EngineError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "conflict" | "invalid" | "duplicate" | "forbidden" = "invalid",
    public existingId?: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/** Run side effects after the response is sent (falls back to fire-and-forget outside a request). */
function later(task: () => Promise<void>) {
  const run = () => task().catch((err) => console.error("[engine] background task failed", err));
  try {
    after(run);
  } catch {
    void run();
  }
}

// ---------------------------------------------------------------------------
// Reads

export async function getRequest(id: string): Promise<RequestView | null> {
  const { data } = await db().from("requests").select(REQUEST_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as RequestView | null) ?? null;
}

export async function getRequestByCode(code: string, hotelId: string): Promise<RequestView | null> {
  const clean = code.trim().toUpperCase().replace(/^NX(\d)/, "NX-$1");
  const { data } = await db()
    .from("requests")
    .select(REQUEST_SELECT)
    .eq("hotel_id", hotelId)
    .eq("code", clean)
    .maybeSingle();
  return (data as unknown as RequestView | null) ?? null;
}

export async function getEvents(requestId: string): Promise<RequestEvent[]> {
  const { data } = await db()
    .from("request_events")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  return (data as RequestEvent[] | null) ?? [];
}

export interface RequestFilter {
  hotelId: string;
  statuses?: RequestStatus[];
  reservationId?: string;
  assigneeId?: string;
  departmentId?: string;
  roomId?: string;
  since?: string;
  limit?: number;
}

export async function listRequests(f: RequestFilter): Promise<RequestView[]> {
  let q = db().from("requests").select(REQUEST_SELECT).eq("hotel_id", f.hotelId);
  if (f.statuses?.length) q = q.in("status", f.statuses);
  if (f.reservationId) q = q.eq("reservation_id", f.reservationId);
  if (f.assigneeId) q = q.eq("assignee_id", f.assigneeId);
  if (f.departmentId) q = q.eq("department_id", f.departmentId);
  if (f.roomId) q = q.eq("room_id", f.roomId);
  if (f.since) q = q.gte("created_at", f.since);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(f.limit ?? 200);
  if (error) throw new Error(`Could not load requests: ${error.message}`);
  return (data as unknown as RequestView[]) ?? [];
}

// ---------------------------------------------------------------------------
// Internals

function by(actor: Actor): string {
  if (actor.type === "workpeg_ai") return `Workpeg AI, for ${firstName(actor.name) || "a manager"}`;
  if (actor.type === "nexora_ai") return "NEXORA AI";
  if (actor.type === "system") return "NEXORA";
  return firstName(actor.name) || actor.name;
}

async function addEvent(
  req: Pick<ServiceRequest, "id" | "hotel_id">,
  e: { kind: string; from?: RequestStatus | null; to?: RequestStatus | null; actor: Actor; message: string },
) {
  const { error } = await db()
    .from("request_events")
    .insert({
      request_id: req.id,
      hotel_id: req.hotel_id,
      kind: e.kind,
      from_status: e.from ?? null,
      to_status: e.to ?? null,
      actor_type: e.actor.type,
      actor_id: e.actor.id ?? null,
      actor_name: e.actor.name,
      message: e.message,
    });
  if (error) console.error("[engine] could not record event", error.message);
}

function announce(req: RequestView, kind: string, guestMessage: string | null) {
  const messages: PingMessage[] = [
    {
      topic: topics.hotel(req.hotel_id),
      payload: {
        kind,
        id: req.id,
        code: req.code,
        room: req.room?.number ?? null,
        title: req.title,
        status: req.status,
        priority: req.priority,
        assigneeId: req.assignee_id,
        departmentId: req.department_id,
        feedback: req.guest_feedback,
      },
    },
  ];
  if (req.reservation_id) {
    messages.push({
      topic: topics.stay(req.reservation_id),
      payload: { kind, id: req.id, code: req.code, status: req.status, message: guestMessage },
    });
  }
  later(async () => {
    await ping(messages);
    await syncRequestToWorkpeg(req.id);
    // A guest's new request also lands on the NEXORA peg's Board in Workpeg,
    // once a hotel has allowed the peg's inbound permission.
    if (kind === "created" && req.source === "guest_portal") await pushGuestRequestToPeg(req);
  });
}

async function load(requestId: string): Promise<RequestView> {
  const req = await getRequest(requestId);
  if (!req) throw new EngineError("Request not found.", "not_found");
  return req;
}

async function transition(
  req: RequestView,
  allowedFrom: RequestStatus[],
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await db()
    .from("requests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", req.id)
    .in("status", allowedFrom)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not update ${req.code}: ${error.message}`);
  if (!data) throw new EngineError("Someone else just changed this request. Refresh and try again.", "conflict");
}

function assertAssignee(req: RequestView, actor: Actor) {
  if (actor.type === "staff" && req.assignee_id !== actor.id) {
    throw new EngineError("This task is assigned to someone else.", "forbidden");
  }
}

function deptName(id: string | null | undefined) {
  return (id && DEPARTMENT_LABEL[id]) || "the team";
}

// ---------------------------------------------------------------------------
// Writes

export interface CreateRequestInput {
  hotelId: string;
  roomId: string;
  reservationId?: string | null;
  guestId?: string | null;
  serviceId: string;
  quantity?: number;
  note?: string | null;
  priority?: Priority;
  source: RequestSource;
  actor: Actor;
  ai?: { confidence: Confidence; engine: string } | null;
  checkDuplicate?: boolean;
  /** Menu lines for a food and drinks order. Prices always come from the database. */
  items?: { menuItemId: string; quantity: number }[];
  /** For orders: pay now through the gateway, or add to the room bill. */
  payment?: "pay_now" | "charge_to_room";
}

const PAYMENTS_ACTOR: Actor = { type: "system", name: "Payments" };

export async function createRequest(input: CreateRequestInput): Promise<RequestView> {
  const { data: serviceRow } = await db()
    .from("services")
    .select("*")
    .eq("id", input.serviceId)
    .eq("active", true)
    .maybeSingle();
  const service = serviceRow as Service | null;
  if (!service || service.hotel_id !== input.hotelId) {
    throw new EngineError("That service isn't available right now.", "invalid");
  }

  const quantity = service.has_quantity
    ? Math.min(Math.max(1, Math.round(input.quantity ?? 1)), service.max_quantity)
    : 1;
  const note = input.note?.trim().slice(0, 500) || null;

  // Menu orders: price every line from the database, never from the browser.
  const lines: { menu_item_id: string; name: string; unit_price_minor: number; quantity: number }[] = [];
  if (input.items?.length) {
    const ids = [...new Set(input.items.map((i) => i.menuItemId))];
    const { data: menu } = await db()
      .from("menu_items")
      .select("id, name, price_minor")
      .in("id", ids)
      .eq("hotel_id", input.hotelId)
      .eq("available", true);
    const byId = new Map((menu ?? []).map((m) => [m.id as string, m as { id: string; name: string; price_minor: number }]));
    for (const item of input.items) {
      const m = byId.get(item.menuItemId);
      if (!m) throw new EngineError("Something in your order is no longer available. Please check your basket.", "invalid");
      const quantity = Math.min(Math.max(1, Math.round(item.quantity)), 20);
      const existing = lines.find((l) => l.menu_item_id === m.id);
      if (existing) existing.quantity = Math.min(existing.quantity + quantity, 20);
      else lines.push({ menu_item_id: m.id, name: m.name, unit_price_minor: m.price_minor, quantity });
    }
  }
  const isOrder = lines.length > 0;
  const amountMinor = lines.reduce((a, l) => a + l.unit_price_minor * l.quantity, 0);
  const payNow = isOrder && input.payment === "pay_now";
  if (isOrder && !payNow && !input.reservationId) {
    throw new EngineError("Only in-house guests can charge an order to a room.", "invalid");
  }

  if (service.needs_note && !note && !isOrder) {
    throw new EngineError("Please tell us a little more about what you need.", "invalid");
  }

  if (input.checkDuplicate && !isOrder) {
    const { data: dup } = await db()
      .from("requests")
      .select("id, code, created_at")
      .eq("room_id", input.roomId)
      .eq("service_id", service.id)
      .in("status", OPEN_STATUSES)
      .gte("created_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dup) {
      throw new EngineError(
        `You asked for ${service.name.toLowerCase()} ${fmtAgo(dup.created_at)}.`,
        "duplicate",
        dup.id,
      );
    }
  }

  const now = new Date();
  const priority = input.priority ?? service.default_priority;
  const first = lines[0];
  const extraLines = lines.length - 1;
  const title = isOrder
    ? `${first.name}${first.quantity > 1 ? ` × ${first.quantity}` : ""}${extraLines > 0 ? ` + ${extraLines} more` : ""}`
    : service.has_quantity && quantity > 1
      ? `${service.name} × ${quantity}`
      : service.name;
  const dueMinutes = dueTargetMinutes(service.resolution_target_min, priority);

  const { data: inserted, error } = await db()
    .from("requests")
    .insert({
      hotel_id: input.hotelId,
      reservation_id: input.reservationId ?? null,
      room_id: input.roomId,
      guest_id: input.guestId ?? null,
      service_id: service.id,
      title,
      quantity,
      note,
      priority,
      status: payNow ? "awaiting_payment" : "pending",
      department_id: service.department_id,
      source: input.source,
      ai_suggested: Boolean(input.ai),
      ai_confidence: input.ai?.confidence ?? null,
      ai_engine: input.ai?.engine ?? null,
      due_at: payNow ? null : new Date(now.getTime() + dueMinutes * 60_000).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      amount_minor: amountMinor,
      payment_status: !isOrder ? "not_required" : payNow ? "awaiting" : "charged_to_room",
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(`Could not save the request: ${error?.message ?? "unknown error"}`);

  const ref = { id: inserted.id as string, hotel_id: input.hotelId };
  if (isOrder) {
    const { error: itemsError } = await db()
      .from("request_items")
      .insert(lines.map((l) => ({ ...l, request_id: ref.id })));
    if (itemsError) throw new Error(`Could not save the order items: ${itemsError.message}`);
  }

  const money = fmtMinor(amountMinor);
  const createdMessage = isOrder
    ? payNow
      ? `${by(input.actor)} placed an order (${money}), awaiting payment`
      : `${by(input.actor)} placed an order and charged ${money} to the room`
    : input.source === "guest_portal"
      ? `${by(input.actor)} sent the request from the guest portal`
      : input.source === "workpeg_ai"
        ? `Created by ${by(input.actor)}`
        : `Logged by ${by(input.actor)} (${input.source === "phone" ? "phone call" : "front desk"})`;
  await addEvent(ref, { kind: "created", to: payNow ? "awaiting_payment" : "pending", actor: input.actor, message: createdMessage });

  if (input.ai) {
    await addEvent(ref, {
      kind: "ai_suggested",
      actor: { type: "nexora_ai", name: "NEXORA AI" },
      message: `Sorted as ${service.name} → ${deptName(service.department_id)} (${input.ai.confidence} confidence, ${
        input.ai.engine === "claude" ? "Claude" : "keyword rules"
      })`,
    });
  }

  if (isOrder && !payNow && input.reservationId) await syncReservationBalance(db(), input.reservationId);

  const view = await load(ref.id);
  // An unpaid order isn't work yet: refresh screens, but don't alert the kitchen.
  announce(view, payNow ? "awaiting_payment" : "created", null);
  return view;
}

async function dueFromNow(req: RequestView): Promise<string> {
  const { data } = await db().from("services").select("resolution_target_min").eq("id", req.service_id).single();
  return new Date(Date.now() + dueTargetMinutes(data?.resolution_target_min ?? 30, req.priority) * 60_000).toISOString();
}

/**
 * A confirmed payment releases an order to its department. Called once per
 * payment (confirmPayment is idempotent), so an order that is no longer waiting
 * means the money arrived late (the guest finished paying after all).
 */
export async function markOrderPaid(requestId: string, paidWith: string, reference?: string): Promise<RequestView> {
  const req = await load(requestId);
  const money = fmtMinor(req.amount_minor);
  if (req.payment_status === "charged_to_room" && req.status !== "cancelled") {
    // It went on the room bill, then the payment came through: the payment settles that charge.
    await db().from("requests").update({ payment_status: "paid", updated_at: new Date().toISOString() }).eq("id", req.id);
    await addEvent(req, { kind: "payment", actor: PAYMENTS_ACTOR, message: `Payment received: ${money} (${paidWith}). It settles the charge on the room bill.` });
    return load(req.id);
  }
  if (req.status !== "awaiting_payment" || req.payment_status === "paid") {
    // Paid twice, or paid after a cancel: keep the money on record and flag a refund.
    const why = req.payment_status === "paid" ? "a second payment for an order that was already paid" : `a payment after the order was ${req.status}`;
    await db()
      .from("requests")
      .update({
        payment_status: "paid",
        follow_up: true,
        follow_up_note: `Refund ${money}${reference ? ` (${reference})` : ""}: ${why}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    await addEvent(req, { kind: "follow_up", actor: PAYMENTS_ACTOR, message: `Payment received (${money}, ${paidWith}) as ${why}. Flagged for a refund.` });
    const view = await load(req.id);
    announce(view, "follow_up", null);
    return view;
  }
  await transition(req, ["awaiting_payment"], { status: "pending", payment_status: "paid", due_at: await dueFromNow(req) });
  await addEvent(req, {
    kind: "payment",
    from: "awaiting_payment",
    to: "pending",
    actor: PAYMENTS_ACTOR,
    message: `Payment received: ${fmtMinor(req.amount_minor)} (${paidWith}). Sent to ${deptName(req.department_id)}`,
  });
  const view = await load(req.id);
  announce(view, "created", `Payment received. ${deptName(view.department_id)} has your order.`);
  return view;
}

/** A failed or abandoned payment leaves the order waiting; the guest can retry or charge it to the room. */
export async function markOrderPaymentFailed(requestId: string, reason: string): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status !== "awaiting_payment") return req;
  await db()
    .from("requests")
    .update({ payment_status: "failed", updated_at: new Date().toISOString() })
    .eq("id", req.id)
    .eq("status", "awaiting_payment");
  await addEvent(req, { kind: "payment_failed", actor: PAYMENTS_ACTOR, message: `Payment didn't go through: ${reason}` });
  const view = await load(req.id);
  announce(view, "payment_failed", `Payment didn't go through: ${reason}`);
  return view;
}

/** Instead of paying now, put the order on the room bill and send it to the kitchen. */
export async function chargeOrderToRoom(requestId: string, actor: Actor): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status !== "awaiting_payment") throw new EngineError("This order is already confirmed.", "conflict");
  if (!req.reservation_id) throw new EngineError("Only in-house guests can charge an order to a room.", "invalid");
  await transition(req, ["awaiting_payment"], {
    status: "pending",
    payment_status: "charged_to_room",
    due_at: await dueFromNow(req),
  });
  await addEvent(req, {
    kind: "payment",
    from: "awaiting_payment",
    to: "pending",
    actor,
    message: `${by(actor)} charged ${fmtMinor(req.amount_minor)} to Room ${req.room?.number}`,
  });
  await syncReservationBalance(db(), req.reservation_id);
  const view = await load(req.id);
  announce(view, "created", `Charged to Room ${view.room?.number}. ${deptName(view.department_id)} has your order.`);
  return view;
}

export async function assignRequest(requestId: string, staffId: string, actor: Actor): Promise<RequestView> {
  const req = await load(requestId);
  if (!OPEN_STATUSES.includes(req.status)) throw new EngineError("This request is already closed.", "conflict");

  const { data: staffRow } = await db().from("staff").select("*").eq("id", staffId).maybeSingle();
  const staff = staffRow as Staff | null;
  if (!staff || staff.hotel_id !== req.hotel_id) throw new EngineError("Staff member not found.", "not_found");
  if (req.assignee_id === staff.id) return req;

  const now = new Date().toISOString();
  const nextStatus: RequestStatus = req.status === "pending" ? "assigned" : req.status;
  await transition(req, OPEN_STATUSES, {
    assignee_id: staff.id,
    status: nextStatus,
    assigned_at: req.assigned_at ?? now,
  });

  const name = firstName(staff.full_name);
  await addEvent(req, {
    kind: "assigned",
    from: req.status,
    to: nextStatus,
    actor,
    message: req.assignee
      ? `Reassigned from ${firstName(req.assignee.full_name)} to ${name} by ${by(actor)}`
      : `Assigned to ${name} by ${by(actor)}`,
  });

  const view = await load(req.id);
  announce(view, "assigned", `${name} from ${deptName(staff.department_id)} has your request.`);
  return view;
}

/** Floor staff take an unassigned request from their department's open pool. */
export async function claimRequest(requestId: string, staff: Staff): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status !== "pending" || req.assignee_id) {
    throw new EngineError("Someone else already took this one.", "conflict");
  }
  if (staff.department_id && staff.department_id !== req.department_id) {
    throw new EngineError("This request belongs to another department.", "forbidden");
  }
  const now = new Date().toISOString();
  await transition(req, ["pending"], { assignee_id: staff.id, status: "assigned", assigned_at: now });
  const name = firstName(staff.full_name);
  await addEvent(req, {
    kind: "assigned",
    from: "pending",
    to: "assigned",
    actor: { type: "staff", id: staff.id, name: staff.full_name },
    message: `${name} claimed it from the open pool`,
  });
  const view = await load(req.id);
  announce(view, "assigned", `${name} from ${deptName(staff.department_id)} has your request.`);
  return view;
}

export async function startRequest(requestId: string, actor: Actor): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status === "in_progress") return req;
  if (req.status !== "assigned") throw new EngineError("Only an assigned request can be started.", "conflict");
  assertAssignee(req, actor);

  await transition(req, ["assigned"], { status: "in_progress", started_at: new Date().toISOString() });
  const assigneeName = firstName(req.assignee?.full_name);
  await addEvent(req, {
    kind: "started",
    from: "assigned",
    to: "in_progress",
    actor,
    message:
      actor.id && actor.id === req.assignee_id
        ? `${by(actor)} started the task`
        : `Marked in progress by ${by(actor)}`,
  });

  const view = await load(req.id);
  announce(view, "started", `${assigneeName || "Our team"} is on the way.`);
  return view;
}

export async function completeRequest(
  requestId: string,
  actor: Actor,
  opts: { note?: string | null; followUp?: boolean } = {},
): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status === "completed") return req;
  if (req.status !== "assigned" && req.status !== "in_progress") {
    throw new EngineError("This request can't be completed from its current state.", "conflict");
  }
  assertAssignee(req, actor);

  const now = new Date();
  const note = opts.note?.trim().slice(0, 300) || null;
  await transition(req, ["assigned", "in_progress"], {
    status: "completed",
    completed_at: now.toISOString(),
    started_at: req.started_at ?? now.toISOString(),
    follow_up: Boolean(opts.followUp),
    follow_up_note: opts.followUp ? note : null,
  });

  await addEvent(req, {
    kind: "completed",
    from: req.status,
    to: "completed",
    actor,
    message: `${actor.id && actor.id === req.assignee_id ? `${by(actor)} completed the task` : `Marked complete by ${by(actor)}`}${
      note ? ` · “${note}”` : ""
    }`,
  });
  if (opts.followUp) {
    await addEvent(req, {
      kind: "follow_up",
      actor,
      message: `Needs follow-up${note ? `: ${note}` : ""}`,
    });
  }

  const view = await load(req.id);
  const time = fmtTime(now, DEFAULT_TZ);
  const guestMessage =
    view.service?.category === "amenities"
      ? `Done. Your ${view.service.name.toLowerCase()} ${view.quantity > 1 || /s$/i.test(view.service.name) ? "were" : "was"} delivered at ${time}.`
      : `Done. ${view.service?.name ?? "Your request"} was completed at ${time}.`;
  announce(view, "completed", guestMessage);
  return view;
}

export async function cancelRequest(requestId: string, actor: Actor, reason?: string | null): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status === "cancelled") return req;
  if (actor.type === "guest" && req.status !== "pending" && req.status !== "awaiting_payment") {
    throw new EngineError(
      `${deptName(req.department_id)} has already started on this. Call reception if you need to change it.`,
      "conflict",
    );
  }
  const cancellable: RequestStatus[] = [...OPEN_STATUSES, "awaiting_payment"];
  if (!cancellable.includes(req.status)) throw new EngineError("This request is already closed.", "conflict");

  // A paid order that is cancelled needs its money back: flag it for the front desk.
  // (An order charged to the room simply drops off the bill.)
  const refund = req.payment_status === "paid" && req.amount_minor > 0 ? `Refund ${fmtMinor(req.amount_minor)}: paid order cancelled` : null;
  await transition(req, actor.type === "guest" ? ["pending", "awaiting_payment"] : cancellable, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    ...(refund ? { follow_up: true, follow_up_note: refund } : {}),
  });
  await addEvent(req, {
    kind: "cancelled",
    from: req.status,
    to: "cancelled",
    actor,
    message:
      (actor.type === "guest"
        ? `${by(actor)} cancelled the request`
        : `Cancelled by ${by(actor)}${reason ? ` · ${reason}` : ""}`) + (refund ? `. ${refund.replace(/:.*/, "")} flagged for the front desk` : ""),
  });
  const view = await load(req.id);
  announce(view, "cancelled", refund ? "Order cancelled. The hotel will refund your payment." : "Your request was cancelled.");
  return view;
}

export async function handBackRequest(requestId: string, actor: Actor, reason: string): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status !== "assigned" && req.status !== "in_progress") {
    throw new EngineError("Only an open, assigned task can be handed back.", "conflict");
  }
  assertAssignee(req, actor);
  await transition(req, ["assigned", "in_progress"], { status: "pending", assignee_id: null, started_at: null });
  await addEvent(req, {
    kind: "handed_back",
    from: req.status,
    to: "pending",
    actor,
    message: `${by(actor)} handed it back: ${reason.trim().slice(0, 200) || "no reason given"}`,
  });
  const view = await load(req.id);
  announce(view, "handed_back", "We're finding the right person for this.");
  return view;
}

export async function setPriority(requestId: string, priority: Priority, actor: Actor): Promise<RequestView> {
  const req = await load(requestId);
  if (req.priority === priority) return req;
  const { error } = await db()
    .from("requests")
    .update({ priority, updated_at: new Date().toISOString() })
    .eq("id", req.id);
  if (error) throw new Error(error.message);
  await addEvent(req, {
    kind: "priority",
    actor,
    message: `Priority changed from ${PRIORITY_LABEL[req.priority]} to ${PRIORITY_LABEL[priority]} by ${by(actor)}`,
  });
  const view = await load(req.id);
  announce(view, "priority", null);
  return view;
}

export async function leaveFeedback(
  requestId: string,
  value: "up" | "down",
  note: string | null,
  actor: Actor,
): Promise<RequestView> {
  const req = await load(requestId);
  if (req.status !== "completed") throw new EngineError("You can rate a request once it's done.", "conflict");
  if (req.guest_feedback) return req;
  const clean = note?.trim().slice(0, 300) || null;
  const { error } = await db()
    .from("requests")
    .update({
      guest_feedback: value,
      feedback_note: clean,
      feedback_at: new Date().toISOString(),
      follow_up: value === "down" ? true : req.follow_up,
      follow_up_note: value === "down" ? clean ?? "Guest says it wasn't resolved" : req.follow_up_note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id);
  if (error) throw new Error(error.message);
  await addEvent(req, {
    kind: "feedback",
    actor,
    message:
      value === "up"
        ? "Guest: thumbs up"
        : `Guest says it wasn't resolved${clean ? `: “${clean}”` : ""}. Duty manager alerted.`,
  });
  const view = await load(req.id);
  announce(view, value === "down" ? "feedback_down" : "feedback_up", null);
  return view;
}
