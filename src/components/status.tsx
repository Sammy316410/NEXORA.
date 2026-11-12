import {
  CircleCheck,
  CircleX,
  Hourglass,
  Inbox,
  Phone,
  Sparkles,
  Timer,
  TriangleExclamationPoint,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  GUEST_STATUS_LABEL,
  PRIORITY_LABEL,
  ROOM_STATUS_CODE,
  ROOM_STATUS_LABEL,
  ROOM_STATUS_TONE,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  type Tone,
} from "@/lib/labels";
import type { Confidence, Priority, RequestSource, RequestStatus, RoomStatus } from "@/lib/types";

export const TONE_CLASSES: Record<Tone, string> = {
  pending: "bg-pending-bg text-pending",
  assigned: "bg-assigned-bg text-assigned",
  progress: "bg-progress-bg text-progress",
  done: "bg-done-bg text-done",
  alert: "bg-alert-bg text-alert",
  neutral: "bg-neutral-bg text-neutral",
};

const STATUS_ICONS: Record<RequestStatus, LucideIcon> = {
  awaiting_payment: Wallet,
  pending: Inbox,
  assigned: UserCheck,
  in_progress: Timer,
  completed: CircleCheck,
  cancelled: CircleX,
};

export function Chip({
  tone,
  icon: Icon,
  children,
  size = "sm",
  className,
  title,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap",
        size === "md" ? "px-2.5 py-1 text-[13px]" : "px-2 py-0.5 text-xs",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {Icon ? <Icon className={size === "md" ? "size-3.5" : "size-3"} strokeWidth={2.25} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Request status: internal words for staff, warmer words for guests. Icon + label + colour. */
export function StatusChip({ status, guest = false, size }: { status: RequestStatus; guest?: boolean; size?: "sm" | "md" }) {
  return (
    <Chip tone={STATUS_TONE[status]} icon={STATUS_ICONS[status]} size={size}>
      {guest ? GUEST_STATUS_LABEL[status] : STATUS_LABEL[status]}
    </Chip>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "urgent") {
    return (
      <Chip tone="alert" icon={TriangleExclamationPoint}>
        Urgent
      </Chip>
    );
  }
  if (priority === "high") {
    return (
      <Chip tone="progress" icon={TriangleExclamationPoint}>
        High
      </Chip>
    );
  }
  return <span className="text-xs text-muted">{PRIORITY_LABEL[priority]}</span>;
}

/** Left-edge colour bar for request cards. */
export function priorityEdge(priority: Priority): string {
  return priority === "urgent" ? "bg-alert-solid" : priority === "high" ? "bg-[#F5A524]" : "bg-transparent";
}

/** AI-made things look different from statuses: outlined, with a sparkle. */
export function AIChip({ label, confidence, title }: { label?: string; confidence?: Confidence | null; title?: string }) {
  return (
    <span
      title={title ?? "Suggested automatically. A person can change it."}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/20 bg-surface px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink"
    >
      <Sparkles className="size-3" strokeWidth={2.25} aria-hidden="true" />
      {label ?? "AI"}
      {confidence ? <span className="text-muted">{`· ${confidence}`}</span> : null}
    </span>
  );
}

export function RoomStatusChip({ status, size }: { status: RoomStatus; size?: "sm" | "md" }) {
  return (
    <Chip tone={ROOM_STATUS_TONE[status]} size={size} title={`Hotel code: ${ROOM_STATUS_CODE[status]}`}>
      {ROOM_STATUS_LABEL[status]}
    </Chip>
  );
}

export function SourceTag({ source }: { source: RequestSource }) {
  if (source === "guest_portal") return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      {source === "phone" ? <Phone className="size-3" aria-hidden="true" /> : null}
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function WaitingChip({ minutes }: { minutes: number }) {
  return (
    <Chip tone="progress" icon={Hourglass}>
      Waiting {minutes} min
    </Chip>
  );
}
