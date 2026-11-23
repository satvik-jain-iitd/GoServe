-- Story 1320 (epic 1317): where the minutes go. Per delivered order: minutes to cook (placed to picked up), to ride (picked up to arriving), at the door (arriving to delivered).
-- Built from the first row of each event in order_events. No name, phone or address in the answer. Admin only. Safe to run twice.
create or replace function order_stage_minutes_v1(p_from timestamptz default null)
returns table (order_id uuid, cook_min numeric, ride_min numeric, door_min numeric, total_min numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
  with t as (
    select e.order_id as oid,
           min(e.created_at) filter (where e.event = 'order.placed') as placed,
           min(e.created_at) filter (where e.event = 'order.picked_up') as picked,
           min(e.created_at) filter (where e.event = 'order.arriving') as arriving,
           min(e.created_at) filter (where e.event = 'order.delivered') as delivered
      from order_events e
     where e.event in ('order.placed', 'order.picked_up', 'order.arriving', 'order.delivered')
     group by e.order_id)
  select t.oid,
         round(extract(epoch from (t.picked - t.placed)) / 60, 1),
         round(extract(epoch from (t.arriving - t.picked)) / 60, 1),
         round(extract(epoch from (t.delivered - t.arriving)) / 60, 1),
         round(extract(epoch from (t.delivered - t.placed)) / 60, 1)
    from t
   where t.delivered is not null and (p_from is null or t.delivered >= p_from);
end $$;

-- The middle value (median) and the worst value (max) of each stage, and how many delivered orders took over 30 minutes in all.
create or replace function order_stage_summary_v1(p_from timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object(
      'orders', count(*),
      'cook_median', percentile_cont(0.5) within group (order by s.cook_min), 'cook_max', max(s.cook_min),
      'ride_median', percentile_cont(0.5) within group (order by s.ride_min), 'ride_max', max(s.ride_min),
      'door_median', percentile_cont(0.5) within group (order by s.door_min), 'door_max', max(s.door_min),
      'over_30', count(*) filter (where s.total_min > 30))
    from order_stage_minutes_v1(p_from) s);
end $$;

revoke all on function order_stage_minutes_v1(timestamptz) from public, anon;
revoke all on function order_stage_summary_v1(timestamptz) from public, anon;
grant execute on function order_stage_minutes_v1(timestamptz) to authenticated;
grant execute on function order_stage_summary_v1(timestamptz) to authenticated;
