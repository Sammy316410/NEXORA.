// Demo data for Amber Coast Hotel. Idempotent: safe to run again at any time.
// Used by `npm run db:seed` and by the "Reset demo" button.
//
// Reset keeps hotel, rooms, staff accounts and guest access links (so printed
// QR codes keep working) and rebuilds every request, relative to "now", so the
// demo always looks like a live afternoon at the hotel.
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  DEPARTMENTS,
  DOWN_NOTES,
  HISTORY_MIX,
  HOTEL,
  MENU,
  NAMED_GUESTS,
  OTHER_GUESTS,
  ROOM_OVERRIDES,
  ROOM_TYPES,
  SERVICES,
  STAFF,
} from "./catalog";
import { syncReservationBalance } from "../payments/folio";
import { fmtMinor } from "../format";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const LAGOS_OFFSET_MS = 60 * MIN; // Africa/Lagos is UTC+1, no daylight saving

type Log = (message: string) => void;

export interface SeedResult {
  hotelId: string;
  davidToken: string | null;
  staff: number;
  rooms: number;
  reservations: number;
  requests: number;
}

// Small deterministic PRNG so every reset produces the same-looking history.
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lagosDate(now: number, offsetDays = 0): string {
  return new Date(now + LAGOS_OFFSET_MS + offsetDays * DAY).toISOString().slice(0, 10);
}

