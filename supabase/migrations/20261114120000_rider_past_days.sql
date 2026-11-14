-- Story 1442 (boards PD1 to PD3 and AR1; reviewer's pick on the owner's delegation, 14 Nov 2026): the rider's "Pichhle din".
-- The admin number "Past days", 0 to 30, starts at 7. 0 hides the row. The rider's orders are already readable by him (orders_my_rider), so no new access to orders.
-- 1) settings row rider_past_days {"days": 7}, checked 0 to 30.
-- 2) rider_past_days_get_v2 / rider_past_days_set_v2: admin only; the row keeps who and when.
-- 3) rider_past_days: a rider (or an admin) reads the number.
-- Additive and safe to run twice: every object is guarded.
alter table settings drop constraint if exists settings_rider_past_days_rule;
alter table settings add constraint settings_rider_past_days_rule check (name <> 'rider_past_days' or
  case when jsonb_typeof(value) = 'object' and jsonb_typeof(value -> 'days') = 'number'
       then (value ->> 'days')::numeric between 0 and 30 and (value ->> 'days')::numeric % 1 = 0
       else false end);
insert into settings (name, value) values ('rider_past_days', '{"days": 7}'::jsonb) on conflict (name) do nothing;

create or replace function rider_past_days_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('days', (s.value ->> 'days')::integer, 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'rider_past_days');
end $$;

create or replace function rider_past_days_set_v2(p_days integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_days is null or p_days < 0 or p_days > 30 then
    return jsonb_build_object('ok', false, 'error', 'invalid_days', 'message', 'Pick 0 to 30 days.');
  end if;
  update settings set value = jsonb_build_object('days', p_days), updated_by = auth.uid(), updated_at = now() where name = 'rider_past_days';
  return jsonb_build_object('ok', true);
end $$;

create or replace function rider_past_days() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or exists (select 1 from riders where user_id = auth.uid())) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object('days', coalesce((select (value ->> 'days')::integer from settings where name = 'rider_past_days'), 7));
end $$;
revoke all on function rider_past_days_get_v2() from public, anon;
revoke all on function rider_past_days_set_v2(integer) from public, anon;
revoke all on function rider_past_days() from public, anon;
grant execute on function rider_past_days_get_v2() to authenticated;
grant execute on function rider_past_days_set_v2(integer) to authenticated;
grant execute on function rider_past_days() to authenticated;
