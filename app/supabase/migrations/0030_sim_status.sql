-- Story H7 (#190, epic E16) and the review of #259. The admin Simulator tab asks the city's state through the webhook (sim_status), and
-- the tick learns three things: kitchens flip at a gentle 2 percent a minute and only 11:00 to 23:00 India time (review Q1), riders
-- flip online or offline at 2 percent a minute so dispatch sees a changing set (review Q2), and the defaults are the admin tab's defaults.

create or replace function sim_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true,
    'enabled', coalesce((select (value->>'enabled')::boolean from params where session_id = 'global' and key = 'sim_enabled' order by version desc limit 1), false),
    'kitchens', (select count(*) from kitchens where synthetic), 'kitchens_open', (select count(*) from kitchens where synthetic and open),
    'riders', (select count(*) from riders where synthetic), 'riders_online', (select count(*) from riders where synthetic and online),
    'dishes', (select count(*) from menu_items where synthetic))
$$;

create or replace function sim_tick(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_min integer := least(greatest(coalesce((p->>'move_min_m')::integer, 100), 0), 2000);
  v_max integer := least(greatest(coalesce((p->>'move_max_m')::integer, 300), 0), 2000);
  v_kpct integer := least(greatest(coalesce((p->>'kitchen_flip_pct')::integer, 2), 0), 100);
  v_dpct integer := least(greatest(coalesce((p->>'dish_flip_pct')::integer, 5), 0), 100);
  v_rpct integer := least(greatest(coalesce((p->>'rider_flip_pct')::integer, 2), 0), 100);
  v_on boolean := coalesce((select (value->>'enabled')::boolean from params where session_id = 'global' and key = 'sim_enabled' order by version desc limit 1), false);
  v_hours boolean := extract(hour from now() at time zone 'Asia/Kolkata') between 11 and 22;   -- kitchens change only 11:00 to 23:00
  v_riders integer; v_kitchens integer := 0; v_dishes integer; v_flipped integer;
begin
  if not v_on then
    return jsonb_build_object('ok', true, 'skipped', 'sim_disabled');
  end if;
  if v_max < v_min then v_max := v_min; end if;
  -- One step per online rider: metres to degrees (111,320 m per degree of latitude; longitude shrinks with the cosine of the latitude).
  -- A random walk drifts about 1.5 km an hour, so a rider more than 1 km from every synthetic kitchen heads back toward the nearest one.
  with step as (
    select r.user_id, v_min + random() * (v_max - v_min) as m,
           case when k.d > 1000 then atan2((k.lng - r.lng) * cos(radians(r.lat)), k.lat - r.lat) + (random() - 0.5) * 0.6
                else random() * 2 * pi() end as a
    from riders r
    left join lateral (select lat, lng, distance_m(r.lat, r.lng, lat, lng) as d from kitchens where synthetic and lat is not null order by d limit 1) k on true
    where r.synthetic and r.online and r.lat is not null and r.lng is not null
  ), moved as (
    update riders r
       set lat = r.lat + (s.m * cos(s.a)) / 111320.0,
           lng = r.lng + (s.m * sin(s.a)) / (111320.0 * cos(radians(r.lat))),
           updated_at = now()
      from step s where r.user_id = s.user_id
    returning 1)
  select count(*) into v_riders from moved;
  if v_hours then
    with flipped as (update kitchens set open = not open where synthetic and random() * 100 < v_kpct returning 1) select count(*) into v_kitchens from flipped;
  end if;
  with flipped as (update menu_items set available = not available where synthetic and random() * 100 < v_dpct returning 1) select count(*) into v_dishes from flipped;
  with flipped as (update riders set online = not online, updated_at = now() where synthetic and random() * 100 < v_rpct returning 1) select count(*) into v_flipped from flipped;
  return jsonb_build_object('ok', true, 'riders_moved', v_riders, 'kitchens_flipped', v_kitchens, 'dishes_flipped', v_dishes, 'riders_flipped', v_flipped);
end $$;

revoke all on function sim_status() from public, anon, authenticated;
grant execute on function sim_status() to service_role;
