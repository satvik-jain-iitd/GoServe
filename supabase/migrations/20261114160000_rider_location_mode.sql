-- Story 1498 (boards AM1 and RL1, canvas row 2ci): how the customer sees the rider is the admin's choice.
--   link  a row that opens Google Maps at the rider's last place, with the clock time of that place. The start value (owner, 14 Nov 2026).
--   map   the rider row and the live map inside the app (board T4), as before.
--   off   no row. The minutes, the status and Call stay.
-- 1) settings row rider_location_mode {"mode": "link"}, checked. An open customer app must read it and hear a change, so it is readable like otp_login_on.
-- 2) rider_location_mode_get_v2 / rider_location_mode_set_v2: admin only; the row keeps who and when.
-- 3) rider_row_tap: counts a tap on the row as an order event (customer.rider_link or customer.rider_map). The order, the mode and the time; no place.
-- Additive and safe to run twice: every object is guarded.
alter table settings drop constraint if exists settings_rider_location_mode_rule;
alter table settings add constraint settings_rider_location_mode_rule check (name <> 'rider_location_mode' or
  case when jsonb_typeof(value) = 'object' then value ->> 'mode' in ('off', 'link', 'map') else false end);
insert into settings (name, value) values ('rider_location_mode', '{"mode": "link"}'::jsonb) on conflict (name) do nothing;

drop policy if exists settings_read_rider_location_mode on settings;
create policy settings_read_rider_location_mode on settings for select to anon, authenticated using (name = 'rider_location_mode');

create or replace function rider_location_mode_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('mode', s.value ->> 'mode', 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'rider_location_mode');
end $$;

create or replace function rider_location_mode_set_v2(p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('off', 'link', 'map') then
    return jsonb_build_object('ok', false, 'error', 'invalid_mode', 'message', 'Pick one of the three.');
  end if;
  update settings set value = jsonb_build_object('mode', p_mode), updated_by = auth.uid(), updated_at = now() where name = 'rider_location_mode';
  return jsonb_build_object('ok', true);
end $$;

-- The customer's own order only, and only while it is on the way. Anything else is ignored: a count must never get in the way of the screen.
create or replace function rider_row_tap(p_order uuid, p_mode text) returns void
language plpgsql security definer set search_path = public as $$
declare v orders;
begin
  if p_mode is null or p_mode not in ('link', 'map') then return; end if;
  select * into v from orders where id = p_order and session_id = auth.uid()::text and status = 'out_for_delivery';
  if v.id is null then return; end if;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'customer.rider_' || p_mode, 'customer');
end $$;

revoke all on function rider_location_mode_get_v2() from public, anon;
revoke all on function rider_location_mode_set_v2(text) from public, anon;
revoke all on function rider_row_tap(uuid, text) from public, anon;
grant execute on function rider_location_mode_get_v2() to authenticated;
grant execute on function rider_location_mode_set_v2(text) to authenticated;
grant execute on function rider_row_tap(uuid, text) to authenticated;
