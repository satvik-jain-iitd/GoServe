-- Story #454 (epic E25). Demo mode: one stored switch, off by default. On, the demo city is steady and fast: no kitchen or dish flips by itself (and the ones already off come back on), no kitchen turns an order away,
-- no item sells out, no kitchen is slow, no rider drops out, prep takes a fifth of the usual time and riders walk twice as fast. Off, the numbers it replaced come back
-- exactly. The switch lives in the sim_knobs row (keys demo and before), so the scheduled tick (GS MAIN 31) reads it without any change in n8n. Found in the M.5 rehearsal
-- (26 Oct): a kitchen switched itself off in the middle of the show, and an order took 24 minutes to reach Delivered.

create or replace function sim_knobs() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from params where session_id = 'global' and key = 'sim_knobs' order by version desc limit 1),
                  '{"reject_pct":5,"sold_out_pct":3,"delay_pct":10,"rider_drop_pct":2,"prep_scale":1}'::jsonb)
$$;

-- The scenario knobs and the prep speed, as in 0036, plus p.demo (true or false). A call without demo keeps the switch and what it saved as they are.
create or replace function sim_set_knobs(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := sim_knobs();
  v_was boolean := coalesce((v_old->>'demo')::boolean, false);
  v_base jsonb := v_old - 'demo' - 'before';
  v_new jsonb;
begin
  if p ? 'demo' then
    if (p->>'demo')::boolean = v_was then
      return jsonb_build_object('ok', true, 'knobs', v_old);
    elsif v_was then   -- off: the numbers it replaced come back
      v_new := coalesce(v_old->'before', '{"reject_pct":5,"sold_out_pct":3,"delay_pct":10,"rider_drop_pct":2,"prep_scale":1}'::jsonb) || '{"demo":false}'::jsonb;
    else               -- on: steady and fast; the old numbers are kept under before
      v_new := jsonb_build_object('reject_pct', 0, 'sold_out_pct', 0, 'delay_pct', 0, 'rider_drop_pct', 0, 'prep_scale', 0.2, 'demo', true, 'before', v_base);
      update kitchens set open = true where synthetic and active and not open;   -- what the city already switched off must not stay off for the whole demo
      update menu_items set available = true where synthetic and not available;
    end if;
  else
    v_new := jsonb_build_object(
      'reject_pct', least(greatest(coalesce((p->>'reject_pct')::numeric, (v_old->>'reject_pct')::numeric), 0), 100),
      'sold_out_pct', least(greatest(coalesce((p->>'sold_out_pct')::numeric, (v_old->>'sold_out_pct')::numeric), 0), 100),
      'delay_pct', least(greatest(coalesce((p->>'delay_pct')::numeric, (v_old->>'delay_pct')::numeric), 0), 100),
      'rider_drop_pct', least(greatest(coalesce((p->>'rider_drop_pct')::numeric, (v_old->>'rider_drop_pct')::numeric), 0), 100),
      'prep_scale', least(greatest(coalesce((p->>'prep_scale')::numeric, (v_old->>'prep_scale')::numeric), 0.01), 5),
      'demo', v_was);
    if v_old ? 'before' then v_new := v_new || jsonb_build_object('before', v_old->'before'); end if;
  end if;
  insert into params (kitchen_id, session_id, key, value, version)
  values (null, 'global', 'sim_knobs', v_new, coalesce((select max(version) from params where session_id = 'global' and key = 'sim_knobs'), 0) + 1);
  return jsonb_build_object('ok', true, 'knobs', v_new);
end $$;

-- The orders half of the tick: as in 0036; in demo mode riders walk twice as fast.
create or replace function sim_orders_tick() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_k jsonb := sim_knobs();
  v_rej double precision := (v_k->>'reject_pct')::double precision;
  v_sold double precision := (v_k->>'sold_out_pct')::double precision;
  v_delay double precision := (v_k->>'delay_pct')::double precision;
  v_drop double precision := (v_k->>'rider_drop_pct')::double precision;
  v_scale double precision := (v_k->>'prep_scale')::double precision;
  v_speed double precision := case when coalesce((v_k->>'demo')::boolean, false) then 2 else 1 end;   -- #454: demo mode walks twice as fast
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
    v_left := sim_walk(v_o.rider_id, v_o.lat, v_o.lng, v_speed * (250 + random() * 150));
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
    v_left := sim_walk(v_o.rider_id, v_tlat, v_tlng, v_speed * (250 + random() * 150));
    if v_left <= 100 then
      perform change_status(v_o.id, v_o.session_id, 'delivered', 'sim-rider');
      n_del := n_del + 1;
    end if;
  end loop;
  return jsonb_build_object('accepted', n_acc, 'cancelled', n_can, 'preparing', n_prep, 'ready', n_rdy, 'assigned', n_asg, 'picked_up', n_pick, 'delivered', n_del, 'dropped', n_drop);
end $$;

-- The tick: as in 0036; in demo mode no kitchen or dish flips, whatever the call asks.
create or replace function sim_tick(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_min integer := least(greatest(coalesce((p->>'move_min_m')::integer, 100), 0), 2000);
  v_max integer := least(greatest(coalesce((p->>'move_max_m')::integer, 300), 0), 2000);
  v_kpct integer := least(greatest(coalesce((p->>'kitchen_flip_pct')::integer, 2), 0), 100);
  v_dpct integer := least(greatest(coalesce((p->>'dish_flip_pct')::integer, 5), 0), 100);
  v_rpct integer := least(greatest(coalesce((p->>'rider_flip_pct')::integer, 2), 0), 100);
  v_demo boolean := coalesce((sim_knobs()->>'demo')::boolean, false);   -- #454: demo mode keeps kitchens and dishes steady, whatever the call asks
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
    with flipped as (update kitchens set open = not open where synthetic and not v_demo and random() * 100 < v_kpct returning 1) select count(*) into v_kitchens from flipped;
  end if;
  with flipped as (update menu_items set available = not available where synthetic and not v_demo and random() * 100 < v_dpct returning 1) select count(*) into v_dishes from flipped;
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

revoke all on function sim_set_knobs(jsonb) from public, anon, authenticated;
revoke all on function sim_orders_tick() from public, anon, authenticated;
revoke all on function sim_tick(jsonb) from public, anon, authenticated;

grant execute on function sim_set_knobs(jsonb) to service_role;
grant execute on function sim_orders_tick() to service_role;
grant execute on function sim_tick(jsonb) to service_role;
