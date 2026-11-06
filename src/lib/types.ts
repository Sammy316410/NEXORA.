export type RequestStatus = "awaiting_payment" | "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
export type RequestPaymentStatus = "not_required" | "awaiting" | "paid" | "failed" | "charged_to_room" | "refunded";
export type Priority = "low" | "normal" | "high" | "urgent";
export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance";
export type ReservationStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
export type StaffRole = "admin" | "manager" | "front_desk" | "staff";
export type RequestSource = "guest_portal" | "front_desk" | "phone" | "workpeg_ai" | "system";
export type ActorType = "guest" | "staff" | "manager" | "system" | "nexora_ai" | "workpeg_ai";
export type Confidence = "high" | "medium" | "low";
export type ServiceCategory = "amenities" | "housekeeping" | "maintenance" | "food" | "front_desk";

export interface Hotel {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  accent_color: string;
  canvas_color: string;
  timezone: string;
  currency: string;
  check_in_time: string;
  check_out_time: string;
  wifi_name: string | null;
  wifi_password: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  breakfast_hours: string | null;
}

export interface Department {
  id: string;
  hotel_id: string;
  name: string;
  sort: number;
}

export interface Room {
  id: string;
  hotel_id: string;
  number: string;
  floor: number;
  room_type: string;
  rate: number;
  status: RoomStatus;
  status_note: string | null;
  landmark: string | null;
  updated_at: string;
}

export interface Guest {
  id: string;
  hotel_id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
}

export interface Reservation {
  id: string;
  hotel_id: string;
  guest_id: string;
  room_id: string;
  booking_ref: string;
  check_in: string;
  check_out: string;
  adults: number;
  status: ReservationStatus;
  access_token: string | null;
  access_code: string | null;
  access_expires_at: string | null;
  access_revoked_at: string | null;
  payment_status: "paid" | "part_paid" | "unpaid" | "refunded";
  balance: number;
}

export interface Staff {
  id: string;
  hotel_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  role: StaffRole;
  job_title: string | null;
  department_id: string | null;
  on_duty: boolean;
  workpeg_subject: string | null;
  last_seen_at: string | null;
}

export interface Service {
  id: string;
  hotel_id: string;
  name: string;
  category: ServiceCategory;
  department_id: string;
  icon: string;
  action_verb: string;
  default_priority: Priority;
  response_target_min: number;
  resolution_target_min: number;
  has_quantity: boolean;
  max_quantity: number;
  ask_urgent: boolean;
  needs_note: boolean;
  guest_visible: boolean;
  featured: boolean;
  active: boolean;
  sort: number;
}

export interface ServiceRequest {
  id: string;
  code: string;
  hotel_id: string;
  reservation_id: string | null;
  room_id: string;
  guest_id: string | null;
  service_id: string;
  title: string;
  quantity: number;
  note: string | null;
  priority: Priority;
  status: RequestStatus;
  department_id: string;
  assignee_id: string | null;
  source: RequestSource;
  ai_suggested: boolean;
  ai_confidence: Confidence | null;
  ai_engine: string | null;
  due_at: string | null;
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  guest_feedback: "up" | "down" | null;
  feedback_note: string | null;
  feedback_at: string | null;
  follow_up: boolean;
  follow_up_note: string | null;
  updated_at: string;
  amount_minor: number;
  payment_status: RequestPaymentStatus;
}

export interface MenuItem {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  category: "mains" | "light" | "drinks" | "desserts";
  price_minor: number;
  available: boolean;
  sort: number;
}

export interface RequestItem {
  id: number;
  request_id: string;
  menu_item_id: string | null;
  name: string;
  unit_price_minor: number;
  quantity: number;
}

export type PaymentStatus = "initialized" | "pending" | "succeeded" | "failed" | "abandoned" | "refunded";

export interface Payment {
  id: string;
  hotel_id: string;
  reservation_id: string | null;
  request_id: string | null;
  purpose: "order" | "bill" | "deposit";
  provider: string;
  mode: "test" | "live";
  reference: string;
  provider_reference: string | null;
  amount_minor: number;
  currency: string;
  status: PaymentStatus;
  failure_reason: string | null;
  channel: string | null;
  card_brand: string | null;
  card_last4: string | null;
  checkout_url: string | null;
  payer_email: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A request joined with the things every screen shows next to it. */
export interface RequestView extends ServiceRequest {
  room: Pick<Room, "id" | "number" | "floor" | "room_type" | "landmark">;
  service: Pick<Service, "id" | "name" | "icon" | "category" | "action_verb" | "resolution_target_min" | "response_target_min">;
  guest: Pick<Guest, "id" | "first_name" | "last_name" | "title"> | null;
  assignee: Pick<Staff, "id" | "full_name" | "department_id" | "on_duty"> | null;
}

export interface RequestEvent {
  id: number;
  request_id: string;
  kind: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus | null;
  actor_type: ActorType;
  actor_id: string | null;
  actor_name: string | null;
  message: string;
  created_at: string;
}

export interface Actor {
  type: ActorType;
  id?: string | null;
  name: string;
}
