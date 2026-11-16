-- Story #1594: "Delete my account" leaves nothing. The ask "Tell me when you come here" (area_requests, by user id) and the login codes (otp_codes, by phone, stored as 91 plus ten digits) went with no login link, so they stayed.
-- delete_my_leftovers does those two deletes; delete_my_account() calls it with the phone it read before the profile and the login go. Everything else in delete_my_account() is as in 0052.
-- The first object of this file is new (delete_my_leftovers) so the prod plan reads the file as not yet applied; create or replace lets the tests run the text again on dev.

create or replace function delete_my_leftovers(p_user uuid, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from area_requests where user_id = p_user;
  if p_phone is not null then delete from otp_codes where right(phone, 10) = right(p_phone, 10); end if;
end $$;
revoke all on function delete_my_leftovers(uuid, text) from public, anon, authenticated;

create or replace function delete_my_account() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_t text;
  v_phone text := coalesce((select phone from customers where user_id = v_me), (select phone from auth.users where id = v_me));   -- read before the login and profile go
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
  perform delete_my_leftovers(v_me, v_phone);
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
