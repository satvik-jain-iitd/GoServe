-- Story 944 (hardening): only the kitchen's owner or an admin may remove a kitchen.
-- A staff member who is not the owner gets the named refusal owner_only. Same body as before otherwise. Safe to run twice.
create or replace function kitchen_remove_v2(p_kitchen uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_staff integer;
begin
  if not is_admin() then
    if not is_my_kitchen(p_kitchen) then raise exception 'not_allowed' using errcode = '42501'; end if;
    if not exists (select 1 from kitchen_staff where kitchen_id = p_kitchen and user_id = auth.uid() and role = 'owner') then
      raise exception 'owner_only' using errcode = '42501', hint = 'Only the kitchen owner or an admin can remove a kitchen.';
    end if;
  end if;
  if exists (select 1 from orders where kitchen_id = p_kitchen and status not in ('delivered', 'cancelled')) then
    return jsonb_build_object('ok', false, 'error', 'orders_open', 'message', 'Finish the orders on your tickets first, then remove the kitchen.');
  end if;
  update kitchens set active = false, open = false where id = p_kitchen;
  insert into kitchen_active_log (kitchen_id, active, by_label) values (p_kitchen, false, auth.jwt() ->> 'email');
  with gone as (delete from kitchen_staff where kitchen_id = p_kitchen returning 1) select count(*) into v_staff from gone;
  return jsonb_build_object('ok', true, 'staff', v_staff);
end $$;
revoke all on function kitchen_remove_v2(uuid) from public, anon;
grant execute on function kitchen_remove_v2(uuid) to authenticated;
