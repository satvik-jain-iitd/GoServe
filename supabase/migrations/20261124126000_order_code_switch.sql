-- Story 1668 (epic 1652), layer A. The customer reads the drop code only while the delivery-code switch (drop_code_on) is on.
-- Switch off: the customer gets the same no_code answer as a stranger, so nothing shows that a code exists. The rider's pickup code is unchanged.
-- One read door for the app; settings stay closed to app roles. Safe to run twice (create or replace).
create or replace function order_code_v1(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; c order_codes;
  none constant jsonb := jsonb_build_object('ok', false, 'error', 'no_code', 'message', 'No code for you on this order.');
begin
  select * into o from orders where id = p_order_id;
  if o.id is null or o.status in ('cancelled', 'delivered') then return none; end if;
  select * into c from order_codes where order_id = o.id;
  if c.order_id is null then return none; end if;
  if o.rider_id is not null and o.rider_id = auth.uid() then
    return jsonb_build_object('ok', true, 'role', 'rider', 'pickup_code', c.pickup_code);
  elsif is_my_session(o.session_id) and drop_code_on() then
    return jsonb_build_object('ok', true, 'role', 'customer', 'drop_code', c.drop_code);
  end if;
  return none;
end $$;
revoke all on function order_code_v1(uuid) from public, anon;
grant execute on function order_code_v1(uuid) to authenticated;
