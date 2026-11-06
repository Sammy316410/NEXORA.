import Link from "next/link";
import { ServiceIcon } from "@/components/icons";
import { PriorityBadge, priorityEdge, SourceTag, StatusChip } from "@/components/status";
import { ActionButton } from "@/components/client/action-button";
import { DueChip, TimeAgo } from "@/components/client/due-chip";
import { completeTask, startTask } from "@/app/actions/staff";
import { cn } from "@/lib/cn";
import type { RequestView } from "@/lib/types";

/** S2 task card: the room number is the biggest thing on it. */
export function TaskCard({ r, isNew = false }: { r: RequestView; isNew?: boolean }) {
  const guestName = r.guest?.first_name;
  return (
    <article className={cn("relative overflow-hidden rounded-2xl border border-line bg-surface", isNew && "animate-flash")}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", priorityEdge(r.priority))} aria-hidden="true" />
      <Link href={`/staff/tasks/${r.id}`} className="flex items-start gap-4 p-4 pl-5">
        <div className="min-w-[72px]">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Room</p>
          <p className="font-display text-[40px] leading-none font-extrabold tabular-nums">{r.room?.number}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-[17px] leading-snug font-bold">
            <ServiceIcon icon={r.service?.icon} className="size-4.5 shrink-0 text-muted" />
            <span className="truncate">{r.title}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {guestName ? `${guestName} · ` : ""}
            <TimeAgo at={r.created_at} />
          </p>
          {r.note ? <p className="mt-1.5 line-clamp-2 text-sm text-ink">“{r.note}”</p> : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <DueChip status={r.status} dueAt={r.due_at} />
            {r.priority === "urgent" || r.priority === "high" ? <PriorityBadge priority={r.priority} /> : null}
            {r.status !== "assigned" ? <StatusChip status={r.status} /> : null}
            <SourceTag source={r.source} />
          </div>
        </div>
      </Link>
      {r.status === "assigned" ? (
        <div className="px-4 pb-4">
          <ActionButton action={startTask.bind(null, r.id)} size="xl" className="w-full" pendingText="Starting…">
            Start task
          </ActionButton>
        </div>
      ) : r.status === "in_progress" ? (
        <div className="px-4 pb-4">
          <ActionButton action={completeTask.bind(null, r.id)} variant="accent" size="xl" className="w-full" pendingText="Completing…">
            Mark complete
          </ActionButton>
        </div>
      ) : null}
    </article>
  );
}
