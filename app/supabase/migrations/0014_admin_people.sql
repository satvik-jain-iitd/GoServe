-- Story A2 (#149, epic E8). The admin screen lists, adds and removes the people of the system by email.
-- People are rows in kitchen_staff (kitchen), riders (rider) and admins (admin); the email lives in auth.users, which an app key cannot read,
-- so these three functions look it up. Each one refuses anyone who is not an admin.

create function admin_people() returns table (kind text, user_id uuid, email text, kitchen_id uuid, kitchen_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  return query
    select 'admin', a.user_id, u.email::text, null::uuid, null::text from admins a left join auth.users u on u.id = a.user_id
    union all
    select 'rider', r.user_id, u.email::text, null::uuid, null::text from riders r left join auth.users u on u.id = r.user_id
    union all
    select 'kitchen', s.user_id, u.email::text, s.kitchen_id, k.name from kitchen_staff s left join auth.users u on u.id = s.user_id left join kitchens k on k.id = s.kitchen_id
    order by 1, 3;
end $$;

-- The person must have signed in with Google once, so auth.users has the email.
create function admin_add_person(p_email text, p_kind text, p_kitchen uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'no_such_user';
  end if;
  if p_kind = 'admin' then
    insert into admins (user_id) values (v_user) on conflict do nothing;
  elsif p_kind = 'rider' then
    insert into riders (user_id) values (v_user) on conflict do nothing;
  elsif p_kind = 'kitchen' and p_kitchen is not null then
    insert into kitchen_staff (kitchen_id, user_id) values (p_kitchen, v_user) on conflict do nothing;
  else
    raise exception 'invalid_kind';
  end if;
end $$;

create function admin_remove_person(p_kind text, p_user uuid, p_kitchen uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_kind = 'admin' then
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

revoke execute on function admin_people() from public, anon;
revoke execute on function admin_add_person(text, text, uuid) from public, anon;
revoke execute on function admin_remove_person(text, uuid, uuid) from public, anon;
grant execute on function admin_people() to authenticated;
grant execute on function admin_add_person(text, text, uuid) to authenticated;
grant execute on function admin_remove_person(text, uuid, uuid) to authenticated;
