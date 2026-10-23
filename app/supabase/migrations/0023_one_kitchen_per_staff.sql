-- Story H3 (#186, epic E15, MVP 2.5). A staff account belongs to one kitchen. Two rows made the kitchen app pick one at random (bug 2 of the first prod walk).
-- If a user already has two rows, this migration fails: remove one in the admin app first.

create unique index kitchen_staff_one_kitchen on kitchen_staff (user_id);

-- Same function as in 0014; a person already in another kitchen is refused with a plain code.
create or replace function admin_add_person(p_email text, p_kind text, p_kitchen uuid) returns void
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
    if exists (select 1 from kitchen_staff where user_id = v_user and kitchen_id <> p_kitchen) then
      raise exception 'already_staff';
    end if;
    insert into kitchen_staff (kitchen_id, user_id) values (p_kitchen, v_user) on conflict do nothing;
  else
    raise exception 'invalid_kind';
  end if;
end $$;
