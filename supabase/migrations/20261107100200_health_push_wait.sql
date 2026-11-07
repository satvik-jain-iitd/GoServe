-- Story #920 (3 of 3). health_numbers() says how long the oldest waiting push has waited (push_wait_s, null when nothing waits). The daily card turns more than 120 s into an alert.
-- Everything else stays as it was in 0046. The partial index keeps the min() cheap however many old rows pile up; it is also the file's marker for the prod plan
-- (health_numbers is already a V1 marker, so a function alone would read as present on prod).

create index if not exists push_outbox_waiting_idx on push_outbox (created_at) where taken_at is null and sent_at is null and dead_at is null;

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
    'push_wait_s', (select round(extract(epoch from now() - min(created_at)))::int from push_outbox where taken_at is null and sent_at is null and dead_at is null),
    'caps', (select value from params where session_id = 'global' and key = 'cost_caps' order by version desc limit 1),
    'ai', jsonb_build_object(
      'jev_calls_today', (decision_gate() ->> 'jev_used')::int,
      'jev_cap', (decision_gate() ->> 'jev_cap')::int,
      'jev_cost_today', coalesce((select sum((decision -> 'jev' ->> 'cost')::numeric) from decision_log
                                  where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
                                    and decision ->> 'engine' = 'jev'), 0))
  )
$$;
