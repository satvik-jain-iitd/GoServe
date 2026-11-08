-- Story #1099: alerts for the kitchen's answer. Before, push_outbox_enqueue (0045) queued only placed, ready, out_for_delivery and delivered, so a customer
-- heard nothing when the kitchen accepted the order, declined it, or an order was cancelled.
-- 1. accepted and cancelled queue a push too, by any path. A cancel the customer made themselves queues none (they just tapped it); kitchen, admin and rider cancels do.
-- 2. A kitchen decline carries its reason: push_latest says "The kitchen declined your order: <reason>" (the reason cut at 120 characters). Any other cancel says "Your order was cancelled."
-- Same rules as before: no subscription, no row (a trace line says why). The first object of this file is new (push_decline_words) so the prod plan reads the file as not yet applied.

create function push_decline_words(p_reason text) returns text
language sql immutable as $$
  select case when nullif(trim(p_reason), '') is null then null
    else 'The kitchen declined your order: ' || left(trim(p_reason), 120) end
$$;
revoke all on function push_decline_words(text) from public, anon, authenticated;

create or replace function push_outbox_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status not in ('placed', 'accepted', 'ready', 'out_for_delivery', 'delivered', 'cancelled') then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status = 'cancelled' and new.cancelled_by = 'customer' then return new; end if;
  if exists (select 1 from push_subscriptions where session_id = new.session_id) then
    insert into push_outbox (order_id, session_id, status) values (new.id, new.session_id, new.status);
    perform trace_write(new.id, 'db', 'push_queued', new.status, null, null);
  elsif not exists (select 1 from kitchens where id = new.kitchen_id and synthetic) then   -- the city's own orders would fill the log
    perform trace_write(new.id, 'db', 'push_skipped', 'no_subscription', new.status, null);
  end if;
  return new;
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
  v_by text;
  v_why text;
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
  select o.id, o.status, r.name, o.cancelled_by, o.cancel_reason into v_order, v_status, v_rider, v_by, v_why from orders o left join riders r on r.user_id = o.rider_id where o.session_id = v_session order by o.created_at desc limit 1;
  if v_status is null then
    return null;
  end if;
  if v_status = 'out_for_delivery' and exists (select 1 from order_events where order_id = v_order and event = 'order.arriving') then
    return jsonb_build_object('title', 'GoServe', 'status', 'arriving', 'order_id', v_order, 'body', 'Your rider is at your door.');
  end if;
  if v_status = 'cancelled' and v_by = 'kitchen' and push_decline_words(v_why) is not null then
    return jsonb_build_object('title', 'GoServe', 'status', 'cancelled', 'order_id', v_order, 'body', push_decline_words(v_why));
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
