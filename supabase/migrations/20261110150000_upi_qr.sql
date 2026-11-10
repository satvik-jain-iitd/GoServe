-- Story #1263 (epic #1259, board A10-PayMethods): the UPI QR the rider shows at the door is a picture the admin uploads, not a file in a release.
-- 1) Bucket upi-qr: public to read (the rider's phone shows it), only an admin writes (same shape as the menu photos bucket, migration 0015).
-- 2) settings row upi_qr {"url": null}: null means no real QR yet and the app shows its sample picture. Only an admin sets it, through upi_qr_set_v2, and only to
--    an address inside this bucket. Who and when are the row's updated_by and updated_at.
-- 3) upi_qr_url() answers the rider (any signed-in user) with the address, or null. Customers and anon never see it.

insert into storage.buckets (id, name, public) values ('upi-qr', 'upi-qr', true) on conflict (id) do nothing;
create policy upi_qr_insert on storage.objects for insert to authenticated with check (bucket_id = 'upi-qr' and is_admin());
create policy upi_qr_update on storage.objects for update to authenticated using (bucket_id = 'upi-qr' and is_admin()) with check (bucket_id = 'upi-qr' and is_admin());
create policy upi_qr_delete on storage.objects for delete to authenticated using (bucket_id = 'upi-qr' and is_admin());

insert into settings (name, value) values ('upi_qr', '{"url": null}'::jsonb) on conflict (name) do nothing;

create function upi_qr_url() returns text
language sql stable security definer set search_path = public as $$
  select value ->> 'url' from settings where name = 'upi_qr'
$$;
revoke all on function upi_qr_url() from public, anon;
grant execute on function upi_qr_url() to authenticated, service_role;

create function upi_qr_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('url', s.value ->> 'url', 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'upi_qr');
end $$;

create function upi_qr_set_v2(p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_url is null or p_url !~ '^https://[A-Za-z0-9.-]+/storage/v1/object/public/upi-qr/[A-Za-z0-9._-]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_url', 'message', 'The picture is not in the QR folder.');
  end if;
  update settings set value = jsonb_build_object('url', p_url), updated_by = auth.uid(), updated_at = now() where name = 'upi_qr';
  return jsonb_build_object('ok', true, 'url', p_url);
end $$;
revoke all on function upi_qr_get_v2() from public, anon;
revoke all on function upi_qr_set_v2(text) from public, anon;
grant execute on function upi_qr_get_v2() to authenticated;
grant execute on function upi_qr_set_v2(text) to authenticated;
