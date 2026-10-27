-- Story #488 (epic E25). The Supabase free limits that SQL can answer: storage size, auth users, and users who signed in during the last 30 days
-- (the nearest SQL gets to monthly active users; the dashboard number is the real one). Billed egress has no source (docs/research/supabase-health-2026-10.md).
-- Everything else in health_numbers() stays as it was in 0039.

create or replace function health_numbers() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'db_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'storage_mb', round(coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects), 0) / 1048576.0, 1),
    'users', (select count(*) from auth.users),
    'users_active_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
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
