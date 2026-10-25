-- Story #283 (epic E16). Everything is demo until the first real kitchen signs (ADR-022). While the global param `sim_riders_serve_all` is on
-- (default), a synthetic rider may take an order of ANY kitchen, the two manual kitchens included, and a real rider may take a synthetic one.
-- Off brings back the rule of 0028: real and synthetic never mix. The one rule lives in sim_rider_ok(); dispatch_candidates (0033),
-- assign_rider and dispatch_tick (0032) call it and are otherwise the same bodies.

insert into params (kitchen_id, session_id, key, value, version)
values (null, 'global', 'sim_riders_serve_all', '{"on":true}', 1)
on conflict (session_id, key, version) do nothing;

create or replace function sim_riders_serve_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> 'on')::boolean from params where session_id = 'global' and key = 'sim_riders_serve_all' order by version desc limit 1), true)
$$;

create or replace function sim_rider_ok(p_rider_synthetic boolean, p_kitchen_synthetic boolean) returns boolean
language sql stable as $$
  select sim_riders_serve_all() or p_rider_synthetic = p_kitchen_synthetic
$$;

create or replace function set_sim_riders_serve_all(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not_admin';
  end if;
  insert into params (kitchen_id, session_id, key, value, version)
  values (null, 'global', 'sim_riders_serve_all', jsonb_build_object('on', p_on),
          coalesce((select max(version) from params where session_id = 'global' and key = 'sim_riders_serve_all'), 0) + 1);
  return jsonb_build_object('on', p_on);
end $$;

create or replace function dispatch_candidates(p_order uuid) returns jsonb
language plpgsql stable as $$
declare
  v_order orders;
  v_kitchen kitchens;
  v_rules jsonb := coalesce((select value from params where session_id = 'global' and key = 'per_order_rules' order by version desc limit 1), '{}'::jsonb);
  v_band double precision := coalesce((v_rules ->> 'near_band_m')::double precision, 500);
  v_fresh double precision := coalesce((v_rules ->> 'fresh_ping_s')::double precision, 90);
  v_pick text := coalesce(v_rules ->> 'pick', 'fewest_trips');
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if dispatch_batch_on() then
    return jsonb_build_object('riders', '[]'::jsonb, 'batch', true);
  end if;
  select * into v_kitchen from kitchens where id = v_order.kitchen_id;
  if v_pick <> 'nearest_band' then
    return jsonb_build_object('riders', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'free', c.free, 'distance_m', c.distance_m, 'trips_done', c.trips_done) order by c.distance_m, c.trips_done)
      from (
        select r.user_id::text as id,
               not exists (select 1 from orders o where o.rider_id = r.user_id and o.status in ('ready', 'out_for_delivery')) as free,
               case when r.lat is null or v_kitchen.lat is null then 0 else round(distance_m(v_kitchen.lat, v_kitchen.lng, r.lat, r.lng))::integer end as distance_m,
               (select count(*) from orders o where o.rider_id = r.user_id and o.status in ('out_for_delivery', 'delivered')
                  and (o.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)::integer as trips_done
        from riders r where r.online and sim_rider_ok(r.synthetic, v_kitchen.synthetic)
        order by 3, 4
        limit 10
      ) c), '[]'::jsonb));
  end if;
  return jsonb_build_object('riders', coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'free', c.free, 'distance_m', c.distance_m, 'trips_done', c.trips_done, 'rank', c.rank) order by c.rank)
    from (
      select u.*, row_number() over (
               order by (not u.free), (not u.usable), case when u.in_band then 0 else 1 end,
                        case when u.in_band or not u.usable then u.trips_done end, u.distance_m, u.id) as rank
      from (
        select b.*, (b.usable and b.free and b.distance_m <= min(b.distance_m) filter (where b.usable and b.free) over () + case when b.fresh_any then v_band else 0 end) as in_band
        from (
          select r.user_id::text as id,
                 not exists (select 1 from orders o where o.rider_id = r.user_id and o.status in ('ready', 'out_for_delivery')) as free,
                 case when r.lat is null or v_kitchen.lat is null then 999999 else round(distance_m(v_kitchen.lat, v_kitchen.lng, r.lat, r.lng))::integer end as distance_m,
                 (select count(*) from orders o where o.rider_id = r.user_id and o.status in ('out_for_delivery', 'delivered')
                    and (o.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)::integer as trips_done,
                 (r.lat is not null and v_kitchen.lat is not null and (extract(epoch from now() - r.updated_at) <= v_fresh or not bool_or(r.lat is not null and extract(epoch from now() - r.updated_at) <= v_fresh) over ())) as usable,
                 coalesce(bool_or(r.lat is not null and extract(epoch from now() - r.updated_at) <= v_fresh) over (), false) as fresh_any
          from riders r where r.online and sim_rider_ok(r.synthetic, v_kitchen.synthetic)
        ) b
      ) u
      order by rank
      limit 10
    ) c), '[]'::jsonb));
end $$;

