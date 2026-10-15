-- Story S-C (#95). Delivered by hand, paid by cash: the customer taps Yes and the order closes as delivered and paid.
-- Same rules as the other order functions: one transaction, only the service role may call them.

alter table orders add column paid_by text null check (paid_by in ('cash'));

-- A second tap on the same step is refused (it used to write a duplicate event). The check lives here, not in the trigger,
-- because other updates (such as setting paid_by) keep the status the same.
create or replace function change_status(p_order uuid, p_session text, p_to text, p_actor text)
returns jsonb language plpgsql as $$
declare
  v_order orders;
  v_event text;
begin
  v_event := case p_to
    when 'accepted' then 'order.accepted'
    when 'preparing' then 'order.preparing'
    when 'ready' then 'order.ready'
    when 'out_for_delivery' then 'order.picked_up'
    when 'delivered' then 'order.delivered'
  end;
  if v_event is null then
    raise exception 'invalid_status: %', p_to;
  end if;

  select * into v_order from orders where id = p_order and session_id = p_session for update;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if v_order.status = p_to then
    raise exception 'already_done';
  end if;

  -- the trigger orders_status_rule rejects a skipped or backward step
  update orders set status = p_to where id = v_order.id returning * into v_order;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, v_event, coalesce(p_actor, 'unknown'));
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

-- The customer's Yes. A ready order goes out for delivery and is delivered, as the customer, then paid by cash and confirmed.
-- An order the rider already delivered only records the cash and the confirmation. A repeat answers already_done and changes nothing.
create function confirm_delivery(p_order uuid, p_session text)
returns jsonb language plpgsql as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order and session_id = p_session for update;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if v_order.status = 'delivered' and v_order.paid_by is not null then
    return jsonb_build_object('already_done', true, 'order', to_jsonb(v_order));
  end if;
  if v_order.status not in ('ready', 'out_for_delivery', 'delivered') then
    raise exception 'illegal status step: % to delivered', v_order.status;
  end if;

  if v_order.status = 'ready' then
    update orders set status = 'out_for_delivery' where id = v_order.id returning * into v_order;
    insert into order_events (order_id, kitchen_id, session_id, event, actor)
    values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.picked_up', 'customer');
  end if;
  if v_order.status = 'out_for_delivery' then
    update orders set status = 'delivered' where id = v_order.id returning * into v_order;
    insert into order_events (order_id, kitchen_id, session_id, event, actor)
    values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.delivered', 'customer');
  end if;
  update orders set paid_by = 'cash' where id = v_order.id returning * into v_order;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.confirmed', 'customer');
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

revoke execute on function confirm_delivery(uuid, text) from public, anon, authenticated;
grant execute on function confirm_delivery(uuid, text) to service_role;
