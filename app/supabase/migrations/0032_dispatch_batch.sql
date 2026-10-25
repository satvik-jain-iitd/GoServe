-- Story #263 layer 2 (epic E22), Stage 1 of docs/research/quick-commerce-dispatch-2026-10.md: ready-time batch dispatch.
-- Every 30 s one function looks at all free riders and all orders whose food is nearly ready, and matches best pair first. It is OFF until the
-- owner turns dispatch_mode to 'batch' (test E9 passes first) and only works while the decision engine is Rules. Real and synthetic never mix.
--   dispatch_match(jsonb)  pure: riders, orders, kitchens, tunables in; assignments and zone states out. E9 replays this exact function.
--   dispatch_tick()        reads the tables, calls dispatch_match, applies the answer, writes zone_state.
--   set_dispatch_mode()    admin only, a new params version per change, like set_decision_engine.

insert into params (kitchen_id, session_id, key, value, version) values
  (null, 'global', 'dispatch_mode', '{"mode":"per_order","by":"system"}', 1),
  (null, 'global', 'dispatch_rules', '{"detour":1.4,"speed_kmh":15,"margin_min":2,"early_free_min":3,"fair_w":0.5,"stack_max":2,"stack_gap_min":5,"stack_added_max_min":5,"stack_drop_min":2,"slow_ratio":2,"close_ratio":3,"slow_eta_min":10,"ping_max_s":90,"horizon_min":10,"zone_reach_min":15,"prep_default_min":15,"prep_min_orders":30,"ready_grace_s":60}', 1)
on conflict (session_id, key, version) do nothing;
-- Hard gate (review of #271): batch mode cannot be turned on until the rider app shows a job that is named early. Flip this to true in the same PR that does it (F173).
insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'dispatch_gates', '{"rider_app_early_job":false}', 1)
on conflict (session_id, key, version) do nothing;

create table if not exists zone_state (
  kitchen_id uuid primary key references kitchens (id) on delete cascade,
  state text not null default 'open' check (state in ('open', 'slow', 'closed')),
  eta_extra_min integer not null default 0,
  waiting integer not null default 0,
  riders integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table zone_state enable row level security;
drop policy if exists zone_read on zone_state;
create policy zone_read on zone_state for select to anon, authenticated using (true);

create or replace function dispatch_batch_on() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value ->> 'mode' from params where session_id = 'global' and key = 'dispatch_mode' order by version desc limit 1), 'per_order') = 'batch'
     and coalesce((select value ->> 'engine' from params where session_id = 'global' and key = 'decision_engine' order by version desc limit 1), 'rules') = 'rules'
$$;

