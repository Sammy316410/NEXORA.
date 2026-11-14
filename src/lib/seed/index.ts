// Demo data for Villa Monument (demo): only what the team saw at the hotel on
// 13 Nov 2026, plus the service list and a sample menu so the app can run.
// Idempotent: used by `npm run db:seed` and by the "Reset demo" button.
//
// Reset keeps the hotel, rooms, staff logins and the team's guest link (so a
// printed QR code keeps working) and rebuilds the requests: just the two real
// ones. Insights starts from those and grows as the app is used.
//
// It also deletes the old fictional Amber Coast hotel and its demo logins.
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  DEPARTMENTS,
  HOTEL,
  LEGACY_EMAIL_DOMAIN,
  LEGACY_HOTEL_SLUG,
  MENU,
  ROOMS,
  SERVICES,
  STAFF,
  TEAM_GUEST,
} from "./catalog";
import { syncReservationBalance } from "../payments/folio";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const LAGOS_OFFSET_MS = 60 * MIN; // Africa/Lagos is UTC+1, no daylight saving

type Log = (message: string) => void;

export interface SeedResult {
  hotelId: string;
  /** The team guest's portal link token. */
  guestToken: string | null;
  staff: number;
  rooms: number;
  reservations: number;
  requests: number;
}

function lagosDate(now: number, offsetDays = 0): string {
  return new Date(now + LAGOS_OFFSET_MS + offsetDays * DAY).toISOString().slice(0, 10);
}

function lagosTime(date: string, hhmm: string): number {
  return Date.parse(`${date}T${hhmm}:00+01:00`);
}

const token = () => randomBytes(18).toString("base64url");
const accessCode = () => String(randomInt(100000, 1000000));
const iso = (ms: number) => new Date(ms).toISOString();

async function ok<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function one<T>(
  promise: PromiseLike<{ data: T; error: { message: string } | null }>,
  what: string,
): Promise<NonNullable<T>> {
  const data = await ok(promise, what);
  if (data === null || data === undefined) throw new Error(`${what}: no row returned`);
  return data as NonNullable<T>;
}

// ---------------------------------------------------------------------------

export async function seedDemo(db: SupabaseClient, opts: { password: string; log?: Log; now?: number }): Promise<SeedResult> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? Date.now();

  await removeLegacyDemo(db, log);

  const hotel = await one(db.from("hotels").upsert(HOTEL, { onConflict: "slug" }).select("id").single(), "hotel");
  const hotelId = hotel.id as string;
  log(`Hotel: ${HOTEL.name}`);

  await ok(db.from("departments").upsert(DEPARTMENTS.map((d) => ({ ...d, hotel_id: hotelId }))), "departments");
  await ok(db.from("services").upsert(SERVICES.map((s) => ({ ...s, hotel_id: hotelId }))), "services");
  log(`Services: ${SERVICES.length}`);
  await ok(
    db.from("menu_items").upsert(
      MENU.map((m, i) => ({
        id: m.id,
        hotel_id: hotelId,
        name: m.name,
        description: m.description,
        category: m.category,
        price_minor: m.price * 100,
        available: true,
        sort: i + 1,
      })),
    ),
    "menu",
  );
  log(`Menu items (sample prices): ${MENU.length}`);

  const rooms = await seedRooms(db, hotelId, now);
  log(`Rooms and amenities: ${rooms.size}`);

  const staff = await seedStaff(db, hotelId, opts.password);
  log(`Staff logins: ${staff.length} (password from DEMO_STAFF_PASSWORD)`);

  const stay = await seedTeamStay(db, hotelId, rooms, now);
  log(`Guest: ${TEAM_GUEST.first} ${TEAM_GUEST.last}, ${TEAM_GUEST.room}`);

  // Payments are rebuilt with the requests: clear every attempt and the sandbox ledger.
  await ok(db.from("payments").delete().eq("hotel_id", hotelId), "clear payments");
  await db.from("sandbox_transactions").delete().neq("reference", "");

  const requests = await rebuildRequests(db, hotelId, rooms, stay, staff, now);
  log(`Requests: ${requests} (the two the team saw)`);

  await syncReservationBalance(db, stay.id);
  await ok(db.rpc("nexora_restart_request_codes"), "restart request codes");
  await db.from("access_attempts").delete().gte("id", 0);
  await db.from("workpeg_links").delete().eq("entity", "request");

  return { hotelId, guestToken: stay.access_token, staff: staff.length, rooms: rooms.size, reservations: 1, requests };
}

