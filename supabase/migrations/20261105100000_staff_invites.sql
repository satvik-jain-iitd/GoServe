-- Story #875 (epic E32), boards A-AddPerson-Invite and A-Kitchen-Invite. An admin can add a cook or a rider by email before that person has ever signed in.
-- The invite waits in staff_invites. When the same email signs in with Google, the invite turns into the kitchen_staff or riders row.
-- Only an admin reads or changes invites. A sign-up is never blocked by an invite: the trigger swallows its own errors.
create table staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and email like '%@%'),
  kind text not null check (kind in ('kitchen', 'rider')),
  kitchen_id uuid references kitchens (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_user_id uuid references auth.users (id) on delete set null,
  check ((kind = 'kitchen') = (kitchen_id is not null))
);
-- One open invite per email, kind and kitchen. A rider has no kitchen, so nulls count as equal.
create unique index staff_invites_open on staff_invites (email, kind, kitchen_id) nulls not distinct where claimed_at is null;
create index staff_invites_kitchen on staff_invites (kitchen_id);
create index staff_invites_created_by on staff_invites (created_by);
create index staff_invites_claimed_user on staff_invites (claimed_user_id);

alter table staff_invites enable row level security;
create policy staff_invites_admin on staff_invites for all to authenticated using (is_admin()) with check (is_admin());
revoke all on staff_invites from anon, authenticated;
grant select, insert, update, delete on staff_invites to authenticated;

-- The core: turns every open invite of this email into a row. Nobody calls it directly.
create function claim_staff_invites(p_user uuid, p_email text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_invite staff_invites;
  v_n integer := 0;
begin
  for v_invite in select * from staff_invites where email = lower(btrim(p_email)) and claimed_at is null for update loop
    if v_invite.kind = 'rider' then
      insert into riders (user_id) values (p_user) on conflict do nothing;
    else
      insert into kitchen_staff (kitchen_id, user_id) values (v_invite.kitchen_id, p_user) on conflict do nothing;
    end if;
    update staff_invites set claimed_at = now(), claimed_user_id = p_user where id = v_invite.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function claim_staff_invites(uuid, text) from public, anon, authenticated;

-- The safety check at the first load of the kitchen or rider gate: the signed-in person claims their own invites. Only a confirmed email counts.
create function claim_my_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then
    return 0;
  end if;
  return claim_staff_invites(auth.uid(), v_email);
end $$;
revoke all on function claim_my_invites() from public, anon;
grant execute on function claim_my_invites() to authenticated;

-- The first sign-in. Whatever goes wrong here, the person still gets their account.
create function staff_invites_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    perform claim_staff_invites(new.id, new.email);
  end if;
  return new;
exception when others then
  return new;
end $$;
revoke all on function staff_invites_on_signup() from public, anon, authenticated;
create trigger staff_invites_claim after insert on auth.users for each row execute function staff_invites_on_signup();

-- The open invites, with the kitchen's name, for the City screen.
create function admin_invites() returns table (id uuid, email text, kind text, kitchen_id uuid, kitchen_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  return query
    select i.id, i.email, i.kind, i.kitchen_id, k.name, i.created_at
    from staff_invites i left join kitchens k on k.id = i.kitchen_id
    where i.claimed_at is null
    order by i.created_at, i.email;
end $$;
revoke all on function admin_invites() from public, anon;
grant execute on function admin_invites() to authenticated;

create function admin_cancel_invite(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  delete from staff_invites where id = p_id and claimed_at is null;
end $$;
revoke all on function admin_cancel_invite(uuid) from public, anon;
grant execute on function admin_cancel_invite(uuid) to authenticated;

-- Same checks as before. An email with no account is no longer an error: it becomes an invite. The answer says which one happened.
-- A person who already works for another kitchen is refused, and the refusal names that kitchen.
drop function admin_add_person(text, text, uuid);
create function admin_add_person(p_email text, p_kind text, p_kitchen uuid) returns jsonb
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
    if p_kind = 'admin' then
      raise exception 'no_such_user';
    end if;
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