create or replace function set_dispatch_mode(p_mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now text; v_by text;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  if p_mode is null or p_mode not in ('per_order', 'batch') then raise exception 'invalid_mode'; end if;
  if p_mode = 'batch' and not coalesce((select (value ->> 'rider_app_early_job')::boolean from params where session_id = 'global' and key = 'dispatch_gates' order by version desc limit 1), false) then
    raise exception 'gate_rider_app';   -- a rider named early must see the job (F173)
  end if;
  select value ->> 'mode' into v_now from params where session_id = 'global' and key = 'dispatch_mode' order by version desc limit 1;
  if v_now is distinct from p_mode then
    select coalesce(email, id::text) into v_by from auth.users where id = auth.uid();
    insert into params (kitchen_id, session_id, key, value, version)
    values (null, 'global', 'dispatch_mode', jsonb_build_object('mode', p_mode, 'by', coalesce(v_by, 'admin')),
            coalesce((select max(version) from params where session_id = 'global' and key = 'dispatch_mode'), 0) + 1);
  end if;
  return jsonb_build_object('ok', true, 'mode', p_mode, 'batch_on', dispatch_batch_on());
end $$;

-- Median of our own accepted-to-ready stamps for a kitchen: that hour of day first, then the whole kitchen, then a fixed default until there are enough orders.
create or replace function kitchen_prep_seconds(p_kitchen uuid, p_hour integer, p_rules jsonb default '{}'::jsonb)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare v_def double precision := coalesce((p_rules ->> 'prep_default_min')::double precision, 15) * 60;
        v_min integer := coalesce((p_rules ->> 'prep_min_orders')::integer, 30);
        v_n integer; v_med double precision;
begin
  select count(*), percentile_cont(0.5) within group (order by q.secs) into v_n, v_med from (
    select extract(epoch from (r.created_at - a.created_at)) as secs
    from order_events a join order_events r on r.order_id = a.order_id and r.event = 'order.ready'
    where a.kitchen_id = p_kitchen and a.event = 'order.accepted' and r.created_at > a.created_at and a.created_at > now() - interval '14 days'
      and extract(hour from a.created_at at time zone 'Asia/Kolkata') = p_hour) q;
  if v_n >= v_min then return v_med; end if;
  select count(*), percentile_cont(0.5) within group (order by q.secs) into v_n, v_med from (
    select extract(epoch from (r.created_at - a.created_at)) as secs
    from order_events a join order_events r on r.order_id = a.order_id and r.event = 'order.ready'
    where a.kitchen_id = p_kitchen and a.event = 'order.accepted' and r.created_at > a.created_at and a.created_at > now() - interval '14 days') q;
  if v_n >= v_min then return v_med; end if;
  return v_def;
end $$;

-- When will the food be ready, in epoch seconds. A ready order: its ready stamp. Otherwise accepted time + the kitchen's median prep; if that moment has passed and
-- the food is still not ready, one grace minute from now (the rider is needed soon, not at a time in the past).
create or replace function order_ready_at(o orders, p_now timestamptz, p_rules jsonb default '{}'::jsonb)
returns double precision language sql stable security definer set search_path = public as $$
  select case when o.status = 'ready'
    then extract(epoch from coalesce((select max(e.created_at) from order_events e where e.order_id = o.id and e.event = 'order.ready'), o.updated_at))
    else greatest(
      extract(epoch from a.at) + kitchen_prep_seconds(o.kitchen_id, extract(hour from a.at at time zone 'Asia/Kolkata')::integer, p_rules),
      extract(epoch from p_now) + coalesce((p_rules ->> 'ready_grace_s')::double precision, 60)) end
  from (select coalesce((select min(e.created_at) from order_events e where e.order_id = o.id and e.event = 'order.accepted'), o.updated_at) as at) a
$$;

-- The matcher. Seconds are epoch seconds. Input: {now, params, riders:[{id,lat,lng,ping_age_s,trips,load:[{order_id,kitchen_id,ready_at}]}],
-- orders:[{id,kitchen_id,ready_at}], kitchens:[{id,lat,lng}]}. `load` = orders the rider already waits for and has not picked up.
-- 1 Pairs: a free rider with a fresh ping and an order whose send time has come (now >= ready - travel - margin). Travel = straight line x detour at speed.
-- 2 Cost = travel minutes + (arriving more than early_free_min before the food is ready) + fair_w x trips today. Best pair first; each rider and order once.
-- 3 Stacking: one more order of the SAME kitchen for a rider who has one (matched now or waiting), if the ready times are within stack_gap_min and the first
--   customer waits under stack_added_max_min more (ready gap + stack_drop_min for the extra stop; customer places are not known yet).
-- 4 Zones: per kitchen, orders due within horizon_min / free riders within zone_reach_min. Over slow_ratio: slow (ETA +slow_eta_min). Over close_ratio, or none: closed.
create or replace function dispatch_match(p jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_now double precision := (p ->> 'now')::double precision;
  v_pr jsonb := coalesce(p -> 'params', '{}'::jsonb);
  v_detour double precision := coalesce((v_pr ->> 'detour')::double precision, 1.4);
  v_speed double precision := coalesce((v_pr ->> 'speed_kmh')::double precision, 15) / 3.6;
  v_margin double precision := coalesce((v_pr ->> 'margin_min')::double precision, 2) * 60;
  v_early double precision := coalesce((v_pr ->> 'early_free_min')::double precision, 3);
  v_fair double precision := coalesce((v_pr ->> 'fair_w')::double precision, 0.5);
  v_stack_max integer := coalesce((v_pr ->> 'stack_max')::integer, 2);
  v_gap double precision := coalesce((v_pr ->> 'stack_gap_min')::double precision, 5) * 60;
  v_added_max double precision := coalesce((v_pr ->> 'stack_added_max_min')::double precision, 5) * 60;
  v_drop double precision := coalesce((v_pr ->> 'stack_drop_min')::double precision, 2) * 60;
  v_slow double precision := coalesce((v_pr ->> 'slow_ratio')::double precision, 2);
  v_close double precision := coalesce((v_pr ->> 'close_ratio')::double precision, 3);
  v_slow_eta integer := coalesce((v_pr ->> 'slow_eta_min')::integer, 10);
  v_ping double precision := coalesce((v_pr ->> 'ping_max_s')::double precision, 90);
  v_horizon double precision := coalesce((v_pr ->> 'horizon_min')::double precision, 10) * 60;
  v_reach double precision := coalesce((v_pr ->> 'zone_reach_min')::double precision, 15) * 60;
  v_used_r text[] := '{}'; v_used_o text[] := '{}';
  v_out jsonb := '[]'::jsonb; v_zones jsonb := '[]'::jsonb;
  pr record; h record; c record; z record;
  v_ratio double precision; v_state text;
begin
  for pr in
    with r as (select * from jsonb_to_recordset(coalesce(p -> 'riders', '[]'::jsonb)) as x(id text, lat double precision, lng double precision, ping_age_s double precision, trips integer, load jsonb)),
         o as (select * from jsonb_to_recordset(coalesce(p -> 'orders', '[]'::jsonb)) as x(id text, kitchen_id text, ready_at double precision)),
         k as (select * from jsonb_to_recordset(coalesce(p -> 'kitchens', '[]'::jsonb)) as x(id text, lat double precision, lng double precision)),
         pairs as (
           select r.id as rid, o.id as oid, o.kitchen_id as kid, o.ready_at as ready_at, coalesce(r.trips, 0) as trips,
                  distance_m(r.lat, r.lng, k.lat, k.lng) * v_detour / v_speed as travel_s
           from r cross join o join k on k.id = o.kitchen_id
           where coalesce(jsonb_array_length(coalesce(r.load, '[]'::jsonb)), 0) = 0 and coalesce(r.ping_age_s, 0) <= v_ping and r.lat is not null and r.lng is not null)
    select pairs.*, pairs.travel_s / 60.0 + greatest(0, (pairs.ready_at - (v_now + pairs.travel_s)) / 60.0 - v_early) + v_fair * pairs.trips as cost
    from pairs where v_now >= pairs.ready_at - pairs.travel_s - v_margin
    order by cost, rid, oid
  loop
    if pr.rid = any (v_used_r) or pr.oid = any (v_used_o) then continue; end if;
    v_used_r := v_used_r || pr.rid; v_used_o := v_used_o || pr.oid;
    v_out := v_out || jsonb_build_object('order_id', pr.oid, 'rider_id', pr.rid, 'kitchen_id', pr.kid, 'ready_at', pr.ready_at, 'travel_s', round(pr.travel_s), 'stacked', false);
  end loop;

  if v_stack_max >= 2 then
    for h in
      select x.rid, x.kid, x.ready_at from (
        select a ->> 'rider_id' as rid, a ->> 'kitchen_id' as kid, (a ->> 'ready_at')::double precision as ready_at from jsonb_array_elements(v_out) a
        union all
        select r.id, r.load -> 0 ->> 'kitchen_id', (r.load -> 0 ->> 'ready_at')::double precision
        from jsonb_to_recordset(coalesce(p -> 'riders', '[]'::jsonb)) as r(id text, ping_age_s double precision, load jsonb)
        where jsonb_array_length(coalesce(r.load, '[]'::jsonb)) = 1 and coalesce(r.ping_age_s, 0) <= v_ping) x
      order by x.rid
    loop
      select o.id, o.kitchen_id, o.ready_at into c
      from jsonb_to_recordset(coalesce(p -> 'orders', '[]'::jsonb)) as o(id text, kitchen_id text, ready_at double precision)
      where o.kitchen_id = h.kid and not (o.id = any (v_used_o))
        and abs(o.ready_at - h.ready_at) <= v_gap and greatest(0, o.ready_at - h.ready_at) + v_drop <= v_added_max
      order by abs(o.ready_at - h.ready_at), o.id limit 1;
      if c.id is not null then
        v_used_o := v_used_o || c.id;
        v_out := v_out || jsonb_build_object('order_id', c.id, 'rider_id', h.rid, 'kitchen_id', c.kitchen_id, 'ready_at', c.ready_at, 'travel_s', 0, 'stacked', true);
      end if;
      c := null;
    end loop;
  end if;

  for z in
    select k.id as kid,
           (select count(*) from jsonb_to_recordset(coalesce(p -> 'orders', '[]'::jsonb)) as o(id text, kitchen_id text, ready_at double precision)
             where o.kitchen_id = k.id and o.ready_at <= v_now + v_horizon) as waiting,
           (select count(*) from jsonb_to_recordset(coalesce(p -> 'riders', '[]'::jsonb)) as r(id text, lat double precision, lng double precision, ping_age_s double precision, load jsonb)
             where coalesce(jsonb_array_length(coalesce(r.load, '[]'::jsonb)), 0) = 0 and coalesce(r.ping_age_s, 0) <= v_ping and r.lat is not null
               and distance_m(r.lat, r.lng, k.lat, k.lng) * v_detour / v_speed <= v_reach) as riders
    from jsonb_to_recordset(coalesce(p -> 'kitchens', '[]'::jsonb)) as k(id text, lat double precision, lng double precision)
    order by k.id
  loop
    v_ratio := case when z.waiting = 0 then 0 when z.riders = 0 then 999 else z.waiting::double precision / z.riders end;
    v_state := case when v_ratio > v_close then 'closed' when v_ratio > v_slow then 'slow' else 'open' end;
    v_zones := v_zones || jsonb_build_object('kitchen_id', z.kid, 'waiting', z.waiting, 'riders', z.riders, 'ratio', round(v_ratio::numeric, 2),
                                             'state', v_state, 'eta_extra_min', case when v_state = 'open' then 0 else v_slow_eta end);
  end loop;
  return jsonb_build_object('assignments', v_out, 'zones', v_zones);
end $$;

-- Rider and kitchen of one kind only (0028 rule kept), and an early assignment: the rider may be named while the food is still being made.
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
                 where r.user_id = p_rider and r.online and r.synthetic = k.synthetic) then
    raise exception 'rider_not_available';
  end if;
  update orders set rider_id = p_rider where id = v_order.id returning * into v_order;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.assigned', 'dispatch');
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

-- In batch mode the per-order path stands down: SUB 22 sees the flag and ends its run without an error.
create or replace function dispatch_candidates(p_order uuid) returns jsonb
language plpgsql stable as $$
declare
  v_order orders;
  v_kitchen kitchens;
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if dispatch_batch_on() then
    return jsonb_build_object('riders', '[]'::jsonb, 'batch', true);
  end if;
  select * into v_kitchen from kitchens where id = v_order.kitchen_id;
  return jsonb_build_object('riders', coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'free', c.free, 'distance_m', c.distance_m, 'trips_done', c.trips_done) order by c.distance_m, c.trips_done)
    from (
      select r.user_id::text as id,
             not exists (select 1 from orders o where o.rider_id = r.user_id and o.status in ('ready', 'out_for_delivery')) as free,
             case when r.lat is null or v_kitchen.lat is null then 0 else round(distance_m(v_kitchen.lat, v_kitchen.lng, r.lat, r.lng))::integer end as distance_m,
             (select count(*) from orders o where o.rider_id = r.user_id and o.status in ('out_for_delivery', 'delivered')
                and (o.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)::integer as trips_done
      from riders r where r.online and r.synthetic = v_kitchen.synthetic
      order by 3, 4
      limit 10
    ) c), '[]'::jsonb));
