-- Story #944 (otp_codes retention). The login codes hold phone numbers, and nothing deleted them. otp_purge_v2() removes the rows consumed or expired more than 24 hours ago.
-- Nothing reads an older row: the send limit looks back 10 minutes and a code lives 10 minutes (20261027210000_otp.sql). A named daily job runs it (the push-retry pattern).
create or replace function otp_purge_v2() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from otp_codes where consumed_at < now() - interval '24 hours' or expires_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function otp_purge_v2() from public, anon, authenticated;
select cron.schedule('goserve-otp-purge', '17 3 * * *', 'select public.otp_purge_v2()');   -- a named job is replaced, so this file can run twice
