-- Story #284 (epic E16). Programmed kitchens and riders behave like real ones. Real people place the orders; the tick (n8n GS MAIN 31, every minute, under the
-- sim_enabled switch) moves them. Kitchen side, for orders of SYNTHETIC kitchens only: placed is accepted after a tick or two, or turned away ("Kitchen busy",
-- "Item sold out"); accepted becomes preparing, then ready after the kitchen's usual prep time (longer for a delayed order). Rider side, for synthetic riders on
-- orders of ANY kitchen (the two manual kitchens included): an assigned rider walks to the kitchen, picks up when it is ready, walks to the pin's drop point and
-- delivers; a rider may drop out before pickup and the order goes back to dispatch. Every step goes through change_status or cancel-style writes that also write
-- order_events, so tracking, the admin and the scorecard see a normal order. Riders are free in Delhi (owner, 25 Oct): one that comes back online lands at a
-- random point in the Delhi box or near a random kitchen, not at its old kitchen, and the 1 km pull back to the nearest kitchen is gone.

insert into params (kitchen_id, session_id, key, value, version)
values (null, 'global', 'sim_knobs', '{"reject_pct":5,"sold_out_pct":3,"delay_pct":10,"rider_drop_pct":2,"prep_scale":1}', 1)
on conflict (session_id, key, version) do nothing;

create or replace function sim_knobs() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from params where session_id = 'global' and key = 'sim_knobs' order by version desc limit 1),
                  '{"reject_pct":5,"sold_out_pct":3,"delay_pct":10,"rider_drop_pct":2,"prep_scale":1}'::jsonb)
$$;

