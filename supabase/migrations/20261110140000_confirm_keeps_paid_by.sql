-- Story #1293 (epic #1259): the customer's Yes never sets or changes how the order was paid. Only the rider's deliver step records it (story #1260).
-- 1) confirm_delivery of 0009_paid_by.sql without the line that wrote paid_by = 'cash'. A second Yes is already_done when the order was delivered with a way
--    recorded, or already confirmed.
-- 2) act_on_order of 20261110130000: when the customer confirmed first (delivered, paid_by empty), the rider's deliver records the method once instead of answering already_done.
--    A second deliver, a method that is off, and a caller who is not the rider are refused as before.
-- Orders confirmed before this migration keep the cash that was written then.

create or replace function confirm_delivery(p_order uuid, p_session text)
returns jsonb language plpgsql as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order and session_id = p_session for update;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if v_order.status = 'delivered' and (v_order.paid_by is not null or exists (select 1 from order_events where order_id = v_order.id and event = 'order.confirmed')) then
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
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.confirmed', 'customer');
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

revoke execute on function confirm_delivery(uuid, text) from public, anon, authenticated;
grant execute on function confirm_delivery(uuid, text) to service_role;

create or replace function act_on_order(p_order uuid, p_action text, p_arg text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v orders;
  v_admin boolean;
  v_kitchen boolean;
  v_rider boolean;
  v_customer boolean;
  v_may boolean;
  v_res jsonb;
  v_method text;
  v_on jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Sign in first.');
  end if;
  if p_action is null or p_action not in ('accept', 'prepare', 'ready', 'pickup', 'arriving', 'deliver', 'confirm', 'cancel') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action', 'message', 'This step does not exist.');
  end if;
  select * into v from orders where id = p_order;
  if v.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  -- coalesce: an order with no rider gives null, and null must never read as a yes
  v_admin := coalesce(is_admin(), false);
  v_kitchen := coalesce(is_my_kitchen(v.kitchen_id), false);
  v_rider := coalesce(v.rider_id = v_uid, false);
  v_customer := coalesce(v.session_id = v_uid::text, false);

  v_may := case p_action
       when 'accept' then v_admin or v_kitchen
       when 'prepare' then v_admin or v_kitchen
       when 'ready' then v_admin or v_kitchen
       when 'pickup' then v_admin or v_rider
       when 'arriving' then v_admin or v_rider
       when 'deliver' then v_admin or v_rider
       when 'confirm' then v_customer
       else v_admin or v_kitchen or v_customer
     end;
  if not coalesce(v_may, false) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'You cannot do this step on this order.');
  end if;

  -- story #348: an online order waits for its payment; cash on delivery is untouched
  if p_action = 'accept' and v.payment_method = 'online' and v.paid_at is null then
    return jsonb_build_object('ok', false, 'error', 'awaiting_payment', 'message', 'The order is waiting for its payment.');
  end if;

  -- story #1260: the rider's deliver step records how the order was paid. No method (an old rider app) counts as cash. A method that is off is refused before anything changes.
  if p_action = 'deliver' and v.payment_method <> 'online' then
    v_method := coalesce(p_arg, 'cash');
    if v_method not in ('cash', 'upi_door') then
      return jsonb_build_object('ok', false, 'error', 'invalid_method', 'message', 'This way of paying does not exist.');
    end if;
    select value into v_on from settings where name = 'payment_methods';
    if not exists (select 1 from jsonb_array_elements_text(v_on) m where m = v_method) then
      return jsonb_build_object('ok', false, 'error', 'method_off', 'message', case when p_arg is null then 'Cash is not on. Say how the customer paid.' else 'This way of paying is not on. Pick another.' end);
    end if;
  end if;

  -- story #1293: the customer confirmed first, so the order is delivered with no paid_by. The rider's deliver records the method once.
  -- Only when the confirmation is on record, and the update itself is the guard: two taps at once, the second finds no empty paid_by and answers already_done.
  if p_action = 'deliver' and v_method is not null and v.status = 'delivered' and v.paid_by is null
     and exists (select 1 from order_events where order_id = v.id and event = 'order.confirmed') then
    update orders set paid_by = v_method where id = v.id and paid_by is null returning * into v;
    if v.id is null then
      return jsonb_build_object('ok', false, 'error', 'already_done', 'message', 'This step was already done.');
    end if;
    return jsonb_build_object('ok', true, 'order', to_jsonb(v));
  end if;

  begin
    v_res := case p_action
      when 'accept' then change_status(v.id, v.session_id, 'accepted', case when v_admin then 'admin' else 'kitchen' end)
      when 'prepare' then change_status(v.id, v.session_id, 'preparing', case when v_admin then 'admin' else 'kitchen' end)
      when 'ready' then change_status(v.id, v.session_id, 'ready', case when v_admin then 'admin' else 'kitchen' end)
      when 'pickup' then change_status(v.id, v.session_id, 'out_for_delivery', case when v_rider then 'rider' else 'admin' end)
      when 'deliver' then change_status(v.id, v.session_id, 'delivered', case when v_rider then 'rider' else 'admin' end)
      when 'arriving' then rider_event(v.id, v.session_id, 'order.arriving', case when v_rider then 'rider' else 'admin' end)
      when 'confirm' then confirm_delivery(v.id, v.session_id)
      else cancel_order(v.id, p_arg)
    end;
    if p_action = 'deliver' and v_method is not null then
      update orders set paid_by = v_method where id = v.id;
      v_res := jsonb_set(v_res, '{order,paid_by}', to_jsonb(v_method));
    end if;
  exception when others then
    return case
      when sqlerrm like 'already_done%' or sqlerrm like 'event_exists%' then jsonb_build_object('ok', false, 'error', 'already_done', 'message', 'This step was already done.')
      when sqlerrm like 'illegal%' then jsonb_build_object('ok', false, 'error', 'illegal_step', 'message', 'The order is not at the step before this one.')
      when sqlerrm like 'cannot_cancel%' then jsonb_build_object('ok', false, 'error', 'cannot_cancel', 'message', 'The food is already on its way. It cannot be cancelled now.')
      when sqlerrm like 'reason_required%' then jsonb_build_object('ok', false, 'error', 'reason_required', 'message', 'Say why you are cancelling.')
      when sqlerrm like 'not_allowed%' then jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'You cannot do this step on this order.')
      else jsonb_build_object('ok', false, 'error', 'order_action_failed', 'message', 'The step could not be done. Try again.')
    end;
  end;
  if p_action = 'cancel' then   -- story #348: a paid payment is owed back, an unpaid one is closed
    update payments set status = case when status = 'paid' then 'refund_due' else 'failed' end, updated_at = now() where order_id = v.id and status in ('created', 'paid');
  end if;
  if coalesce((v_res->>'already_done')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'already_done', 'message', 'This step was already done.');
  end if;
  return jsonb_build_object('ok', true, 'order', v_res->'order');
end $$;

revoke all on function act_on_order(uuid, text, text) from public, anon;
grant execute on function act_on_order(uuid, text, text) to authenticated, service_role;