end $$;

-- One tick: real and synthetic are two separate rounds, so a synthetic rider never takes a real order and the other way round.
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
  foreach v_syn in array array[false, true] loop
    v_in := jsonb_build_object('now', v_now, 'params', v_rules,
      'kitchens', coalesce((select jsonb_agg(jsonb_build_object('id', k.id::text, 'lat', k.lat, 'lng', k.lng)) from kitchens k where k.synthetic = v_syn and k.active and k.lat is not null), '[]'::jsonb),
      'riders', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.user_id::text, 'lat', r.lat, 'lng', r.lng, 'ping_age_s', extract(epoch from p_now - r.updated_at),
          'trips', (select count(*) from orders t where t.rider_id = r.user_id and t.status in ('out_for_delivery', 'delivered')
                     and (t.created_at at time zone 'Asia/Kolkata')::date = (p_now at time zone 'Asia/Kolkata')::date),
          'load', coalesce((select jsonb_agg(jsonb_build_object('order_id', l.id::text, 'kitchen_id', l.kitchen_id::text, 'ready_at', order_ready_at(l, p_now, v_rules)))
                             from orders l where l.rider_id = r.user_id and l.status in ('accepted', 'preparing', 'ready')), '[]'::jsonb)))
        from riders r
        where r.synthetic = v_syn and r.online and r.lat is not null
          and not exists (select 1 from orders b where b.rider_id = r.user_id and b.status = 'out_for_delivery')), '[]'::jsonb),
      'orders', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id::text, 'kitchen_id', o.kitchen_id::text, 'ready_at', order_ready_at(o, p_now, v_rules)))
        from orders o join kitchens k on k.id = o.kitchen_id
        where k.synthetic = v_syn and o.rider_id is null and o.status in ('accepted', 'preparing', 'ready')), '[]'::jsonb));
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

