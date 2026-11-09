-- Story #985: the owner account is the one superadmin, hardcoded (a constant, not a setting; no screen adds or changes it).
-- It can never be removed from the admins, is_admin() is true for it even when its row is gone (only with a confirmed email), and its sign-in puts the row back.
-- The same address is OWNER_EMAIL in app/src/lib/admin.ts; a unit test checks the two match.
create or replace function owner_email() returns text
language sql immutable as $$ select 'satvik.jain@iitdalumni.com'::text $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
      or exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null and lower(email) = owner_email())
$$;
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- The owner row is in now, when the user exists.
insert into admins (user_id) select id from auth.users where email_confirmed_at is not null and lower(email) = owner_email() on conflict do nothing;

-- The sign-up trigger and the admin screen's first load both call this: the owner's confirmed address gets its admins row back.
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

create or replace function admin_remove_person(p_kind text, p_user uuid, p_kitchen uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_kind = 'admin' then
    if exists (select 1 from auth.users where id = p_user and lower(email) = owner_email()) then
      raise exception 'owner_admin';
    end if;
    if (select count(*) from admins) <= 1 then
      raise exception 'last_admin';
    end if;
    delete from admins where user_id = p_user;
  elsif p_kind = 'rider' then
    update orders set rider_id = null where rider_id = p_user and status not in ('delivered', 'cancelled');
    delete from riders where user_id = p_user;
  elsif p_kind = 'kitchen' then
    delete from kitchen_staff where user_id = p_user and kitchen_id = p_kitchen;
  else
    raise exception 'invalid_kind';
  end if;
end $$;
revoke execute on function admin_remove_person(text, uuid, uuid) from public, anon;
grant execute on function admin_remove_person(text, uuid, uuid) to authenticated;
