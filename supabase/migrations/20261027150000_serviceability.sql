-- Story #342 (E27, plan v2 B.6). Serviceability by distance: a kitchen delivers to places inside its radius.
-- The kitchen already has lat and lng (0013). Radius and prep time are new; the ETA is prep time plus the ride.
alter table kitchens
  add column radius_m integer not null default 3000 check (radius_m between 100 and 20000),
  add column prep_minutes integer not null default 20 check (prep_minutes between 0 and 180);

-- 'Request here': a place no kitchen reaches yet. Anyone can add a row; nobody but the service role can read the list.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  pin_code text check (pin_code ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table waitlist enable row level security;
revoke all on waitlist from anon, authenticated;
grant insert on waitlist to anon, authenticated;
create policy waitlist_add on waitlist for insert to anon, authenticated with check (true);
