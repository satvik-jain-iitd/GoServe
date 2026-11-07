-- Story #920. Three changes to the push queue, one file.
-- 1. A restart never fires old pushes: push_outbox_take marks every row older than 10 minutes dead as 'stale' (reoffers unchanged) before it hands anything out.
-- 2. The phone gets the order id with the text, so the service worker can use it as the notification tag (one notification per order).
-- 3. health_numbers() says how long the oldest waiting push has waited (push_wait_s, null when nothing waits). The daily card turns more than 120 s into an alert.
-- Everything else in the three functions stays as it was in 0050 / 0046.

create or replace function push_outbox_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  r record;
begin
  perform open_alerts_sweep();
  delete from push_outbox where created_at < now() - interval '2 days';
  for r in update push_outbox set dead_at = now() where created_at < now() - interval '10 minutes' and sent_at is null and dead_at is null
           returning order_id, status loop
    if r.order_id is not null then perform trace_write(r.order_id, 'db', 'push_dead', r.status, 'stale', null); end if;
  end loop;
  for r in update push_outbox set dead_at = now() where taken_at < now() - interval '2 minutes' and sent_at is null and dead_at is null and reoffers >= 3
           returning order_id, status loop
    if r.order_id is not null then perform trace_write(r.order_id, 'db', 'push_dead', r.status, 'not sent after 3 re-offers', null); end if;
  end loop;
  with t as (select id from push_outbox
             where sent_at is null and dead_at is null and (taken_at is null or taken_at < now() - interval '2 minutes')
             order by id limit greatest(1, least(p_limit, 100)) for update skip locked),
  u as (update push_outbox o set reoffers = o.reoffers + (o.taken_at is not null)::int, taken_at = now() from t where o.id = t.id
        returning o.id, o.order_id, o.session_id, o.status, o.kind, o.kitchen_id)
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) into v_rows from u;
  return jsonb_build_object('rows', v_rows);
end $$;

create or replace function push_latest(p_endpoint text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_session text;
  v_status text;
  v_rider text;
  v_order uuid;
  v_row push_outbox;
  v_kitchen text;
begin
  select session_id into v_session from push_subscriptions where endpoint = p_endpoint;
  if v_session is null then
    return null;
  end if;
  select * into v_row from push_outbox where session_id = v_session and kind = 'kitchen_open' and shown_at is null and created_at > now() - interval '15 minutes'
    order by id desc limit 1;
  if found then
    update push_outbox set shown_at = now() where id = v_row.id;
    select name into v_kitchen from kitchens where id = v_row.kitchen_id;
    return jsonb_build_object('title', 'GoServe', 'status', 'open', 'order_id', 'kitchen-' || v_row.kitchen_id, 'body', coalesce(v_kitchen, 'The kitchen') || ' is open. Order now.');
  end if;
  select o.id, o.status, r.name into v_order, v_status, v_rider from orders o left join riders r on r.user_id = o.rider_id where o.session_id = v_session order by o.created_at desc limit 1;
  if v_status is null then
    return null;
  end if;
  return jsonb_build_object('title', 'GoServe', 'status', v_status, 'order_id', v_order, 'body', case v_status
    when 'placed' then 'Your order is placed.'
    when 'accepted' then 'The kitchen accepted your order.'
    when 'preparing' then 'Your order is being cooked.'
    when 'ready' then 'Your order is ready.'
    when 'out_for_delivery' then case when coalesce(trim(v_rider), '') <> '' then trim(v_rider) || ' has picked up your order.' else 'Your order is on the way.' end
    when 'delivered' then 'Your order was delivered.'
    when 'cancelled' then 'Your order was cancelled.'
    else 'Your order has an update.' end);
end $$;

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
