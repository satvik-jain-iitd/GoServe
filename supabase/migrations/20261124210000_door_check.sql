-- Story #1322 (epic 1317). Five minutes after the rider taps Arriving, if the order is still not delivered or cancelled, the customer gets ONE push with a way to call.
-- push_door_check_v1() queues it (status door_check, once per order, with a trace line; no subscription = a trace line only) and a named job runs it every minute.
-- Only arriving events of the last 2 hours count, so the first run never wakes an old stuck order. The words are ONE constant, push_door_words(): WORDS NOT YET APPROVED by the owner.
create or replace function push_door_words() returns text language sql immutable as $$ select 'Your rider is close. Can''t find them? Call.' $$;

create or replace function push_door_check_v1() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select distinct on (e.order_id) e.order_id, e.session_id from order_events e join orders o on o.id = e.order_id
           where e.event = 'order.arriving' and e.created_at <= now() - interval '5 minutes' and e.created_at > now() - interval '2 hours'
             and o.status = 'out_for_delivery'
             and not exists (select 1 from push_outbox p where p.order_id = e.order_id and p.status = 'door_check')
           order by e.order_id, e.created_at loop
    if exists (select 1 from push_subscriptions where session_id = r.session_id) then
      insert into push_outbox (order_id, session_id, status) values (r.order_id, r.session_id, 'door_check');
      perform trace_write(r.order_id, 'db', 'push_queued', 'door_check', null, null);
      n := n + 1;
    else
      if not exists (select 1 from order_trace where order_id = r.order_id and event = 'push_skipped' and detail::text like '%door_check%') then   -- once per order, not once a minute
        perform trace_write(r.order_id, 'db', 'push_skipped', 'no_subscription', 'door_check', null);
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function push_door_check_v1() from public, anon, authenticated;
select cron.schedule('goserve-door-check', '* * * * *', 'select public.push_door_check_v1()');   -- a named job is replaced, so this file can run twice

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
  v_kname text;
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
  select o.id, o.status, r.name, o.cancelled_by, o.cancel_reason, k.name into v_order, v_status, v_rider, v_by, v_why, v_kname from orders o left join riders r on r.user_id = o.rider_id left join kitchens k on k.id = o.kitchen_id where o.session_id = v_session order by o.created_at desc limit 1;
  if v_status is null then
    return null;
  end if;
  if v_status = 'out_for_delivery' and exists (select 1 from push_outbox where order_id = v_order and status = 'door_check') then
    return jsonb_build_object('title', 'GoServe', 'status', 'door_check', 'order_id', v_order, 'body', push_door_words());
  end if;
  if v_status = 'out_for_delivery' and exists (select 1 from order_events where order_id = v_order and event = 'order.arriving') then
    return jsonb_build_object('title', 'GoServe', 'status', 'arriving', 'order_id', v_order, 'body', 'Your rider is at your door.');
  end if;
  if v_status = 'cancelled' and v_by = 'kitchen' and push_decline_words(v_kname, v_why) is not null then
    return jsonb_build_object('title', 'GoServe', 'status', 'cancelled', 'order_id', v_order, 'body', push_decline_words(v_kname, v_why));
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
