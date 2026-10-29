-- Story #351 (E27, plan v2 B.15). Push to phones, built with a test double (FakePush) until the owner's FCM and Apple Developer clicks.
-- One row per device token (Android or iOS). The old web push (push_subscriptions) is a different thing and stays as it is.
-- Only the service role calls these; nobody reads the table (a token is a secret of the device).
-- Refusals are answers, not exceptions: {ok:false, error, message}.
create table push_devices (
  id bigint generated always as identity primary key,
  session_id text not null,
  platform text not null check (platform in ('android', 'ios')),
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table push_devices enable row level security;
revoke all on push_devices from public, anon, authenticated;

-- Save the token of this device. A token that moves to another user follows the new user.
create function register_push_device_v2(p_session text, p_platform text, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_session), '') = '' or p_platform is null or p_platform not in ('android', 'ios') or coalesce(trim(p_token), '') = '' or length(p_token) > 4096 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request', 'message', 'This device cannot be saved.');
  end if;
  insert into push_devices (session_id, platform, token) values (p_session, p_platform, trim(p_token))
  on conflict (token) do update set session_id = excluded.session_id, platform = excluded.platform;
  return jsonb_build_object('ok', true);
end $$;

-- Who to push for this order: its status and every device of its customer.
create function push_job_v2(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  o orders;
begin
  select * into o from orders where id = p_order;
  if o.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  return jsonb_build_object('ok', true, 'status', o.status, 'devices',
    (select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'token', token)), '[]'::jsonb) from push_devices where session_id = o.session_id));
end $$;

-- The push service said the token is gone: forget it.
create function push_device_forget_v2(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  delete from push_devices where token = p_token;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function register_push_device_v2(text, text, text) from public, anon, authenticated;
revoke all on function push_job_v2(uuid) from public, anon, authenticated;
revoke all on function push_device_forget_v2(text) from public, anon, authenticated;
grant execute on function register_push_device_v2(text, text, text) to service_role;
grant execute on function push_job_v2(uuid) to service_role;
grant execute on function push_device_forget_v2(text) to service_role;
