-- Story #340 (E27, plan v2 B.4). A customer keeps a name and an email, and can delete the account.
-- Delete is a soft delete at once (the profile is hidden and emptied, the pings stop) and the purge job removes the personal rows later: it blanks the name, phone and address on
-- their orders (the orders stay for the books), deletes their saved places, details, tracking and feedback, and deletes the login. Only the service role calls these.
-- Refusals are answers, not exceptions: {ok:false, error, message}.
create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text check (name is null or length(name) between 1 and 80),
  email text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
revoke all on profiles from public, anon, authenticated;

create function profile_get_v2(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
begin
  select * into p from profiles where user_id = p_user;
  if p.deleted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'account_deleted', 'message', 'This account was deleted.');
  end if;
  return jsonb_build_object('ok', true, 'profile', jsonb_build_object('name', p.name, 'email', p.email));
end $$;

-- A null field is "not sent". An empty string clears the field.
create function profile_set_v2(p_user uuid, p_name text, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
  v_name text := case when p_name is null then null else nullif(trim(p_name), '') end;
  v_email text := case when p_email is null then null else nullif(trim(p_email), '') end;
begin
  select * into p from profiles where user_id = p_user;
  if p.deleted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'account_deleted', 'message', 'This account was deleted.');
  end if;
  if p_name is not null and (v_name is null or length(v_name) > 80) then
    return jsonb_build_object('ok', false, 'error', 'invalid_name', 'message', 'Enter a name up to 80 letters.');
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    return jsonb_build_object('ok', false, 'error', 'invalid_email', 'message', 'Enter a real email address.');
  end if;
  insert into profiles (user_id, name, email) values (p_user, v_name, v_email)
  on conflict (user_id) do update set name = case when p_name is null then profiles.name else v_name end,
    email = case when p_email is null then profiles.email else v_email end, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

create function account_delete_v2(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, deleted_at) values (p_user, now())
  on conflict (user_id) do update set name = null, email = null, deleted_at = coalesce(profiles.deleted_at, now()), updated_at = now();
  delete from push_devices where session_id = p_user::text;
  delete from push_subscriptions where session_id = p_user::text;
  return jsonb_build_object('ok', true);
end $$;

-- The job: every account deleted more than p_days ago. Returns how many it purged.
create function purge_deleted_accounts_v2(p_days integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_n integer := 0;
begin
  for v_user in select user_id from profiles where deleted_at < now() - make_interval(days => p_days) loop
    delete from addresses where user_id = v_user;
    delete from customers where user_id = v_user;
    delete from feedback where session_id = v_user::text;
    delete from order_tracking where session_id = v_user::text;
    delete from push_outbox where session_id = v_user::text;
    delete from coupons where session_id = v_user::text;
    update orders set customer_name = null, customer_phone = null, address = '[deleted]' where session_id = v_user::text;
    delete from profiles where user_id = v_user;
    delete from auth.users where id = v_user;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'purged', v_n);
end $$;

revoke all on function profile_get_v2(uuid) from public, anon, authenticated;
revoke all on function profile_set_v2(uuid, text, text) from public, anon, authenticated;
revoke all on function account_delete_v2(uuid) from public, anon, authenticated;
revoke all on function purge_deleted_accounts_v2(integer) from public, anon, authenticated;
grant execute on function profile_get_v2(uuid) to service_role;
grant execute on function profile_set_v2(uuid, text, text) to service_role;
grant execute on function account_delete_v2(uuid) to service_role;
grant execute on function purge_deleted_accounts_v2(integer) to service_role;
