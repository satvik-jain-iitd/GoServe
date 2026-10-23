-- Story A3 (#150). Dish photos live in a public Storage bucket `menu`: anyone can read a photo by its link, only an admin can add, replace or remove one.
insert into storage.buckets (id, name, public) values ('menu', 'menu', true) on conflict (id) do nothing;
create policy menu_photos_insert on storage.objects for insert to authenticated with check (bucket_id = 'menu' and is_admin());
create policy menu_photos_update on storage.objects for update to authenticated using (bucket_id = 'menu' and is_admin()) with check (bucket_id = 'menu' and is_admin());
create policy menu_photos_delete on storage.objects for delete to authenticated using (bucket_id = 'menu' and is_admin());
