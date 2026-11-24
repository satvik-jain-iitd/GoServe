-- Story 1671 review fix. admin_deliver_without_code_v1 never guesses how the order was paid: the method is REQUIRED and is cash, upi_door or not_collected.
-- null or any other value is refused with method_required before anything changes. not_collected delivers with paid_by empty (the money did not come) and touches no money-due column.
create or replace function admin_deliver_without_code_v1(p_order uuid, p_reason text, p_method text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders; v_reason text := btrim(coalesce(p_reason, '')); v_res jsonb;
begin
  if auth.uid() is null or not coalesce(is_admin(), false) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'Only an admin can do this.');
  end if;
  if p_method is null or p_method not in ('cash', 'upi_door', 'not_collected') then
    return jsonb_build_object('ok', false, 'error', 'method_required', 'message', 'Say how the customer paid: cash, UPI at the door, or not collected.');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required', 'message', 'Say why the order is delivered without the code.');
  end if;
  if char_length(v_reason) > 200 then
    return jsonb_build_object('ok', false, 'error', 'reason_too_long', 'message', 'Keep the reason under 200 characters.');
  end if;
  select * into v from orders where id = p_order;
  if v.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  if p_method = 'not_collected' then
    begin
      v_res := change_status(v.id, v.session_id, 'delivered', 'admin');
      v_res := jsonb_build_object('ok', true, 'order', v_res->'order');
    exception when others then
      return jsonb_build_object('ok', false, 'error', case when sqlerrm like 'already_done%' then 'already_done' when sqlerrm like 'illegal%' then 'illegal_step' else 'order_action_failed' end, 'message', 'The step could not be done.');
    end;
  else
    v_res := act_on_order(v.id, 'deliver', p_method);
  end if;
  if coalesce((v_res->>'ok')::boolean, false) then
    insert into order_events (order_id, kitchen_id, session_id, event, actor, reason, by_user)
      values (v.id, v.kitchen_id, v.session_id, 'order.delivered_without_code', 'admin', v_reason, auth.uid());
  end if;
  return v_res;
end $$;
revoke all on function admin_deliver_without_code_v1(uuid, text, text) from public, anon;
grant execute on function admin_deliver_without_code_v1(uuid, text, text) to authenticated;
