-- Story H15 (#205, epic E20). What the weekly and monthly report reads about the platform itself, and the caps it is judged against.
-- Only the service role (n8n) may call health_numbers: it shows table sizes and open connections.

-- The caps, one global versioned row (rule 17: a change is a new version, the old one stays for a one-step rollback).
insert into params (kitchen_id, session_id, key, value, version) values
  (null, 'global', 'cost_caps', '{"openrouter_usd":2,"supabase_mb":500,"n8n_errors_day":5}', 1);

create function health_numbers() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'db_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'connections', (select count(*) from pg_stat_activity),
    'rows', jsonb_build_object('orders', (select count(*) from orders), 'run_log', (select count(*) from run_log),
                               'rider_pings', (select count(*) from rider_pings), 'order_events', (select count(*) from order_events)),
    'oldest', jsonb_build_object('orders', (select min(created_at) from orders), 'run_log', (select min(created_at) from run_log),
                                 'rider_pings', (select min(at) from rider_pings), 'order_events', (select min(created_at) from order_events)),
    'caps', (select value from params where session_id = 'global' and key = 'cost_caps' order by version desc limit 1)
  )
$$;
revoke execute on function health_numbers() from public, anon, authenticated;
grant execute on function health_numbers() to service_role;
