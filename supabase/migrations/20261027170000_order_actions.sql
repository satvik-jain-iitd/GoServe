-- Story #349 (E27, plan v2 B.13). Status, confirm, events and cancel on v2: one door, act_on_order.
-- It reads who is asking from the login (auth.uid()), checks that this person may take this step on this order, then calls the same
-- change_status, rider_event, confirm_delivery and cancel_order that n8n calls today, so the rules and the events stay in one place.
-- Who may do what: the kitchen's staff or an admin: accept, prepare, ready. The rider assigned to the order or an admin: pickup, arriving, deliver.
-- The customer who placed it: confirm (cash) and cancel. cancel keeps its own rule (customer, kitchen staff or admin; only while placed or accepted).
-- Refusals are answers, not exceptions: {ok:false, error, message}.
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
  if coalesce((v_res->>'already_done')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'already_done', 'message', 'This step was already done.');
  end if;
  return jsonb_build_object('ok', true, 'order', v_res->'order');
end $$;
revoke all on function act_on_order(uuid, text, text) from public, anon;
grant execute on function act_on_order(uuid, text, text) to authenticated, service_role;
