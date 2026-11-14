// Hotel-level operations: rooms, reservations, guest access, staff.
import { randomBytes, randomInt } from "node:crypto";
import { db, exactIlike, sameText } from "./db";
import { ping, topics } from "./realtime";
import { createRequest, EngineError } from "./requests";
import { todayISO } from "./format";
import type { Actor, Guest, Hotel, Reservation, Room, RoomStatus, Service, Staff } from "./types";

export async function getHotel(): Promise<Hotel> {
  const slug = process.env.NEXORA_HOTEL_SLUG?.trim() || "villa-monument";
  const { data } = await db().from("hotels").select("*").eq("slug", slug).maybeSingle();
  if (data) return data as Hotel;
  const { data: first } = await db().from("hotels").select("*").order("created_at").limit(1).maybeSingle();
  if (!first) throw new Error("No hotel found. Run `npm run db:seed` first.");
  return first as Hotel;
}

export async function listServices(hotelId: string, opts: { guestVisibleOnly?: boolean } = {}): Promise<Service[]> {
  let q = db().from("services").select("*").eq("hotel_id", hotelId).eq("active", true);
  if (opts.guestVisibleOnly) q = q.eq("guest_visible", true);
  const { data } = await q.order("sort");
  return (data as Service[]) ?? [];
}

export async function getService(id: string): Promise<Service | null> {
  const { data } = await db().from("services").select("*").eq("id", id).maybeSingle();
  return (data as Service | null) ?? null;
}

export async function listStaff(hotelId: string): Promise<Staff[]> {
  const { data } = await db().from("staff").select("*").eq("hotel_id", hotelId).order("full_name");
  return (data as Staff[]) ?? [];
}

function announceHotel(hotelId: string, kind: string, extra: Record<string, unknown> = {}) {
  void ping([{ topic: topics.hotel(hotelId), payload: { kind, ...extra } }]);
}

// ---------------------------------------------------------------------------
// Rooms

export interface RoomView extends Room {
  stay: { id: string; status: Reservation["status"]; check_in: string; check_out: string; guest: string } | null;
  openRequests: number;
  arrivingToday: boolean;
  departingToday: boolean;
}

export async function listRooms(hotel: Hotel): Promise<RoomView[]> {
  const today = todayISO(hotel.timezone);
  const [{ data: rooms }, { data: stays }, { data: open }] = await Promise.all([
    db().from("rooms").select("*").eq("hotel_id", hotel.id).order("number"),
    db()
      .from("reservations")
      .select("id, room_id, status, check_in, check_out, guest:guests(title, first_name, last_name)")
      .eq("hotel_id", hotel.id)
      .in("status", ["checked_in", "confirmed"]),
    db().from("requests").select("room_id").eq("hotel_id", hotel.id).in("status", ["pending", "assigned", "in_progress"]),
  ]);
  const openByRoom = new Map<string, number>();
  for (const r of (open as { room_id: string }[]) ?? []) openByRoom.set(r.room_id, (openByRoom.get(r.room_id) ?? 0) + 1);

  type StayRow = {
    id: string;
    room_id: string;
    status: Reservation["status"];
    check_in: string;
    check_out: string;
    guest: Pick<Guest, "title" | "first_name" | "last_name">;
  };
  const stayRows = (stays as unknown as StayRow[]) ?? [];
  return ((rooms as Room[]) ?? []).map((room) => {
    const here = stayRows.filter((s) => s.room_id === room.id);
    const inHouse = here.find((s) => s.status === "checked_in");
    const arriving = here.find((s) => s.status === "confirmed" && s.check_in === today);
    const stay = inHouse ?? arriving ?? null;
    return {
      ...room,
      stay: stay
        ? {
            id: stay.id,
            status: stay.status,
            check_in: stay.check_in,
            check_out: stay.check_out,
            guest: [stay.guest.title, stay.guest.first_name, stay.guest.last_name].filter(Boolean).join(" "),
          }
        : null,
      openRequests: openByRoom.get(room.id) ?? 0,
      arrivingToday: Boolean(arriving),
      departingToday: Boolean(inHouse && inHouse.check_out === today),
    };
  });
}

export async function findRoomByNumber(hotelId: string, number: string): Promise<Room | null> {
  // Case-insensitive, so "a12" finds room A12.
  const { data } = await db().from("rooms").select("*").eq("hotel_id", hotelId).ilike("number", exactIlike(number.trim())).maybeSingle();
  const room = (data as Room | null) ?? null;
  return room && sameText(room.number, number) ? room : null;
}

