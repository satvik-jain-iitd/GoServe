-- Story #339 (E27, plan v2 B.3). Phone OTP, built with a test double (FakeSms) until the owner clicks the SMS provider (docs/product/founder-checklist.md).
-- The rules live here: 3 sends per phone per 10 minutes, 5 tries per code, 10 minutes of life, one use. A newer send voids the older code.
-- The code is kept only as a hash. otp_send_v2 hands the plain code to the Edge Function (service role) so a sender can deliver it; it never leaves the server.
-- Phones are Indian mobiles: ten digits starting 6 to 9, stored as 91 plus the number (the form Supabase Auth uses).
create table otp_codes (
  id bigint generated always as identity primary key,
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index otp_codes_phone on otp_codes (phone, created_at desc);
alter table otp_codes enable row level security;   -- no policy: only the service role reads or writes
revoke all on otp_codes from public, anon, authenticated;

create function otp_send_v2(p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_code text;
begin
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone', 'message', 'Enter a ten digit mobile number.');
  end if;
  v_phone := '91' || p_phone;
  if (select count(*) from otp_codes where phone = v_phone and created_at > now() - interval '10 minutes') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'too_many_sends', 'message', 'Too many codes. Try again in a few minutes.');
  end if;
  update otp_codes set consumed_at = now() where phone = v_phone and consumed_at is null;   -- the older code is void
  v_code := lpad((('x' || substr(gen_random_uuid()::text, 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');   -- gen_random_uuid is random enough for a six digit code
  insert into otp_codes (phone, code_hash, expires_at)
  values (v_phone, encode(sha256(convert_to(v_phone || ':' || v_code, 'UTF8')), 'hex'), now() + interval '10 minutes');
  return jsonb_build_object('ok', true, 'code', v_code, 'expires_in_s', 600);
end $$;

create function otp_verify_v2(p_phone text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v otp_codes;
begin
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone', 'message', 'Enter a ten digit mobile number.');
  end if;
  v_phone := '91' || p_phone;
  select * into v from otp_codes where phone = v_phone and consumed_at is null order by created_at desc limit 1 for update;
  if v.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_code', 'message', 'Ask for a new code.');
  end if;
  if v.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'code_expired', 'message', 'The code has expired. Ask for a new one.');
  end if;
  if v.attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts', 'message', 'Too many wrong tries. Ask for a new code.');
  end if;
  if v.code_hash <> encode(sha256(convert_to(v_phone || ':' || coalesce(p_code, ''), 'UTF8')), 'hex') then
    update otp_codes set attempts = attempts + 1 where id = v.id;
    return jsonb_build_object('ok', false, 'error', 'wrong_code', 'message', 'That code is not right.', 'attempts_left', 5 - v.attempts - 1);
  end if;
  update otp_codes set consumed_at = now() where id = v.id;
  return jsonb_build_object('ok', true, 'phone', v_phone);
end $$;
revoke all on function otp_send_v2(text) from public, anon, authenticated;
revoke all on function otp_verify_v2(text, text) from public, anon, authenticated;
grant execute on function otp_send_v2(text) to service_role;
grant execute on function otp_verify_v2(text, text) to service_role;
