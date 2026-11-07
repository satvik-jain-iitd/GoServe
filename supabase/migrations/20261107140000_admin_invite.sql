-- Story #968 (epic E32): an admin can invite another admin by email before that person has ever signed in, the same way a cook or a rider is invited (story #875).
-- staff_invites.kind allows 'admin' (no kitchen). The claim turns an open admin invite into the admins row at the first confirmed Google sign-in, or at the
-- first open of /admin/ (claim_my_invites). admin_add_person no longer refuses an admin email with no account: it saves the invite.
alter table staff_invites drop constraint if exists staff_invites_kind_check;
alter table staff_invites add constraint staff_invites_kind_check check (kind in ('kitchen', 'rider', 'admin'));

create or replace function claim_staff_invites(p_user uuid, p_email text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_invite staff_invites;
  v_n integer := 0;
begin
  for v_invite in select * from staff_invites where email = lower(btrim(p_email)) and claimed_at is null for update loop
    if v_invite.kind = 'rider' then
      insert into riders (user_id) values (p_user) on conflict do nothing;
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

create or replace function admin_add_person(p_email text, p_kind text, p_kitchen uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
  v_other text;
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_kind not in ('admin', 'rider', 'kitchen') or (p_kind = 'kitchen' and p_kitchen is null) then
    raise exception 'invalid_kind';
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    insert into staff_invites (email, kind, kitchen_id, created_by)
    values (v_email, p_kind, case when p_kind = 'kitchen' then p_kitchen end, auth.uid()) on conflict do nothing;
    return jsonb_build_object('invited', true);
  end if;
  if p_kind = 'admin' then
    insert into admins (user_id) values (v_user) on conflict do nothing;
  elsif p_kind = 'rider' then
    insert into riders (user_id) values (v_user) on conflict do nothing;
  else
    select k.name into v_other from kitchen_staff s join kitchens k on k.id = s.kitchen_id where s.user_id = v_user and s.kitchen_id <> p_kitchen limit 1;
    if v_other is not null then
      raise exception 'already_staff' using detail = v_other;
    end if;
    insert into kitchen_staff (kitchen_id, user_id) values (p_kitchen, v_user) on conflict do nothing;
  end if;
  return jsonb_build_object('invited', false);
end $$;
revoke execute on function admin_add_person(text, text, uuid) from public, anon;
grant execute on function admin_add_person(text, text, uuid) to authenticated;