export async function setRoomStatus(roomId: string, status: RoomStatus, _actor: Actor, note?: string | null): Promise<Room> {
  if (status === "maintenance" && !note?.trim()) {
    throw new EngineError("Say why the room is out of order.", "invalid");
  }
  const { data, error } = await db()
    .from("rooms")
    .update({ status, status_note: status === "maintenance" ? note?.trim() ?? null : null, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not update the room: ${error?.message}`);
  const room = data as Room;
  announceHotel(room.hotel_id, "room", { room: room.number, status });
  return room;
}

// ---------------------------------------------------------------------------
// Reservations and guest access

export interface ReservationView extends Reservation {
  guest: Guest;
  room: Room;
}

const RES_SELECT = "*, guest:guests(*), room:rooms(*)";

export async function listReservations(hotelId: string): Promise<ReservationView[]> {
  const { data } = await db()
    .from("reservations")
    .select(RES_SELECT)
    .eq("hotel_id", hotelId)
    .in("status", ["confirmed", "checked_in", "checked_out"])
    .order("check_in", { ascending: false })
    .limit(200);
  return (data as unknown as ReservationView[]) ?? [];
}

export async function getReservation(id: string): Promise<ReservationView | null> {
  const { data } = await db().from("reservations").select(RES_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as ReservationView | null) ?? null;
}

export async function getReservationByToken(token: string): Promise<ReservationView | null> {
  if (!token || token.length < 10) return null;
  const { data } = await db().from("reservations").select(RES_SELECT).eq("access_token", token).maybeSingle();
  return (data as unknown as ReservationView | null) ?? null;
}

export function guestLink(token: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/g/${token}`;
}

function checkoutInstant(hotel: Pick<Hotel, "check_out_time">, checkOut: string): string {
  // Hotels in this MVP are in Africa/Lagos (UTC+1, no daylight saving).
  return new Date(`${checkOut}T${hotel.check_out_time || "12:00"}:00+01:00`).toISOString();
}

export async function issueGuestAccess(reservationId: string): Promise<{ token: string; code: string }> {
  const res = await getReservation(reservationId);
  if (!res) throw new EngineError("Reservation not found.", "not_found");
  const { data: hotel } = await db().from("hotels").select("check_out_time").eq("id", res.hotel_id).single();
  const token = randomBytes(18).toString("base64url");
  const code = String(randomInt(100000, 1000000));
  const { error } = await db()
    .from("reservations")
    .update({
      access_token: token,
      access_code: code,
      access_expires_at: checkoutInstant(hotel ?? { check_out_time: "12:00" }, res.check_out),
      access_revoked_at: null,
    })
    .eq("id", reservationId);
  if (error) throw new Error(error.message);
  return { token, code };
}

export async function revokeGuestAccess(reservationId: string): Promise<void> {
  const { error } = await db()
    .from("reservations")
    .update({ access_revoked_at: new Date().toISOString() })
    .eq("id", reservationId);
  if (error) throw new Error(error.message);
}

export async function checkIn(reservationId: string): Promise<ReservationView> {
  const res = await getReservation(reservationId);
  if (!res) throw new EngineError("Reservation not found.", "not_found");
  if (res.status !== "confirmed") throw new EngineError("Only a confirmed reservation can be checked in.", "conflict");
  await db().from("reservations").update({ status: "checked_in" }).eq("id", res.id);
  await db().from("rooms").update({ status: "occupied", status_note: null, updated_at: new Date().toISOString() }).eq("id", res.room_id);
  if (!res.access_token || res.access_revoked_at) await issueGuestAccess(res.id);
  announceHotel(res.hotel_id, "reservation", { room: res.room.number, status: "checked_in" });
  return (await getReservation(res.id))!;
}

/**
 * Checkout = one click that joins three departments: guest access is revoked,
 * the room goes to Cleaning, and housekeeping gets a cleaning task.
 */
export async function checkOut(reservationId: string, actor: Actor): Promise<ReservationView> {
  const res = await getReservation(reservationId);
  if (!res) throw new EngineError("Reservation not found.", "not_found");
  if (res.status !== "checked_in") throw new EngineError("Only an in-house guest can be checked out.", "conflict");
  const now = new Date().toISOString();
  await db().from("reservations").update({ status: "checked_out", access_revoked_at: now }).eq("id", res.id);
  await db().from("rooms").update({ status: "cleaning", status_note: "Checkout clean", updated_at: now }).eq("id", res.room_id);
  await createRequest({
    hotelId: res.hotel_id,
    roomId: res.room_id,
    serviceId: "room-cleaning",
    note: "Checkout clean: prepare the room for the next guest",
    source: "system",
    actor: { type: "system", name: `NEXORA (checkout by ${actor.name})` },
  });
  announceHotel(res.hotel_id, "reservation", { room: res.room.number, status: "checked_out" });
  return (await getReservation(res.id))!;
}

// ---------------------------------------------------------------------------
// Staff

export async function setOnDuty(staffId: string, onDuty: boolean): Promise<void> {
  const { data, error } = await db().from("staff").update({ on_duty: onDuty }).eq("id", staffId).select("hotel_id").single();
  if (error) throw new Error(error.message);
  announceHotel(data.hotel_id as string, "staff", { staffId, onDuty });
}