function lagosDayStart(date: string): number {
  return Date.parse(`${date}T00:00:00+01:00`);
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

async function inChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

// ---------------------------------------------------------------------------

export async function seedDemo(db: SupabaseClient, opts: { password: string; log?: Log; now?: number }): Promise<SeedResult> {
  const log = opts.log ?? (() => {});
  seededPayments = 0;
  const now = opts.now ?? Date.now();

  const hotel = await one(
    db.from("hotels").upsert(HOTEL, { onConflict: "slug" }).select("id").single(),
    "hotel",
  );
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
  log(`Menu items: ${MENU.length}`);

  const rooms = await seedRooms(db, hotelId, now);
  log(`Rooms: ${rooms.size}`);

  const staff = await seedStaff(db, hotelId, opts.password);
  log(`Staff accounts: ${staff.length} (password from DEMO_STAFF_PASSWORD)`);

  const stays = await seedReservations(db, hotelId, rooms, now);
  log(`Reservations: ${stays.size}`);

  // Payments are rebuilt with the requests: clear every attempt and the sandbox ledger.
  await ok(db.from("payments").delete().eq("hotel_id", hotelId), "clear payments");
  await db.from("sandbox_transactions").delete().neq("reference", "");
  const deposits = await seedDeposits(db, hotelId, stays);
  log(`Booking deposits: ${deposits}`);

  const requests = await rebuildRequests(db, hotelId, rooms, stays, staff, now);
  log(`Requests: ${requests} (rebuilt relative to now)`);

  // Fatima (208) leaves today and settled the rest of her bill from her phone this morning.
  const fatima = stays.get("208");
  const folio = fatima ? await syncReservationBalance(db, fatima.id) : null;
  if (fatima && folio && folio.balanceMinor > 0) {
    await seedSandboxPayment(db, hotelId, {
      stay: fatima,
      purpose: "bill",
      amountMinor: folio.balanceMinor,
      at: now - 55 * MIN,
      status: "succeeded",
      channel: "bank_transfer",
      description: `Bill for Room ${fatima.room_number}`,
    });
  }

  for (const stay of stays.values()) await syncReservationBalance(db, stay.id);
  log("Bills recomputed for every stay");

  await ok(db.rpc("nexora_restart_request_codes"), "restart request codes");
  await db.from("access_attempts").delete().gte("id", 0);
  await db.from("workpeg_links").delete().eq("entity", "request");

  return {
    hotelId,
    davidToken: stays.get("204")?.access_token ?? null,
    staff: staff.length,
    rooms: rooms.size,
    reservations: stays.size,
    requests,
  };
}

// ---------------------------------------------------------------------------

interface RoomRow {
  id: string;
  number: string;
  status: string;
  rate: number;
}

async function seedRooms(db: SupabaseClient, hotelId: string, now: number): Promise<Map<string, RoomRow>> {
  const rows = [];
  for (let floor = 1; floor <= 4; floor++) {
    for (let n = 1; n <= 12; n++) {
      const number = `${floor}${String(n).padStart(2, "0")}`;
      const type = ROOM_TYPES.find((t) => n <= t.upTo)!;
      const override = ROOM_OVERRIDES[number];
      rows.push({
        hotel_id: hotelId,
        number,
        floor,
        room_type: type.type,
        rate: type.rate,
        status: override?.status ?? "occupied",
        status_note: override?.note ?? null,
        landmark: n <= 4 ? "near the lift" : n <= 8 ? "middle of the corridor" : "end of the corridor",
        updated_at: iso(now),
      });
    }
  }
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
  last_name: string;
  email: string;
  room_number: string;
  booking_ref: string;
  check_in: string;
  access_token: string | null;
  /** Paid when the room was booked (kobo). */
  deposit_minor: number;
}

async function seedReservations(
  db: SupabaseClient,
  hotelId: string,
  rooms: Map<string, RoomRow>,
  now: number,
): Promise<Map<string, Stay>> {
  const existing = await ok(
    db.from("reservations").select("id, booking_ref, guest_id, access_token, access_code").eq("hotel_id", hotelId),
    "load reservations",
  );
  const byRef = new Map(
    (existing as { id: string; booking_ref: string; guest_id: string; access_token: string | null; access_code: string | null }[]).map(
      (r) => [r.booking_ref, r],
    ),
  );

  // Who is where: 36 occupied rooms (6 named guests + 30 others) and 5 arrivals.
  const others = [...OTHER_GUESTS];
  const plan: {
    room: string;
    title: string | null;
    first: string;
    last: string;
    before: number;
    after: number;
    status: "checked_in" | "confirmed";
  }[] = [];
  let generated = 0;
  for (const room of [...rooms.values()].sort((a, b) => a.number.localeCompare(b.number))) {
    if (room.status !== "occupied") continue;
    const named = NAMED_GUESTS[room.number];
    if (named) {
      plan.push({ room: room.number, title: named.title, first: named.first, last: named.last, before: named.nightsBefore, after: named.nightsAfter, status: "checked_in" });
    } else {
      const [first, last] = others.shift()!;
      const departsToday = generated % 5 === 0 && generated < 30;
      plan.push({ room: room.number, title: null, first, last, before: generated % 3, after: departsToday ? 0 : 1 + (generated % 4), status: "checked_in" });
      generated++;
    }
  }
  for (const room of ["103", "106", "110", "202", "212"]) {
    const [first, last] = others.shift()!;
    plan.push({ room, title: null, first, last, before: 0, after: 2, status: "confirmed" });
  }

  const stays = new Map<string, Stay>();
  for (const [i, p] of plan.entries()) {
    const room = rooms.get(p.room)!;
    const bookingRef = `AC-2${p.room}`;
    const checkIn = lagosDate(now, -p.before);
    const checkOut = lagosDate(now, p.after);
    const nights = Math.max(1, p.before + p.after);
    const payment = i % 7 === 0 ? "unpaid" : i % 4 === 0 ? "part_paid" : "paid";
    const total = room.rate * nights;
    const balance = payment === "paid" ? 0 : payment === "part_paid" ? Math.round(total / 2) : total;
    const depositMinor = (total - balance) * 100;
    const prior = byRef.get(bookingRef);

    const guestFields = { hotel_id: hotelId, title: p.title, first_name: p.first, last_name: p.last, phone: `+234 80${String(1000000 + i * 7919).slice(0, 8)}`, email: `${p.first}.${p.last}@example.com`.toLowerCase() };
    let guestId = prior?.guest_id;
    if (guestId) {
      await ok(db.from("guests").update(guestFields).eq("id", guestId), "update guest");
    } else {
      const g = await one(db.from("guests").insert(guestFields).select("id").single(), "insert guest");
      guestId = g.id as string;
    }

    const checkedIn = p.status === "checked_in";
    const accessToken = checkedIn ? prior?.access_token ?? token() : null;
    const reservation = {
      hotel_id: hotelId,
      guest_id: guestId,
      room_id: room.id,
      booking_ref: bookingRef,
      check_in: checkIn,
      check_out: checkOut,
      adults: 1 + (i % 2),
      status: p.status,
      access_token: accessToken,
      access_code: checkedIn ? prior?.access_code ?? accessCode() : null,
      access_expires_at: checkedIn ? `${checkOut}T11:00:00.000Z` : null,
      access_revoked_at: null,
      payment_status: payment,
      balance,
    };
    let reservationId = prior?.id;
    if (reservationId) {
      await ok(db.from("reservations").update(reservation).eq("id", reservationId), "update reservation");
    } else {
      const r = await one(db.from("reservations").insert(reservation).select("id").single(), "insert reservation");
      reservationId = r.id as string;
    }
    stays.set(p.room, {
      id: reservationId,
      guest_id: guestId,
      first_name: p.first,
      last_name: p.last,
      email: guestFields.email,
      room_number: p.room,
      booking_ref: bookingRef,
      check_in: checkIn,
      access_token: accessToken,
      deposit_minor: depositMinor,
    });
  }
  return stays;
}

// ---------------------------------------------------------------------------
// Payments. Seeded rows look exactly like the ones the app writes itself.

/** Room money taken when the booking was made, recorded by the front desk. */
async function seedDeposits(db: SupabaseClient, hotelId: string, stays: Map<string, Stay>): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  let i = 0;
  for (const s of stays.values()) {
    if (s.deposit_minor <= 0) continue;
    const card = i % 3 !== 2;
    const paidAt = lagosDayStart(s.check_in) - (2 + (i % 9)) * DAY + (9 * 60 + ((i * 37) % 600)) * MIN;
    rows.push({
      hotel_id: hotelId,
      reservation_id: s.id,
      purpose: "deposit",
      provider: "front_desk",
      mode: "test",
      reference: `NXP-DEP-${s.booking_ref}`,
      provider_reference: s.booking_ref,
      amount_minor: s.deposit_minor,
      currency: "NGN",
      status: "succeeded",
      channel: card ? "card" : "bank_transfer",
      card_brand: card ? (i % 2 ? "mastercard" : "visa") : null,
      card_last4: card ? String(1000 + ((i * 7919) % 9000)) : null,
      payer_email: s.email,
      paid_at: iso(paidAt),
      created_at: iso(paidAt),
      updated_at: iso(paidAt),
    });
    i++;
  }
  if (rows.length) await ok(db.from("payments").insert(rows), "insert deposits");
  return rows.length;
}

