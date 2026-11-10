-- Story #1192. Two faults in nearest_pin (story #987):
-- 1. It ran as the caller and called distance_m, which anon and authenticated could not run: every call answered "permission denied for function distance_m" (42501).
--    distance_m is pure arithmetic on four numbers (no table, no data), so the grant below is harmless for any caller. Idempotent.
-- 2. With the grant the answers were wrong: the GeoNames centroids are coarse (27 Delhi pins share one point), so the function returned one arbitrary pin of the nearest shared
--    point, 9 km from the place (AIIMS gave 110051, Saket gave 110010). Now it answers only when the nearest centroid belongs to exactly ONE pin and lies within 1.5 km of the point;
--    else null, and the customer types the pin as before. A wrong pin is worse than no pin: the app would fill it with full confidence.
grant execute on function distance_m(double precision, double precision, double precision, double precision) to anon, authenticated;

create or replace function nearest_pin(p_lat double precision, p_lng double precision) returns text
language sql stable security invoker set search_path = public as $$
  with n as (
    select lat, lng, distance_m(lat, lng, p_lat, p_lng) as d from pincodes
    where p_lat between -90 and 90 and p_lng between -180 and 180
      and lat between p_lat - 0.15 and p_lat + 0.15 and lng between p_lng - 0.15 and p_lng + 0.15
    order by d, pin
    limit 1
  )
  select min(p.pin) from pincodes p join n on p.lat = n.lat and p.lng = n.lng
  where n.d <= 1500
  having count(*) = 1   -- a centroid shared by several pins cannot name one of them
$$;
revoke all on function nearest_pin(double precision, double precision) from public;
grant execute on function nearest_pin(double precision, double precision) to anon, authenticated;
