import "server-only";
import { revalidatePath } from "next/cache";
import { dueState, waitingMinutes } from "./sla";
import { PRIORITY_RANK, SOURCE_LABEL, STATUS_LABEL } from "./labels";
import type { RequestView } from "./types";

/** A request as the mobile app shows it: the row plus labels worked out the same way the web app does. */
export function mobileTask(r: RequestView, now = Date.now()) {
  const due = dueState(r, now);
  const wait = waitingMinutes(r, now);
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    quantity: r.quantity,
    note: r.note,
    priority: r.priority,
    source: r.source,
    sourceLabel: SOURCE_LABEL[r.source],
    status: r.status,
    statusLabel: STATUS_LABEL[r.status],
    departmentId: r.department_id,
    room: r.room ? { number: r.room.number, floor: r.room.floor, landmark: r.room.landmark } : null,
    service: r.service ? { name: r.service.name, icon: r.service.icon, category: r.service.category } : null,
    guestFirstName: r.guest?.first_name ?? null,
    assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.full_name } : null,
    due: { kind: due.kind, label: due.label },
    waitingLabel: wait !== null ? `Waiting ${wait} min` : null,
    createdAt: r.created_at,
    assignedAt: r.assigned_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

export type MobileTask = ReturnType<typeof mobileTask>;

export function sortTasks(a: RequestView, b: RequestView, now = Date.now()) {
  const urgent = (r: RequestView) => (r.priority === "urgent" ? 0 : 1);
  const overdue = (r: RequestView) => (dueState(r, now).kind === "overdue" ? 0 : 1);
  return (
    urgent(a) - urgent(b) ||
    overdue(a) - overdue(b) ||
    (a.due_at ?? "").localeCompare(b.due_at ?? "") ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  );
}

/** Keeps the web staff app and the dashboard in step with changes made from a phone. */
export function refreshWeb() {
  revalidatePath("/staff", "layout");
  revalidatePath("/dashboard", "layout");
}
