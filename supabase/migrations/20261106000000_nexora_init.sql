-- NEXORA schema: one shared request record that the guest portal, staff app and
-- manager dashboard all read and write.
--
-- Security model: every table has row level security ON and NO policies, so the
-- anon and authenticated roles can read or write nothing directly. All access goes
-- through the Next.js server, which checks the guest or staff session first and
-- then uses the service-role key. The browser only ever receives Realtime
-- "something changed" pings (see src/lib/realtime).

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  accent_color text not null default '#0F766E',
  canvas_color text not null default '#FBF8F3',
  timezone text not null default 'Africa/Lagos',
  currency text not null default 'NGN',
  check_in_time text not null default '14:00',
  check_out_time text not null default '12:00',
  wifi_name text,
  wifi_password text,
  phone text,
  whatsapp text,
  address text,
  breakfast_hours text,
  created_at timestamptz not null default now()
);

create table public.departments (
  id text primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  sort int not null default 0
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  number text not null,
  floor int not null,
  room_type text not null,
  rate integer not null,
  status text not null default 'available'
    check (status in ('available', 'occupied', 'cleaning', 'maintenance')),
  status_note text,
  landmark text,
  updated_at timestamptz not null default now(),
  unique (hotel_id, number)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  title text,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  room_id uuid not null references public.rooms(id),
  booking_ref text not null,
  check_in date not null,
  check_out date not null,
  adults int not null default 1,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  access_token text unique,
  access_code text,
  access_expires_at timestamptz,
  access_revoked_at timestamptz,
  payment_status text not null default 'unpaid'
    check (payment_status in ('paid', 'part_paid', 'unpaid', 'refunded')),
  balance integer not null default 0,
  created_at timestamptz not null default now()
);
create index reservations_room_idx on public.reservations (room_id, status);

-- Failed last-name attempts, for the 5-tries-then-10-minutes lock on guest access.
create table public.access_attempts (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index access_attempts_idx on public.access_attempts (reservation_id, created_at);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'manager', 'front_desk', 'staff')),
  job_title text,
  department_id text references public.departments(id),
  on_duty boolean not null default true,
  workpeg_subject text unique,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.services (
  id text primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  category text not null
    check (category in ('amenities', 'housekeeping', 'maintenance', 'food', 'front_desk')),
  department_id text not null references public.departments(id),
  icon text not null,
  action_verb text not null default 'Deliver',
  default_priority text not null default 'normal'
    check (default_priority in ('low', 'normal', 'high', 'urgent')),
  response_target_min int not null default 10,
  resolution_target_min int not null default 30,
  has_quantity boolean not null default false,
  max_quantity int not null default 1,
  ask_urgent boolean not null default false,
  needs_note boolean not null default false,
  guest_visible boolean not null default true,
  featured boolean not null default false,
  active boolean not null default true,
  sort int not null default 0
);

-- Live requests start at NX-1042 so the first demo request matches the brief.
create sequence public.request_code_seq start with 1042;

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('NX-' || nextval('public.request_code_seq')),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  room_id uuid not null references public.rooms(id),
  guest_id uuid references public.guests(id) on delete set null,
  service_id text not null references public.services(id),
  title text not null,
  quantity int not null default 1,
  note text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  department_id text not null references public.departments(id),
  assignee_id uuid references public.staff(id) on delete set null,
  source text not null default 'guest_portal'
    check (source in ('guest_portal', 'front_desk', 'phone', 'workpeg_ai', 'system')),
  ai_suggested boolean not null default false,
  ai_confidence text check (ai_confidence in ('high', 'medium', 'low')),
  ai_engine text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  guest_feedback text check (guest_feedback in ('up', 'down')),
  feedback_note text,
  feedback_at timestamptz,
  follow_up boolean not null default false,
  follow_up_note text,
  updated_at timestamptz not null default now()
);
create index requests_status_idx on public.requests (hotel_id, status, created_at desc);
create index requests_assignee_idx on public.requests (assignee_id, status);
create index requests_reservation_idx on public.requests (reservation_id, created_at desc);
create index requests_room_idx on public.requests (room_id, created_at desc);

-- Every step of every request: who did what, when. This is the accountability trail.
create table public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  kind text not null,
  from_status text,
  to_status text,
  actor_type text not null
    check (actor_type in ('guest', 'staff', 'manager', 'system', 'nexora_ai', 'workpeg_ai')),
  actor_id uuid,
  actor_name text,
  message text not null,
  created_at timestamptz not null default now()
);
create index request_events_idx on public.request_events (request_id, created_at);

-- The Workpeg activity log shown on Settings > Integrations.
create table public.integration_events (
  id bigint generated always as identity primary key,
  hotel_id uuid references public.hotels(id) on delete cascade,
  provider text not null default 'workpeg',
  event text not null,
  result text not null check (result in ('ok', 'error', 'blocked', 'skipped')),
  detail text,
  created_at timestamptz not null default now()
);
create index integration_events_idx on public.integration_events (hotel_id, created_at desc);

-- Which Workpeg table row mirrors which NEXORA record.
create table public.workpeg_links (
  entity text not null,
  entity_id uuid not null,
  table_uuid text not null,
  row_id bigint not null,
  synced_at timestamptz not null default now(),
  primary key (entity, entity_id)
);

-- Small key/value store (for example the Workpeg table UUID created at first sync).
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lock everything down. No policies = no direct access for anon/authenticated.
alter table public.hotels enable row level security;
alter table public.departments enable row level security;
alter table public.rooms enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.access_attempts enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.requests enable row level security;
alter table public.request_events enable row level security;
alter table public.integration_events enable row level security;
alter table public.workpeg_links enable row level security;
alter table public.app_settings enable row level security;

-- Demo reset helper: restart request codes at NX-1042. Service role only.
create or replace function public.nexora_restart_request_codes()
returns void
language sql
security definer
set search_path = ''
as $$
  select setval('public.request_code_seq', 1042, false);
$$;

revoke execute on function public.nexora_restart_request_codes() from public, anon, authenticated;
grant execute on function public.nexora_restart_request_codes() to service_role;
