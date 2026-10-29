-- Story #619 layer d (board A9). The admin reads and changes the sold-out swap discount from the admin panel. The table stays closed; these two functions are the only way,
-- and they check is_admin() themselves. The percent is a whole number from 0 to 50 (the table refuses anything else).
create function swap_discount_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('pct', (s.value #>> '{}')::integer, 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'swap_discount_pct');
end $$;

create function swap_discount_set_v2(p_pct integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 50 then
    return jsonb_build_object('ok', false, 'error', 'invalid_percent', 'message', 'Pick a whole number from 0 to 50.');
  end if;
  update settings set value = to_jsonb(p_pct), updated_by = auth.uid(), updated_at = now() where name = 'swap_discount_pct';
  return jsonb_build_object('ok', true);
end $$;

revoke all on function swap_discount_get_v2() from public, anon;
revoke all on function swap_discount_set_v2(integer) from public, anon;
grant execute on function swap_discount_get_v2() to authenticated;
grant execute on function swap_discount_set_v2(integer) to authenticated;
