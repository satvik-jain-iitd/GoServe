-- Story #1280 (board A13-KitchenOff, closes the data half of #1193): an admin turns a kitchen that is off back on.
-- Turning on makes the kitchen active again and leaves it closed for orders (open false), so no order reaches a kitchen with no staff.
-- Remove already took the staff rows away; the admin adds them again, then the kitchen opens itself.
-- Who and when: every change of a kitchen's active flag by an admin or a cook goes in kitchen_active_log. Only admins read it.
create table kitchen_active_log (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchens (id) on delete cascade,
  active boolean not null,
  by_user uuid default auth.uid(),
  by_label text,
  at timestamptz not null default now()
);
create index kitchen_active_log_kitchen_at on kitchen_active_log (kitchen_id, at desc);
alter table kitchen_active_log enable row level security;
create policy kitchen_active_log_admin_read on kitchen_active_log for select to authenticated using (is_admin());
revoke all on kitchen_active_log from anon, authenticated;
grant select on kitchen_active_log to authenticated;

-- One admin-only call. Two admins at the same moment: the second finds it already on and changes nothing (ok true, changed false).
create function kitchen_turn_on(p_kitchen uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_active boolean;
begin
  if not is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select active into v_active from kitchens where id = p_kitchen for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_active then return jsonb_build_object('ok', true, 'changed', false); end if;
  update kitchens set active = true, open = false where id = p_kitchen;
  insert into kitchen_active_log (kitchen_id, active, by_label) values (p_kitchen, true, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'changed', true);
end $$;
revoke all on function kitchen_turn_on(uuid) from public, anon;
grant execute on function kitchen_turn_on(uuid) to authenticated;

-- Remove now says who and when, so the off kitchen's page can show it. Same rules as before.
create or replace function kitchen_remove_v2(p_kitchen uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_staff integer;
begin
  if not (is_admin() or is_my_kitchen(p_kitchen)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if exists (select 1 from orders where kitchen_id = p_kitchen and status not in ('delivered', 'cancelled')) then
    return jsonb_build_object('ok', false, 'error', 'orders_open', 'message', 'Finish the orders on your tickets first, then remove the kitchen.');
  end if;
  update kitchens set active = false, open = false where id = p_kitchen;
  insert into kitchen_active_log (kitchen_id, active, by_label) values (p_kitchen, false, auth.jwt() ->> 'email');
  with gone as (delete from kitchen_staff where kitchen_id = p_kitchen returning 1) select count(*) into v_staff from gone;
  return jsonb_build_object('ok', true, 'staff', v_staff);
end $$;
