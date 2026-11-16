-- Story #1602: what the caller does decides the actor, not who the caller is. Before, cancel_order (story #904) named the customer first, so staff or an admin who
-- placed the order and then declined it with a reason was recorded as the customer: the slip said Cancelled, the reason was never shown, and no alert was sent.
-- Now a caller who is admin or staff of the order's kitchen AND gives a reason is declining (admin or kitchen). The caller's own order with no reason stays customer (story #904).
-- The first object of this file is new (cancel_actor) so the prod plan reads the file as not yet applied.

create function cancel_actor(p_session text, p_kitchen uuid, p_reason text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_reason is not null and is_admin() then 'admin'
    when p_reason is not null and is_my_kitchen(p_kitchen) then 'kitchen'
    when p_session = auth.uid()::text then 'customer'
    when is_admin() then 'admin'
    when is_my_kitchen(p_kitchen) then 'kitchen' end
$$;
revoke all on function cancel_actor(text, uuid, text) from public, anon, authenticated;

create or replace function cancel_order(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders;
  v_actor text;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v from orders where id = p_order for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  v_actor := cancel_actor(v.session_id, v.kitchen_id, v_reason);
  if v_actor is null then
    raise exception 'not_allowed';
  end if;
  if v.status not in ('placed', 'accepted') then
    raise exception 'cannot_cancel: %', v.status;
  end if;
  if v_actor <> 'customer' and v_reason is null then
    raise exception 'reason_required';
  end if;
  update orders set status = 'cancelled', cancel_reason = v_reason, cancelled_by = v_actor where id = v.id returning * into v;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'order.cancelled', v_actor);
  return jsonb_build_object('order', to_jsonb(v));
end $$;
revoke execute on function cancel_order(uuid, text) from public, anon;
grant execute on function cancel_order(uuid, text) to authenticated;

-- Old rows: since story #1017 a customer's own cancel stores no reason, so customer plus a reason is a decline that was recorded wrongly.
update orders set cancelled_by = 'kitchen' where status = 'cancelled' and cancelled_by = 'customer' and cancel_reason is not null;
