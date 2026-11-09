-- Story #850 (epic E32), board K-Account: "Remove this kitchen" on the kitchen's Today tab. This file is the data path only; the confirm sheet waits for its frame.
-- Removing is soft: customers stop seeing the kitchen (active and open off, as the admin's "Off") and the kitchen's staff rows go, so those Google accounts can be
-- added to another kitchen. Orders and every other row stay. It refuses while the kitchen still has orders to finish, so an order never loses its cook.
-- Who may call it: a cook of that kitchen or an admin, like set_kitchen_open.
create function kitchen_remove_v2(p_kitchen uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_staff integer;
begin
  if not (is_admin() or is_my_kitchen(p_kitchen)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if exists (select 1 from orders where kitchen_id = p_kitchen and status not in ('delivered', 'cancelled')) then
    return jsonb_build_object('ok', false, 'error', 'orders_open', 'message', 'Finish the orders on your tickets first, then remove the kitchen.');
  end if;
  update kitchens set active = false, open = false where id = p_kitchen;
  with gone as (delete from kitchen_staff where kitchen_id = p_kitchen returning 1) select count(*) into v_staff from gone;
  return jsonb_build_object('ok', true, 'staff', v_staff);
end $$;

revoke all on function kitchen_remove_v2(uuid) from public, anon;
grant execute on function kitchen_remove_v2(uuid) to authenticated;
