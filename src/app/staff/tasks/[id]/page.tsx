import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { requireStaff, isManager } from "@/lib/auth";
import { getEvents, getRequest, listRequests } from "@/lib/requests";
import { fmtTime, isoMinutesAgo } from "@/lib/format";
import { departmentName } from "@/lib/labels";
import { ServiceIcon } from "@/components/icons";
import { PriorityBadge, StatusChip } from "@/components/status";
import { ActionButton } from "@/components/client/action-button";
import { DueChip } from "@/components/client/due-chip";
import { CompleteWithNote, HandBack } from "@/components/staff/task-actions";
import { completeTask, handBackTask, startTask } from "@/app/actions/staff";

export const metadata: Metadata = { title: "Task" };

// S3: everything needed to do the job, with one big action at the bottom.
export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  const r = await getRequest(id);
  if (!r || r.hotel_id !== staff.hotel_id) notFound();
  if (r.assignee_id !== staff.id && !isManager(staff)) notFound();

  const [events, roomHistory] = await Promise.all([
    getEvents(r.id),
    listRequests({ hotelId: r.hotel_id, roomId: r.room_id, since: isoMinutesAgo(24 * 60), limit: 10 }),
  ]);
  const others = roomHistory.filter((x) => x.id !== r.id);
  const tz = "Africa/Lagos";

  return (
    <div className="px-4 pt-5">
      <Link href="/staff" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted">
        <ChevronLeft className="size-4" aria-hidden="true" /> My tasks
      </Link>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Room</p>
        <p className="font-display text-[64px] leading-none font-extrabold tabular-nums">{r.room?.number}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="size-4" aria-hidden="true" /> Floor {r.room?.floor}
          {r.room?.landmark ? ` · ${r.room.landmark}` : ""}
        </p>
        <h1 className="mt-4 flex items-center gap-2 font-display text-xl font-extrabold">
          <ServiceIcon icon={r.service?.icon} className="size-5 text-muted" /> {r.title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusChip status={r.status} size="md" />
          <DueChip status={r.status} dueAt={r.due_at} size="md" />
          {r.priority === "urgent" || r.priority === "high" ? <PriorityBadge priority={r.priority} /> : null}
        </div>
        {r.note ? (
          <blockquote className="mt-4 rounded-xl border-l-4 border-ink bg-subtle px-4 py-3 text-[15px]">
            “{r.note}”
            {r.guest ? <footer className="mt-1 text-sm text-muted">{r.guest.first_name}, guest</footer> : null}
          </blockquote>
        ) : r.guest ? (
          <p className="mt-4 text-sm text-muted">For {r.guest.first_name}</p>
        ) : null}
      </section>

      {others.length ? (
        <p className="mt-3 rounded-xl bg-progress-bg px-4 py-2.5 text-sm text-progress">
          {others.length} other request{others.length === 1 ? "" : "s"} from this room in the last 24 hours.
        </p>
      ) : null}

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">History</h2>
        <ol className="space-y-1.5 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-11 shrink-0 text-muted tabular-nums">{fmtTime(e.created_at, tz)}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ol>
      </section>

      {r.status === "assigned" || r.status === "in_progress" ? (
        <div className="mt-4 space-y-2 pb-36">
          {r.status === "in_progress" ? <CompleteWithNote action={completeTask.bind(null, r.id)} /> : null}
          <HandBack action={handBackTask.bind(null, r.id)} />
        </div>
      ) : (
        <p className="mt-6 pb-10 text-center text-sm text-muted">This task is {r.status === "completed" ? "done" : r.status}. Nice work.</p>
      )}

      {r.status === "assigned" || r.status === "in_progress" ? (
        <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-[480px] border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur">
          {r.status === "assigned" ? (
            <ActionButton action={startTask.bind(null, r.id)} size="xl" className="w-full" pendingText="Starting…">
              Start task
            </ActionButton>
          ) : (
            <ActionButton action={completeTask.bind(null, r.id)} variant="accent" size="xl" className="w-full" pendingText="Completing…">
              Mark complete
            </ActionButton>
          )}
          <p className="mt-1.5 text-center text-xs text-muted">{departmentName(r.department_id)} · {r.code}</p>
        </div>
      ) : null}
    </div>
  );
}
