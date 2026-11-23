-- Story 1654: a rider is saved with a real name and a 10-digit mobile. Only an admin sets them.
-- admin_add_person gets two last arguments (default null); for a rider both are required. The invite keeps them until the first sign-in.
-- admin_set_rider changes them for a rider already there. Safe to run twice.
alter table staff_invites add column if not exists rider_name text;
alter table staff_invites add column if not exists rider_phone text;

create or replace function rider_details_check(p_name text, p_phone text) returns void
language plpgsql immutable as $$
begin
  if p_name is null or btrim(p_name) = '' then raise exception 'rider_name_needed'; end if;
  if char_length(btrim(p_name)) > 40 then raise exception 'rider_name_long'; end if;
  if p_phone is null or p_phone !~ '^[0-9]{10}$' then raise exception 'rider_phone_bad'; end if;
end $$;
revoke all on function rider_details_check(text, text) from public, anon, authenticated;

drop function if exists admin_add_person(text, text, uuid);
create or replace function admin_add_person(p_email text, p_kind text, p_kitchen uuid, p_name text default null, p_phone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
  v_other text;
  v_name text := btrim(p_name);
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_kind not in ('admin', 'rider', 'kitchen') or (p_kind = 'kitchen' and p_kitchen is null) then
    raise exception 'invalid_kind';
  end if;
  if p_kind = 'rider' then
    perform rider_details_check(p_name, p_phone);
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    insert into staff_invites (email, kind, kitchen_id, created_by, rider_name, rider_phone)
    values (v_email, p_kind, case when p_kind = 'kitchen' then p_kitchen end, auth.uid(), case when p_kind = 'rider' then v_name end, case when p_kind = 'rider' then p_phone end) on conflict do nothing;
    return jsonb_build_object('invited', true);
  end if;
  if p_kind = 'admin' then
    insert into admins (user_id) values (v_user) on conflict do nothing;
  elsif p_kind = 'rider' then
    insert into riders (user_id, name, phone) values (v_user, v_name, p_phone) on conflict (user_id) do update set name = excluded.name, phone = excluded.phone;
  else
    select k.name into v_other from kitchen_staff s join kitchens k on k.id = s.kitchen_id where s.user_id = v_user and s.kitchen_id <> p_kitchen limit 1;
    if v_other is not null then
      raise exception 'already_staff' using detail = v_other;
    end if;
    insert into kitchen_staff (kitchen_id, user_id) values (p_kitchen, v_user) on conflict do nothing;
  end if;
  return jsonb_build_object('invited', false);
end $$;
revoke execute on function admin_add_person(text, text, uuid, text, text) from public, anon;
grant execute on function admin_add_person(text, text, uuid, text, text) to authenticated;

create or replace function claim_staff_invites(p_user uuid, p_email text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_invite staff_invites;
  v_n integer := 0;
begin
  if lower(btrim(p_email)) = owner_email() then
    insert into admins (user_id) values (p_user) on conflict do nothing;
  end if;
  for v_invite in select * from staff_invites where email = lower(btrim(p_email)) and claimed_at is null for update loop
    if v_invite.kind = 'rider' then
      insert into riders (user_id, name, phone) values (p_user, v_invite.rider_name, v_invite.rider_phone)
      on conflict (user_id) do update set name = coalesce(riders.name, excluded.name), phone = coalesce(riders.phone, excluded.phone);
    elsif v_invite.kind = 'admin' then
      insert into admins (user_id) values (p_user) on conflict do nothing;
    else
      insert into kitchen_staff (kitchen_id, user_id) values (v_invite.kitchen_id, p_user) on conflict do nothing;
    end if;
    update staff_invites set claimed_at = now(), claimed_user_id = p_user where id = v_invite.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function claim_staff_invites(uuid, text) from public, anon, authenticated;

create or replace function admin_set_rider(p_user uuid, p_name text, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  perform rider_details_check(p_name, p_phone);
  update riders set name = btrim(p_name), phone = p_phone where user_id = p_user;
  if not found then raise exception 'not_a_rider'; end if;
end $$;
revoke execute on function admin_set_rider(uuid, text, text) from public, anon;
grant execute on function admin_set_rider(uuid, text, text) to authenticated;
