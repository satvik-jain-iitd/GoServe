-- Story H6 (#189, epic E16). The synthetic city moves on its own: every minute n8n GS MAIN 31 calls sim_tick(). While the switch
-- (params global/sim_enabled, latest version) is on, each synthetic online rider walks 100 to 300 m in a random direction and is
-- stamped, a few synthetic kitchens flip open or closed and a few synthetic dishes flip sold out. Real rows are never touched.
-- Both functions are for the service role only (n8n). The admin Simulator tab (H7) reaches them through the gs-sim webhook.

create or replace function sim_enable(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_on boolean := coalesce((p->>'enabled')::boolean, true);
begin
  insert into params (kitchen_id, session_id, key, value, version)
  values (null, 'global', 'sim_enabled', jsonb_build_object('enabled', v_on),
          coalesce((select max(version) from params where session_id = 'global' and key = 'sim_enabled'), 0) + 1);
  return jsonb_build_object('ok', true, 'enabled', v_on);
end $$;

create or replace function sim_tick(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_min integer := least(greatest(coalesce((p->>'move_min_m')::integer, 100), 0), 2000);
  v_max integer := least(greatest(coalesce((p->>'move_max_m')::integer, 300), 0), 2000);
  v_kpct integer := least(greatest(coalesce((p->>'kitchen_flip_pct')::integer, 10), 0), 100);
  v_dpct integer := least(greatest(coalesce((p->>'dish_flip_pct')::integer, 5), 0), 100);
  v_on boolean := coalesce((select (value->>'enabled')::boolean from params where session_id = 'global' and key = 'sim_enabled' order by version desc limit 1), false);
  v_riders integer; v_kitchens integer; v_dishes integer;
begin
  if not v_on then
    return jsonb_build_object('ok', true, 'skipped', 'sim_disabled');
  end if;
  if v_max < v_min then v_max := v_min; end if;
  -- One step per rider: metres to degrees (111,320 m per degree of latitude; longitude shrinks with the cosine of the latitude).
  -- A random walk drifts about 1.5 km an hour, so a rider more than 1 km from every synthetic kitchen heads back toward the nearest one
  -- (with a little wobble); riders stay around the kitchens instead of leaving Delhi.
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
  with flipped as (update kitchens set open = not open where synthetic and random() * 100 < v_kpct returning 1) select count(*) into v_kitchens from flipped;
  with flipped as (update menu_items set available = not available where synthetic and random() * 100 < v_dpct returning 1) select count(*) into v_dishes from flipped;
  return jsonb_build_object('ok', true, 'riders_moved', v_riders, 'kitchens_flipped', v_kitchens, 'dishes_flipped', v_dishes);
end $$;

revoke all on function sim_enable(jsonb) from public, anon, authenticated;
revoke all on function sim_tick(jsonb) from public, anon, authenticated;
grant execute on function sim_enable(jsonb) to service_role;
grant execute on function sim_tick(jsonb) to service_role;
