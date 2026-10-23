-- Story A5 (#152, epic E9). A ready order gets a rider. n8n (the service role) reads who is online, SUB 13 decides, and the rider is saved on the order.
-- Same rules as the other order functions: one transaction, only the service role may call them.

-- Metres between two points on the earth (haversine). No map service: the distance is only for the rule, not for the customer.
create function distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) returns double precision
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- The riders that are online, nearest to the order's kitchen first: id, free (no ready or out-for-delivery order on them), distance in metres, trips today.
-- A rider who has not shared a location yet is at distance 0 (still listed, so a new rider is not shut out). At most ten, the limit SUB 13 accepts.
create function dispatch_candidates(p_order uuid) returns jsonb
language plpgsql stable as $$
declare
  v_order orders;
  v_kitchen kitchens;
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    raise exception 'order_not_found';
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
      from riders r where r.online
      order by 3, 4
      limit 10
    ) c), '[]'::jsonb));
end $$;

-- Save the rider on a ready order and write the event. The same rider twice changes nothing; another rider cannot take it; an offline rider is refused.
create function assign_rider(p_order uuid, p_rider uuid) returns jsonb
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
  if v_order.status <> 'ready' or v_order.rider_id is not null then
    raise exception 'not_ready';
  end if;
  if not exists (select 1 from riders where user_id = p_rider and online) then
    raise exception 'rider_not_available';
  end if;
  update orders set rider_id = p_rider where id = v_order.id returning * into v_order;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.assigned', 'dispatch');
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

revoke execute on function distance_m(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function dispatch_candidates(uuid) from public, anon, authenticated;
revoke execute on function assign_rider(uuid, uuid) from public, anon, authenticated;
grant execute on function distance_m(double precision, double precision, double precision, double precision) to service_role;
grant execute on function dispatch_candidates(uuid) to service_role;
grant execute on function assign_rider(uuid, uuid) to service_role;
