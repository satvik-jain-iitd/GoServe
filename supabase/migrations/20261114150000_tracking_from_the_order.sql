-- Story 1497: the customer's tracker is built from the order, and the time it shows is the time of the rider's place.
-- Before: the app read "You" from pin_points by the postal code it held now (26 Delhi codes only), and order_tracking.updated_at was set to now()
-- on every refresh, so a place from an hour ago could read "updated just now".
--   riders.located_at        when the rider's phone last sent a place. Set only by rider_ping. riders.updated_at also moves on an Online flip, so it cannot say this.
--   order_tracking.rider_at  that time, copied with the place.
--   order_tracking.drop_lat, drop_lng  the order's own drop point (the pin the customer set). Null when the order has none: the app then shows no distance.
-- The delivery time (eta) still falls back to the postal code's point, as before. Safe to run twice.
alter table riders add column if not exists located_at timestamptz;
-- Old places: the newest ping still kept in rider_pings. A rider with a place and no kept ping stays null, and the app shows no place until his next ping (a place with no time is not shown).
update riders r set located_at = p.at from (select user_id, max(at) as at from rider_pings group by user_id) p
 where p.user_id = r.user_id and r.located_at is null and r.lat is not null;

alter table order_tracking add column if not exists rider_at timestamptz, add column if not exists drop_lat double precision, add column if not exists drop_lng double precision;

create or replace function rider_ping(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from riders where user_id = auth.uid()) then
    raise exception 'not_allowed';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location';
  end if;
  update riders set lat = p_lat, lng = p_lng, updated_at = now(), located_at = now() where user_id = auth.uid();
  insert into rider_pings (user_id, lat, lng) values (auth.uid(), p_lat, p_lng);
  perform refresh_order_tracking(id) from orders where rider_id = auth.uid() and status in ('ready', 'out_for_delivery');
end $$;

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
  -- Story 1497: rider_at is the time of the rider's last ping (never now()); drop_lat, drop_lng are the order's own point, with no postal code fallback.
  insert into order_tracking (order_id, session_id, status, rider_lat, rider_lng, rider_at, drop_lat, drop_lng, eta_min, eta_lo_min, eta_hi_min, eta_late, updated_at)
  values (o.id, o.session_id, o.status, case when o.status in ('ready', 'out_for_delivery') then r.lat end, case when o.status in ('ready', 'out_for_delivery') then r.lng end,
          case when o.status in ('ready', 'out_for_delivery') and r.lat is not null then r.located_at end, o.drop_lat, o.drop_lng,
          v_lo_min, v_lo_min, v_hi_min, v_late, now())
  on conflict (order_id) do update set status = excluded.status, rider_lat = excluded.rider_lat, rider_lng = excluded.rider_lng, rider_at = excluded.rider_at,
    drop_lat = excluded.drop_lat, drop_lng = excluded.drop_lng, eta_min = excluded.eta_min,
    eta_lo_min = excluded.eta_lo_min, eta_hi_min = excluded.eta_hi_min, eta_late = excluded.eta_late, updated_at = excluded.updated_at;
end $$;
revoke all on function refresh_order_tracking(uuid) from public, anon, authenticated;

-- Orders on the road now get the new columns at once, not at the rider's next ping.
select refresh_order_tracking(id) from orders where status in ('ready', 'out_for_delivery');