-- A closed zone takes no new order (batch mode only). The message reaches the customer through n8n's shape node as a plain 409.
create or replace function orders_zone_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if dispatch_batch_on() and exists (select 1 from zone_state z where z.kitchen_id = new.kitchen_id and z.state = 'closed') then
    raise exception 'zone_closed';
  end if;
  return new;
end $$;
drop trigger if exists orders_zone_guard on orders;
create trigger orders_zone_guard before insert on orders for each row execute function orders_zone_guard();

revoke all on function dispatch_batch_on() from public, anon, authenticated;
revoke all on function set_dispatch_mode(text) from public, anon;
revoke all on function kitchen_prep_seconds(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function order_ready_at(orders, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function dispatch_match(jsonb) from public, anon, authenticated;
revoke all on function dispatch_tick(timestamptz) from public, anon, authenticated;
grant execute on function dispatch_batch_on() to service_role;
grant execute on function set_dispatch_mode(text) to authenticated;
grant execute on function kitchen_prep_seconds(uuid, integer, jsonb) to service_role;
grant execute on function order_ready_at(orders, timestamptz, jsonb) to service_role;
grant execute on function dispatch_match(jsonb) to service_role;
grant execute on function dispatch_tick(timestamptz) to service_role;
revoke execute on function dispatch_candidates(uuid) from public, anon, authenticated;
revoke execute on function assign_rider(uuid, uuid) from public, anon, authenticated;
grant execute on function dispatch_candidates(uuid) to service_role;
grant execute on function assign_rider(uuid, uuid) to service_role;
