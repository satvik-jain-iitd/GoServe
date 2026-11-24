-- Story 1671 (epic 1652), AC-2 and AC-3. When the customer cannot show the code, the rider calls support and an ADMIN marks the order Delivered.
-- 1) order_events.by_user: who did it (the admin's id).
-- 2) admin_deliver_without_code_v1(order, reason, method): admin only, a typed reason of 1 to 200 characters (trimmed, never optional). It runs the same deliver step as act_on_order
--    (an admin is never blocked by the code switch) and writes ONE order_events row, order.delivered_without_code, with the admin, the time and the reason.
alter table order_events add column if not exists by_user uuid;

create or replace function admin_deliver_without_code_v1(p_order uuid, p_reason text, p_method text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders; v_reason text := btrim(coalesce(p_reason, '')); v_res jsonb;
begin
  if auth.uid() is null or not coalesce(is_admin(), false) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'Only an admin can do this.');
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
  v_res := act_on_order(v.id, 'deliver', p_method);
  if coalesce((v_res->>'ok')::boolean, false) then
    insert into order_events (order_id, kitchen_id, session_id, event, actor, reason, by_user)
      values (v.id, v.kitchen_id, v.session_id, 'order.delivered_without_code', 'admin', v_reason, auth.uid());
  end if;
  return v_res;
end $$;
revoke all on function admin_deliver_without_code_v1(uuid, text, text) from public, anon;
grant execute on function admin_deliver_without_code_v1(uuid, text, text) to authenticated;
