-- Workpeg inbound permission: the key Workpeg sends us when a hotel's owner or
-- admin presses Allow, so guest requests from our room-QR page are added to the
-- NEXORA peg's Guest requests table. One key per business and table, stored
-- encrypted (AES-256-GCM, see src/lib/workpeg-permissions.ts).
create table public.workpeg_inbound_keys (
  business text not null,
  table_uuid text not null,
  grant_id text not null,
  key_id text,
  sequence integer not null,
  name text not null,
  key_cipher text,
  revoked_at timestamptz,
  received_at timestamptz not null default now(),
  primary key (business, table_uuid)
);

-- Delivery ids seen in the last 10 minutes, so a replayed delivery is refused.
create table public.workpeg_deliveries (
  delivery text primary key,
  seen_at timestamptz not null default now()
);

alter table public.workpeg_inbound_keys enable row level security;
alter table public.workpeg_deliveries enable row level security;
