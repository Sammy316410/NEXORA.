import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEPARTMENT_LABEL } from "@/lib/labels";
import { firstName, fmtTime } from "@/lib/format";
import { dueState } from "@/lib/sla";
import type { RequestView } from "@/lib/types";

const ORDER = ["pending", "assigned", "in_progress", "completed"] as const;

function stepIndex(status: RequestView["status"]): number {
  const i = ORDER.indexOf(status as (typeof ORDER)[number]);
  return i === -1 ? 0 : i;
}

/** The four-bar mini progress used on request cards. */
export function MiniProgress({ status }: { status: RequestView["status"] }) {
  const at = stepIndex(status);
  return (
    <div className="flex gap-1" aria-hidden="true">
      {ORDER.map((s, i) => (
        <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= at && status !== "cancelled" ? "bg-hotel" : "bg-line")} />
      ))}
    </div>
  );
}

/** G5: the vertical four-step timeline the guest watches. */
export function GuestTimeline({ request, tz }: { request: RequestView; tz: string }) {
  const at = stepIndex(request.status);
  const who = request.assignee ? firstName(request.assignee.full_name) : null;
  const dept = DEPARTMENT_LABEL[request.department_id] ?? "the team";
  const late = dueState(request).kind === "overdue";

  const steps = [
    { key: "pending", title: "Received", detail: "We've got your request.", time: request.created_at },
    { key: "assigned", title: "Assigned", detail: who ? `${who} from ${dept} has it.` : `${dept} will pick it up.`, time: request.assigned_at },
    { key: "in_progress", title: "On it", detail: who ? `${who} is on the way.` : "Someone is on the way.", time: request.started_at },
    { key: "completed", title: "Done", detail: "Completed.", time: request.completed_at },
  ];

  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const done = i < at || request.status === "completed";
        const current = i === at && request.status !== "completed";
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 ? (
              <span className={cn("absolute top-9 left-[17px] h-[calc(100%-36px)] w-0.5", done ? "bg-hotel" : "bg-line")} aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                done ? "border-hotel bg-hotel text-white" : current ? "border-hotel bg-surface text-hotel" : "border-line bg-surface text-muted",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
              {current ? <span className="absolute inset-0 animate-ping rounded-full border-2 border-hotel opacity-40" aria-hidden="true" /> : null}
            </span>
            <div className="pt-1">
              <p className={cn("font-display text-[15px] font-bold", !done && !current && "text-muted")}>
                {step.title}
                {step.time && (done || current) ? <span className="ml-2 text-sm font-medium text-muted tabular-nums">{fmtTime(step.time, tz)}</span> : null}
              </p>
              {done || current ? <p className="text-sm text-muted">{current && late && i > 0 ? "Taking longer than usual — we've nudged the team." : step.detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
