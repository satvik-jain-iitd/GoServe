-- Story #1263 (epic #1259, board A10-PayMethods): the UPI QR the rider shows at the door is a picture the admin uploads, not a file in a release.
-- 1) Bucket upi-qr: public to read (the rider's phone shows it), only an admin writes (same shape as the menu photos bucket, migration 0015),
--    at most 2 MB, only PNG, JPEG and WebP.
-- 2) settings row upi_qr {"object": null}: the name of one object in that bucket. null means no real QR yet. Only an admin sets it, through upi_qr_set_v2,
--    and only to an object that exists in this bucket (never an address, so no other host can be named). Every change is logged with who and when.
-- 3) upi_qr_object() answers the rider (any signed-in user) with the object name, or null. The app builds the address from its own project address.
--    Customers and anon never see it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upi-qr', 'upi-qr', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
create policy upi_qr_insert on storage.objects for insert to authenticated with check (bucket_id = 'upi-qr' and is_admin());
create policy upi_qr_update on storage.objects for update to authenticated using (bucket_id = 'upi-qr' and is_admin()) with check (bucket_id = 'upi-qr' and is_admin());
create policy upi_qr_delete on storage.objects for delete to authenticated using (bucket_id = 'upi-qr' and is_admin());

insert into settings (name, value) values ('upi_qr', '{"object": null}'::jsonb) on conflict (name) do nothing;

create table upi_qr_log (
  id uuid primary key default gen_random_uuid(),
  object text not null,
  by_user uuid default auth.uid(),
  by_label text,
  at timestamptz not null default now()
);
alter table upi_qr_log enable row level security;
create policy upi_qr_log_admin_read on upi_qr_log for select to authenticated using (is_admin());
revoke all on upi_qr_log from public, anon, authenticated;
grant select on upi_qr_log to authenticated;

create function upi_qr_object() returns text
language sql stable security definer set search_path = public as $$
  select value ->> 'object' from settings where name = 'upi_qr'
$$;
revoke all on function upi_qr_object() from public, anon;
grant execute on function upi_qr_object() to authenticated, service_role;

create function upi_qr_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('object', s.value ->> 'object', 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'upi_qr');
end $$;

create function upi_qr_set_v2(p_object text) returns jsonb
language plpgsql security definer set search_path = public, storage as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_object is null or p_object !~ '^qr-[0-9a-f-]{36}\.(png|jpg|webp)$'
     or not exists (select 1 from storage.objects where bucket_id = 'upi-qr' and name = p_object) then
    return jsonb_build_object('ok', false, 'error', 'invalid_object', 'message', 'That picture is not in the QR folder.');
  end if;
  update settings set value = jsonb_build_object('object', p_object), updated_by = auth.uid(), updated_at = now() where name = 'upi_qr';
  insert into upi_qr_log (object, by_label) values (p_object, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'object', p_object);
end $$;
revoke all on function upi_qr_get_v2() from public, anon;
revoke all on function upi_qr_set_v2(text) from public, anon;
grant execute on function upi_qr_get_v2() to authenticated;
grant execute on function upi_qr_set_v2(text) to authenticated;
