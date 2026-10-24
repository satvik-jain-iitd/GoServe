-- Story H14 (#204, epic E20). The numbers the owner reads against the pilot breakpoints (docs/product/pilot-breakpoints.md):
-- a ping history for riders, the phone platform of an order, the customer's Call tap, a refused delivery, the breakpoints as a versioned param,
-- one function that returns the day's numbers, and the watch that lists orders over the lines.

-- Rider location history. Only the functions below read or write it; the rider's own row keeps the last place, as before.
create table rider_pings (
  user_id uuid not null, at timestamptz not null default now(), lat double precision not null, lng double precision not null
);
create index rider_pings_user_at on rider_pings (user_id, at);
alter table rider_pings enable row level security;   -- no policy: nobody reads it directly

create function rider_ping(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from riders where user_id = auth.uid()) then
    raise exception 'not_allowed';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location';
  end if;
  update riders set lat = p_lat, lng = p_lng, updated_at = now() where user_id = auth.uid();
  insert into rider_pings (user_id, lat, lng) values (auth.uid(), p_lat, p_lng);
end $$;
revoke execute on function rider_ping(double precision, double precision) from public, anon;
grant execute on function rider_ping(double precision, double precision) to authenticated;

-- The phone platform of an order, set once by the customer's app after place.
alter table orders add column client_platform text check (client_platform in ('ios', 'android', 'other'));
create function order_platform(p_order uuid, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_platform is null or p_platform not in ('ios', 'android', 'other') then
    raise exception 'invalid_platform';
  end if;
  update orders set client_platform = p_platform where id = p_order and session_id = auth.uid()::text and client_platform is null;
  if not found and not exists (select 1 from orders where id = p_order and session_id = auth.uid()::text) then
    raise exception 'order_not_found';
  end if;
end $$;
revoke execute on function order_platform(uuid, text) from public, anon;
grant execute on function order_platform(uuid, text) to authenticated;

-- "Where is my food": the customer's Call tap on a live order is one event.
create function customer_call(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v orders;
begin
  select * into v from orders where id = p_order and session_id = auth.uid()::text and status not in ('delivered', 'cancelled');
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'customer.call', 'customer');
end $$;
revoke execute on function customer_call(uuid) from public, anon;
grant execute on function customer_call(uuid) to authenticated;

-- Refused at the door: the assigned rider ends an order that is on the way. The status rule now allows out_for_delivery to cancelled.
create or replace function orders_check_status() returns trigger language plpgsql as $$
declare
  steps text[] := array['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
begin
  if new.status <> old.status then
    if new.status = 'cancelled' then
      if old.status not in ('placed', 'accepted', 'out_for_delivery') then
        raise exception 'illegal status step: % to cancelled', old.status;
      end if;
    elsif old.status = 'cancelled' or array_position(steps, new.status) is distinct from array_position(steps, old.status) + 1 then
      raise exception 'illegal status step: % to %', old.status, new.status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create function rider_refused(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v orders;
begin
  select * into v from orders where id = p_order and rider_id = auth.uid() and status = 'out_for_delivery' for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  update orders set status = 'cancelled', cancel_reason = 'refused_at_door' where id = v.id;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'order.cancelled', 'rider');
end $$;
revoke execute on function rider_refused(uuid) from public, anon;
grant execute on function rider_refused(uuid) to authenticated;

-- The breakpoints, one global versioned row (rule 17: a change is a new version, the old one stays for a one-step rollback).
alter table params alter column kitchen_id drop not null;
insert into params (kitchen_id, session_id, key, value, version) values
  (null, 'global', 'pilot_breakpoints', '{"orders_day":30,"tickets_hour":10,"missed_day":1,"deliveries_rider_hour":4,"radius_km":3.5,"pins":4,"on_time_pct":80,"gap_min":5,"gap_share":0.2,"cash_rider":8000,"refused_pct":8,"ios_share":0.33,"lost_week":2,"calls_share":0.2,"realtime":200}', 1);

-- The day's numbers in one row. Unmeasured numbers (radius needs maps, lost sessions and realtime connections have no source yet) are null.
create function pilot_numbers(p_since timestamptz, p_until timestamptz, p_kitchen uuid default null, p_accept_min integer default 3, p_promise_min integer default 35, p_gap_min integer default 5)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_bp jsonb;
  v_n jsonb;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'not_allowed';
  end if;
  select value into v_bp from params where session_id = 'global' and key = 'pilot_breakpoints' order by version desc limit 1;
  with o as (
    select * from orders where created_at >= p_since and created_at < p_until and (p_kitchen is null or kitchen_id = p_kitchen)
  ), ev as (
    select e.order_id,
           min(e.created_at) filter (where e.event = 'order.accepted') as accepted_at,
           min(e.created_at) filter (where e.event = 'order.picked_up') as picked_at,
           min(e.created_at) filter (where e.event = 'order.delivered') as delivered_at,
           bool_or(e.event = 'customer.call') as called
      from order_events e where e.order_id in (select id from o) group by e.order_id
  ), j as (
    select o.*, ev.accepted_at, ev.picked_at, ev.delivered_at, coalesce(ev.called, false) as called from o left join ev on ev.order_id = o.id
  ), per_hour as (select max(c) as m from (select count(*) c from j group by date_trunc('hour', created_at at time zone 'Asia/Kolkata')) x),
  per_rider_hour as (select max(c) as m from (select count(*) c from j where delivered_at is not null and rider_id is not null group by rider_id, date_trunc('hour', delivered_at at time zone 'Asia/Kolkata')) x),
  per_rider_cash as (select max(s) as m from (select sum(total_paise) s from j where delivered_at is not null and rider_id is not null and coalesce(paid_by, 'cash') = 'cash' group by rider_id) x),
  gaps as (
    select j.id,
           coalesce((select max(g) from (select extract(epoch from (t - lag(t) over (order by t))) / 60 as g
                       from (select j.picked_at as t union all select at from rider_pings where user_id = j.rider_id and at >= j.picked_at and at <= j.delivered_at union all select j.delivered_at) s) x), 0) > p_gap_min as has_gap
      from j where j.delivered_at is not null and j.picked_at is not null and j.rider_id is not null
  )
  select jsonb_build_object(
    'orders_day', (select count(*) from j),
    'tickets_hour', coalesce((select m from per_hour), 0),
    'missed_day', (select count(*) from j where (j.status <> 'cancelled' or j.accepted_at is not null)
                     and coalesce(j.accepted_at, least(now(), p_until)) - j.created_at > make_interval(mins => p_accept_min)),
    'deliveries_rider_hour', coalesce((select m from per_rider_hour), 0),
    'radius_km', null,
    'pins', (select count(distinct p) from kitchens k, unnest(k.pin_codes) p where k.active and (p_kitchen is null or k.id = p_kitchen)),
    'on_time_pct', (select round(100.0 * count(*) filter (where delivered_at - created_at <= make_interval(mins => p_promise_min)) / nullif(count(*), 0), 1) from j where delivered_at is not null),
    'gap_share', (select round(count(*) filter (where has_gap)::numeric / nullif(count(*), 0), 2) from gaps),
    'cash_rider', (select m / 100.0 from per_rider_cash),
    'refused_pct', (select round(100.0 * count(*) filter (where cancel_reason = 'refused_at_door') / nullif(count(*) filter (where cancel_reason = 'refused_at_door' or delivered_at is not null), 0), 1) from j),
    'ios_share', (select round(count(*) filter (where client_platform = 'ios')::numeric / nullif(count(*) filter (where client_platform is not null), 0), 2) from j),
    'lost_week', null,
    'calls_share', (select round(count(*) filter (where called)::numeric / nullif(count(*), 0), 2) from j),
    'realtime', null
  ) into v_n;
  return jsonb_build_object('since', p_since, 'until', p_until, 'numbers', v_n, 'breakpoints', v_bp);
end $$;
revoke execute on function pilot_numbers(timestamptz, timestamptz, uuid, integer, integer, integer) from public, anon;
grant execute on function pilot_numbers(timestamptz, timestamptz, uuid, integer, integer, integer) to authenticated, service_role;

-- The watch: orders over a line right now that nobody was told about yet.
create function pilot_watch(p_accept_min integer default 3, p_rider_min integer default 5)
returns table (order_id uuid, kind text, kitchen_name text, minutes integer, short_id text)
language sql stable security definer set search_path = public as $$
  select o.id, 'accept_late', k.name, floor(extract(epoch from now() - o.created_at) / 60)::integer, left(o.id::text, 8)
    from orders o join kitchens k on k.id = o.kitchen_id
   where o.status = 'placed' and o.created_at < now() - make_interval(mins => p_accept_min) and o.created_at > now() - interval '12 hours'
     and not exists (select 1 from order_events e where e.order_id = o.id and e.event = 'watch.accept_late')
  union all
  select o.id, 'rider_late', k.name, floor(extract(epoch from now() - o.updated_at) / 60)::integer, left(o.id::text, 8)
    from orders o join kitchens k on k.id = o.kitchen_id
   where o.status = 'ready' and o.rider_id is null and o.updated_at < now() - make_interval(mins => p_rider_min) and o.updated_at > now() - interval '12 hours'
     and not exists (select 1 from order_events e where e.order_id = o.id and e.event = 'watch.rider_late')
$$;
revoke execute on function pilot_watch(integer, integer) from public, anon, authenticated;
grant execute on function pilot_watch(integer, integer) to service_role;

-- Mark orders as told: one event each, never twice. Returns how many were written.
create function pilot_watch_mark(p_marks jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  m jsonb;
  n integer := 0;
  c integer;
begin
  for m in select * from jsonb_array_elements(p_marks) loop
    if m->>'kind' not in ('accept_late', 'rider_late') then
      raise exception 'invalid_kind';
    end if;
    insert into order_events (order_id, kitchen_id, session_id, event, actor)
    select o.id, o.kitchen_id, o.session_id, 'watch.' || (m->>'kind'), 'system' from orders o
     where o.id = (m->>'order_id')::uuid
       and not exists (select 1 from order_events e where e.order_id = o.id and e.event = 'watch.' || (m->>'kind'));
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end $$;
revoke execute on function pilot_watch_mark(jsonb) from public, anon, authenticated;
grant execute on function pilot_watch_mark(jsonb) to service_role;

-- Ping history is kept 30 days; the daily report calls this.
create function pilot_prune() returns integer language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  delete from rider_pings where at < now() - interval '30 days';
  get diagnostics c = row_count;
  return c;
end $$;
revoke execute on function pilot_prune() from public, anon, authenticated;
grant execute on function pilot_prune() to service_role;
