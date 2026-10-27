-- Story #483 (epic E25). A push was sent only when the status change came through n8n MAIN 01. The city tick, and any other path, changed the status
-- with a plain update and no push left (found in the logs of order b7f912a6, 27 Oct: Apple answered 201 for "placed", nothing at ready or delivered).
-- One way instead: the database queues a push whenever an order reaches placed, ready, out_for_delivery or delivered, by any path. One sender (n8n MAIN 34)
-- takes the queue every 30 seconds and calls SUB 20. Only a customer with a push subscription gets a row; the others get a trace line that says why.

alter table order_trace drop constraint order_trace_actor_check;
alter table order_trace add constraint order_trace_actor_check check (actor in ('app', 'sw', 'n8n', 'sim', 'db'));

create table push_outbox (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id) on delete cascade,
  session_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  taken_at timestamptz
);
create index push_outbox_waiting on push_outbox (id) where taken_at is null;
alter table push_outbox enable row level security;
revoke all on push_outbox from public, anon, authenticated;

create function push_outbox_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status not in ('placed', 'ready', 'out_for_delivery', 'delivered') then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if exists (select 1 from push_subscriptions where session_id = new.session_id) then
    insert into push_outbox (order_id, session_id, status) values (new.id, new.session_id, new.status);
    perform trace_write(new.id, 'db', 'push_queued', new.status, null, null);
  elsif not exists (select 1 from kitchens where id = new.kitchen_id and synthetic) then   -- the city's own orders would fill the log
    perform trace_write(new.id, 'db', 'push_skipped', 'no_subscription', new.status, null);
  end if;
  return new;
end $$;
revoke all on function push_outbox_enqueue() from public, anon, authenticated;
create trigger orders_push_outbox after insert or update of status on orders for each row execute function push_outbox_enqueue();

-- For n8n (service role only): hand out the waiting rows once, and forget the old ones.
create function push_outbox_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
begin
  delete from push_outbox where created_at < now() - interval '2 days';
  with t as (select id from push_outbox where taken_at is null order by id limit greatest(1, least(p_limit, 100)) for update skip locked),
  u as (update push_outbox o set taken_at = now() from t where o.id = t.id returning o.id, o.order_id, o.session_id, o.status)
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) into v_rows from u;
  return jsonb_build_object('rows', v_rows);
end $$;
revoke all on function push_outbox_take(int) from public, anon, authenticated;
grant execute on function push_outbox_take(int) to service_role;

-- What the notification says: the status of the order the push was queued for is not known to the phone, so it shows the newest order of the owner.
-- Picked up now names the rider.
create or replace function push_latest(p_endpoint text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_session text;
  v_status text;
  v_rider text;
begin
  select session_id into v_session from push_subscriptions where endpoint = p_endpoint;
  if v_session is null then
    return null;
  end if;
  select o.status, r.name into v_status, v_rider from orders o left join riders r on r.user_id = o.rider_id where o.session_id = v_session order by o.created_at desc limit 1;
  if v_status is null then
    return null;
  end if;
  return jsonb_build_object('title', 'GoServe', 'status', v_status, 'body', case v_status
    when 'placed' then 'Your order is placed.'
    when 'accepted' then 'The kitchen accepted your order.'
    when 'preparing' then 'Your order is being cooked.'
    when 'ready' then 'Your order is ready.'
    when 'out_for_delivery' then case when coalesce(trim(v_rider), '') <> '' then trim(v_rider) || ' has picked up your order.' else 'Your order is on the way.' end
    when 'delivered' then 'Your order was delivered.'
    when 'cancelled' then 'Your order was cancelled.'
    else 'Your order has an update.' end);
end $$;
