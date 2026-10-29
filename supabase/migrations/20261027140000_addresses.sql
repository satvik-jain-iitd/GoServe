-- Story #341 (E27, plan v2 B.5). Saved addresses: a customer saves a place once and picks it in a tap.
-- "Signed in" is auth.uid(). Only the owner can read, save, change or delete a row; there is no other path in. The CRUD endpoints are
-- PostgREST on this table with the customer's own login token, so row level security is the only gate (one way in, no copy of the rule).

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 30),
  house text not null check (length(trim(house)) > 0),
  building text not null check (length(trim(building)) > 0),
  landmark text,
  pin_code text not null check (pin_code ~ '^[0-9]{6}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user on addresses (user_id, created_at);
create unique index addresses_one_default on addresses (user_id) where is_default;

alter table addresses enable row level security;
create policy addresses_own on addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on addresses from anon;
