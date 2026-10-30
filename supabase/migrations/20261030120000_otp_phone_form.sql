-- Story #802a: every stored phone number is 91 plus the ten digits, the form otp_codes and Supabase Auth use (migration 20261027210000_otp.sql).
-- With OTP_FIXED_CODE set (story #665), withFixedCode handed back the ten digits instead of 91 plus the ten digits, so every number linked through
-- the fixed code was stored in the wrong form. Supabase's own phone sign-in looks for the 91 form, so those customers could not sign in to their own account.
-- A row is left alone when the 91 form of it already exists, because auth.users.phone is unique and the two rows would collide;
-- such a pair is a person with two accounts and is the owner's call, not a migration's.
-- It is a function so the prod script can see it ran (it names a migration by the first object the file makes); it returns how many rows it changed.
create or replace function otp_repair_phone_form() returns integer
language plpgsql security definer set search_path = public, auth as $$
declare n integer;
begin
  update auth.users u
     set phone = '91' || u.phone
   where u.phone ~ '^[6-9][0-9]{9}$'
     and not exists (select 1 from auth.users o where o.phone = '91' || u.phone);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function otp_repair_phone_form() from public, anon, authenticated;
grant execute on function otp_repair_phone_form() to service_role;

select otp_repair_phone_form();
