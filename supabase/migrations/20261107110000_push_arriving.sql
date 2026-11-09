-- Story #922. The rider's Arriving tap is an event (order.arriving), not a status, so it never made a push.
-- 1. A row in order_events with that event queues one push (status 'arriving') for a customer who allowed alerts, once per order: a second event row, or a second
--    tap after a reload, adds nothing. Same rules as push_outbox_enqueue: no subscription, no row (a trace line says why).
-- 2. push_latest says "Your rider is at your door." while the order is out for delivery and the event exists. Everything else stays as in 20261107100100.
-- ORDER OF ROLLOUT: n8n SUB 20 (it now accepts the status 'arriving') is deployed before this migration reaches a database it drains.
-- One file: push_latest was already made by 20261107100100, so a second file for it would read as done on prod (same marker).

create or replace function push_outbox_event_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event is distinct from 'order.arriving' then return new; end if;
  if exists (select 1 from push_outbox where order_id = new.order_id and status = 'arriving') then return new; end if;
  if exists (select 1 from push_subscriptions where session_id = new.session_id) then
    insert into push_outbox (order_id, session_id, status) values (new.order_id, new.session_id, 'arriving');
    perform trace_write(new.order_id, 'db', 'push_queued', 'arriving', null, null);
  else
    perform trace_write(new.order_id, 'db', 'push_skipped', 'no_subscription', 'arriving', null);
  end if;
  return new;
end $$;
revoke all on function push_outbox_event_enqueue() from public, anon, authenticated;
create trigger order_events_push_outbox after insert on order_events for each row execute function push_outbox_event_enqueue();

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
  if v_status = 'out_for_delivery' and exists (select 1 from order_events where order_id = v_order and event = 'order.arriving') then
    return jsonb_build_object('title', 'GoServe', 'status', 'arriving', 'order_id', v_order, 'body', 'Your rider is at your door.');
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
