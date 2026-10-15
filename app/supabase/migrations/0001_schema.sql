-- Story #43. The 7 MVP 0 tables (docs/architecture/mvp0-build-design.md section 5).
-- Every table has kitchen_id and session_id. RLS and Realtime come in story #44.

create table kitchens (
  id uuid primary key default gen_random_uuid(),
  session_id text not null default 'demo',
  name text not null
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens (id),
  session_id text not null default 'demo',
  name text not null,
  price_paise integer not null check (price_paise >= 0),
  available boolean not null default true
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens (id),
  session_id text not null default 'demo',
  client_order_key text not null,  -- made by the phone; a retry reuses it
  status text not null default 'placed'
    check (status in ('placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered')),
  items jsonb not null,
  total_paise integer not null check (total_paise >= 0),
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, client_order_key)
);

create table order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id),
  kitchen_id uuid not null references kitchens (id),
  session_id text not null default 'demo',
  event text not null,
  actor text,
  created_at timestamptz not null default now()
);

create table decision_log (
  id bigint generated always as identity primary key,
  kitchen_id uuid not null references kitchens (id),
  session_id text not null default 'demo',
  order_id uuid references orders (id),
  decision jsonb not null,  -- shape in docs/ai/LAYA_PLAN.md section 4
  created_at timestamptz not null default now()
);

create table run_log (
  id bigint generated always as identity primary key,
  kitchen_id uuid not null references kitchens (id),
  session_id text not null default 'demo',
  workflow text not null,
  params_version integer,
  duration_ms integer,
  cost numeric,
  error text,
  created_at timestamptz not null default now()
);

create table params (
  id bigint generated always as identity primary key,
  kitchen_id uuid not null references kitchens (id),
  session_id text not null default 'demo',
  key text not null,
  value jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (session_id, key, version)
);

-- Legal-status rule: an order moves one step forward, in this order, and never back.
create function orders_check_status() returns trigger language plpgsql as $$
declare
  steps text[] := array['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
begin
  if new.status <> old.status
     and array_position(steps, new.status) <> array_position(steps, old.status) + 1 then
    raise exception 'illegal status step: % to %', old.status, new.status;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger orders_status_rule before update on orders
  for each row execute function orders_check_status();

-- order_events are history: never edited, never deleted.
create function order_events_frozen() returns trigger language plpgsql as $$
begin
  raise exception 'order_events cannot be changed';
end $$;

create trigger order_events_no_change before update or delete on order_events
  for each row execute function order_events_frozen();