/** Delete the fictional Amber Coast hotel (its rows cascade) and its demo logins. */
async function removeLegacyDemo(db: SupabaseClient, log: Log) {
  const { data: legacy } = await db.from("hotels").select("id").eq("slug", LEGACY_HOTEL_SLUG).maybeSingle();
  if (legacy) {
    const id = legacy.id as string;
    // Payments and requests point at rooms and stays, so clear them before the hotel.
    await ok(db.from("payments").delete().eq("hotel_id", id), "clear Amber Coast payments");
    await ok(db.from("requests").delete().eq("hotel_id", id), "clear Amber Coast requests");
    await ok(db.from("reservations").delete().eq("hotel_id", id), "clear Amber Coast stays");
    await ok(db.from("hotels").delete().eq("id", id), "delete Amber Coast");
    log("Removed the Amber Coast demo hotel");
  }
  const { data: list, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`list auth users: ${error.message}`);
  let removed = 0;
  for (const u of list.users) {
    if (u.email?.toLowerCase().endsWith(LEGACY_EMAIL_DOMAIN)) {
      const del = await db.auth.admin.deleteUser(u.id);
      if (del.error) throw new Error(`delete ${u.email}: ${del.error.message}`);
      removed++;
    }
  }
  if (removed) log(`Removed ${removed} Amber Coast demo logins`);
}

// ---------------------------------------------------------------------------

interface RoomRow {
  id: string;
  number: string;
  status: string;
  rate: number;
}

async function seedRooms(db: SupabaseClient, hotelId: string, now: number): Promise<Map<string, RoomRow>> {
  const rows = ROOMS.map((r) => ({
    hotel_id: hotelId,
    ...r,
    // Only the team's room is known to be occupied.
    status: r.number === TEAM_GUEST.room ? "occupied" : "available",
    status_note: null,
    landmark: null,
    updated_at: iso(now),
  }));
  const saved = await ok(
    db.from("rooms").upsert(rows, { onConflict: "hotel_id,number" }).select("id, number, status, rate"),
    "rooms",
  );
  return new Map((saved as RoomRow[]).map((r) => [r.number, r]));
}

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
  on_duty: boolean;
}

async function seedStaff(db: SupabaseClient, hotelId: string, password: string): Promise<StaffRow[]> {
  const { data: list, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`list auth users: ${error.message}`);
  const byEmail = new Map(list.users.map((u) => [u.email?.toLowerCase() ?? "", u]));

  const rows = [];
  for (const s of STAFF) {
    let user = byEmail.get(s.email);
    if (!user) {
      const created = await db.auth.admin.createUser({
        email: s.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: s.full_name },
      });
      if (created.error || !created.data.user) throw new Error(`create ${s.email}: ${created.error?.message}`);
      user = created.data.user;
    } else {
      const updated = await db.auth.admin.updateUserById(user.id, { password });
      if (updated.error) throw new Error(`update ${s.email}: ${updated.error.message}`);
    }
    rows.push({ ...s, hotel_id: hotelId, user_id: user.id });
  }
  return (await ok(db.from("staff").upsert(rows, { onConflict: "email" }).select("*"), "staff")) as StaffRow[];
}

interface Stay {
  id: string;
  guest_id: string;
  first_name: string;
  access_token: string | null;
}

/** The team's own stay: checked in yesterday, leaving tomorrow, nothing paid yet. */
async function seedTeamStay(db: SupabaseClient, hotelId: string, rooms: Map<string, RoomRow>, now: number): Promise<Stay> {
  const room = rooms.get(TEAM_GUEST.room)!;
  const prior = await ok(
    db.from("reservations").select("id, guest_id, access_token, access_code").eq("hotel_id", hotelId).eq("booking_ref", TEAM_GUEST.bookingRef).maybeSingle(),
    "load stay",
  );
  const guestFields = { hotel_id: hotelId, title: null, first_name: TEAM_GUEST.first, last_name: TEAM_GUEST.last, phone: null, email: null };
  let guestId = prior?.guest_id as string | undefined;
  if (guestId) {
    await ok(db.from("guests").update(guestFields).eq("id", guestId), "update guest");
  } else {
    const g = await one(db.from("guests").insert(guestFields).select("id").single(), "insert guest");
    guestId = g.id as string;
  }

  const checkOut = lagosDate(now, 1);
  const nights = 2;
  const reservation = {
    hotel_id: hotelId,
    guest_id: guestId,
    room_id: room.id,
    booking_ref: TEAM_GUEST.bookingRef,
    check_in: lagosDate(now, -1),
    check_out: checkOut,
    adults: 1,
    status: "checked_in",
    access_token: (prior?.access_token as string | null) ?? token(),
    access_code: (prior?.access_code as string | null) ?? accessCode(),
    access_expires_at: `${checkOut}T11:00:00.000Z`,
    access_revoked_at: null,
    payment_status: "unpaid",
    balance: room.rate * nights,
  };
  let id = prior?.id as string | undefined;
  if (id) {
    await ok(db.from("reservations").update(reservation).eq("id", id), "update stay");
  } else {
    const r = await one(db.from("reservations").insert(reservation).select("id").single(), "insert stay");
    id = r.id as string;
  }
  return { id, guest_id: guestId, first_name: TEAM_GUEST.first, access_token: reservation.access_token };
}

