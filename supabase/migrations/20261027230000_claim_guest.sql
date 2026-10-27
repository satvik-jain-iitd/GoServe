-- Story #558 (layer 2 of #339). The returning customer: a guest on a new phone signs in with the number of an account they already have, and the orders they
-- made as a guest move to that account. One database function; the Edge Function (POST /otp/claim) checks both tokens first.
-- Only a guest (anonymous) can be claimed, and only into a signed-in (not anonymous) account. Orders and their tracking rows move; nothing else.
-- order_events is append-only (trigger order_events_no_change) and keeps the guest's session id. The old account reads those events through their order instead (policy below).
-- Refusals are answers: {ok:false, error, message}. Only the service role may call it.
create function claim_guest_orders_v2(p_from uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_orders integer;
begin
  if p_from is null or p_to is null or p_from = p_to then
    return jsonb_build_object('ok', false, 'error', 'same_user', 'message', 'There is nothing to move.');
  end if;
  if not exists (select 1 from auth.users where id = p_from and is_anonymous) then
    return jsonb_build_object('ok', false, 'error', 'not_a_guest', 'message', 'Only a guest session can be moved.');
  end if;
  if not exists (select 1 from auth.users where id = p_to and not is_anonymous) then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in', 'message', 'Sign in to the account first.');
  end if;
  update orders set session_id = p_to::text where session_id = p_from::text;
  get diagnostics v_orders = row_count;
  update order_tracking set session_id = p_to::text where session_id = p_from::text;
  return jsonb_build_object('ok', true, 'orders', v_orders);
exception when others then
  return jsonb_build_object('ok', false, 'error', 'claim_failed', 'message', 'The orders could not be moved. Try again.');
end $$;
create policy events_via_my_order on order_events for select to authenticated using (exists (select 1 from orders o where o.id = order_id and o.session_id = auth.uid()::text));

revoke all on function claim_guest_orders_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function claim_guest_orders_v2(uuid, uuid) to service_role;
