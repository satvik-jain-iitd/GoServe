-- Story 1319 (epic 1317). At the door the food was handed over but the money did not come: the order is Delivered with a money-due mark, and it is not cash in hand.
-- 1) orders.money_due_reason: one of four fixed reasons. orders.money_due_note: words, 1 to 200 characters, only with 'other'.
-- 2) rider_money_not_collected_v1(order, reason, note): only the rider of the order, only while Out for delivery; marks it Delivered with no paid_by.
--    The customer code switch stays honest: with drop_code_on() the code is still asked first (code_required, as act_on_order says).
alter table orders add column if not exists money_due_reason text;
alter table orders add column if not exists money_due_note text;
alter table orders drop constraint if exists orders_money_due_check;
alter table orders add constraint orders_money_due_check check (
  (money_due_reason is null and money_due_note is null)
  or (money_due_reason in ('says_already_paid', 'will_pay_later', 'did_not_have_money') and money_due_note is null)
  or (money_due_reason = 'other' and char_length(btrim(money_due_note)) between 1 and 200));

create or replace function rider_money_not_collected_v1(p_order uuid, p_reason text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_res jsonb;
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
  if drop_code_on() then
    return jsonb_build_object('ok', false, 'error', 'code_required', 'message', 'Ask the customer for the code.');
  end if;
  begin
    v_res := change_status(v.id, v.session_id, 'delivered', 'rider');
  exception when others then
    return jsonb_build_object('ok', false, 'error', case when sqlerrm like 'already_done%' then 'already_done' else 'order_action_failed' end, 'message', 'The step could not be done. Try again.');
  end;
  update orders set money_due_reason = p_reason, money_due_note = case when p_reason = 'other' then v_note end where id = v.id returning * into v;
  return jsonb_build_object('ok', true, 'order', to_jsonb(v));
end $$;
revoke all on function rider_money_not_collected_v1(uuid, text, text) from public, anon;
grant execute on function rider_money_not_collected_v1(uuid, text, text) to authenticated;
