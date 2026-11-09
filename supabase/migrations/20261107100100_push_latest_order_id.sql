-- Story #920 (2 of 3). The phone gets the order id with the text, so the service worker can use it as the notification tag (one notification per order).
-- Everything else stays as it was in 0050.

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
