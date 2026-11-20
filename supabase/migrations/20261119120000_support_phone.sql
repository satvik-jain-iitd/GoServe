-- Story 1659 layer 1. One support phone number for GoServe, set by the admin, read by any signed-in user.
-- It is a row in settings (JSON null until the admin sets it). The table stays closed; three functions are the only way in.
-- Safe to run twice.
insert into settings (name, value) values ('support_phone', 'null'::jsonb) on conflict (name) do nothing;

alter table settings drop constraint if exists settings_support_phone_rule;
alter table settings add constraint settings_support_phone_rule check (name <> 'support_phone'
  or value = 'null'::jsonb
  or (jsonb_typeof(value) = 'string' and (value #>> '{}') ~ '^[6-9][0-9]{9}$'));

create or replace function support_phone_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('phone', s.value #>> '{}', 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'support_phone');
end $$;

create or replace function support_phone_set_v2(p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text := nullif(btrim(p_phone), '');
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if v is not null and v !~ '^[6-9][0-9]{9}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone', 'message', 'Type a 10-digit mobile number.');
  end if;
  update settings set value = coalesce(to_jsonb(v), 'null'::jsonb), updated_by = auth.uid(), updated_at = now() where name = 'support_phone';
  return jsonb_build_object('ok', true);
end $$;

create or replace function support_phone() returns text
language sql stable security definer set search_path = public as $$
  select value #>> '{}' from settings where name = 'support_phone'
$$;

revoke all on function support_phone_get_v2() from public, anon;
revoke all on function support_phone_set_v2(text) from public, anon;
revoke all on function support_phone() from public, anon;
grant execute on function support_phone_get_v2() to authenticated;
grant execute on function support_phone_set_v2(text) to authenticated;
grant execute on function support_phone() to authenticated;
