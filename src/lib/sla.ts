import type { RequestStatus } from "./types";
import { fmtDuration, minutesBetween } from "./format";

/** Pending this long with nobody assigned = the "Waiting" flag. NEXORA default. */
export const WAITING_AFTER_MIN = 5;
/** The due chip turns amber this many minutes before the due time. NEXORA default. */
export const DUE_SOON_MIN = 5;

export const OPEN_STATUSES: RequestStatus[] = ["pending", "assigned", "in_progress"];

/** Resolution target used for the due time. Urgent work is capped at 30 minutes. NEXORA default. */
export function dueTargetMinutes(resolutionTargetMin: number, priority: string): number {
  return priority === "urgent" ? Math.min(resolutionTargetMin, 30) : resolutionTargetMin;
}

export function isOpen(status: RequestStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export type DueKind = "none" | "ok" | "soon" | "overdue";

export interface DueState {
  kind: DueKind;
  minutes: number;
  label: string;
}

export function dueState(
  r: { status: RequestStatus; due_at: string | null },
  now = Date.now(),
): DueState {
  if (!r.due_at || !isOpen(r.status)) return { kind: "none", minutes: 0, label: "" };
  const remaining = -minutesBetween(r.due_at, now) || 0;
  if (remaining < 0) {
    const late = Math.abs(remaining);
    return { kind: "overdue", minutes: late, label: `Overdue ${fmtDuration(late)}` };
  }
  if (remaining <= DUE_SOON_MIN) {
    return { kind: "soon", minutes: remaining, label: remaining === 0 ? "Due now" : `Due in ${fmtDuration(remaining)}` };
  }
  return { kind: "ok", minutes: remaining, label: `Due in ${fmtDuration(remaining)}` };
}

/** Minutes a pending, unassigned request has been waiting, or null if the flag doesn't apply. */
export function waitingMinutes(
  r: { status: RequestStatus; assignee_id: string | null; created_at: string },
  now = Date.now(),
): number | null {
  if (r.status !== "pending" || r.assignee_id) return null;
  const age = minutesBetween(r.created_at, now);
  return age >= WAITING_AFTER_MIN ? age : null;
}

export interface Clocks {
  /** sent -> assigned */
  assign: number | null;
  /** sent -> started (the industry "response time") */
  response: number | null;
  /** started -> done */
  work: number | null;
  /** sent -> done */
  resolution: number | null;
}

export function clocks(r: {
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}): Clocks {
  return {
    assign: r.assigned_at ? minutesBetween(r.created_at, r.assigned_at) : null,
    response: r.started_at ? minutesBetween(r.created_at, r.started_at) : null,
    work: r.started_at && r.completed_at ? minutesBetween(r.started_at, r.completed_at) : null,
    resolution: r.completed_at ? minutesBetween(r.created_at, r.completed_at) : null,
  };
}

export function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