-- The four scenario knobs and the prep speed. Clamped here; a new version each time, the old one stays (rule 17 of the meta-workflows).
create or replace function sim_set_knobs(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := sim_knobs();
  v_new jsonb;
begin
  v_new := jsonb_build_object(
    'reject_pct', least(greatest(coalesce((p->>'reject_pct')::numeric, (v_old->>'reject_pct')::numeric), 0), 100),
    'sold_out_pct', least(greatest(coalesce((p->>'sold_out_pct')::numeric, (v_old->>'sold_out_pct')::numeric), 0), 100),
    'delay_pct', least(greatest(coalesce((p->>'delay_pct')::numeric, (v_old->>'delay_pct')::numeric), 0), 100),
    'rider_drop_pct', least(greatest(coalesce((p->>'rider_drop_pct')::numeric, (v_old->>'rider_drop_pct')::numeric), 0), 100),
    'prep_scale', least(greatest(coalesce((p->>'prep_scale')::numeric, (v_old->>'prep_scale')::numeric), 0.01), 5));
  insert into params (kitchen_id, session_id, key, value, version)
  values (null, 'global', 'sim_knobs', v_new, coalesce((select max(version) from params where session_id = 'global' and key = 'sim_knobs'), 0) + 1);
  return jsonb_build_object('ok', true, 'knobs', v_new);
end $$;

-- A number from 0 to 1 that depends only on the text: the same order always gets the same delay and the same noise.
create or replace function sim_unit(p_text text) returns double precision
language sql immutable as $$ select (('x' || substr(md5(p_text), 1, 7))::bit(28)::int)::double precision / 268435456.0 $$;

-- Walk a rider toward a point by up to p_m metres. Returns the metres still to go (0 when it arrived).
create or replace function sim_walk(p_rider uuid, p_lat double precision, p_lng double precision, p_m double precision) returns double precision
language plpgsql as $$
declare v_lat double precision; v_lng double precision; v_d double precision;
begin
  select lat, lng into v_lat, v_lng from riders where user_id = p_rider;
  if v_lat is null then
    update riders set lat = p_lat, lng = p_lng, updated_at = now() where user_id = p_rider;
    return 0;
  end if;
  v_d := distance_m(v_lat, v_lng, p_lat, p_lng);
  if v_d <= p_m then
    update riders set lat = p_lat, lng = p_lng, updated_at = now() where user_id = p_rider;
    return 0;
  end if;
  update riders set lat = v_lat + (p_lat - v_lat) * p_m / v_d, lng = v_lng + (p_lng - v_lng) * p_m / v_d, updated_at = now() where user_id = p_rider;
  return v_d - p_m;
end $$;

-- The orders half of the tick.
create or replace function sim_orders_tick() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_k jsonb := sim_knobs();
  v_rej double precision := (v_k->>'reject_pct')::double precision;
  v_sold double precision := (v_k->>'sold_out_pct')::double precision;
  v_delay double precision := (v_k->>'delay_pct')::double precision;
  v_drop double precision := (v_k->>'rider_drop_pct')::double precision;
  v_scale double precision := (v_k->>'prep_scale')::double precision;
  v_o record; v_r double precision; v_rider uuid; v_left double precision; v_tlat double precision; v_tlng double precision; v_ready timestamptz; v_acc timestamptz;
  n_acc integer := 0; n_can integer := 0; n_prep integer := 0; n_rdy integer := 0; v_new uuid[] := '{}'; n_asg integer := 0; n_pick integer := 0; n_del integer := 0; n_drop integer := 0;
begin
  -- Kitchen: placed. The kitchen looks at an order in 6 of 10 ticks; when it looks it decides once: busy, sold out, or accept.
  for v_o in select id, session_id, kitchen_id from orders where status = 'placed' and created_at < now() - interval '20 seconds'
           and kitchen_id in (select id from kitchens where synthetic) loop
    continue when random() >= 0.6;
    v_r := random() * 100;
    if v_r < v_rej + v_sold then
      update orders set status = 'cancelled', cancel_reason = case when v_r < v_rej then 'Kitchen busy' else 'Item sold out' end where id = v_o.id;
      insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v_o.id, v_o.kitchen_id, v_o.session_id, 'order.cancelled', 'kitchen');
      n_can := n_can + 1;
    else
      perform change_status(v_o.id, v_o.session_id, 'accepted', 'sim-kitchen');
      n_acc := n_acc + 1;
    end if;
  end loop;
  -- Kitchen: accepted, then preparing.
  for v_o in select id, session_id from orders where status = 'accepted' and kitchen_id in (select id from kitchens where synthetic) loop
    perform change_status(v_o.id, v_o.session_id, 'preparing', 'sim-kitchen');
    n_prep := n_prep + 1;
  end loop;
  -- Kitchen: ready after the usual prep time (noise 0.8 to 1.2; a delayed order takes 2.5 times as long). prep_scale shortens it for tests.
  for v_o in select o.id, o.session_id, o.kitchen_id from orders o where o.status = 'preparing' and o.kitchen_id in (select id from kitchens where synthetic) loop
    select min(e.created_at) into v_acc from order_events e where e.order_id = v_o.id and e.event = 'order.accepted';
    v_ready := coalesce(v_acc, now()) + make_interval(secs => kitchen_prep_seconds(v_o.kitchen_id, extract(hour from coalesce(v_acc, now()) at time zone 'Asia/Kolkata')::integer)
      * v_scale * (0.8 + 0.4 * sim_unit(v_o.id::text || 'noise')) * case when sim_unit(v_o.id::text || 'delay') * 100 < v_delay then 2.5 else 1 end);
    if now() >= v_ready then
      perform change_status(v_o.id, v_o.session_id, 'ready', 'sim-kitchen');
      n_rdy := n_rdy + 1;
    end if;
  end loop;
  -- Rider: may drop out before pickup. The order goes back to dispatch.
  for v_o in select o.id, o.session_id, o.kitchen_id, o.rider_id from orders o join riders r on r.user_id = o.rider_id
           where r.synthetic and o.status in ('accepted', 'preparing', 'ready') and o.created_at > now() - interval '12 hours' loop
    if random() * 100 < v_drop then
      update riders set online = false, updated_at = now() where user_id = v_o.rider_id;
      update orders set rider_id = null where id = v_o.id;
      insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v_o.id, v_o.kitchen_id, v_o.session_id, 'order.unassigned', 'sim-rider');
      n_drop := n_drop + 1;
    end if;
  end loop;
  -- Orders older than 12 hours are left alone (a stale order from another day is not a job). Dispatch: a ready order with no rider takes the first free synthetic rider on the candidate list (the same path SUB 19 uses). Batch mode assigns elsewhere.
  for v_o in select id from orders where status = 'ready' and rider_id is null and created_at > now() - interval '12 hours' loop
    select (c.e ->> 'id')::uuid into v_rider
      from jsonb_array_elements(coalesce(dispatch_candidates(v_o.id) -> 'riders', '[]'::jsonb)) with ordinality as c(e, n)
     where (c.e ->> 'free')::boolean and exists (select 1 from riders r where r.user_id = (c.e ->> 'id')::uuid and r.synthetic)
     order by c.n limit 1;
    if v_rider is not null then
      begin
        perform assign_rider(v_o.id, v_rider);
        v_new := v_new || v_o.id;   -- the rider hears about the job now and starts walking next tick
        n_asg := n_asg + 1;
      exception when others then null;   -- the order moved on; the next tick looks again
      end;
    end if;
    v_rider := null;
  end loop;
  -- Rider: walk to the kitchen, pick up when it is ready and the rider is within 100 m.
  for v_o in select o.id, o.session_id, o.status, o.rider_id, k.lat, k.lng from orders o join riders r on r.user_id = o.rider_id join kitchens k on k.id = o.kitchen_id
           where r.synthetic and r.online and o.status in ('accepted', 'preparing', 'ready') and k.lat is not null and o.created_at > now() - interval '12 hours' and not (o.id = any (v_new)) loop
    v_left := sim_walk(v_o.rider_id, v_o.lat, v_o.lng, 250 + random() * 150);
    if v_o.status = 'ready' and v_left <= 100 then
      perform change_status(v_o.id, v_o.session_id, 'out_for_delivery', 'sim-rider');
      n_pick := n_pick + 1;
    end if;
  end loop;
  -- Rider: walk to the drop point of the order's pin (plus up to 300 m of spread), deliver within 100 m.
  for v_o in select o.id, o.session_id, o.rider_id, coalesce(pp.lat, k.lat + 0.015) as lat, coalesce(pp.lng, k.lng) as lng
             from orders o join riders r on r.user_id = o.rider_id join kitchens k on k.id = o.kitchen_id left join pin_points pp on pp.pin = o.pin_code
            where r.synthetic and o.status = 'out_for_delivery' and o.created_at > now() - interval '12 hours' loop
    v_tlat := v_o.lat + (sim_unit(v_o.id::text || 'a') - 0.5) * 0.006;
    v_tlng := v_o.lng + (sim_unit(v_o.id::text || 'b') - 0.5) * 0.006;
    v_left := sim_walk(v_o.rider_id, v_tlat, v_tlng, 250 + random() * 150);
    if v_left <= 100 then
      perform change_status(v_o.id, v_o.session_id, 'delivered', 'sim-rider');
      n_del := n_del + 1;
    end if;
  end loop;
  return jsonb_build_object('accepted', n_acc, 'cancelled', n_can, 'preparing', n_prep, 'ready', n_rdy, 'assigned', n_asg, 'picked_up', n_pick, 'delivered', n_del, 'dropped', n_drop);
