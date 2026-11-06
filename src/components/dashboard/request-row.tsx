import Link from "next/link";
import { ServiceIcon } from "@/components/icons";
import { AIChip, PriorityBadge, priorityEdge, SourceTag, StatusChip } from "@/components/status";
import { Avatar } from "@/components/ui";
import { DueChip, WaitingFlag } from "@/components/client/due-chip";
import { fmtTime, firstName } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RequestView } from "@/lib/types";

/** One line in a feed or list: time, room, request, status, owner, due. Opens the M4 drawer. */
export function RequestRow({ r, tz, href, fresh = false }: { r: RequestView; tz: string; href: string; fresh?: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn("relative flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0 hover:bg-subtle", fresh && "animate-flash")}
    >
      <span className={cn("absolute inset-y-2 left-0 w-1 rounded-r", priorityEdge(r.priority))} aria-hidden="true" />
      <span className="w-11 shrink-0 text-xs text-muted tabular-nums">{fmtTime(r.created_at, tz)}</span>
      <span className="w-14 shrink-0 font-display text-base font-extrabold tabular-nums">{r.room?.number}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <ServiceIcon icon={r.service?.icon} className="size-4 shrink-0 text-muted" />
        <span className="truncate text-sm font-medium">{r.title}</span>
        {r.ai_suggested ? <AIChip /> : null}
        {r.priority === "urgent" || r.priority === "high" ? <PriorityBadge priority={r.priority} /> : null}
        <SourceTag source={r.source} />
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <WaitingFlag status={r.status} assigneeId={r.assignee_id} createdAt={r.created_at} />
        <DueChip status={r.status} dueAt={r.due_at} />
        <StatusChip status={r.status} />
        {r.assignee ? (
          <span className="flex items-center gap-1.5" title={r.assignee.full_name}>
            <Avatar name={r.assignee.full_name} size="sm" />
            <span className="hidden text-xs text-muted 2xl:inline">{firstName(r.assignee.full_name)}</span>
          </span>
        ) : r.status === "pending" ? (
          <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">Assign</span>
        ) : null}
      </span>
    </Link>
  );
}
