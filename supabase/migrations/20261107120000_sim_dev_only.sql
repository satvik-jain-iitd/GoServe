-- Story #941 (epic #939): the simulator may only write where the settings row clear_allowed is true. That row is set by hand on dev and never on prod
-- (the same gate sim_clear_all uses). On prod the simulator cannot move, cancel or delete anything, even for an admin.
-- The bodies stay as they are: each write function is renamed to *_unguarded and a thin function with the old name checks the row first.
-- The *_unguarded functions are not callable by any API role; only their guard can call them.

create or replace function sim_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from settings where name = 'clear_allowed'), false)
$$;
revoke all on function sim_allowed() from public, anon, authenticated;
grant execute on function sim_allowed() to service_role;

-- The admin app asks this directly (no n8n) to show Clear everything at once. It is true only for an admin on a database that allows it.
create or replace function sim_clear_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() and sim_allowed()
$$;
revoke all on function sim_clear_allowed() from public, anon;
grant execute on function sim_clear_allowed() to authenticated;

alter function sim_reset() rename to sim_reset_unguarded;
alter function sim_set_knobs(jsonb) rename to sim_set_knobs_unguarded;
alter function sim_enable(jsonb) rename to sim_enable_unguarded;
alter function sim_tick(jsonb) rename to sim_tick_unguarded;
alter function sim_orders_tick() rename to sim_orders_tick_unguarded;
alter function set_sim_riders_serve_all(boolean) rename to set_sim_riders_serve_all_unguarded;

create or replace function sim_reset() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not sim_allowed() then raise exception 'sim_not_allowed: the simulator is off on this database'; end if;
  return sim_reset_unguarded();
end $$;
create or replace function sim_set_knobs(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not sim_allowed() then raise exception 'sim_not_allowed: the simulator is off on this database'; end if;
  return sim_set_knobs_unguarded(p);
end $$;
create or replace function sim_enable(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not sim_allowed() then raise exception 'sim_not_allowed: the simulator is off on this database'; end if;
  return sim_enable_unguarded(p);
end $$;
-- The two ticks run every minute under n8n: a refusal here is a quiet skip, never an error that pages anyone.
create or replace function sim_tick(p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not sim_allowed() then return jsonb_build_object('ok', true, 'skipped', 'sim_not_allowed'); end if;
  return sim_tick_unguarded(p);
end $$;
create or replace function sim_orders_tick() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not sim_allowed() then return jsonb_build_object('ok', true, 'skipped', 'sim_not_allowed'); end if;
  return sim_orders_tick_unguarded();
end $$;
-- Turning serve_all off is allowed anywhere; turning it on only where the simulator is allowed.
create or replace function set_sim_riders_serve_all(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_on and not sim_allowed() then raise exception 'sim_not_allowed: the simulator is off on this database'; end if;
  return set_sim_riders_serve_all_unguarded(p_on);
end $$;

revoke all on function sim_reset_unguarded(), sim_set_knobs_unguarded(jsonb), sim_enable_unguarded(jsonb), sim_tick_unguarded(jsonb), sim_orders_tick_unguarded(), set_sim_riders_serve_all_unguarded(boolean) from public, anon, authenticated, service_role;
revoke all on function sim_reset(), sim_set_knobs(jsonb), sim_enable(jsonb), sim_tick(jsonb), sim_orders_tick() from public, anon, authenticated;
grant execute on function sim_reset(), sim_set_knobs(jsonb), sim_enable(jsonb), sim_tick(jsonb), sim_orders_tick() to service_role;
revoke execute on function set_sim_riders_serve_all(boolean) from public, anon;
grant execute on function set_sim_riders_serve_all(boolean) to authenticated;

-- Real and synthetic never mix unless an admin turns serve_all on, and only on a database that allows it: the default is off, now everywhere.
create or replace function sim_riders_serve_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> 'on')::boolean from params where session_id = 'global' and key = 'sim_riders_serve_all' order by version desc limit 1), false)
$$;
insert into params (kitchen_id, session_id, key, value, version)
values (null, 'global', 'sim_riders_serve_all', '{"on":false}',
        coalesce((select max(version) from params where session_id = 'global' and key = 'sim_riders_serve_all'), 0) + 1);
