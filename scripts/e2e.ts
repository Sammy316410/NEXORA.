// End-to-end check of the core loop (the PRD's acceptance scenario) against the
// local database, plus the Workpeg AI bridge over HTTP.
//   npm run test:e2e        (needs `npm run dev` running for the bridge part)
// Resets the demo data at the end.
import { createClient } from "@supabase/supabase-js";
import {
  assignRequest,
  cancelRequest,
  completeRequest,
  createRequest,
  EngineError,
  getEvents,
  leaveFeedback,
  startRequest,
} from "../src/lib/requests";
import { classifyWithRules } from "../src/lib/ai/rules";
import { seedDemo } from "../src/lib/seed";
import type { Actor } from "../src/lib/types";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`, detail ?? "");
  }
}

async function expectError(label: string, code: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, "no error thrown");
  } catch (err) {
    check(label, err instanceof EngineError && err.code === code, err instanceof Error ? err.message : err);
  }
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const password = process.env.DEMO_STAFF_PASSWORD || "nexora-demo-2026";
  await seedDemo(db, { password });

  const { data: hotel } = await db.from("hotels").select("id").eq("slug", "amber-coast").single();
  const { data: room } = await db.from("rooms").select("id").eq("hotel_id", hotel!.id).eq("number", "204").single();
  const { data: stay } = await db.from("reservations").select("id, guest_id").eq("room_id", room!.id).eq("status", "checked_in").single();
  const { data: staff } = await db.from("staff").select("id, full_name, email");
  const by = (email: string) => staff!.find((s) => s.email === email)!;
  const grace = by("grace@ambercoast.demo");
  const amaka = by("amaka@ambercoast.demo");
  const ibrahim = by("ibrahim@ambercoast.demo");

  const guest: Actor = { type: "guest", id: stay!.guest_id, name: "David" };
  const manager: Actor = { type: "manager", id: grace.id, name: grace.full_name };
  const amakaActor: Actor = { type: "staff", id: amaka.id, name: amaka.full_name };
  const ibrahimActor: Actor = { type: "staff", id: ibrahim.id, name: ibrahim.full_name };

  console.log("\nCore loop (PRD section 15)");
  const created = await createRequest({
    hotelId: hotel!.id,
    roomId: room!.id,
    reservationId: stay!.id,
    guestId: stay!.guest_id,
    serviceId: "extra-towels",
    quantity: 2,
    note: "Please leave them by the door",
    source: "guest_portal",
    actor: guest,
    checkDuplicate: true,
  });
  check("guest request saved as Pending", created.status === "pending", created.status);
  check("first live code is NX-1042", created.code === "NX-1042", created.code);
  check("title carries quantity", created.title === "Extra towels × 2", created.title);
  const dueIn = Math.round((Date.parse(created.due_at!) - Date.parse(created.created_at)) / 60000);
  check("due in 15 minutes (towels target)", dueIn === 15, dueIn);

  await expectError("duplicate guard catches a second towels request", "duplicate", () =>
    createRequest({ hotelId: hotel!.id, roomId: room!.id, reservationId: stay!.id, guestId: stay!.guest_id, serviceId: "extra-towels", source: "guest_portal", actor: guest, checkDuplicate: true }),
  );

  const assigned = await assignRequest(created.id, amaka.id, manager);
  check("manager assigns to Amaka", assigned.status === "assigned" && assigned.assignee_id === amaka.id);
  await expectError("another staff member cannot start Amaka's task", "forbidden", () => startRequest(created.id, ibrahimActor));
  await expectError("guest cannot cancel once assigned", "conflict", () => cancelRequest(created.id, guest));

  const started = await startRequest(created.id, amakaActor);
  check("Amaka starts: In progress", started.status === "in_progress" && Boolean(started.started_at));
  const done = await completeRequest(created.id, amakaActor);
  check("Amaka completes: Completed", done.status === "completed" && Boolean(done.completed_at));
  const rated = await leaveFeedback(created.id, "up", null, guest);
  check("guest leaves thumbs up", rated.guest_feedback === "up");

  const events = await getEvents(created.id);
  const kinds = events.map((e) => e.kind).join(",");
  check("history has every step in order", kinds === "created,assigned,started,completed,feedback", kinds);
  check("history names who did it", events[1].message === "Assigned to Amaka by Grace", events[1].message);

  console.log("\nNot-resolved feedback raises a follow-up");
  const second = await createRequest({ hotelId: hotel!.id, roomId: room!.id, reservationId: stay!.id, guestId: stay!.guest_id, serviceId: "toiletries", source: "guest_portal", actor: guest });
  await assignRequest(second.id, amaka.id, manager);
  await completeRequest(second.id, amakaActor);
  const unhappy = await leaveFeedback(second.id, "down", "Soap was missing", guest);
  check("thumbs down sets follow-up", unhappy.follow_up && unhappy.guest_feedback === "down");

  console.log("\nKeyword routing (AI fallback)");
  const multi = classifyWithRules("Two more towels and a toothbrush please");
  check("splits towels + toothbrush", multi.map((m) => m.serviceId).join(",") === "extra-towels,toiletries", multi);
  check("reads quantity two", multi[0]?.quantity === 2, multi[0]);
  const leak = classifyWithRules("Water is dripping from my ceiling");
  check("ceiling drip is an urgent leak", leak[0]?.serviceId === "leak" && leak[0]?.priority === "urgent", leak);
  const knock = classifyWithRules("Someone keeps knocking on my door");
  check("knocking is an urgent safety concern, not a door fix", knock.length === 1 && knock[0].serviceId === "safety-concern" && knock[0].priority === "urgent", knock);
  const ac = classifyWithRules("My AC isn't working");
  check("AC goes to maintenance", ac[0]?.serviceId === "ac-cooling", ac);

  console.log("\nWorkpeg AI bridge (HTTP)");
  const base = process.env.APP_URL || "http://localhost:3000";
  const secret = process.env.NEXORA_BRIDGE_SECRET!;
  const call = async (action: string, params: Record<string, unknown>, auth = secret) => {
    const res = await fetch(`${base}/api/workpeg/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ action, params, actor: { email: "grace@ambercoast.demo", name: "Grace Bello", via: "workpeg_ai" } }),
    });
    return { status: res.status, body: (await res.json()) as { ok: boolean; result?: Record<string, unknown>; error?: string } };
  };
  try {
    const denied = await call("list_open_requests", {}, "wrong-secret");
    check("bridge rejects a wrong secret", denied.status === 401, denied);
    const list = await call("list_open_requests", { department: "maintenance" });
    check("list_open_requests returns maintenance work", list.body.ok && Number(list.body.result?.count) >= 1, list.body);
    const assign = await call("assign_request", { code: "NX-1038", staff_name: "Ibrahim" });
    check("assign_request by first name", assign.body.ok, assign.body);
    const createdByAi = await call("create_request", { room: "310", description: "Water is dripping from the ceiling" });
    check("create_request routes a leak", createdByAi.body.ok && String(createdByAi.body.result?.message).includes("Maintenance"), createdByAi.body);
    const { data: aiEvents } = await db
      .from("request_events")
      .select("actor_type, message")
      .eq("actor_type", "workpeg_ai")
      .order("created_at", { ascending: false })
      .limit(5);
    check("Workpeg AI writes are attributed", (aiEvents ?? []).some((e) => e.message.includes("Workpeg AI, for Grace")), aiEvents);
    const summary = await call("shift_summary", {});
    check("shift_summary answers", summary.body.ok && Array.isArray(summary.body.result?.summary), summary.body);
  } catch (err) {
    check("bridge reachable (is `npm run dev` running?)", false, err instanceof Error ? err.message : err);
  }

  await seedDemo(db, { password });
  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`} Demo data reset.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
