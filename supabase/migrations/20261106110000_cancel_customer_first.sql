-- Story #904: the person who placed the order is the customer first, whatever else they are.
-- Before: admin, then kitchen staff, then customer. A customer who was also staff or admin was treated as staff or admin,
-- and those need a reason, so the app (which sends none) got reason_required. Now: customer first.
-- Staff and admin still need a reason for someone else's order. Only the actor order changes.
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
  v_actor := case when v.session_id = auth.uid()::text then 'customer' when is_admin() then 'admin' when is_my_kitchen(v.kitchen_id) then 'kitchen' end;
  if v_actor is null then
    raise exception 'not_allowed';
  end if;
  if v.status not in ('placed', 'accepted') then
    raise exception 'cannot_cancel: %', v.status;
  end if;
  v_reason := coalesce(v_reason, case when v_actor = 'customer' then 'cancelled by customer' end);
  if v_reason is null then
    raise exception 'reason_required';
  end if;
  update orders set status = 'cancelled', cancel_reason = v_reason where id = v.id returning * into v;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'order.cancelled', v_actor);
  return jsonb_build_object('order', to_jsonb(v));
end $$;
revoke execute on function cancel_order(uuid, text) from public, anon;
grant execute on function cancel_order(uuid, text) to authenticated;
