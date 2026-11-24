-- Story 1319 review fix 2. Both switches may be on: Money not collected takes the customer's code like rider_deliver_v1 (optional p_code, checked only while drop_code_on()).
create or replace function rider_money_not_collected_v1(p_order uuid, p_reason text, p_note text default null, p_code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders; v_try jsonb; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_res jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Sign in first.');
  end if;
  select * into v from orders where id = p_order;
  if v.id is null or v.rider_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'You cannot do this step on this order.');
  end if;
  if p_reason is null or p_reason not in ('says_already_paid', 'will_pay_later', 'did_not_have_money', 'other') then
    return jsonb_build_object('ok', false, 'error', 'reason_required', 'message', 'Pick why the money was not collected.');
  end if;
  if p_reason = 'other' and v_note is null then
    return jsonb_build_object('ok', false, 'error', 'note_required', 'message', 'Say in a few words why.');
  end if;
  if p_reason = 'other' and char_length(v_note) > 200 then
    return jsonb_build_object('ok', false, 'error', 'note_too_long', 'message', 'Keep it under 200 characters.');
  end if;
  if v.status <> 'out_for_delivery' then
    return jsonb_build_object('ok', false, 'error', 'not_ready', 'message', 'The order is not out for delivery.');
  end if;
  if drop_code_on() then   -- the same check as rider_deliver_v1: no code is code_required, a wrong one is counted, five lock it
    if p_code is null or btrim(p_code) = '' then
      return jsonb_build_object('ok', false, 'error', 'code_required', 'message', 'Ask the customer for the code.');
    end if;
    v_try := order_code_try_v1(v.id, 'drop', btrim(p_code));
    if not coalesce((v_try->>'ok')::boolean, false) then
      return case v_try->>'error'
        when 'locked' then jsonb_build_object('ok', false, 'error', 'code_locked', 'message', 'Too many wrong tries. Call support.')
        when 'wrong_code' then jsonb_build_object('ok', false, 'error', 'wrong_code', 'message', 'That code is not right. Ask the customer again.', 'tries_left', v_try->'tries_left')
        else jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'You cannot do this step on this order.')
      end;
    end if;
  end if;
  begin
    v_res := change_status(v.id, v.session_id, 'delivered', 'rider');
  exception when others then
    return jsonb_build_object('ok', false, 'error', case when sqlerrm like 'already_done%' then 'already_done' else 'order_action_failed' end, 'message', 'The step could not be done. Try again.');
  end;
  update orders set money_due_reason = p_reason, money_due_note = case when p_reason = 'other' then v_note end where id = v.id returning * into v;
  return jsonb_build_object('ok', true, 'order', to_jsonb(v));
end $$;
revoke all on function rider_money_not_collected_v1(uuid, text, text, text) from public, anon;
grant execute on function rider_money_not_collected_v1(uuid, text, text, text) to authenticated;
drop function if exists rider_money_not_collected_v1(uuid, text, text);   -- one function, not two overloads