end $$;

-- The tick. Same as 0030 with three changes: riders on a job do not wander or flip; a rider who comes back online lands somewhere new in Delhi (a random point in
-- the box, or near a random kitchen); the pull back to the nearest kitchen only applies to a rider that left the Delhi box. Then the orders half runs.
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
  v_riders integer; v_kitchens integer := 0; v_dishes integer; v_flipped integer := 0; v_back uuid[] := '{}'; v_cur record; v_kid record; v_orders jsonb;
begin
  if not v_on then
    return jsonb_build_object('ok', true, 'skipped', 'sim_disabled');
  end if;
  if v_max < v_min then v_max := v_min; end if;
  with step as (
    select r.user_id, v_min + random() * (v_max - v_min) as m,
           case when (r.lat not between 28.45 and 28.78 or r.lng not between 77.00 and 77.40) and k.d is not null
                then atan2((k.lng - r.lng) * cos(radians(r.lat)), k.lat - r.lat) + (random() - 0.5) * 0.6
                else random() * 2 * pi() end as a
    from riders r
    left join lateral (select lat, lng, distance_m(r.lat, r.lng, lat, lng) as d from kitchens where synthetic and lat is not null order by d limit 1) k on true
    where r.synthetic and r.online and r.lat is not null and r.lng is not null
      and not exists (select 1 from orders o where o.rider_id = r.user_id and o.status in ('accepted', 'preparing', 'ready', 'out_for_delivery'))
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
  -- Offline riders coming back online (the owner's Rapido case): half land at a random point in the Delhi box, half near a random kitchen.
  for v_cur in select user_id from riders where synthetic and not online and random() * 100 < v_rpct loop
    if random() < 0.5 then
      update riders set online = true, lat = 28.50 + random() * 0.22, lng = 77.05 + random() * 0.30, updated_at = now() where user_id = v_cur.user_id;
    else
      select lat, lng into v_kid from kitchens where synthetic and lat is not null order by random() limit 1;
      update riders set online = true, lat = coalesce(v_kid.lat, 28.6) + (random() - 0.5) * 0.01, lng = coalesce(v_kid.lng, 77.2) + (random() - 0.5) * 0.01, updated_at = now() where user_id = v_cur.user_id;
    end if;
    v_back := v_back || v_cur.user_id;
    v_flipped := v_flipped + 1;
  end loop;
  -- Online riders going offline, but never one on a job (a drop is the knob rider_drop_pct) and never one that just came back.
  with flipped as (
    update riders set online = false, updated_at = now()
     where synthetic and online and random() * 100 < v_rpct and not (user_id = any (v_back))
       and not exists (select 1 from orders o where o.rider_id = riders.user_id and o.status in ('accepted', 'preparing', 'ready', 'out_for_delivery'))
    returning 1)
  select v_flipped + count(*) into v_flipped from flipped;
  v_orders := sim_orders_tick();
  return jsonb_build_object('ok', true, 'riders_moved', v_riders, 'kitchens_flipped', v_kitchens, 'dishes_flipped', v_dishes, 'riders_flipped', v_flipped, 'orders', v_orders);
end $$;

create or replace function sim_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true,
    'enabled', coalesce((select (value->>'enabled')::boolean from params where session_id = 'global' and key = 'sim_enabled' order by version desc limit 1), false),
    'kitchens', (select count(*) from kitchens where synthetic), 'kitchens_open', (select count(*) from kitchens where synthetic and open),
    'riders', (select count(*) from riders where synthetic), 'riders_online', (select count(*) from riders where synthetic and online),
    'dishes', (select count(*) from menu_items where synthetic),
    'knobs', sim_knobs())
$$;

revoke all on function sim_knobs() from public, anon, authenticated;
revoke all on function sim_set_knobs(jsonb) from public, anon, authenticated;
revoke all on function sim_unit(text) from public, anon, authenticated;
revoke all on function sim_walk(uuid, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function sim_orders_tick() from public, anon, authenticated;
revoke all on function sim_tick(jsonb) from public, anon, authenticated;
revoke all on function sim_status() from public, anon, authenticated;
grant execute on function sim_knobs() to service_role;
grant execute on function sim_set_knobs(jsonb) to service_role;
grant execute on function sim_unit(text) to service_role;
grant execute on function sim_walk(uuid, double precision, double precision, double precision) to service_role;
grant execute on function sim_orders_tick() to service_role;
grant execute on function sim_tick(jsonb) to service_role;
grant execute on function sim_status() to service_role;
