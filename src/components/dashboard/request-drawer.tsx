import Link from "next/link";
import { Bot, Check, CircleUser, Sparkles, TriangleExclamationPoint, X } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getEvents, getRequest, listRequests } from "@/lib/requests";
import { listStaff } from "@/lib/hotel";
import { db } from "@/lib/db";
import { clocks, OPEN_STATUSES } from "@/lib/sla";
import { fmtDate, fmtDuration, fmtTime, fmtMinor } from "@/lib/format";
import { DEPARTMENT_LABEL, SOURCE_LABEL } from "@/lib/labels";
import { assignAction, cancelAction, completeAction, priorityAction } from "@/app/actions/manager";
import { ServiceIcon } from "@/components/icons";
import { AIChip, StatusChip } from "@/components/status";
import { Avatar } from "@/components/ui";
import { ActionButton } from "@/components/client/action-button";
import { DueChip } from "@/components/client/due-chip";
import { DrawerEscape, PrioritySelect } from "./drawer-controls";
import { listRequestItems, paymentsForRequest } from "@/lib/orders";
import { PaymentMethod, PaymentStatusChip, TestModeBadge } from "@/components/payments/payment-bits";
import { REQUEST_PAYMENT_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { ActorType, Staff } from "@/lib/types";

function ActorIcon({ type }: { type: ActorType }) {
  if (type === "nexora_ai") return <Sparkles className="size-3.5" aria-hidden="true" />;
  if (type === "workpeg_ai") return <Bot className="size-3.5" aria-hidden="true" />;
  return <CircleUser className="size-3.5" aria-hidden="true" />;
}

const ACTOR_STYLE: Record<ActorType, string> = {
  guest: "bg-[#E5F4E4] text-done",
  staff: "bg-assigned-bg text-assigned",
  manager: "bg-ink text-white",
  system: "bg-neutral-bg text-neutral",
  nexora_ai: "border border-ink/25 bg-surface text-ink",
  workpeg_ai: "bg-[#0064FF] text-white",
};

// M4: assign, priority, the three clocks and the full history of one request.
export async function RequestDrawer({ requestId, closeHref, hotelTz }: { requestId: string; closeHref: string; hotelTz: string }) {
  const manager = await requireManager();
  const r = await getRequest(requestId);
  if (!r || r.hotel_id !== manager.hotel_id) return null;

  const [events, staff, open, stayCount] = await Promise.all([
    getEvents(r.id),
    listStaff(r.hotel_id),
    listRequests({ hotelId: r.hotel_id, statuses: OPEN_STATUSES, limit: 500 }),
    r.reservation_id
      ? db().from("requests").select("id", { count: "exact", head: true }).eq("reservation_id", r.reservation_id).then((x) => x.count ?? 0)
      : Promise.resolve(0),
  ]);
  const { data: stay } = r.reservation_id
    ? await db().from("reservations").select("check_in, check_out").eq("id", r.reservation_id).maybeSingle()
    : { data: null };

  const [items, attempts] = r.amount_minor > 0 ? await Promise.all([listRequestItems(r.id), paymentsForRequest(r.id)]) : [[], []];
  const load = (s: Staff) => open.filter((x) => x.assignee_id === s.id).length;
  const team = staff
    .filter((s) => s.department_id === r.department_id && s.role !== "manager")
    .sort((a, b) => Number(b.on_duty) - Number(a.on_duty) || load(a) - load(b));
  const others = staff.filter((s) => s.department_id !== r.department_id && s.on_duty);
  const suggested = team.find((s) => s.on_duty && s.id !== r.assignee_id);
  const c = clocks(r);
  const isOpenReq = OPEN_STATUSES.includes(r.status);

  const staffRow = (s: Staff, showDept = false) => (
    <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-subtle">
      <Avatar name={s.full_name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {s.full_name}
          <span className={cn("size-2 rounded-full", s.on_duty ? "bg-[#1FA35B]" : "bg-line-strong")} title={s.on_duty ? "On duty" : "Off duty"} />
          {suggested?.id === s.id ? <span className="rounded-full bg-accent-subtle px-1.5 text-[11px] font-semibold text-accent">Suggested</span> : null}
        </p>
        <p className="text-xs text-muted">
          {showDept ? `${DEPARTMENT_LABEL[s.department_id ?? ""] ?? "Front desk"} · ` : ""}
          {load(s)} open task{load(s) === 1 ? "" : "s"}
          {!s.on_duty ? " · off duty" : ""}
        </p>
      </div>
      {r.assignee_id === s.id ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-done">
          <Check className="size-3.5" aria-hidden="true" /> Assigned
        </span>
      ) : !s.on_duty ? (
        <span className="text-xs text-muted">Off duty</span>
      ) : (
        <ActionButton action={assignAction.bind(null, r.id, s.id)} size="sm" variant={suggested?.id === s.id ? "primary" : "secondary"}>
          {r.assignee_id ? "Reassign" : "Assign"}
        </ActionButton>
      )}
    </li>
  );

  const clock = (label: string, value: number | null, target: number | null, hint: string) => (
    <div className="rounded-xl bg-subtle p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 font-display text-lg font-extrabold tabular-nums">
        {value === null ? "—" : fmtDuration(value)}
        {value !== null && target !== null ? (
          value <= target ? <Check className="size-4 text-done" aria-label="On target" /> : <TriangleExclamationPoint className="size-4 text-progress" aria-label="Over target" />
        ) : null}
      </p>
      <p className="text-[11px] text-muted">{target !== null ? `Target ${target} min · ${hint}` : hint}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40">
      <DrawerEscape closeHref={closeHref} />
      <Link href={closeHref} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/25" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] animate-rise flex-col bg-surface shadow-float"
      >
        <header className="flex items-start gap-3 border-b border-line p-5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-subtle">
            <ServiceIcon icon={r.service?.icon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="drawer-title" className="font-display text-lg leading-tight font-extrabold">
              {r.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {r.code} · Room {r.room?.number} · {DEPARTMENT_LABEL[r.department_id]}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusChip status={r.status} />
              <DueChip status={r.status} dueAt={r.due_at} />
              {r.guest_feedback === "down" ? <span className="rounded-full bg-alert-bg px-2 py-0.5 text-xs font-medium text-alert">Guest says not resolved</span> : null}
            </div>
          </div>
          <Link href={closeHref} scroll={false} className="rounded-full p-2 text-muted hover:bg-black/5" aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </Link>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted">Guest</p>
              <p className="font-semibold">{r.guest ? [r.guest.title, r.guest.first_name, r.guest.last_name].filter(Boolean).join(" ") : "No guest (internal)"}</p>
              {stay ? (
                <p className="text-xs text-muted">
                  {fmtDate(stay.check_in)} – {fmtDate(stay.check_out)} · request {stayCount} this stay
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted">Room</p>
              <p className="font-semibold">
                {r.room?.number} · {r.room?.room_type}
              </p>
              <p className="text-xs text-muted">
                Sent {fmtTime(r.created_at, hotelTz)} via {SOURCE_LABEL[r.source].toLowerCase()}
              </p>
            </div>
            {r.note ? <p className="col-span-2 rounded-xl bg-subtle px-3 py-2.5 text-[15px]">“{r.note}”</p> : null}
            <div className="col-span-2 flex items-center justify-between">
              <span className="text-xs text-muted">Priority</span>
              {isOpenReq ? <PrioritySelect value={r.priority} action={priorityAction.bind(null, r.id)} /> : <span className="text-sm font-semibold capitalize">{r.priority}</span>}
            </div>
          </section>

          {r.amount_minor > 0 ? (
            <section className="rounded-xl border border-line p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Order</h3>
                <span className="text-xs font-semibold text-muted">{REQUEST_PAYMENT_LABEL[r.payment_status]}</span>
              </div>
              <ul className="space-y-1">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>
                      {i.quantity} × {i.name}
                    </span>
                    <span className="tabular-nums">{fmtMinor(i.unit_price_minor * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fmtMinor(r.amount_minor)}</span>
              </p>
              {attempts.length ? (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {attempts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5">
                        <PaymentMethod p={p} /> <TestModeBadge mode={p.mode} />
                      </span>
                      <span className="flex items-center gap-1.5 text-muted">
                        {fmtTime(p.paid_at ?? p.created_at, hotelTz)} <PaymentStatusChip status={p.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {r.ai_suggested ? (
            <section className="flex items-center gap-2 rounded-xl border border-dashed border-ink/20 px-3 py-2.5 text-sm">
              <AIChip label={`${r.service?.name} → ${DEPARTMENT_LABEL[r.department_id]}`} confidence={r.ai_confidence} />
              <span className="text-xs text-muted">From the guest&apos;s message{r.ai_engine === "claude" ? " (Claude)" : " (keyword rules)"}</span>
            </section>
          ) : null}

          {isOpenReq ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">{r.assignee ? "Assigned to" : "Assign to"}</h3>
              <ul className="space-y-0.5">{team.map((s) => staffRow(s))}</ul>
              {others.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer px-2 text-xs font-medium text-muted">Other departments on duty</summary>
                  <ul className="mt-1 space-y-0.5">{others.map((s) => staffRow(s, true))}</ul>
                </details>
              ) : null}
            </section>
          ) : null}

          <section className="grid grid-cols-3 gap-2">
            {clock("Assigned in", c.assign, null, "sent → assigned")}
            {clock("Response", c.response, r.service?.response_target_min ?? 10, "sent → started")}
            {clock("Resolution", c.resolution, r.service?.resolution_target_min ?? 30, "sent → done")}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">History</h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {events.map((e, i) => {
                const prev = events[i - 1];
                const gap = prev ? Math.round((Date.parse(e.created_at) - Date.parse(prev.created_at)) / 60000) : null;
                return (
                  <li key={e.id} className="relative">
                    <span className={cn("absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full", ACTOR_STYLE[e.actor_type])}>
                      <ActorIcon type={e.actor_type} />
                    </span>
                    <p className="text-sm">{e.message}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {fmtTime(e.created_at, hotelTz)}
                      {gap !== null && gap > 0 ? ` · ${fmtDuration(gap)} later` : ""}
                      {e.actor_type === "workpeg_ai" ? " · via Workpeg AI" : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {isOpenReq ? (
          <footer className="flex gap-2 border-t border-line p-4">
            {r.status !== "pending" ? (
              <ActionButton action={completeAction.bind(null, r.id)} variant="accent" className="flex-1">
                Mark complete
              </ActionButton>
            ) : null}
            <ActionButton action={cancelAction.bind(null, r.id)} variant="danger" confirmText={`Cancel ${r.code}? The guest will see it as cancelled.`}>
              Cancel request
            </ActionButton>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
