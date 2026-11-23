-- Story 944: kitchen staff may update only the stock columns of their own kitchen's dishes (available, back_soon_at).
-- The policy staff_update_menu lets staff write any column (price, name, kitchen, id). A trigger limits it. Admins and the server (no signed-in user) are not limited.
create or replace function menu_items_staff_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin()
     and (to_jsonb(new) - 'available' - 'back_soon_at') is distinct from (to_jsonb(old) - 'available' - 'back_soon_at') then
    raise exception 'staff can change only available and back_soon_at' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists menu_items_staff_columns on menu_items;
create trigger menu_items_staff_columns before update on menu_items
  for each row execute function menu_items_staff_columns();
