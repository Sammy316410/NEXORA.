// Numbers for the Overview and Insights screens. Every figure here comes from
// real rows; the AI summary only ever paraphrases these.
import { db } from "./db";
import { listRequests } from "./requests";
import { average, clocks, dueState, waitingMinutes, OPEN_STATUSES } from "./sla";
import { DEPARTMENT_LABEL, PRIORITY_RANK } from "./labels";
import { todayISO } from "./format";
import type { Hotel, RequestStatus, RequestView, Staff } from "./types";

/** UTC instant of local midnight, `offsetDays` from today, in the hotel's time zone. */
export function dayStart(tz: string, offsetDays = 0, now = Date.now()): number {
  const date = todayISO(tz, now + offsetDays * 86_400_000);
  // Offset of tz at that date: compare the wall clock in tz with UTC.
  const probe = new Date(`${date}T12:00:00Z`);
  const wall = new Date(probe.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = wall.getTime() - utc.getTime();
  return Date.parse(`${date}T00:00:00Z`) - offset;
}

export type AttentionReason = "overdue" | "waiting" | "urgent" | "not_resolved" | "follow_up";

export interface AttentionItem {
  request: RequestView;
  reason: AttentionReason;
  label: string;
}

export interface Overview {
  rooms: { total: number; occupied: number; available: number; cleaning: number; maintenance: number };
  stays: { inHouse: number; arrivalsToday: number; departuresToday: number };
  open: { pending: number; assigned: number; inProgress: number; total: number };
  overdue: number;
  waiting: number;
  completedToday: number;
  createdToday: number;
  avgResponseToday: number | null;
  responseTarget: number;
  staffOnDuty: number;
  staffTotal: number;
  workload: { departmentId: string; name: string; pending: number; assigned: number; inProgress: number }[];
  statusMixToday: Record<RequestStatus, number>;
  needsAttention: AttentionItem[];
  feed: RequestView[];
  openRequests: RequestView[];
}

export async function getOverview(hotel: Hotel, staff: Staff[]): Promise<Overview> {
  const now = Date.now();
  const today = todayISO(hotel.timezone, now);
  const since = new Date(dayStart(hotel.timezone, 0, now)).toISOString();

  const [roomsRes, staysRes, openRequests, todayRequests, followUps] = await Promise.all([
    db().from("rooms").select("status").eq("hotel_id", hotel.id),
    db().from("reservations").select("status, check_in, check_out").eq("hotel_id", hotel.id).in("status", ["confirmed", "checked_in"]),
    listRequests({ hotelId: hotel.id, statuses: OPEN_STATUSES, limit: 500 }),
    listRequests({ hotelId: hotel.id, since, limit: 500 }),
    listRequests({ hotelId: hotel.id, statuses: ["completed", "cancelled"], since: new Date(now - 2 * 86_400_000).toISOString(), limit: 200 }),
  ]);

  const roomStatuses = (roomsRes.data as { status: string }[]) ?? [];
  const count = (s: string) => roomStatuses.filter((r) => r.status === s).length;
  const stays = (staysRes.data as { status: string; check_in: string; check_out: string }[]) ?? [];

  const needsAttention: AttentionItem[] = [];
  for (const r of openRequests) {
    const due = dueState(r, now);
    const wait = waitingMinutes(r, now);
    if (due.kind === "overdue") needsAttention.push({ request: r, reason: "overdue", label: due.label });
    else if (wait !== null) needsAttention.push({ request: r, reason: "waiting", label: `Waiting ${wait} min` });
    else if (r.priority === "urgent") needsAttention.push({ request: r, reason: "urgent", label: "Urgent" });
    else if (r.follow_up) needsAttention.push({ request: r, reason: "follow_up", label: "Needs follow-up" });
  }
  for (const r of followUps) {
    if (r.guest_feedback === "down" && r.follow_up) {
      needsAttention.push({ request: r, reason: "not_resolved", label: "Guest says not resolved" });
    } else if (r.follow_up) {
      needsAttention.push({ request: r, reason: "follow_up", label: "Needs follow-up" });
    }
  }
  const reasonRank: Record<AttentionReason, number> = { overdue: 0, not_resolved: 1, urgent: 2, waiting: 3, follow_up: 4 };
  needsAttention.sort(
    (a, b) =>
      reasonRank[a.reason] - reasonRank[b.reason] ||
      PRIORITY_RANK[a.request.priority] - PRIORITY_RANK[b.request.priority] ||
      a.request.created_at.localeCompare(b.request.created_at),
  );

  const statusMixToday: Record<RequestStatus, number> = { awaiting_payment: 0, pending: 0, assigned: 0, in_progress: 0, completed: 0, cancelled: 0 };
  for (const r of todayRequests) statusMixToday[r.status]++;

  const startedToday = todayRequests.filter((r) => r.started_at);
  const departments = ["housekeeping", "maintenance", "food", "front_desk"];

  return {
    rooms: { total: roomStatuses.length, occupied: count("occupied"), available: count("available"), cleaning: count("cleaning"), maintenance: count("maintenance") },
    stays: {
      inHouse: stays.filter((s) => s.status === "checked_in").length,
      arrivalsToday: stays.filter((s) => s.status === "confirmed" && s.check_in === today).length,
      departuresToday: stays.filter((s) => s.status === "checked_in" && s.check_out === today).length,
    },
    open: {
      pending: openRequests.filter((r) => r.status === "pending").length,
      assigned: openRequests.filter((r) => r.status === "assigned").length,
      inProgress: openRequests.filter((r) => r.status === "in_progress").length,
      total: openRequests.length,
    },
    overdue: needsAttention.filter((a) => a.reason === "overdue").length,
    waiting: needsAttention.filter((a) => a.reason === "waiting").length,
    completedToday: todayRequests.filter((r) => r.status === "completed").length,
    createdToday: todayRequests.length,
    avgResponseToday: average(startedToday.map((r) => clocks(r).response)),
    responseTarget: 10,
    staffOnDuty: staff.filter((s) => s.on_duty).length,
    staffTotal: staff.length,
    workload: departments.map((d) => ({
      departmentId: d,
      name: DEPARTMENT_LABEL[d],
      pending: openRequests.filter((r) => r.department_id === d && r.status === "pending").length,
      assigned: openRequests.filter((r) => r.department_id === d && r.status === "assigned").length,
      inProgress: openRequests.filter((r) => r.department_id === d && r.status === "in_progress").length,
    })),
    statusMixToday,
    needsAttention: needsAttention.slice(0, 8),
    feed: todayRequests.slice(0, 12),
    openRequests,
  };
}

export interface Insights {
  days: { date: string; label: string; created: number; completed: number }[];
  departments: { departmentId: string; name: string; count: number; avgResponse: number | null; avgResolution: number | null; withinTarget: number | null }[];
  categories: { category: string; count: number }[];
  withinTarget: number | null;
  feedback: { up: number; down: number; rate: number | null };
  repeatRooms: { room: string; count: number; service: string }[];
  total: number;
}

export async function getInsights(hotel: Hotel): Promise<Insights> {
  const now = Date.now();
  const since = new Date(dayStart(hotel.timezone, -6, now)).toISOString();
  const rows = await listRequests({ hotelId: hotel.id, since, limit: 1000 });

  const days = Array.from({ length: 7 }, (_, i) => {
    const start = dayStart(hotel.timezone, i - 6, now);
    const end = dayStart(hotel.timezone, i - 5, now);
    const inDay = rows.filter((r) => {
      const t = Date.parse(r.created_at);
      return t >= start && t < end;
    });
    const date = todayISO(hotel.timezone, start + 3_600_000);
    return {
      date,
      label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
      created: inDay.length,
      completed: inDay.filter((r) => r.status === "completed").length,
    };
  });

  const done = rows.filter((r) => r.status === "completed");
  const within = (r: RequestView) => {
    const c = clocks(r);
    return c.resolution !== null ? c.resolution <= (r.service?.resolution_target_min ?? 30) : null;
  };
  const rate = (list: RequestView[]) => {
    const marks = list.map(within).filter((v): v is boolean => v !== null);
    return marks.length ? marks.filter(Boolean).length / marks.length : null;
  };

  const departments = ["housekeeping", "maintenance", "food", "front_desk"].map((d) => {
    const list = done.filter((r) => r.department_id === d);
    return {
      departmentId: d,
      name: DEPARTMENT_LABEL[d],
      count: rows.filter((r) => r.department_id === d).length,
      avgResponse: average(list.map((r) => clocks(r).response)),
      avgResolution: average(list.map((r) => clocks(r).resolution)),
      withinTarget: rate(list),
    };
  });

  const categoryCounts = new Map<string, number>();
  for (const r of rows) {
    const c = r.service?.category ?? "other";
    categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }

  const repeat = new Map<string, { room: string; count: number; service: string }>();
  for (const r of rows.filter((x) => x.service?.category === "maintenance")) {
    const key = `${r.room?.number}|${r.service_id}`;
    const entry = repeat.get(key) ?? { room: r.room?.number ?? "?", count: 0, service: r.service?.name ?? r.title };
    entry.count++;
    repeat.set(key, entry);
  }

  const up = rows.filter((r) => r.guest_feedback === "up").length;
  const down = rows.filter((r) => r.guest_feedback === "down").length;

  return {
    days,
    departments,
    categories: [...categoryCounts.entries()].map(([category, c]) => ({ category, count: c })).sort((a, b) => b.count - a.count),
    withinTarget: rate(done),
    feedback: { up, down, rate: up + down ? up / (up + down) : null },
    repeatRooms: [...repeat.values()].filter((r) => r.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5),
    total: rows.length,
  };
}
