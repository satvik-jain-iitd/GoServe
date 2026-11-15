-- Story 1530 (owner, 15 Nov 2026): "Recently searched" on the Deliver to screen. A recent is a place the customer picked from search and confirmed on the pin map.
-- A small table of its own, not a kind on `addresses`: a saved address needs a label, counts in the 20-row cap, in "N saved", in the open-time pick and in the
-- sheet's rows, and a recent must be in none of them. A separate table keeps every one of those paths as it is, with no filter to forget.
-- What a row holds: the confirmed point, the words the customer typed himself (the search words, the house and the landmark from the details sheet) and a postal code
-- that is our own (nearest_pin) or typed by him. Never an answer of Ola Maps (its terms forbid storing one in a table of ours; see supabase/functions/geocode/index.ts).
-- A search row of our own postal code table may be kept as it is.
-- The rows belong to the login (auth.uid), so a second phone has them. Row level security: a customer reads and writes only his own. Deleting the account deletes them
-- (the foreign key cascades when purge_pii deletes the auth.users row).
-- Additive and safe to run twice.
create table if not exists recent_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  address text not null check (length(btrim(address)) between 1 and 300),
  pin_code text not null check (pin_code ~ '^[0-9]{6}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  house text check (house is null or length(house) <= 120),
  landmark text check (landmark is null or length(landmark) <= 120),
  used_at timestamptz not null default now()
);
create index if not exists recent_places_user_used on recent_places (user_id, used_at desc);

alter table recent_places enable row level security;
drop policy if exists recent_places_own on recent_places;
create policy recent_places_own on recent_places for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on recent_places from anon;
grant select, insert, update, delete on recent_places to authenticated;

-- A customer keeps his 10 newest recents: after each new one the older rows go. A hundred searches cannot grow the table without end.
create or replace function recent_places_cap() returns trigger language plpgsql as $$
begin
  delete from recent_places where user_id = new.user_id and id in (
    select id from recent_places where user_id = new.user_id order by used_at desc, id offset 10);
  return null;
end $$;
drop trigger if exists recent_places_cap_t on recent_places;
create trigger recent_places_cap_t after insert on recent_places for each row execute function recent_places_cap();
