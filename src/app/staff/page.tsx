import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listRequests } from "@/lib/requests";
import { dueState } from "@/lib/sla";
import { PRIORITY_RANK, departmentName } from "@/lib/labels";
import { firstName, isRecent } from "@/lib/format";
import { dayStart } from "@/lib/stats";
import { TaskCard } from "@/components/staff/task-card";
import { cn } from "@/lib/cn";
import type { RequestView } from "@/lib/types";

export const metadata: Metadata = { title: "My tasks" };

function sortTasks(a: RequestView, b: RequestView) {
  const now = Date.now();
  const urgent = (r: RequestView) => (r.priority === "urgent" ? 0 : 1);
  const overdue = (r: RequestView) => (dueState(r, now).kind === "overdue" ? 0 : 1);
  return (
    urgent(a) - urgent(b) ||
    overdue(a) - overdue(b) ||
    (a.due_at ?? "").localeCompare(b.due_at ?? "") ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  );
}

// S2: To do / In progress / Done today, most urgent first.
export default async function StaffTasksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const staff = await requireStaff();
  const mine = await listRequests({ hotelId: staff.hotel_id, assigneeId: staff.id, limit: 200 });
  const since = dayStart("Africa/Lagos");

  const todo = mine.filter((r) => r.status === "assigned").sort(sortTasks);
  const doing = mine.filter((r) => r.status === "in_progress").sort(sortTasks);
  const done = mine.filter((r) => r.status === "completed" && r.completed_at && Date.parse(r.completed_at) >= since);

  // With no tab chosen, show the job in hand first, so "Mark complete" is right there after "Start".
  const current = tab === "doing" || tab === "done" || tab === "todo" ? tab : doing.length ? "doing" : "todo";
  const list = current === "doing" ? doing : current === "done" ? done : todo;
  const tabs = [
    { key: "todo", label: "To do", count: todo.length },
    { key: "doing", label: "In progress", count: doing.length },
    { key: "done", label: "Done today", count: done.length },
  ];

  return (
    <div className="px-4 pt-5">
      <header className="mb-4 pr-24">
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight">Hi {firstName(staff.full_name)}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          {departmentName(staff.department_id)}
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", staff.on_duty ? "bg-done-bg text-done" : "bg-neutral-bg text-neutral")}>
            <span className={cn("size-1.5 rounded-full", staff.on_duty ? "bg-done" : "bg-neutral")} aria-hidden="true" />
            {staff.on_duty ? "On duty" : "Off duty"}
          </span>
        </p>
      </header>

      <nav role="tablist" className="mb-4 grid grid-cols-3 rounded-xl bg-line/60 p-1 text-[13px] font-semibold">
        {tabs.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={current === t.key}
            href={`/staff?tab=${t.key}`}
            className={cn("rounded-lg py-2.5 text-center", current === t.key ? "bg-surface shadow-card" : "text-muted")}
          >
            {t.label} <span className="tabular-nums">({t.count})</span>
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="rounded-2xl bg-surface px-4 py-12 text-center">
          <p className="font-display text-lg font-bold">{current === "done" ? "Nothing finished yet today." : "You're all caught up."}</p>
          {current === "todo" && staff.department_id ? (
            <Link href="/staff/pool" className="mt-2 inline-block text-sm font-medium text-accent">
              Check the open pool
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <TaskCard key={r.id} r={r} isNew={r.status === "assigned" && isRecent(r.assigned_at, 60_000)} />
          ))}
        </div>
      )}
    </div>
  );
}
