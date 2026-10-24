-- Fix found by the H14 live row (#204, #208). The pilot breakpoint is "4 pin codes around one kitchen", but pilot_numbers added up the pin codes of every active kitchen
-- (6 on dev, so the card said OVER). It now reports the most pin codes around one kitchen. Everything else in the function is as in 0024.
create or replace function pilot_numbers(p_since timestamptz, p_until timestamptz, p_kitchen uuid default null, p_accept_min integer default 3, p_promise_min integer default 35, p_gap_min integer default 5)
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
    'pins', (select max(cardinality(k.pin_codes)) from kitchens k where k.active and (p_kitchen is null or k.id = p_kitchen)),
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
