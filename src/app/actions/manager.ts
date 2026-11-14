"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attempt, type ActionResult } from "@/lib/action-result";
import { actorFor, requireManager } from "@/lib/auth";
import {
  checkIn,
  checkOut,
  findRoomByNumber,
  getHotel,
  issueGuestAccess,
  revokeGuestAccess,
  setRoomStatus,
} from "@/lib/hotel";
import {
  assignRequest,
  cancelRequest,
  completeRequest,
  createRequest,
  EngineError,
  setPriority,
} from "@/lib/requests";
import { ping, topics } from "@/lib/realtime";
import { seedDemo } from "@/lib/seed";
import type { Priority, RoomStatus } from "@/lib/types";

const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];
const ROOM_STATUSES: RoomStatus[] = ["available", "occupied", "cleaning", "maintenance"];

function refresh() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/staff", "layout");
}

export async function assignAction(requestId: string, staffId: string): Promise<ActionResult> {
  return attempt(async () => {
    const manager = await requireManager();
    const req = await assignRequest(requestId, staffId, actorFor(manager));
    refresh();
    const name = req.assignee?.full_name.split(" ")[0] ?? "them";
    const guest = req.guest?.first_name;
    return { ok: true, message: guest ? `Assigned to ${name}. ${guest} can see it now.` : `Assigned to ${name}.` };
  });
}

export async function priorityAction(requestId: string, priority: Priority): Promise<ActionResult> {
  return attempt(async () => {
    const manager = await requireManager();
    if (!PRIORITIES.includes(priority)) throw new EngineError("Unknown priority.", "invalid");
    await setPriority(requestId, priority, actorFor(manager));
    refresh();
  });
}

export async function completeAction(requestId: string): Promise<ActionResult> {
  return attempt(async () => {
    const manager = await requireManager();
    await completeRequest(requestId, actorFor(manager));
    refresh();
    return { ok: true, message: "Marked complete." };
  });
}

export async function cancelAction(requestId: string): Promise<ActionResult> {
  return attempt(async () => {
    const manager = await requireManager();
    await cancelRequest(requestId, actorFor(manager));
    refresh();
    return { ok: true, message: "Request cancelled." };
  });
}

/** M6: the front desk logs a phone or walk-in request so it is tracked like any other. */
export async function logRequestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let createdId = "";
  const result = await attempt(async () => {
    const manager = await requireManager();
    const hotel = await getHotel();
    const roomNumber = String(formData.get("room") ?? "").trim();
    const serviceId = String(formData.get("serviceId") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);
    const note = String(formData.get("note") ?? "");
    const priorityRaw = String(formData.get("priority") ?? "") as Priority;
    const source = formData.get("source") === "front_desk" ? "front_desk" : "phone";
    const assignTo = String(formData.get("assignTo") ?? "");

    const room = await findRoomByNumber(hotel.id, roomNumber);
    if (!room) throw new EngineError(`There's no room ${roomNumber}.`, "invalid");
    const { data: stay } = await db()
      .from("reservations")
      .select("id, guest_id")
      .eq("room_id", room.id)
      .eq("status", "checked_in")
      .maybeSingle();

    const req = await createRequest({
      hotelId: hotel.id,
      roomId: room.id,
      reservationId: stay?.id ?? null,
      guestId: stay?.guest_id ?? null,
      serviceId,
      quantity,
      note,
      priority: PRIORITIES.includes(priorityRaw) ? priorityRaw : undefined,
      source,
      actor: actorFor(manager),
    });
    if (assignTo) await assignRequest(req.id, assignTo, actorFor(manager));
    createdId = req.id;
  });
  if (!result.ok) return result;
  refresh();
  redirect(`/dashboard/requests?r=${createdId}`);
}

export async function roomStatusAction(roomId: string, formData: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const manager = await requireManager();
    const status = String(formData.get("status") ?? "") as RoomStatus;
    if (!ROOM_STATUSES.includes(status)) throw new EngineError("Unknown room status.", "invalid");
    const room = await setRoomStatus(roomId, status, actorFor(manager), String(formData.get("note") ?? ""));
    refresh();
    return { ok: true, message: `Room ${room.number} is now ${status}.` };
  });
}

export async function checkInAction(reservationId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireManager();
    const res = await checkIn(reservationId);
    refresh();
    return { ok: true, message: `${res.guest.first_name} is checked in to Room ${res.room.number}.` };
  });
}

export async function checkOutAction(reservationId: string): Promise<ActionResult> {
  return attempt(async () => {
    const manager = await requireManager();
    const res = await checkOut(reservationId, actorFor(manager));
    refresh();
    return {
      ok: true,
      message: `${res.guest.first_name} checked out. Room ${res.room.number} is now Cleaning and housekeeping has the task.`,
    };
  });
}

export async function issueAccessAction(reservationId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireManager();
    await issueGuestAccess(reservationId);
    refresh();
    return { ok: true, message: "New guest link issued. The old one no longer works." };
  });
}

export async function revokeAccessAction(reservationId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireManager();
    await revokeGuestAccess(reservationId);
    refresh();
    return { ok: true, message: "Guest access revoked." };
  });
}

/** Demo launcher: rebuild the demo data. Only when NEXORA_DEMO_MODE=true. */
export async function resetDemoAction(): Promise<ActionResult> {
  return attempt(async () => {
    if (process.env.NEXORA_DEMO_MODE !== "true") throw new EngineError("Demo mode is off.", "forbidden");
    const result = await seedDemo(db(), { password: process.env.DEMO_STAFF_PASSWORD || "nexora-demo-2026" });
    await ping([{ topic: topics.hotel(result.hotelId), payload: { kind: "reset" } }]);
    revalidatePath("/", "layout");
    return { ok: true, message: `Demo reset: back to the ${result.requests} real requests. New request codes start at NX-1042.` };
  });
}
