-- Story #253 (epic E22): Jev is capped by a number of calls a day, and the number starts at zero. Laya is not ready (docs/research/laya-first-readiness-2026-10.md),
-- so the rule decides until the owner raises the cap. One setting, params global/jev_daily_cap, versioned: the latest version wins, every change is a new row with who made it.
-- A "day" is the India day. A Jev call is any decision_log row where the engine was Jev and the call was not skipped (jev_off, jev_daily_cap).

insert into params (kitchen_id, session_id, key, value, version)
values (null, 'global', 'jev_daily_cap', '{"cap":0,"by":"system"}', 1)
on conflict (session_id, key, version) do nothing;

-- n8n (the service role) asks this once per decision: the engine, the cap, and how many Jev calls already ran today.
create or replace function decision_gate()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'engine', coalesce((select value ->> 'engine' from params where session_id = 'global' and key = 'decision_engine' order by version desc limit 1), 'rules'),
    'jev_cap', coalesce((select (value ->> 'cap')::int from params where session_id = 'global' and key = 'jev_daily_cap' order by version desc limit 1), 0),
    'jev_used', (select count(*) from decision_log
                 where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
                   and decision ->> 'engine' = 'jev' and decision ->> 'jev_status' not in ('jev_off', 'jev_daily_cap')))
$$;
revoke execute on function decision_gate() from public, anon, authenticated;
grant execute on function decision_gate() to service_role;

create or replace function set_jev_daily_cap(p_cap int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_by text;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  if p_cap is null or p_cap < 0 or p_cap > 100000 then raise exception 'invalid_cap'; end if;
  select coalesce(email, id::text) into v_by from auth.users where id = auth.uid();
  insert into params (kitchen_id, session_id, key, value, version)
  values (null, 'global', 'jev_daily_cap', jsonb_build_object('cap', p_cap, 'by', coalesce(v_by, 'admin')),
          coalesce((select max(version) from params where session_id = 'global' and key = 'jev_daily_cap'), 0) + 1);
  return jsonb_build_object('ok', true, 'jev_cap', p_cap);
end $$;
revoke all on function set_jev_daily_cap(int) from public, anon;
grant execute on function set_jev_daily_cap(int) to authenticated;

-- The health report gets the AI block: today's Jev calls, their cost, and the cap.
create or replace function health_numbers() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'db_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'connections', (select count(*) from pg_stat_activity),
    'rows', jsonb_build_object('orders', (select count(*) from orders), 'run_log', (select count(*) from run_log),
                               'rider_pings', (select count(*) from rider_pings), 'order_events', (select count(*) from order_events)),
    'oldest', jsonb_build_object('orders', (select min(created_at) from orders), 'run_log', (select min(created_at) from run_log),
                                 'rider_pings', (select min(at) from rider_pings), 'order_events', (select min(created_at) from order_events)),
    'caps', (select value from params where session_id = 'global' and key = 'cost_caps' order by version desc limit 1),
    'ai', jsonb_build_object(
      'jev_calls_today', (decision_gate() ->> 'jev_used')::int,
      'jev_cap', (decision_gate() ->> 'jev_cap')::int,
      'jev_cost_today', coalesce((select sum((decision -> 'jev' ->> 'cost')::numeric) from decision_log
                                  where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
                                    and decision ->> 'engine' = 'jev'), 0))
  )
$$;
