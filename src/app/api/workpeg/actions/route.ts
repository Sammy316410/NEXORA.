import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { getHotel, listRooms, listServices, listStaff, setRoomStatus, findRoomByNumber } from "@/lib/hotel";
import {
  assignRequest,
  cancelRequest,
  completeRequest,
  createRequest,
  EngineError,
  getEvents,
  getRequestByCode,
  listRequests,
  startRequest,
} from "@/lib/requests";
import { classifyRequest } from "@/lib/ai";
import { getInsights, getOverview } from "@/lib/stats";
import { shiftSummary } from "@/lib/ai/summary";
import { logIntegration, workpegConfig } from "@/lib/workpeg";
import { DEPARTMENT_LABEL, PRIORITY_LABEL, ROOM_STATUS_LABEL, STATUS_LABEL } from "@/lib/labels";
import { dueState, OPEN_STATUSES, waitingMinutes } from "@/lib/sla";
import { firstName, fmtTime, minutesBetween } from "@/lib/format";
import type { Actor, Hotel, RequestView, RoomStatus, Staff } from "@/lib/types";

// The bridge that lets Workpeg AI act on NEXORA. The NEXORA peg's function
// (workpeg/function) forwards each manifest action here with a shared secret.
//
// Workpeg does not tell the function which action was called, so the action name
// arrives as a parameter the model fills in. The bridge therefore authorises
// every write itself, from the Workpeg user's email.

const READS = new Set(["list_open_requests", "get_request", "list_rooms", "list_staff", "shift_summary"]);
const WRITES = new Set(["assign_request", "update_request_status", "create_request", "set_room_status"]);

class BridgeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function secretMatches(header: string | null, secret: string): boolean {
  const given = Buffer.from((header ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function summarize(r: RequestView, tz: string) {
  const now = Date.now();
  const due = dueState(r, now);
  const wait = waitingMinutes(r, now);
  return {
    code: r.code,
    room: r.room?.number,
    request: r.title,
    note: r.note,
    status: STATUS_LABEL[r.status],
    priority: PRIORITY_LABEL[r.priority],
    department: DEPARTMENT_LABEL[r.department_id] ?? r.department_id,
    assignee: r.assignee?.full_name ?? null,
    sent: fmtTime(r.created_at, tz),
    age_minutes: minutesBetween(r.created_at, now),
    due: due.label || null,
    flags: [due.kind === "overdue" ? "overdue" : null, wait !== null ? `waiting ${wait} min for an owner` : null].filter(Boolean),
  };
}

async function resolveActor(hotel: Hotel, staff: Staff[], actor: { email?: unknown; name?: unknown } | undefined): Promise<Staff | null> {
  const email = str(actor?.email).toLowerCase();
  if (email) {
    const match = staff.find((s) => s.email.toLowerCase() === email);
    if (match) return match;
  }
  // Demo: Workpeg accounts won't match the seeded @ambercoast.demo emails, so act
  // for a named stand-in (NEXORA_BRIDGE_DEFAULT_ACTOR, default the front desk lead).
  if (process.env.NEXORA_DEMO_MODE === "true") {
    const fallback = (process.env.NEXORA_BRIDGE_DEFAULT_ACTOR ?? "grace@ambercoast.demo").toLowerCase();
    return staff.find((s) => s.email.toLowerCase() === fallback) ?? null;
  }
  return null;
}

function findStaffByName(staff: Staff[], name: string): Staff {
  const q = name.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = staff.filter((s) => s.full_name.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const partial = staff.filter((s) => s.full_name.toLowerCase().split(" ").some((part) => part === q) || s.full_name.toLowerCase().startsWith(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) throw new BridgeError(`"${name}" matches ${partial.map((s) => s.full_name).join(", ")}. Use the full name.`);
  throw new BridgeError(`No staff member called "${name}". On duty: ${staff.filter((s) => s.on_duty).map((s) => s.full_name).join(", ")}.`);
}

async function run(action: string, params: Record<string, unknown>, hotel: Hotel, staff: Staff[], who: Staff | null) {
  const actor: Actor | null = who ? { type: "workpeg_ai", id: who.id, name: who.full_name } : null;
  const needWriter = () => {
    if (!actor || !who) throw new BridgeError("I couldn't match your Workpeg account to a NEXORA staff member, so I can't change anything.", 403);
    return { actor, who };
  };
  const requestFor = async (code: unknown) => {
    const req = await getRequestByCode(str(code), hotel.id);
    if (!req) throw new BridgeError(`No request ${str(code) || "(no code given)"}.`, 404);
    return req;
  };

  switch (action) {
    case "list_open_requests": {
      const dept = str(params.department);
      const status = str(params.status);
      let rows = await listRequests({ hotelId: hotel.id, statuses: OPEN_STATUSES, limit: 200 });
      if (dept) rows = rows.filter((r) => r.department_id === dept);
      if (status) rows = rows.filter((r) => r.status === status);
      return { count: rows.length, requests: rows.slice(0, 50).map((r) => summarize(r, hotel.timezone)) };
    }
    case "get_request": {
      const req = await requestFor(params.code);
      const events = await getEvents(req.id);
      return {
        ...summarize(req, hotel.timezone),
        guest: req.guest?.first_name ?? null,
        history: events.slice(-12).map((e) => `${fmtTime(e.created_at, hotel.timezone)} ${e.message}`),
      };
    }
    case "list_rooms": {
      const status = str(params.status) as RoomStatus | "";
      const rooms = (await listRooms(hotel)).filter((r) => !status || r.status === status);
      return {
        count: rooms.length,
        rooms: rooms.map((r) => ({
          room: r.number,
          type: r.room_type,
          status: ROOM_STATUS_LABEL[r.status],
          note: r.status_note,
          guest: r.stay?.status === "checked_in" ? r.stay.guest : null,
          open_requests: r.openRequests,
          departing_today: r.departingToday,
          arriving_today: r.arrivingToday,
        })),
      };
    }
    case "list_staff": {
      const dept = str(params.department);
      const open = await listRequests({ hotelId: hotel.id, statuses: OPEN_STATUSES, limit: 300 });
      return {
        staff: staff
          .filter((s) => (!dept || s.department_id === dept) && (typeof params.on_duty !== "boolean" || s.on_duty === params.on_duty))
          .map((s) => ({
            name: s.full_name,
            role: s.job_title,
            department: s.department_id ? DEPARTMENT_LABEL[s.department_id] : null,
            on_duty: s.on_duty,
            open_tasks: open.filter((r) => r.assignee_id === s.id).length,
          })),
      };
    }
    case "shift_summary": {
      const [overview, insights] = await Promise.all([getOverview(hotel, staff), getInsights(hotel)]);
      const summary = await shiftSummary(hotel, overview, insights);
      return {
        open: overview.open,
        overdue: overview.overdue,
        waiting_for_owner: overview.waiting,
        completed_today: overview.completedToday,
        avg_response_today_min: overview.avgResponseToday,
        staff_on_duty: `${overview.staffOnDuty} of ${overview.staffTotal}`,
        needs_attention: overview.needsAttention.map((a) => ({ ...summarize(a.request, hotel.timezone), reason: a.label })),
        summary: summary.lines,
        summary_source: summary.engine === "claude" ? "AI-generated from these numbers" : "rule-based summary of these numbers",
      };
    }
    case "assign_request": {
      const { actor: a } = needWriter();
      const req = await requestFor(params.code);
      const target = findStaffByName(staff, str(params.staff_name));
      const updated = await assignRequest(req.id, target.id, a);
      return { ok: true, message: `${updated.code} (Room ${updated.room?.number}, ${updated.title}) is assigned to ${target.full_name}.` };
    }
    case "update_request_status": {
      const { actor: a } = needWriter();
      const req = await requestFor(params.code);
      const status = str(params.status);
      const note = str(params.note) || null;
      const updated =
        status === "in_progress"
          ? await startRequest(req.id, a)
          : status === "completed"
            ? await completeRequest(req.id, a, { note })
            : status === "cancelled"
              ? await cancelRequest(req.id, a, note)
              : null;
      if (!updated) throw new BridgeError("status must be in_progress, completed or cancelled.");
      return { ok: true, message: `${updated.code} is now ${STATUS_LABEL[updated.status]}.` };
    }
    case "create_request": {
      const { actor: a } = needWriter();
      const room = await findRoomByNumber(hotel.id, str(params.room));
      if (!room) throw new BridgeError(`There's no room ${str(params.room)}.`, 404);
      const description = str(params.description);
      if (description.length < 3) throw new BridgeError("Describe what the guest needs.");
      const services = await listServices(hotel.id);
      const sorted = await classifyRequest(description, services, hotel.name);
      const first = sorted.items[0];
      const { data: stay } = await db().from("reservations").select("id, guest_id").eq("room_id", room.id).eq("status", "checked_in").maybeSingle();
      const priority = str(params.priority);
      const req = await createRequest({
        hotelId: hotel.id,
        roomId: room.id,
        reservationId: stay?.id ?? null,
        guestId: stay?.guest_id ?? null,
        serviceId: first.serviceId,
        quantity: first.quantity,
        note: first.note ?? description,
        priority: ["low", "normal", "high", "urgent"].includes(priority) ? (priority as RequestView["priority"]) : first.priority ?? undefined,
        source: "workpeg_ai",
        actor: a,
        ai: { confidence: first.confidence, engine: sorted.engine },
      });
      return {
        ok: true,
        message: `Logged ${req.code} for Room ${room.number}: ${req.title}, routed to ${DEPARTMENT_LABEL[req.department_id]} (${PRIORITY_LABEL[req.priority]}).`,
      };
    }
    case "set_room_status": {
      const { actor: a, who: w } = needWriter();
      if (w.role === "staff") throw new BridgeError("Only the front desk or a manager can change room status.", 403);
      const room = await findRoomByNumber(hotel.id, str(params.room));
      if (!room) throw new BridgeError(`There's no room ${str(params.room)}.`, 404);
      const status = str(params.status) as RoomStatus;
      if (!["available", "occupied", "cleaning", "maintenance"].includes(status)) throw new BridgeError("Unknown room status.");
      await setRoomStatus(room.id, status, a, str(params.reason) || null);
      return { ok: true, message: `Room ${room.number} is now ${ROOM_STATUS_LABEL[status]}.` };
    }
    default:
      throw new BridgeError(`Unknown action "${action}".`, 404);
  }
}

export async function POST(request: Request) {
  const cfg = workpegConfig();
  if (!cfg.bridgeSecret) return Response.json({ ok: false, error: "Bridge not configured (NEXORA_BRIDGE_SECRET)." }, { status: 503 });
  if (!secretMatches(request.headers.get("authorization"), cfg.bridgeSecret)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { action?: unknown; params?: unknown; actor?: { email?: unknown; name?: unknown } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }
  const action = str(body.action);
  const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;
  if (!READS.has(action) && !WRITES.has(action)) {
    return Response.json({ ok: false, error: `Unknown action "${action}".` }, { status: 404 });
  }

  const hotel = await getHotel();
  const staff = await listStaff(hotel.id);
  const who = await resolveActor(hotel, staff, body.actor);
  const forWhom = who ? `, for ${firstName(who.full_name)}` : "";

  try {
    const result = await run(action, params, hotel, staff, who);
    const target = str(params.code) || str(params.room);
    await logIntegration(hotel.id, `Workpeg AI: ${action}${target ? ` ${target}` : ""}${forWhom}`, "ok");
    return Response.json({ ok: true, result });
  } catch (err) {
    const status = err instanceof BridgeError ? err.status : err instanceof EngineError ? (err.code === "not_found" ? 404 : 409) : 500;
    const message = err instanceof Error ? err.message : "Bridge error";
    if (status === 500) console.error("[bridge]", err);
    await logIntegration(hotel.id, `Workpeg AI: ${action}${forWhom}`, status === 403 ? "blocked" : "error", message);
    return Response.json({ ok: false, error: status === 500 ? "NEXORA hit an error. Try again." : message }, { status });
  }
}
