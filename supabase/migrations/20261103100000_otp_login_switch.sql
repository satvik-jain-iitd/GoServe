-- Story #829: the phone code login is a switch the admin flips, and it starts off (there is no SMS provider yet; Google is the way in).
-- The switch is one row in `settings`. The table stays closed except for that one row: an anonymous customer's app must read it at start and hear about a flip
-- through Realtime, so a policy lets anon and authenticated SELECT only name = 'otp_login_on'. swap_discount_pct stays unreadable (no policy matches it).
-- Realtime's postgres_changes respects that policy, so only this row reaches an open app.
create policy settings_read_otp_login on settings for select to anon, authenticated using (name = 'otp_login_on');
grant select on settings to anon, authenticated;

alter table settings add constraint settings_otp_login_on_rule check (name <> 'otp_login_on' or jsonb_typeof(value) = 'boolean');
insert into settings (name, value) values ('otp_login_on', 'false'::jsonb) on conflict (name) do nothing;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings') then
    alter publication supabase_realtime add table settings;
  end if;
end $$;

-- The admin reads and flips it through two functions that check is_admin() themselves, the same rules as swap_discount_*_v2.
create function otp_login_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('on', (s.value #>> '{}')::boolean, 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'otp_login_on');
end $$;

create function otp_login_set_v2(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_on is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'message', 'Pick on or off.');
  end if;
  update settings set value = to_jsonb(p_on), updated_by = auth.uid(), updated_at = now() where name = 'otp_login_on';
  return jsonb_build_object('ok', true);
end $$;

revoke all on function otp_login_get_v2() from public, anon;
revoke all on function otp_login_set_v2(boolean) from public, anon;
grant execute on function otp_login_get_v2() to authenticated;
grant execute on function otp_login_set_v2(boolean) to authenticated;