create or replace function assign_rider(p_order uuid, p_rider uuid) returns jsonb
language plpgsql as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order for update;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if v_order.rider_id = p_rider then
    return jsonb_build_object('order', to_jsonb(v_order));
  end if;
  -- before Ready a rider may be named only in batch mode (review of #271); per-order mode still needs Ready
  if not (v_order.status = 'ready' or (v_order.status in ('accepted', 'preparing') and dispatch_batch_on())) or v_order.rider_id is not null then
    raise exception 'not_ready';
  end if;
  if not exists (select 1 from riders r join kitchens k on k.id = v_order.kitchen_id
                 where r.user_id = p_rider and r.online and sim_rider_ok(r.synthetic, k.synthetic)) then
    raise exception 'rider_not_available';
  end if;
  update orders set rider_id = p_rider where id = v_order.id returning * into v_order;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.assigned', 'dispatch');
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

create or replace function dispatch_tick(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rules jsonb := coalesce((select value from params where session_id = 'global' and key = 'dispatch_rules' order by version desc limit 1), '{}'::jsonb);
  v_now double precision := extract(epoch from p_now);
  v_syn boolean; v_in jsonb; v_res jsonb; a jsonb; z jsonb;
  v_assigned integer := 0; v_stacked integer := 0; v_failed integer := 0; v_slow integer := 0; v_closed integer := 0;
begin
  if not dispatch_batch_on() then
    return jsonb_build_object('ok', true, 'skipped', 'not_batch');
  end if;
  foreach v_syn in array case when sim_riders_serve_all() then array[null::boolean] else array[false, true] end loop
    v_in := jsonb_build_object('now', v_now, 'params', v_rules,
      'kitchens', coalesce((select jsonb_agg(jsonb_build_object('id', k.id::text, 'lat', k.lat, 'lng', k.lng)) from kitchens k where (v_syn is null or k.synthetic = v_syn) and k.active and k.lat is not null), '[]'::jsonb),
      'riders', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.user_id::text, 'lat', r.lat, 'lng', r.lng, 'ping_age_s', extract(epoch from p_now - r.updated_at),
          'trips', (select count(*) from orders t where t.rider_id = r.user_id and t.status in ('out_for_delivery', 'delivered')
                     and (t.created_at at time zone 'Asia/Kolkata')::date = (p_now at time zone 'Asia/Kolkata')::date),
          'load', coalesce((select jsonb_agg(jsonb_build_object('order_id', l.id::text, 'kitchen_id', l.kitchen_id::text, 'ready_at', order_ready_at(l, p_now, v_rules)))
                             from orders l where l.rider_id = r.user_id and l.status in ('accepted', 'preparing', 'ready')), '[]'::jsonb)))
        from riders r
        where (v_syn is null or r.synthetic = v_syn) and r.online and r.lat is not null
          and not exists (select 1 from orders b where b.rider_id = r.user_id and b.status = 'out_for_delivery')), '[]'::jsonb),
      'orders', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id::text, 'kitchen_id', o.kitchen_id::text, 'ready_at', order_ready_at(o, p_now, v_rules)))
        from orders o join kitchens k on k.id = o.kitchen_id
        where (v_syn is null or k.synthetic = v_syn) and o.rider_id is null and o.status in ('accepted', 'preparing', 'ready')), '[]'::jsonb));
    v_res := dispatch_match(v_in);
    for a in select * from jsonb_array_elements(v_res -> 'assignments') loop
      begin
        perform assign_rider((a ->> 'order_id')::uuid, (a ->> 'rider_id')::uuid);
        v_assigned := v_assigned + 1;
        if (a ->> 'stacked')::boolean then v_stacked := v_stacked + 1; end if;
      exception when others then
        v_failed := v_failed + 1;   -- the order moved on between the read and the write; the next tick looks again
      end;
    end loop;
    for z in select * from jsonb_array_elements(v_res -> 'zones') loop
      insert into zone_state (kitchen_id, state, eta_extra_min, waiting, riders, updated_at)
      values ((z ->> 'kitchen_id')::uuid, z ->> 'state', (z ->> 'eta_extra_min')::integer, (z ->> 'waiting')::integer, (z ->> 'riders')::integer, now())
      on conflict (kitchen_id) do update set state = excluded.state, eta_extra_min = excluded.eta_extra_min, waiting = excluded.waiting, riders = excluded.riders, updated_at = now();
      if z ->> 'state' = 'slow' then v_slow := v_slow + 1; elsif z ->> 'state' = 'closed' then v_closed := v_closed + 1; end if;
    end loop;
  end loop;
  return jsonb_build_object('ok', true, 'assigned', v_assigned, 'stacked', v_stacked, 'failed', v_failed, 'zones_slow', v_slow, 'zones_closed', v_closed);
end $$;

revoke all on function sim_riders_serve_all() from public, anon, authenticated;
revoke all on function sim_rider_ok(boolean, boolean) from public, anon, authenticated;
revoke execute on function set_sim_riders_serve_all(boolean) from public, anon;
revoke all on function dispatch_tick(timestamptz) from public, anon, authenticated;
revoke execute on function dispatch_candidates(uuid) from public, anon, authenticated;
revoke execute on function assign_rider(uuid, uuid) from public, anon, authenticated;
grant execute on function sim_riders_serve_all() to service_role;
grant execute on function sim_rider_ok(boolean, boolean) to service_role;
grant execute on function set_sim_riders_serve_all(boolean) to authenticated;
grant execute on function dispatch_tick(timestamptz) to service_role;
grant execute on function dispatch_candidates(uuid) to service_role;
grant execute on function assign_rider(uuid, uuid) to service_role;
