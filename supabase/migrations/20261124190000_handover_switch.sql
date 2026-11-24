-- Story 1672 (epic 1652): the admin flips the two hand-over code switches. Same shape as otp_login_get_v2 and otp_login_set_v2:
-- both functions check is_admin() themselves, and the set function stamps who and when. kitchen = pickup_code_on, customer = drop_code_on.
-- Nothing else changes: the two settings rows and the functions that read them (pickup_code_on, drop_code_on) are already there.
create or replace function handover_switch_get_v1() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object(
    'kitchen', (select jsonb_build_object('on', coalesce((s.value #>> '{}')::boolean, false), 'updated_by', u.email, 'updated_at', s.updated_at)
                from settings s left join auth.users u on u.id = s.updated_by where s.name = 'pickup_code_on'),
    'customer', (select jsonb_build_object('on', coalesce((s.value #>> '{}')::boolean, false), 'updated_by', u.email, 'updated_at', s.updated_at)
                 from settings s left join auth.users u on u.id = s.updated_by where s.name = 'drop_code_on')));
end $$;

create or replace function handover_switch_set_v1(p_which text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  v_name := case p_which when 'kitchen' then 'pickup_code_on' when 'customer' then 'drop_code_on' end;
  if v_name is null or p_on is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'message', 'Pick kitchen or customer, and on or off.');
  end if;
  update settings set value = to_jsonb(p_on), updated_by = auth.uid(), updated_at = now() where name = v_name;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function handover_switch_get_v1() from public, anon;
revoke all on function handover_switch_set_v1(text, boolean) from public, anon;
grant execute on function handover_switch_get_v1() to authenticated;
grant execute on function handover_switch_set_v1(text, boolean) to authenticated;
