"use client";

import { useEffect, useState } from "react";
import { Clock, Hourglass, TriangleExclamationPoint } from "lucide-react";
import { dueState, waitingMinutes } from "@/lib/sla";
import { TONE_CLASSES } from "@/components/status";
import { cn } from "@/lib/cn";
import type { RequestStatus } from "@/lib/types";

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Live countdown: neutral, amber under 5 min, red when overdue. */
export function DueChip({ status, dueAt, size = "sm" }: { status: RequestStatus; dueAt: string | null; size?: "sm" | "md" }) {
  const now = useNow();
  const due = dueState({ status, due_at: dueAt }, now);
  if (due.kind === "none") return null;
  const tone = due.kind === "overdue" ? TONE_CLASSES.alert : due.kind === "soon" ? TONE_CLASSES.progress : "bg-neutral-bg text-neutral";
  const Icon = due.kind === "overdue" ? TriangleExclamationPoint : Clock;
  return (
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap tabular-nums",
        size === "md" ? "px-2.5 py-1 text-[13px]" : "px-2 py-0.5 text-xs",
        tone,
      )}
    >
      <Icon className={size === "md" ? "size-3.5" : "size-3"} strokeWidth={2.25} aria-hidden="true" />
      {due.label}
    </span>
  );
}

/** "Waiting 6 min": pending with no owner for 5+ minutes. */
export function WaitingFlag({ status, assigneeId, createdAt }: { status: RequestStatus; assigneeId: string | null; createdAt: string }) {
  const now = useNow();
  const minutes = waitingMinutes({ status, assignee_id: assigneeId, created_at: createdAt }, now);
  if (minutes === null) return null;
  return (
    <span
      suppressHydrationWarning
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASSES.progress)}
    >
      <Hourglass className="size-3" strokeWidth={2.25} aria-hidden="true" />
      Waiting {minutes} min
    </span>
  );
}

/** "6 min ago", kept fresh. */
export function TimeAgo({ at, className }: { at: string; className?: string }) {
  const now = useNow(30_000);
  const minutes = Math.max(0, Math.round((now - new Date(at).getTime()) / 60000));
  const label = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ago` : `${Math.floor(minutes / 1440)} d ago`;
  return (
    <span suppressHydrationWarning className={className}>
      {label}
    </span>
  );
}
