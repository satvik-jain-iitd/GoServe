-- Story 1182 (boards RY1 to RY3): the rider's door steps.
-- 1. rider_arriving_at: when Arriving was sent for the caller's own order (the rider assigned to it), or null. The rider cannot read order_events
--    (only the customer can, policy events_via_my_order), so this narrow read lets a reload or a second phone open step 3, not step 2.
-- 2. rider_at_door: the rider tapped "I am at the door" while the phone said far (p_metres) or had no place (null). One trace line, so the owner
--    can count how often a pin or the phone's place was wrong. Only the rider of an order that is on the way can write it.
create or replace function rider_arriving_at(p_order uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(e.created_at) from order_events e join orders o on o.id = e.order_id
  where e.order_id = p_order and e.event = 'order.arriving' and o.rider_id = auth.uid();
$$;
revoke execute on function rider_arriving_at(uuid) from public, anon;
grant execute on function rider_arriving_at(uuid) to authenticated;

create or replace function rider_at_door(p_order uuid, p_metres integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from orders where id = p_order and rider_id = auth.uid() and status = 'out_for_delivery') then
    raise exception 'order_not_found';
  end if;
  perform trace_write(p_order, 'app', 'rider_at_door_tap', coalesce(p_metres::text, 'no_place'), null, null);
end $$;
revoke execute on function rider_at_door(uuid, integer) from public, anon;
grant execute on function rider_at_door(uuid, integer) to authenticated;
