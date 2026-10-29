-- Story #557 (layer 2 of #348). An unpaid online order does not stay stuck: it expires to cash, or the customer switches to cash by hand.
-- No timer here. An n8n tick that calls payment_expire_v2 comes with the real gateway. Only the service role calls these.
-- Refusals are answers, not exceptions: {ok:false, error, message}.

-- Every created payment older than p_minutes fails, and its unpaid order goes back to cash so the kitchen can accept it.
create function payment_expire_v2(p_minutes integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  with expired as (
    update payments set status = 'failed', updated_at = now()
    where status = 'created' and created_at < now() - make_interval(mins => p_minutes)
    returning order_id
  )
  select coalesce(array_agg(order_id), '{}') into v_ids from expired;
  update orders set payment_method = 'cod' where id = any (v_ids) and paid_at is null;
  return jsonb_build_object('ok', true, 'expired', cardinality(v_ids));
end $$;

-- The customer who placed the order closes the open payment and pays cash. A paid order is refused. A cash order stays cash.
create function payment_switch_to_cash_v2(p_order uuid, p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  select * into o from orders where id = p_order and session_id = p_session for update;
  if o.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  if o.paid_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_paid', 'message', 'This order is already paid.');
  end if;
  if o.status <> 'placed' then
    return jsonb_build_object('ok', false, 'error', 'order_not_payable', 'message', 'This order cannot be changed now.');
  end if;
  update payments set status = 'failed', updated_at = now() where order_id = o.id and status = 'created';
  update orders set payment_method = 'cod' where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function payment_expire_v2(integer) from public, anon, authenticated;
revoke all on function payment_switch_to_cash_v2(uuid, text) from public, anon, authenticated;
grant execute on function payment_expire_v2(integer) to service_role;
grant execute on function payment_switch_to_cash_v2(uuid, text) to service_role;
