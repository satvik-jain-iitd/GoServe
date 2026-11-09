-- Story #942: the account purge blanks every personal column, not only the ones that existed in October. Added since: orders.drop_lat and drop_lng (the exact
-- home point), orders.instructions (the customer's note), orders.pin_code; also the web push endpoint and the login codes sent to the customer's phone.
-- THE PERSONAL-DATA LIST (kept honest by scripts/test_purge_pii.py, which fails when orders gains a personal-looking column that is not here):
--   orders:  customer_name, customer_phone, address ('[deleted]', it is NOT NULL), drop_lat, drop_lng, instructions, pin_code
--   deleted rows: customers, addresses, profiles, feedback, order_tracking, push_outbox, push_devices, push_subscriptions, coupons, auth.users,
--                 otp_codes for the customer's phone (customers.phone and the phone on their orders)
-- Not personal: orders.session_id (a user id, gone with the login), cancel_reason (the kitchen's words), client_platform.
create or replace function purge_deleted_accounts_v2(p_days integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_n integer := 0;
begin
  for v_user in select user_id from profiles where deleted_at < now() - make_interval(days => p_days) loop
    delete from otp_codes where phone in (select phone from customers where user_id = v_user and phone is not null)
                              or phone in (select customer_phone from orders where session_id = v_user::text and customer_phone is not null);
    delete from addresses where user_id = v_user;
    delete from customers where user_id = v_user;
    delete from feedback where session_id = v_user::text;
    delete from order_tracking where session_id = v_user::text;
    delete from push_outbox where session_id = v_user::text;
    delete from push_devices where session_id = v_user::text;
    delete from push_subscriptions where session_id = v_user::text;
    delete from coupons where session_id = v_user::text;
    update orders set customer_name = null, customer_phone = null, address = '[deleted]', drop_lat = null, drop_lng = null, instructions = null, pin_code = null
      where session_id = v_user::text;
    delete from profiles where user_id = v_user;
    delete from auth.users where id = v_user;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'purged', v_n);
end $$;
