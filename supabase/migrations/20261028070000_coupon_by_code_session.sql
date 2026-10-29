-- Story #579 (coupons layer 2). coupon_by_code_v2 knows the caller's session: a personal coupon (the late-order sorry) is found by its own customer only.
-- No session, or another one, sees the public coupons only. The old one-argument function goes; a call with the code alone still works (p_session defaults to null).
drop function coupon_by_code_v2(text);
create function coupon_by_code_v2(p_code text, p_session text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select e from jsonb_array_elements(coupons_for_session_v2(p_session)) e where e ->> 'code' = upper(trim(p_code))
$$;
revoke all on function coupon_by_code_v2(text, text) from public, anon, authenticated;
grant execute on function coupon_by_code_v2(text, text) to service_role;
