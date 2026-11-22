-- Story 1773 (epic 1753; owner, 22 Nov 2026: an open app keeps the fee it loaded, for up to 12 hours; the new fee starts from the app's next session).
-- delivery_fee_at_v1(p_as_of): the fee as of a time, so the Bill can show the fee at once and the quote and the order can agree with it.
-- No secret and no per-phone memory: the app keeps the server time of its fee read ("as of"); the server looks up the fee that was live at that time, never older than 12 hours.
-- 1) A null time, or a time after the last change in delivery_fee_log, answers the settings value: the same number the quote reads without a time, also after a direct edit of settings.
-- 2) A time before a newer log row answers the log value live then (0 before the first row). A time in the future is now. A time older than 12 hours is now minus 12 hours.
-- 3) Customers and guests may run it (and the service role, which the quote and orders functions use). The answer has no name of who set the fee.
-- Safe to run twice (create or replace).
create or replace function delivery_fee_at_v1(p_as_of timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c_window constant interval := interval '12 hours';   -- the owner set 12 hours on 22 Nov 2026
  v_now timestamptz := now();
  v_t timestamptz := case when p_as_of is null then v_now else least(greatest(p_as_of, v_now - c_window), v_now) end;
  v_amount integer;
begin
  if exists (select 1 from delivery_fee_log where at > v_t) then
    v_amount := coalesce((select amount_paise from delivery_fee_log where at <= v_t order by at desc, id desc limit 1), 0);
  else
    v_amount := coalesce((select (value ->> 'amount_paise')::integer from settings where name = 'delivery_fee'), 0);
  end if;
  return jsonb_build_object('amount_paise', v_amount, 'as_of', v_t, 'now', v_now);
end $$;
revoke all on function delivery_fee_at_v1(timestamptz) from public;
grant execute on function delivery_fee_at_v1(timestamptz) to anon, authenticated, service_role;   -- the quote and orders functions call it with the service key; named here so no platform default is assumed
