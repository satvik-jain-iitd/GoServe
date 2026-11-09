-- Story #1015: the live delivery time comes from the server, not from a constant in the app. order_tracking (one row per order, on the realtime channel,
-- kept by the database on every status change and rider ping) now carries eta_lo_min, eta_hi_min and eta_late. No external call: ride = straight line x detour
-- at a town scooter speed. The numbers are a versioned global param `eta_rules` (a change is a new version, never an edit), like `on_time_promise`.
--   placed:            prep minutes + ride (kitchen to drop point)
--   accepted/preparing: prep minutes left since accepted_at + ride
--   ready:             ride (rider to kitchen) + ride (kitchen to drop); no rider yet: kitchen to drop
--   out_for_delivery:  ride (rider to drop point)
-- hi = lo + buffer_min. The drop point is orders.drop_lat/drop_lng, else the pin's centre. No place, no number (the screen says it is working it out).
-- eta_min stays as the old single number (= eta_lo_min). eta_late: now + lo is past promised_at. Delivered or cancelled: no time.
insert into params (session_id, key, value, version)
select 'global', 'eta_rules', '{"speed_m_min": 300, "detour": 1.3, "buffer_min": 10}'::jsonb, 1
where not exists (select 1 from params where session_id = 'global' and key = 'eta_rules');

create function eta_rules() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from params where session_id = 'global' and key = 'eta_rules' and kitchen_id is null order by version desc limit 1),
    '{"speed_m_min": 300, "detour": 1.3, "buffer_min": 10}'::jsonb)
$$;
revoke all on function eta_rules() from public, anon, authenticated;

alter table orders add column if not exists accepted_at timestamptz;
alter table order_tracking add column if not exists eta_lo_min integer, add column if not exists eta_hi_min integer, add column if not exists eta_late boolean not null default false;

create function orders_stamp_accepted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then new.accepted_at := coalesce(new.accepted_at, now()); end if;
  return new;
end $$;
create trigger orders_stamp_accepted_t before update of status on orders for each row execute function orders_stamp_accepted();

create or replace function refresh_order_tracking(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  k kitchens;
  r riders;
  d pin_points;
  v_rules jsonb := eta_rules();
  v_speed numeric := (v_rules ->> 'speed_m_min')::numeric;
  v_detour numeric := (v_rules ->> 'detour')::numeric;
  v_dlat double precision;
  v_dlng double precision;
  v_lo numeric;
  v_ride_out numeric;
  v_ride_in numeric;
  v_lo_min integer;
  v_hi_min integer;
  v_late boolean := false;
begin
  select * into o from orders where id = p_order;
  if o.id is null then
    return;
  end if;
  select * into r from riders where user_id = o.rider_id;
  select * into k from kitchens where id = o.kitchen_id;
  select * into d from pin_points where pin = o.pin_code;
  v_dlat := coalesce(o.drop_lat, d.lat);
  v_dlng := coalesce(o.drop_lng, d.lng);
  if v_dlat is not null and k.lat is not null then
    v_ride_out := distance_m(k.lat, k.lng, v_dlat, v_dlng) * v_detour / v_speed;   -- kitchen to drop point
    if o.status = 'placed' then
      v_lo := k.prep_minutes + v_ride_out;
    elsif o.status in ('accepted', 'preparing') then
      v_lo := greatest(0, k.prep_minutes - extract(epoch from now() - coalesce(o.accepted_at, now())) / 60.0) + v_ride_out;
    elsif o.status = 'ready' then
      v_lo := v_ride_out + case when r.user_id is not null and r.lat is not null then distance_m(r.lat, r.lng, k.lat, k.lng) * v_detour / v_speed else 0 end;
    elsif o.status = 'out_for_delivery' and r.user_id is not null and r.lat is not null then
      v_lo := distance_m(r.lat, r.lng, v_dlat, v_dlng) * v_detour / v_speed;
    end if;
  end if;
  if v_lo is not null then
    v_lo_min := ceil(v_lo)::integer;
    v_hi_min := ceil(v_lo + (v_rules ->> 'buffer_min')::numeric)::integer;
    v_late := o.promised_at is not null and now() + make_interval(mins => v_lo_min) > o.promised_at;
  end if;
  insert into order_tracking (order_id, session_id, status, rider_lat, rider_lng, eta_min, eta_lo_min, eta_hi_min, eta_late, updated_at)
  values (o.id, o.session_id, o.status, case when o.status in ('ready', 'out_for_delivery') then r.lat end, case when o.status in ('ready', 'out_for_delivery') then r.lng end,
          v_lo_min, v_lo_min, v_hi_min, v_late, now())
  on conflict (order_id) do update set status = excluded.status, rider_lat = excluded.rider_lat, rider_lng = excluded.rider_lng, eta_min = excluded.eta_min,
    eta_lo_min = excluded.eta_lo_min, eta_hi_min = excluded.eta_hi_min, eta_late = excluded.eta_late, updated_at = excluded.updated_at;
end $$;
revoke all on function refresh_order_tracking(uuid) from public, anon, authenticated;
