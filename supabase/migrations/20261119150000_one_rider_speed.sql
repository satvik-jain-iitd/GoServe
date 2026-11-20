-- Story 1689: one rider speed. The phone says 20 km/h (RIDER_KMPH in app/src/lib/riderMap.ts); the server said 300 m a minute (18 km/h).
-- Now both say 20 km/h = 333.33 m a minute. A change to the rules is a new version, never an edit: version 1 stays as it was.
-- Safe to run twice: the guard adds the version 2 row only once, and create or replace is the same function again.
-- The marker the prod plan looks for: a file that only replaces eta_rules() leaves no new object to prove it ran. This one returns the newest rules version.
create or replace function eta_rules_version() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select max(version) from params where session_id = 'global' and key = 'eta_rules' and kitchen_id is null), 0)
$$;
revoke all on function eta_rules_version() from public, anon, authenticated;

insert into params (session_id, key, value, version)
select 'global', 'eta_rules', '{"speed_m_min": 333.33, "detour": 1.3, "buffer_min": 10}'::jsonb, 2
where not exists (select 1 from params where session_id = 'global' and key = 'eta_rules' and version = 2);

create or replace function eta_rules() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from params where session_id = 'global' and key = 'eta_rules' and kitchen_id is null order by version desc limit 1),
    '{"speed_m_min": 333.33, "detour": 1.3, "buffer_min": 10}'::jsonb)
$$;
revoke all on function eta_rules() from public, anon, authenticated;
