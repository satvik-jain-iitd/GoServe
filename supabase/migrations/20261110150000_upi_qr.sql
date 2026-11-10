-- Story #1263 (epic #1259, board A10-PayMethods): the UPI QR the rider shows at the door is a picture the admin uploads, not a file in a release.
-- 1) Bucket upi-qr: public to read (the rider's phone shows it), only an admin ADDS a picture (insert only: a picture is never replaced or deleted, so the picture
--    that says where the money goes cannot change without a setting change and a log row), at most 2 MB, only PNG, JPEG and WebP.
-- 2) settings row upi_qr {"object": null}: the name of one object in that bucket. null means no real QR yet. Only an admin sets it, through upi_qr_set_v2,
--    and only to an object that exists in this bucket (never an address, so no other host can be named). Every change is logged with who and when.
-- 3) upi_qr_object() answers any signed-in user (the rider; customers sign in too) with the object name, or null. It is the name of a public picture, so nothing secret
--    is in it; anon cannot call it. The app builds the address from its own project address.
-- 4) No QR, no UPI: payment_methods_on() (what the customer's bill reads) leaves upi_door out while no QR is set, and Cash cannot be turned off while no QR is set,
--    so the bill never offers a way the rider cannot take, and the rider always has a way to mark the order delivered.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upi-qr', 'upi-qr', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
create policy upi_qr_insert on storage.objects for insert to authenticated with check (bucket_id = 'upi-qr' and is_admin());

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
declare v_cur text;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_object is null or p_object !~ '^qr-[0-9a-f-]{36}\.(png|jpg|webp)$'
     or not exists (select 1 from storage.objects where bucket_id = 'upi-qr' and name = p_object) then
    return jsonb_build_object('ok', false, 'error', 'invalid_object', 'message', 'That picture is not in the QR folder.');
  end if;
  select value ->> 'object' into v_cur from settings where name = 'upi_qr' for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_setting', 'message', 'The QR setting is missing.');
  end if;
  if v_cur = p_object then
    return jsonb_build_object('ok', true, 'object', p_object, 'changed', false);
  end if;
  update settings set value = jsonb_build_object('object', p_object), updated_by = auth.uid(), updated_at = now() where name = 'upi_qr';
  insert into upi_qr_log (object, by_label) values (p_object, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'object', p_object, 'changed', true);
end $$;
revoke all on function upi_qr_get_v2() from public, anon;
revoke all on function upi_qr_set_v2(text) from public, anon;
grant execute on function upi_qr_get_v2() to authenticated;
grant execute on function upi_qr_set_v2(text) to authenticated;

-- No QR, no UPI (point 4). payment_methods_on() is what the customer's bill and the rider's Collect screen read.
create or replace function payment_methods_on() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when (select value ->> 'object' from settings where name = 'upi_qr') is null then value - 'upi_door' else value end
  from settings where name = 'payment_methods'
$$;

-- payment_methods_set_v2 of 20261110130000, with one more refusal: Cash cannot go off while no QR is set.
create or replace function payment_methods_set_v2(p_method text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cur jsonb; v_new jsonb;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_method is null or p_method not in ('cash', 'upi_door') or p_on is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_method', 'message', 'This way of paying does not exist.');
  end if;
  select value into v_cur from settings where name = 'payment_methods' for update;
  select coalesce(jsonb_agg(m order by m), '[]'::jsonb) into v_new
    from (select m from jsonb_array_elements_text(v_cur) m where m <> p_method union select p_method where p_on) x;
  if v_new <@ v_cur and v_cur <@ v_new then
    return jsonb_build_object('ok', true, 'changed', false, 'methods', v_cur);
  end if;
  if jsonb_array_length(v_new) = 0 then
    return jsonb_build_object('ok', false, 'error', 'last_method', 'message', 'One way to pay must stay on.');
  end if;
  if not (v_new ? 'cash') and (select value ->> 'object' from settings where name = 'upi_qr') is null then
    return jsonb_build_object('ok', false, 'error', 'qr_missing', 'message', 'Upload the UPI QR first.');
  end if;
  update settings set value = v_new, updated_by = auth.uid(), updated_at = now() where name = 'payment_methods';
  insert into payment_methods_log (methods, by_label) values (v_new, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'changed', true, 'methods', v_new);
end $$;
revoke all on function payment_methods_set_v2(text, boolean) from public, anon;
grant execute on function payment_methods_set_v2(text, boolean) to authenticated;
