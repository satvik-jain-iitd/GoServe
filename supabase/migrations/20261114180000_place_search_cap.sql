-- Story 1519: the place search asks Ola Maps. A daily cap on those asks, for each person and for the whole app, and the near radius. The day is the India day (Asia/Kolkata).
-- The same pattern as story 1512 (20261114170000_geocode_lookup_cap.sql), with its own counts: a search and an address lookup are counted apart, as Ola counts them.
-- Only counts are kept: a person and a day, and a day total. No typed text, no place, no answer from Ola. A new day drops the old counts.
-- 1) place_search_person_day and place_search_day: the counts. No one reads or writes them but the function below.
-- 2) settings rows place_search_person_day_cap (starts at 100) and place_search_app_day_cap (starts at 2500): whole numbers, 0 or more. 0 stops Ola; our own table answers.
--    settings row place_search_radius_m (starts at 25000): the near radius of the first ask, 1 km to 200 km.
-- 3) place_search_count(person): adds one to both counts when both are under their cap, in one transaction. Returns 'ok', 'person' or 'app'.
--    Only the service role may call it (the edge function place-search). One call for each Ola ask.
-- Additive and safe to run twice: every object is guarded.
-- ponytail: a copy of geocode_count with other names. Fold the two into one counter with a kind column when a third Ola API is counted.
create table if not exists place_search_person_day (
  day date not null,
  person uuid not null references auth.users (id) on delete cascade,
  count integer not null default 0,
  primary key (day, person)
);
create table if not exists place_search_day (
  day date primary key,
  count integer not null default 0
);
alter table place_search_person_day enable row level security;
alter table place_search_day enable row level security;
revoke all on place_search_person_day, place_search_day from public, anon, authenticated;

alter table settings drop constraint if exists settings_place_search_rule;
alter table settings add constraint settings_place_search_rule check (name not in ('place_search_person_day_cap', 'place_search_app_day_cap', 'place_search_radius_m') or
  case when jsonb_typeof(value) = 'number'
       then (value #>> '{}')::numeric % 1 = 0 and
            case when name = 'place_search_radius_m' then (value #>> '{}')::numeric between 1000 and 200000
                 else (value #>> '{}')::numeric between 0 and 1000000 end
       else false end);
insert into settings (name, value) values ('place_search_person_day_cap', '100'::jsonb), ('place_search_app_day_cap', '2500'::jsonb), ('place_search_radius_m', '25000'::jsonb)
  on conflict (name) do nothing;

create or replace function place_search_count(p_person uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_person_cap integer := coalesce((select (value #>> '{}')::integer from settings where name = 'place_search_person_day_cap'), 0);   -- no row: no Ola ask
  v_app_cap integer := coalesce((select (value #>> '{}')::integer from settings where name = 'place_search_app_day_cap'), 0);
begin
  insert into place_search_day (day) values (v_day) on conflict do nothing;
  if found then   -- the first ask of a new day: the old counts go
    delete from place_search_person_day where day < v_day;
    delete from place_search_day where day < v_day;
  end if;
  insert into place_search_person_day (day, person) values (v_day, p_person) on conflict do nothing;
  -- Each update takes the row lock and checks the cap again after it, so two calls at once can never both take the last slot.
  update place_search_person_day set count = count + 1 where day = v_day and person = p_person and count < v_person_cap;
  if not found then return 'person'; end if;
  update place_search_day set count = count + 1 where day = v_day and count < v_app_cap;   -- ponytail: every ask waits on this one row for a moment; fine at a few thousand a day
  if not found then
    update place_search_person_day set count = count - 1 where day = v_day and person = p_person;   -- Ola is not asked, so the person's count does not move
    return 'app';
  end if;
  return 'ok';
end $$;
revoke all on function place_search_count(uuid) from public, anon, authenticated;
grant execute on function place_search_count(uuid) to service_role;