// ---------------------------------------------------------------------------

/**
 * The two requests the team saw on 13 Nov: the receptionist opened our room
 * door, and the porter served food in the lounge. Times are approximate.
 */
async function rebuildRequests(
  db: SupabaseClient,
  hotelId: string,
  rooms: Map<string, RoomRow>,
  stay: Stay,
  staff: StaffRow[],
  now: number,
): Promise<number> {
  await ok(db.from("requests").delete().eq("hotel_id", hotelId), "clear requests");

  const receptionist = staff.find((s) => s.email.startsWith("receptionist@"))!;
  const porter = staff.find((s) => s.email.startsWith("porter@"))!;
  const day = lagosDate(now, -1);

  const real = [
    {
      code: "NX-1001",
      room: TEAM_GUEST.room,
      service: "door-lock",
      title: "Open the room door",
      department: "front_desk",
      priority: "high",
      who: receptionist,
      createdAt: lagosTime(day, "15:10"),
      minutes: { assign: 1, start: 2, done: 8 },
    },
    {
      code: "NX-1002",
      room: "Villa 24 Lounge",
      service: "food-order",
      title: "Serve food in the lounge",
      department: "food",
      priority: "normal",
      who: porter,
      createdAt: lagosTime(day, "19:30"),
      minutes: { assign: 1, start: 3, done: 20 },
    },
  ];

  for (const r of real) {
    const id = randomUUID();
    const assignedAt = r.createdAt + r.minutes.assign * MIN;
    const startedAt = r.createdAt + r.minutes.start * MIN;
    const completedAt = r.createdAt + r.minutes.done * MIN;
    await ok(
      db.from("requests").insert({
        id,
        code: r.code,
        hotel_id: hotelId,
        reservation_id: stay.id,
        room_id: rooms.get(r.room)!.id,
        guest_id: stay.guest_id,
        service_id: r.service,
        title: r.title,
        quantity: 1,
        note: null,
        priority: r.priority,
        status: "completed",
        department_id: r.department,
        assignee_id: r.who.id,
        source: "front_desk",
        due_at: iso(r.createdAt + 30 * MIN),
        created_at: iso(r.createdAt),
        assigned_at: iso(assignedAt),
        started_at: iso(startedAt),
        completed_at: iso(completedAt),
        updated_at: iso(completedAt),
        amount_minor: 0,
        payment_status: "not_required",
      }),
      `insert ${r.code}`,
    );
    const ev = (at: number, kind: string, actorType: string, message: string, from: string | null, to: string | null) => ({
      request_id: id,
      hotel_id: hotelId,
      kind,
      from_status: from,
      to_status: to,
      actor_type: actorType,
      actor_id: r.who.id,
      actor_name: r.who.full_name,
      message,
      created_at: iso(at),
    });
    await ok(
      db.from("request_events").insert([
        ev(r.createdAt, "created", "staff", `${stay.first_name} asked ${r.who.full_name.toLowerCase()} in person`, null, "pending"),
        ev(assignedAt, "assigned", "staff", `${r.who.full_name} took it`, "pending", "assigned"),
        ev(startedAt, "started", "staff", `${r.who.full_name} started`, "assigned", "in_progress"),
        ev(completedAt, "completed", "staff", `${r.who.full_name} completed it`, "in_progress", "completed"),
      ]),
      `events for ${r.code}`,
    );
  }
  return real.length;
}
