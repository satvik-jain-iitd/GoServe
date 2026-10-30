-- Story #802: a returning customer signs in with one code, not two.
-- /otp/send and /otp/verify need to know who already holds a number BEFORE a code is issued or a correct one is consumed.
-- Before this, the Edge Function learned it only from the unique index on auth.users, after otp_verify_v2 had already spent the single-use code.
-- Numbers are stored as 91 plus the ten digits, the form otp_codes and Supabase Auth use (migration 20261027210000_otp.sql).

create or replace function otp_phone_owner(p_phone text) returns uuid
language sql security definer set search_path = public, auth stable as $$
  select id from auth.users where phone = p_phone limit 1
$$;
revoke all on function otp_phone_owner(text) from public, anon, authenticated;
grant execute on function otp_phone_owner(text) to service_role;

-- Repair: with OTP_FIXED_CODE set (story #665), withFixedCode handed back the ten digits instead of 91 plus the ten digits, so every
-- number linked through the fixed code was stored in the wrong form. Supabase's own phone sign-in looks for the 91 form, so those
-- customers could not sign in to their own account at all. Same person, same number, one form.
-- A row is left alone when the 91 form of it already exists, because auth.users.phone is unique and the two rows would collide;
-- such a pair is a person with two accounts and is the owner's call, not a migration's.
update auth.users u
   set phone = '91' || u.phone
 where u.phone ~ '^[6-9][0-9]{9}$'
   and not exists (select 1 from auth.users o where o.phone = '91' || u.phone);
