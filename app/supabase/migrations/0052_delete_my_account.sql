-- Story #771 (E22 #249). Google Play: an app that lets a person make an account must let them delete it from inside the app.
-- delete_my_account() deletes the caller's own data, then the login. It refuses a staff, rider or admin login (they are not customers)
-- and a customer whose order is still on its way (the kitchen and the rider need it). Refusals are answers, not exceptions: {ok:false, error, message}.
-- The tables that only the later (v2) schema has are looked up first, so the same migration runs on a database that does not have them yet.
-- PROD: the owner runs this file with the other prod migrations. It is applied to DEV only by the coder.

create function delete_my_account() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_t text;
begin
  if v_me is null then raise exception 'invalid_request'; end if;
  if exists (select 1 from kitchen_staff where user_id = v_me) or exists (select 1 from riders where user_id = v_me) or exists (select 1 from admins where user_id = v_me) then
    return jsonb_build_object('ok', false, 'error', 'not_a_customer', 'message', 'Only a customer account can be deleted here.');
  end if;
  if exists (select 1 from orders where session_id = v_me::text and status not in ('delivered', 'cancelled')) then
    return jsonb_build_object('ok', false, 'error', 'order_active', 'message', 'Wait until your order is delivered, then delete the account.');
  end if;
  perform set_config('goserve.reset', 'on', true);   -- this transaction only: order_events are frozen except for this
  delete from order_events where session_id = v_me::text;
  delete from decision_log where session_id = v_me::text;
  delete from orders where session_id = v_me::text;   -- order_trace, order_tracking, push_outbox, payments, ratings follow (on delete cascade)
  delete from feedback where session_id = v_me::text;
  delete from push_subscriptions where session_id = v_me::text;
  delete from push_outbox where session_id = v_me::text;
  delete from open_alerts where session_id = v_me::text;
  delete from session_links where member = v_me or session_id = v_me::text;
  delete from customers where user_id = v_me;
  foreach v_t in array array['push_devices', 'coupons', 'order_tracking'] loop
    if to_regclass('public.' || v_t) is not null then execute format('delete from %I where session_id = $1', v_t) using v_me::text; end if;
  end loop;
  foreach v_t in array array['addresses', 'profiles'] loop
    if to_regclass('public.' || v_t) is not null then execute format('delete from %I where user_id = $1', v_t) using v_me; end if;
  end loop;
  delete from auth.users where id = v_me;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
