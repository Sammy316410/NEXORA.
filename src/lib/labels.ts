import type {
  Priority,
  RequestSource,
  RequestStatus,
  ReservationStatus,
  RoomStatus,
  StaffRole,
} from "./types";

/** What staff and managers see. */
export const STATUS_LABEL: Record<RequestStatus, string> = {
  awaiting_payment: "Awaiting payment",
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** What guests see for the same state (warmer words). */
export const GUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  awaiting_payment: "Awaiting payment",
  pending: "Received",
  assigned: "Assigned",
  in_progress: "On it",
  completed: "Done",
  cancelled: "Cancelled",
};

export type Tone = "pending" | "assigned" | "progress" | "done" | "alert" | "neutral";

export const STATUS_TONE: Record<RequestStatus, Tone> = {
  awaiting_payment: "neutral",
  pending: "pending",
  assigned: "assigned",
  in_progress: "progress",
  completed: "done",
  cancelled: "neutral",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

/** Hotel codes, shown as a tooltip next to the word (codes differ between systems). */
export const ROOM_STATUS_CODE: Record<RoomStatus, string> = {
  available: "VC",
  occupied: "OC",
  cleaning: "VD",
  maintenance: "OOO",
};

export const ROOM_STATUS_TONE: Record<RoomStatus, Tone> = {
  available: "done",
  occupied: "assigned",
  cleaning: "progress",
  maintenance: "alert",
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const SOURCE_LABEL: Record<RequestSource, string> = {
  guest_portal: "Guest portal",
  front_desk: "Front desk",
  phone: "Phone",
  workpeg_ai: "Workpeg AI",
  system: "System",
};

export const DEPARTMENT_LABEL: Record<string, string> = {
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
  food: "Food and drinks",
  front_desk: "Front desk",
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  manager: "Manager",
  front_desk: "Front desk",
  staff: "Staff",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  initialized: "Not completed",
  pending: "Confirming",
  succeeded: "Paid",
  failed: "Failed",
  abandoned: "Cancelled",
  refunded: "Refunded",
};

export const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  initialized: "neutral",
  pending: "progress",
  succeeded: "done",
  failed: "alert",
  abandoned: "neutral",
  refunded: "assigned",
};

export const REQUEST_PAYMENT_LABEL: Record<string, string> = {
  not_required: "",
  awaiting: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  charged_to_room: "Charged to room",
  refunded: "Refunded",
};

export function departmentName(id: string | null | undefined): string {
  if (!id) return "No department";
  return DEPARTMENT_LABEL[id] ?? id;
}
