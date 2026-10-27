-- Story #468 (E27, owner decision 26 Oct 2026). One person can own one kitchen and work in another, with one sign-in.
-- The one-kitchen rule of 0023 (a unique index on user_id) goes. A membership is (kitchen, person, role). The old role "kitchen" stays valid and reads as staff.
-- The access check is already per kitchen (is_my_kitchen(kitchen) and act_on_order): a person acts only in the kitchens they belong to.
-- Only the service role calls the three functions (the Edge Function `staff` holds that key); the admin is named by the caller's login.
-- Refusals are answers, not exceptions: {ok:false, error, message}.
-- The PWA stays frozen: it reads one kitchen_staff row (limit 1), so for a person with two it shows one of them. The new app lists them.
drop index if exists kitchen_staff_one_kitchen;
alter table kitchen_staff drop constraint kitchen_staff_role_check;
alter table kitchen_staff add constraint kitchen_staff_role_check check (role in ('kitchen', 'owner', 'staff'));

create function my_kitchens_v2(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'kitchens', coalesce(jsonb_agg(jsonb_build_object('kitchen_id', k.id, 'name', k.name,
    'role', case s.role when 'owner' then 'owner' else 'staff' end) order by k.name, k.id), '[]'::jsonb))
  from kitchen_staff s join kitchens k on k.id = s.kitchen_id where s.user_id = p_user
$$;

create function staff_add_v2(p_actor uuid, p_kitchen uuid, p_user uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = p_actor) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'Only an admin can change who works in a kitchen.');
  end if;
  if p_role is null or p_role not in ('owner', 'staff') then
    return jsonb_build_object('ok', false, 'error', 'invalid_role', 'message', 'The role is owner or staff.');
  end if;
  if not exists (select 1 from kitchens where id = p_kitchen) then
    return jsonb_build_object('ok', false, 'error', 'kitchen_not_found', 'message', 'This kitchen was not found.');
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'user_not_found', 'message', 'This person was not found.');
  end if;
  insert into kitchen_staff (kitchen_id, user_id, role) values (p_kitchen, p_user, p_role)
  on conflict (kitchen_id, user_id) do update set role = excluded.role;
  return jsonb_build_object('ok', true);
end $$;

-- Removes this one membership and no other.
create function staff_remove_v2(p_actor uuid, p_kitchen uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = p_actor) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'Only an admin can change who works in a kitchen.');
  end if;
  delete from kitchen_staff where kitchen_id = p_kitchen and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'membership_not_found', 'message', 'This person does not work in this kitchen.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function my_kitchens_v2(uuid) from public, anon, authenticated;
revoke all on function staff_add_v2(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function staff_remove_v2(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function my_kitchens_v2(uuid) to service_role;
grant execute on function staff_add_v2(uuid, uuid, uuid, text) to service_role;
grant execute on function staff_remove_v2(uuid, uuid, uuid) to service_role;
