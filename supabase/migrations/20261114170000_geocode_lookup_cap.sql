-- Story 1512: a daily cap on Ola address lookups, for each person and for the whole app. The day is the India day (Asia/Kolkata).
-- Only counts are kept: a person and a day, and a day total. No place, no answer from Ola. A new day drops the old counts.
-- 1) geocode_person_day and geocode_day: the counts. No one reads or writes them but the function below.
-- 2) settings rows geocode_person_day_cap (starts at 30) and geocode_app_day_cap (starts at 2500): whole numbers, 0 or more. 0 stops Ola.
-- 3) geocode_count(person): adds one to both counts when both are under their cap, in one transaction. Returns 'ok', 'person' or 'app'.
--    Only the service role may call it (the edge function geocode).
-- Additive and safe to run twice: every object is guarded.
create table if not exists geocode_person_day (
  day date not null,
  person uuid not null references auth.users (id) on delete cascade,
  count integer not null default 0,
  primary key (day, person)
);
create table if not exists geocode_day (
  day date primary key,
  count integer not null default 0
);
alter table geocode_person_day enable row level security;
alter table geocode_day enable row level security;
revoke all on geocode_person_day, geocode_day from public, anon, authenticated;

alter table settings drop constraint if exists settings_geocode_day_cap_rule;
alter table settings add constraint settings_geocode_day_cap_rule check (name not in ('geocode_person_day_cap', 'geocode_app_day_cap') or
  case when jsonb_typeof(value) = 'number'
       then (value #>> '{}')::numeric between 0 and 1000000 and (value #>> '{}')::numeric % 1 = 0
       else false end);
insert into settings (name, value) values ('geocode_person_day_cap', '30'::jsonb), ('geocode_app_day_cap', '2500'::jsonb) on conflict (name) do nothing;

create or replace function geocode_count(p_person uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_person_cap integer := coalesce((select (value #>> '{}')::integer from settings where name = 'geocode_person_day_cap'), 0);   -- no row: no Ola call
  v_app_cap integer := coalesce((select (value #>> '{}')::integer from settings where name = 'geocode_app_day_cap'), 0);
begin
  insert into geocode_day (day) values (v_day) on conflict do nothing;
  if found then   -- the first lookup of a new day: the old counts go
    delete from geocode_person_day where day < v_day;
    delete from geocode_day where day < v_day;
  end if;
  insert into geocode_person_day (day, person) values (v_day, p_person) on conflict do nothing;
  -- Each update takes the row lock and checks the cap again after it, so two calls at once can never both take the last slot.
  update geocode_person_day set count = count + 1 where day = v_day and person = p_person and count < v_person_cap;
  if not found then return 'person'; end if;
  update geocode_day set count = count + 1 where day = v_day and count < v_app_cap;   -- ponytail: every lookup waits on this one row for a moment; fine at a few thousand a day, split the total if lookups ever queue
  if not found then
    update geocode_person_day set count = count - 1 where day = v_day and person = p_person;   -- Ola is not asked, so the person's count does not move
    return 'app';
  end if;
  return 'ok';
end $$;
revoke all on function geocode_count(uuid) from public, anon, authenticated;
grant execute on function geocode_count(uuid) to service_role;