let seededPayments = 0;

/** A guest-portal payment through the sandbox gateway, plus the gateway's own ledger row. */
async function seedSandboxPayment(
  db: SupabaseClient,
  hotelId: string,
  p: {
    stay: Stay;
    purpose: "order" | "bill";
    requestId?: string;
    amountMinor: number;
    at: number;
    status: "succeeded" | "failed";
    channel: "card" | "bank_transfer";
    card?: { brand: string; last4: string };
    failure?: string;
    description: string;
  },
) {
  seededPayments++;
  const reference = `NXP-${p.at.toString(36).toUpperCase()}-SEED${String(seededPayments).padStart(2, "0")}`;
  const paid = p.status === "succeeded";
  await ok(
    db.from("sandbox_transactions").insert({
      reference,
      merchant: HOTEL.name,
      description: p.description,
      email: p.stay.email,
      amount_minor: p.amountMinor,
      currency: "NGN",
      callback_url: `${process.env.APP_URL ?? "http://localhost:3000"}/pay/return`,
      status: paid ? "success" : "failed",
      channel: p.channel,
      card_brand: p.card?.brand ?? null,
      card_last4: p.card?.last4 ?? null,
      gateway_response: paid ? "Approved" : (p.failure ?? "Declined"),
      paid_at: paid ? iso(p.at) : null,
      created_at: iso(p.at - 40_000),
    }),
    "sandbox ledger",
  );
  await ok(
    db.from("payments").insert({
      hotel_id: hotelId,
      reservation_id: p.stay.id,
      request_id: p.requestId ?? null,
      purpose: p.purpose,
      provider: "sandbox",
      mode: "test",
      reference,
      provider_reference: `SBX-${reference}`,
      amount_minor: p.amountMinor,
      currency: "NGN",
      status: p.status,
      failure_reason: paid ? null : (p.failure ?? "Declined"),
      channel: p.channel,
      card_brand: p.card?.brand ?? null,
      card_last4: p.card?.last4 ?? null,
      payer_email: p.stay.email,
      paid_at: paid ? iso(p.at) : null,
      created_at: iso(p.at - 40_000),
      updated_at: iso(p.at),
    }),
    "payment",
  );
}

