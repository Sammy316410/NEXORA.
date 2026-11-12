import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, Rows3 } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getHotel } from "@/lib/hotel";
import { listRequests } from "@/lib/requests";
import { dayStart } from "@/lib/stats";
import { dueState, OPEN_STATUSES } from "@/lib/sla";
import { DEPARTMENT_LABEL, PRIORITY_RANK, SOURCE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { currentTime, fmtTime, firstName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, EmptyState, PageTitle, Avatar } from "@/components/ui";
import { ServiceIcon } from "@/components/icons";
import { AIChip, PriorityBadge, priorityEdge, StatusChip } from "@/components/status";
import { DueChip, TimeAgo, WaitingFlag } from "@/components/client/due-chip";
import { RequestDrawer } from "@/components/dashboard/request-drawer";
import type { RequestStatus, RequestView } from "@/lib/types";

export const metadata: Metadata = { title: "Requests" };

type SP = { view?: string; dept?: string; flag?: string; q?: string; r?: string };

function href(sp: SP, patch: Partial<SP>) {
  const next = { ...sp, ...patch };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
  const s = q.toString();
  return `/dashboard/requests${s ? `?${s}` : ""}`;
}

const COLUMNS: { status: RequestStatus; title: string }[] = [
  { status: "pending", title: "Pending" },
  { status: "assigned", title: "Assigned" },
  { status: "in_progress", title: "In progress" },
  { status: "completed", title: "Completed today" },
];

// M3: the live board (and a table view) of every request.
export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await requireManager();
  const hotel = await getHotel();
  const since = new Date(dayStart(hotel.timezone)).toISOString();
  const [open, today] = await Promise.all([
    listRequests({ hotelId: hotel.id, statuses: OPEN_STATUSES, limit: 500 }),
    listRequests({ hotelId: hotel.id, since, limit: 500 }),
  ]);
  const byId = new Map<string, RequestView>();
  for (const r of [...open, ...today]) byId.set(r.id, r);
  let rows = [...byId.values()];

  const now = currentTime();
  if (sp.dept) rows = rows.filter((r) => r.department_id === sp.dept);
  if (sp.flag === "overdue") rows = rows.filter((r) => dueState(r, now).kind === "overdue");
  if (sp.q) {
    const q = sp.q.trim().toLowerCase();
    rows = rows.filter((r) =>
      [r.code, r.room?.number, r.title, r.guest?.first_name, r.guest?.last_name, r.assignee?.full_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }
  rows.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      Number(dueState(b, now).kind === "overdue") - Number(dueState(a, now).kind === "overdue") ||
      b.created_at.localeCompare(a.created_at),
  );
  const view = sp.view === "table" ? "table" : "board";
  const tz = hotel.timezone;

  return (
    <div>
      <PageTitle
        title="Requests"
        subtitle={sp.q ? `Results for “${sp.q}”` : "Everything open, plus what was completed today"}
        action={
          <div className="flex rounded-full border border-line bg-surface p-1 text-sm font-medium">
            <Link href={href(sp, { view: undefined, r: undefined })} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5", view === "board" ? "bg-ink text-white" : "text-muted")}>
              <Columns3 className="size-4" aria-hidden="true" /> Board
            </Link>
            <Link href={href(sp, { view: "table", r: undefined })} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5", view === "table" ? "bg-ink text-white" : "text-muted")}>
              <Rows3 className="size-4" aria-hidden="true" /> Table
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href={href(sp, { dept: undefined, r: undefined })} className={cn("rounded-full border px-3 py-1.5 font-medium", !sp.dept ? "border-ink bg-ink text-white" : "border-line bg-surface")}>
          All departments
        </Link>
        {Object.entries(DEPARTMENT_LABEL).map(([id, name]) => (
          <Link key={id} href={href(sp, { dept: id, r: undefined })} className={cn("rounded-full border px-3 py-1.5 font-medium", sp.dept === id ? "border-ink bg-ink text-white" : "border-line bg-surface")}>
            {name}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <Link
          href={href(sp, { flag: sp.flag === "overdue" ? undefined : "overdue", r: undefined })}
          className={cn("rounded-full border px-3 py-1.5 font-medium", sp.flag === "overdue" ? "border-alert bg-alert text-white" : "border-alert/30 bg-surface text-alert")}
        >
          Overdue only
        </Link>
        {sp.q ? (
          <Link href={href(sp, { q: undefined })} className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-muted">
            Clear search ×
          </Link>
        ) : null}
      </div>

      {view === "board" ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = rows.filter((r) => r.status === col.status);
            return (
              <section key={col.status} className="flex min-h-48 flex-col rounded-2xl bg-line/40 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1">
                  <StatusChip status={col.status} size="md" />
                  <span className="text-sm font-semibold text-muted tabular-nums">{list.length}</span>
                </h2>
                <div className="space-y-2.5">
                  {list.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">{col.status === "pending" ? "No pending requests. Nice work." : "Nothing here."}</p>
                  ) : (
                    list.map((r) => {
                      const overdue = dueState(r, now).kind === "overdue";
                      return (
                        <Link
                          key={r.id}
                          href={href(sp, { r: r.id })}
                          scroll={false}
                          className={cn(
                            "relative block overflow-hidden rounded-xl border bg-surface p-3 pl-4 hover:border-line-strong",
                            overdue ? "border-alert/50" : "border-line",
                            now - Date.parse(r.created_at) < 90_000 && "animate-flash",
                          )}
                        >
                          <span className={cn("absolute inset-y-0 left-0 w-1", priorityEdge(r.priority))} aria-hidden="true" />
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-display text-xl leading-none font-extrabold tabular-nums">{r.room?.number}</span>
                            <span className="text-[11px] text-muted">{r.code}</span>
                          </div>
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold">
                            <ServiceIcon icon={r.service?.icon} className="size-4 shrink-0 text-muted" />
                            <span className="truncate">{r.title}</span>
                          </p>
                          <p className="text-xs text-muted">
                            {r.guest?.first_name ?? "Internal"} · <TimeAgo at={r.created_at} />
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <WaitingFlag status={r.status} assigneeId={r.assignee_id} createdAt={r.created_at} />
                            <DueChip status={r.status} dueAt={r.due_at} />
                            {r.priority === "urgent" || r.priority === "high" ? <PriorityBadge priority={r.priority} /> : null}
                            {r.ai_suggested ? <AIChip /> : null}
                            {r.guest_feedback === "down" ? <span className="rounded-full bg-alert-bg px-2 py-0.5 text-xs font-medium text-alert">Not resolved</span> : null}
                            {r.assignee ? (
                              <span className="ml-auto flex items-center gap-1 text-xs text-muted" title={r.assignee.full_name}>
                                <Avatar name={r.assignee.full_name} size="sm" /> {firstName(r.assignee.full_name)}
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState title="No requests match these filters." />
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  {["Ref", "Room", "Request", "Guest", "Department", "Priority", "Status", "Assignee", "Sent", "Due", "Source"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-subtle">
                    <td className="px-4 py-2.5">
                      <Link href={href(sp, { r: r.id })} scroll={false} className="font-medium text-accent">
                        {r.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-display font-extrabold tabular-nums">{r.room?.number}</td>
                    <td className="px-4 py-2.5">{r.title}</td>
                    <td className="px-4 py-2.5">{r.guest?.first_name ?? "—"}</td>
                    <td className="px-4 py-2.5">{DEPARTMENT_LABEL[r.department_id]}</td>
                    <td className="px-4 py-2.5">
                      <PriorityBadge priority={r.priority} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="px-4 py-2.5">{r.assignee?.full_name ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{fmtTime(r.created_at, tz)}</td>
                    <td className="px-4 py-2.5">
                      <DueChip status={r.status} dueAt={r.due_at} />
                    </td>
                    <td className="px-4 py-2.5 text-muted">{SOURCE_LABEL[r.source]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <p className="mt-4 text-xs text-muted">
        {rows.length} request{rows.length === 1 ? "" : "s"} · statuses: {Object.values(STATUS_LABEL).join(", ")}
      </p>

      {sp.r ? <RequestDrawer requestId={sp.r} closeHref={href(sp, { r: undefined })} hotelTz={tz} /> : null}
    </div>
  );
}
