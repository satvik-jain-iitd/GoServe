-- Story 1654 layer 1: a rider is saved with a real name and a mobile number (riders already has the two columns).
-- An invite keeps them until the first sign-in. admin_add_person gets two new arguments and ONE signature; claim_staff_invites copies them to the riders row.
-- Layer 1 must not reach dev without layer 2: the app's old 3-argument rider add is refused after this file.
alter table staff_invites add column if not exists rider_name text, add column if not exists rider_phone text;
alter table staff_invites drop constraint if exists staff_invites_rider_details;
alter table staff_invites add constraint staff_invites_rider_details check (
  (rider_phone is null or rider_phone ~ '^[6-9][0-9]{9}$') and (rider_name is null or char_length(btrim(rider_name)) between 1 and 60));

drop function if exists admin_add_person(text, text, uuid);
create or replace function admin_add_person(p_email text, p_kind text, p_kitchen uuid, p_rider_name text default null, p_rider_phone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
  v_other text;
  v_name text := btrim(p_rider_name);
  v_phone text := regexp_replace(coalesce(p_rider_phone, ''), '\s', '', 'g');
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_kind not in ('admin', 'rider', 'kitchen') or (p_kind = 'kitchen' and p_kitchen is null) then
    raise exception 'invalid_kind';
  end if;
  if p_kind = 'rider' then
    -- letters of any language: [:alpha:] misses the vowel signs of Indian scripts, so the marks block U+0900-0DFF and accents U+0300-036F are allowed too
    if v_name is null or v_name !~ '^[[:alpha:]\u0300-\u036F\u0900-\u0DFF .''-]{1,60}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_rider_name', 'message', 'Type the rider''s name.');
    end if;
    if v_phone !~ '^[6-9][0-9]{9}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_rider_phone', 'message', 'Type a 10-digit mobile number.');
    end if;
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    insert into staff_invites (email, kind, kitchen_id, created_by, rider_name, rider_phone)
    values (v_email, p_kind, case when p_kind = 'kitchen' then p_kitchen end, auth.uid(),
            case when p_kind = 'rider' then v_name end, case when p_kind = 'rider' then v_phone end) on conflict do nothing;
    return jsonb_build_object('ok', true, 'invited', true);
  end if;
  if p_kind = 'admin' then
    insert into admins (user_id) values (v_user) on conflict do nothing;
  elsif p_kind = 'rider' then
    insert into riders (user_id, name, phone) values (v_user, v_name, v_phone)
    on conflict (user_id) do update set name = excluded.name, phone = excluded.phone;
  else
    select k.name into v_other from kitchen_staff s join kitchens k on k.id = s.kitchen_id where s.user_id = v_user and s.kitchen_id <> p_kitchen limit 1;
    if v_other is not null then
      raise exception 'already_staff' using detail = v_other;
    end if;
    insert into kitchen_staff (kitchen_id, user_id) values (p_kitchen, v_user) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true, 'invited', false);
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
      on conflict (user_id) do update set name = coalesce(excluded.name, riders.name), phone = coalesce(excluded.phone, riders.phone);
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
