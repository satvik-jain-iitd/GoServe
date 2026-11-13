-- Story 1448 (boards DV1, DV2, TC2; owner, 13 Nov 2026): "Change" on the rider's Delivered slip puts a wrong tap between cash and UPI right.
-- Only the order's own rider, only on a delivered order that already has cash or UPI, only to cash or UPI at the door,
-- and only before the night's hand-over: once the kitchen has stamped any of this rider's cash at or after this delivery, the counted money is closed.
-- Each change leaves one trace line (old and new way), so the owner can see how often a tap was wrong.
create or replace function rider_change_paid(p_order uuid, p_method text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders%rowtype;
begin
  if p_method is null or p_method not in ('cash', 'upi_door') then
    return jsonb_build_object('ok', false, 'error', 'bad_method');
  end if;
  select * into v from orders where id = p_order and rider_id = auth.uid() and status = 'delivered' for update;
  if not found or v.paid_by is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v.cash_handed_at is not null or exists (
    select 1 from orders o where o.rider_id = v.rider_id and o.cash_handed_at is not null and o.cash_handed_at >= v.updated_at
  ) then
    return jsonb_build_object('ok', false, 'error', 'handed_over');
  end if;
  if v.paid_by = p_method then
    return jsonb_build_object('ok', true, 'paid_by', p_method);
  end if;
  update orders set paid_by = p_method where id = v.id;
  perform trace_write(v.id, 'app', 'rider_change_paid', v.paid_by || '>' || p_method, null, null);
  return jsonb_build_object('ok', true, 'paid_by', p_method);
end $$;
revoke execute on function rider_change_paid(uuid, text) from public, anon;
grant execute on function rider_change_paid(uuid, text) to authenticated;
