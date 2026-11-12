-- Payments: menu orders, a per-stay bill (folio) and payment transactions.
--
-- Money in these tables is stored in minor units (kobo for NGN), as payment
-- gateways expect. The older reservations.balance column stays in major units
-- and is recomputed from this data.

-- An order the guest chose to pay for now waits here until the money arrives.
alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('awaiting_payment', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'));

alter table public.requests
  add column amount_minor integer not null default 0,
  add column payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'awaiting', 'paid', 'failed', 'charged_to_room', 'refunded'));

create table public.menu_items (
  id text primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('mains', 'light', 'drinks', 'desserts')),
  price_minor integer not null check (price_minor > 0),
  available boolean not null default true,
  sort int not null default 0
);

create table public.request_items (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests(id) on delete cascade,
  menu_item_id text references public.menu_items(id) on delete set null,
  name text not null,
  unit_price_minor integer not null check (unit_price_minor >= 0),
  quantity integer not null check (quantity > 0)
);
create index request_items_idx on public.request_items (request_id);

-- One row per payment attempt. A retry is a new row with a new reference.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  purpose text not null check (purpose in ('order', 'bill', 'deposit')),
  provider text not null,
  mode text not null check (mode in ('test', 'live')),
  reference text not null unique,
  provider_reference text,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'NGN',
  status text not null default 'initialized'
    check (status in ('initialized', 'pending', 'succeeded', 'failed', 'abandoned', 'refunded')),
  failure_reason text,
  channel text,
  card_brand text,
  card_last4 text,
  checkout_url text,
  payer_email text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_reservation_idx on public.payments (reservation_id, created_at desc);
create index payments_hotel_idx on public.payments (hotel_id, created_at desc);
create index payments_request_idx on public.payments (request_id);

-- The built-in sandbox gateway's own ledger. It plays the part of the payment
-- provider, so NEXORA verifies sandbox payments exactly as it verifies Paystack:
-- by asking "the gateway", never by trusting the browser.
create table public.sandbox_transactions (
  reference text primary key,
  merchant text not null,
  description text not null,
  email text not null,
  amount_minor integer not null,
  currency text not null,
  callback_url text not null,
  status text not null default 'initialized'
    check (status in ('initialized', 'pending', 'success', 'failed', 'abandoned')),
  channel text,
  card_brand text,
  card_last4 text,
  gateway_response text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.menu_items enable row level security;
alter table public.request_items enable row level security;
alter table public.payments enable row level security;
alter table public.sandbox_transactions enable row level security;