// ---------------------------------------------------------------------------

type ServiceDef = (typeof SERVICES)[number];

interface PlannedRequest {
  code: string;
  room: string;
  service: string;
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  createdAt: number;
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  dueAt: number;
  assignee?: StaffRow;
  claimed?: boolean;
  priority?: string;
  quantity?: number;
  note?: string | null;
  source?: "guest_portal" | "phone" | "front_desk";
  ai?: { confidence: "high" | "medium" | "low"; engine: string };
  feedback?: "up" | "down";
  feedbackNote?: string;
  /** A menu order paid through the sandbox: [menu item id, quantity]; optionally declined once first. */
  order?: { items: [string, number][]; declinedFirst?: boolean };
}

async function rebuildRequests(
  db: SupabaseClient,
  hotelId: string,
  rooms: Map<string, RoomRow>,
  stays: Map<string, Stay>,
  staff: StaffRow[],
  now: number,
): Promise<number> {
  await ok(db.from("requests").delete().eq("hotel_id", hotelId), "clear requests");

  const services = new Map(SERVICES.map((s) => [s.id, s]));
  const person = (first: string) => staff.find((s) => s.full_name.startsWith(first))!;
  const grace = person("Grace");
  const onDutyIn = (dept: string) => staff.filter((s) => s.department_id === dept && s.on_duty && s.role === "staff");
  const dueFor = (svc: ServiceDef, created: number, priority: string) =>
    created + (priority === "urgent" ? Math.min(svc.resolution_target_min, 30) : svc.resolution_target_min) * MIN;
  const ago = (minutes: number) => now - minutes * MIN;

  const plan: PlannedRequest[] = [];

  // Today's live board (the brief's sample, minus the hero request NX-1042,
  // which the demo creates live).
  const live: Omit<PlannedRequest, "dueAt">[] = [
    { code: "NX-1041", room: "401", service: "leak", status: "in_progress", priority: "urgent", note: "Water leaking under the bathroom sink", source: "phone", assignee: person("Tunde"), createdAt: ago(49), assignedAt: ago(46), startedAt: ago(40) },
    { code: "NX-1040", room: "208", service: "late-checkout", status: "pending", note: "Until 2 pm, please", createdAt: ago(3) },
    { code: "NX-1039", room: "305", service: "food-order", status: "in_progress", note: "No onions in the sandwich, please", order: { items: [["club-sandwich", 1], ["bottled-water", 2]], declinedFirst: true }, assignee: person("Chidi"), createdAt: ago(18), assignedAt: ago(15), startedAt: ago(10) },
    { code: "NX-1038", room: "112", service: "room-cleaning", status: "pending", createdAt: ago(7) },
    { code: "NX-1037", room: "310", service: "ac-cooling", status: "assigned", note: "AC not cooling", ai: { confidence: "high", engine: "rules" }, assignee: person("Tunde"), createdAt: ago(12), assignedAt: ago(9) },
    { code: "NX-1036", room: "204", service: "toiletries", status: "completed", assignee: person("Ibrahim"), createdAt: ago(150), assignedAt: ago(147), startedAt: ago(142), completedAt: ago(137), feedback: "up" },
    { code: "NX-1035", room: "302", service: "extra-pillows", status: "pending", quantity: 2, createdAt: ago(2) },
    { code: "NX-1034", room: "410", service: "tv-wifi", status: "pending", note: "TV remote not working", createdAt: ago(1) },
    { code: "NX-1033", room: "211", service: "change-linen", status: "assigned", assignee: person("Bisi"), createdAt: ago(40), assignedAt: ago(35) },
  ];
  for (const r of live) {
    const svc = services.get(r.service)!;
    plan.push({ ...r, dueAt: dueFor(svc, r.createdAt, r.priority ?? svc.default_priority) });
  }

  // Generated history: earlier today and the previous six days.
  const rand = prng(20261113);
  const occupied = [...stays.values()].filter((s) => s.access_token && !NAMED_GUESTS[s.room_number]).map((s) => s.room_number);
  const totalWeight = HISTORY_MIX.reduce((a, [, w]) => a + w, 0);
  const pickService = () => {
    let x = rand() * totalWeight;
    for (const [id, w] of HISTORY_MIX) {
      x -= w;
      if (x <= 0) return id;
    }
    return HISTORY_MIX[0][0];
  };
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const completed = (code: string, createdAt: number, serviceId: string, room: string, maxSpanMin: number) => {
    const svc = services.get(serviceId)!;
    const team = onDutyIn(svc.department_id);
    const assignee = svc.department_id === "front_desk" ? grace : team[Math.floor(rand() * team.length)] ?? grace;
    const assign = between(1, 7);
    const startDelay = between(2, 9);
    const workRange = svc.category === "maintenance" ? [12, 40] : svc.category === "food" ? [10, 25] : [4, 14];
    let work = between(workRange[0], workRange[1]);
    work = Math.max(2, Math.min(work, maxSpanMin - assign - startDelay - 1));
    const roll = rand();
    const cancelled = roll > 0.97;
    const fb = rand();
    const p: PlannedRequest = {
      code,
      room,
      service: serviceId,
      status: cancelled ? "cancelled" : "completed",
      createdAt,
      dueAt: dueFor(svc, createdAt, svc.default_priority),
      source: rand() < 0.12 ? "phone" : "guest_portal",
      quantity: svc.has_quantity ? between(1, 2) : 1,
    };
    if (cancelled) {
      p.cancelledAt = createdAt + 3 * MIN;
      return p;
    }
    p.assignee = assignee;
    p.claimed = rand() < 0.3 && assignee.role === "staff";
    p.assignedAt = createdAt + assign * MIN;
    p.startedAt = p.assignedAt + startDelay * MIN;
    p.completedAt = p.startedAt + work * MIN;
    if (fb < 0.62) p.feedback = "up";
    else if (fb < 0.67) {
      p.feedback = "down";
      p.feedbackNote = DOWN_NOTES[Math.floor(rand() * DOWN_NOTES.length)];
    }
    return p;
  };

  // Earlier today: NX-1000 to NX-1032.
  for (let i = 0; i <= 32; i++) {
    const createdAgo = 45 + i * 19;
    plan.push(completed(`NX-${1000 + i}`, ago(createdAgo), pickService(), occupied[i % occupied.length], createdAgo));
  }

  // Previous six days: NX-999 downwards.
  let code = 999;
  for (let d = 1; d <= 6; d++) {
    const dayStart = lagosDayStart(lagosDate(now, -d));
    const count = 18 + Math.floor(rand() * 9);
    for (let i = 0; i < count; i++) {
      const created = dayStart + (6 * 60 + Math.floor(rand() * 16 * 60)) * MIN;
      plan.push(completed(`NX-${code--}`, created, pickService(), occupied[Math.floor(rand() * occupied.length)], 180));
    }
  }
  // A repeat fault for Insights: room 307's AC keeps failing.
  for (const daysAgo of [1, 3]) {
    const created = lagosDayStart(lagosDate(now, -daysAgo)) + 15 * 60 * MIN;
    plan.push(completed(`NX-${code--}`, created, "ac-cooling", "307", 180));
  }
  plan.push(completed(`NX-${code--}`, ago(95), "ac-cooling", "307", 95));

  // Materialise rows and history events.
  const menu = new Map<string, (typeof MENU)[number]>(MENU.map((m) => [m.id, m]));
  const requestRows: Record<string, unknown>[] = [];
  const eventRows: Record<string, unknown>[] = [];
  const itemRows: Record<string, unknown>[] = [];
  const orderPayments: { p: PlannedRequest; id: string; stay: Stay; amountMinor: number; title: string }[] = [];
  for (const p of plan) {
    const svc = services.get(p.service)!;
    const stay = stays.get(p.room);
    const room = rooms.get(p.room)!;
    const id = randomUUID();
    const qty = p.quantity ?? 1;
    let title: string = svc.has_quantity && qty > 1 ? `${svc.name} × ${qty}` : svc.name;
    let amountMinor = 0;
    if (p.order) {
      const lines = p.order.items.map(([itemId, quantity]) => {
        const m = menu.get(itemId)!;
        return { request_id: id, menu_item_id: m.id, name: m.name, unit_price_minor: m.price * 100, quantity };
      });
      itemRows.push(...lines);
      amountMinor = lines.reduce((a, l) => a + l.unit_price_minor * l.quantity, 0);
      const [firstLine, ...rest] = lines;
      title = `${firstLine.name}${firstLine.quantity > 1 ? ` × ${firstLine.quantity}` : ""}${rest.length ? ` + ${rest.length} more` : ""}`;
      if (stay) orderPayments.push({ p, id, stay, amountMinor, title });
    }
    const priority = p.priority ?? svc.default_priority;
    const last = p.completedAt ?? p.cancelledAt ?? p.startedAt ?? p.assignedAt ?? p.createdAt;
    requestRows.push({
      id,
      code: p.code,
      hotel_id: hotelId,
      reservation_id: stay?.id ?? null,
      room_id: room.id,
      guest_id: stay?.guest_id ?? null,
      service_id: svc.id,
      title,
      quantity: qty,
      note: p.note ?? null,
      priority,
      status: p.status,
      department_id: svc.department_id,
      assignee_id: p.assignee?.id ?? null,
      source: p.source ?? "guest_portal",
      ai_suggested: Boolean(p.ai),
      ai_confidence: p.ai?.confidence ?? null,
      ai_engine: p.ai?.engine ?? null,
      due_at: iso(p.dueAt),
      created_at: iso(p.createdAt),
      assigned_at: p.assignedAt ? iso(p.assignedAt) : null,
      started_at: p.startedAt ? iso(p.startedAt) : null,
      completed_at: p.completedAt ? iso(p.completedAt) : null,
      cancelled_at: p.cancelledAt ? iso(p.cancelledAt) : null,
      guest_feedback: p.feedback ?? null,
      feedback_note: p.feedbackNote ?? null,
      feedback_at: p.feedback && p.completedAt ? iso(p.completedAt + 4 * MIN) : null,
      follow_up: p.feedback === "down",
      follow_up_note: p.feedback === "down" ? p.feedbackNote ?? null : null,
      updated_at: iso(p.feedback && p.completedAt ? p.completedAt + 4 * MIN : last),
      amount_minor: amountMinor,
      payment_status: p.order ? "paid" : "not_required",
    });

    const guestName = stay?.first_name ?? "Guest";
    const ev = (at: number, kind: string, actorType: string, actorName: string, message: string, actorId: string | null = null, from: string | null = null, to: string | null = null) =>
      eventRows.push({ request_id: id, hotel_id: hotelId, kind, from_status: from, to_status: to, actor_type: actorType, actor_id: actorId, actor_name: actorName, message, created_at: iso(at) });

    if (p.order) {
      const money = fmtMinor(amountMinor);
      ev(p.createdAt, "created", "guest", guestName, `${guestName} placed an order (${money}), awaiting payment`, null, null, "awaiting_payment");
      if (p.order.declinedFirst) {
        ev(p.createdAt + 45_000, "payment_failed", "system", "Payments", "Payment didn't go through: Declined by the card issuer");
      }
      ev(p.createdAt + 90_000, "payment", "system", "Payments", `Payment received: ${money} (Visa ••4081, sandbox). Sent to Food and drinks`, null, "awaiting_payment", "pending");
    } else if (p.source === "phone") {
      ev(p.createdAt, "created", "manager", grace.full_name, "Logged by Grace (phone call)", grace.id, null, "pending");
    } else {
      ev(p.createdAt, "created", "guest", guestName, `${guestName} sent the request from the guest portal`, null, null, "pending");
    }
    if (p.ai) {
      ev(p.createdAt + 1000, "ai_suggested", "nexora_ai", "NEXORA AI", `Sorted as ${svc.name} → Maintenance (${p.ai.confidence} confidence, keyword rules)`);
    }
    const first = p.assignee?.full_name.split(" ")[0];
    if (p.assignee && p.assignedAt) {
      if (p.claimed) {
        ev(p.assignedAt, "assigned", "staff", p.assignee.full_name, `${first} claimed it from the open pool`, p.assignee.id, "pending", "assigned");
      } else {
        ev(p.assignedAt, "assigned", "manager", grace.full_name, `Assigned to ${first} by Grace`, grace.id, "pending", "assigned");
      }
    }
    if (p.assignee && p.startedAt) {
      ev(p.startedAt, "started", "staff", p.assignee.full_name, `${first} started the task`, p.assignee.id, "assigned", "in_progress");
    }
    if (p.assignee && p.completedAt) {
      ev(p.completedAt, "completed", "staff", p.assignee.full_name, `${first} completed the task`, p.assignee.id, "in_progress", "completed");
    }
    if (p.cancelledAt) {
      ev(p.cancelledAt, "cancelled", "guest", guestName, `${guestName} cancelled the request`, null, "pending", "cancelled");
    }
    if (p.feedback && p.completedAt) {
      ev(
        p.completedAt + 4 * MIN,
        "feedback",
        "guest",
        guestName,
        p.feedback === "up" ? "Guest: thumbs up" : `Guest says it wasn't resolved: “${p.feedbackNote}”. Duty manager alerted.`,
      );
    }
  }

  await inChunks(requestRows, 100, (chunk) => ok(db.from("requests").insert(chunk), "insert requests"));
  await inChunks(eventRows, 300, (chunk) => ok(db.from("request_events").insert(chunk), "insert events"));
  if (itemRows.length) await ok(db.from("request_items").insert(itemRows), "insert order items");
  for (const o of orderPayments) {
    const base = {
      stay: o.stay,
      purpose: "order" as const,
      requestId: o.id,
      amountMinor: o.amountMinor,
      channel: "card" as const,
      description: `Room ${o.stay.room_number} · ${o.title}`,
    };
    if (o.p.order?.declinedFirst) {
      await seedSandboxPayment(db, hotelId, {
        ...base,
        at: o.p.createdAt + 45_000,
        status: "failed",
        card: { brand: "visa", last4: "0002" },
        failure: "Declined by the card issuer",
      });
    }
    await seedSandboxPayment(db, hotelId, { ...base, at: o.p.createdAt + 90_000, status: "succeeded", card: { brand: "visa", last4: "4081" } });
  }
  return requestRows.length;
}
