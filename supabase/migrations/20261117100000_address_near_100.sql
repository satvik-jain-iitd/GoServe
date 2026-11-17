-- Story #1608 (owner, 17 Nov 2026): the near distance of a saved address is 100 m, not 200. Three saved addresses close to each other all read as "here" at 200.
-- address_near_start() is the one start value; address_near_m() answers it when the setting has no number. The setting moves to 100 only when it is still 200,
-- so a value the admin set himself is kept.
-- The first object of this file is new (address_near_start) so the prod plan reads the file as not yet applied; create or replace lets the tests run the text again on dev.

create or replace function address_near_start() returns integer language sql immutable set search_path = public as $$ select 100 $$;
revoke all on function address_near_start() from public, anon, authenticated;

create or replace function address_near_m() returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::integer from settings where name = 'address_near_m' and jsonb_typeof(value) = 'number'), address_near_start())
$$;

update settings set value = '100'::jsonb where name = 'address_near_m' and value = '200'::jsonb;
