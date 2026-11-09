-- Story #987: the pin code for a place comes from data we hold, not from a volunteer server. Table `pincodes` (pin, lat, lng; public read, written by migrations only),
-- seeded by the two files after this one from the GeoNames India postal code file (CC BY 4.0). `nearest_pin(lat, lng)` gives the closest centroid within 15 km, else null.
-- In dense cities the centroids are coarse (many pins share a point), so the app asks the reverse lookup first and uses this only when that has no fitting pin.
create table pincodes (
  pin text primary key check (pin ~ '^[0-9]{6}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180)
);
create index pincodes_lat_lng on pincodes (lat, lng);
alter table pincodes enable row level security;
create policy pincodes_read on pincodes for select to anon, authenticated using (true);
revoke all on pincodes from public, anon, authenticated;
grant select on pincodes to anon, authenticated;

create function nearest_pin(p_lat double precision, p_lng double precision) returns text
language sql stable security invoker set search_path = public as $$
  select pin from pincodes
  where p_lat between -90 and 90 and p_lng between -180 and 180
    and lat between p_lat - 0.15 and p_lat + 0.15 and lng between p_lng - 0.15 and p_lng + 0.15
    and distance_m(lat, lng, p_lat, p_lng) <= 15000
  order by distance_m(lat, lng, p_lat, p_lng), pin   -- the pin breaks a tie, so a shared centroid always answers the same
  limit 1
$$;
revoke all on function nearest_pin(double precision, double precision) from public;
grant execute on function nearest_pin(double precision, double precision) to anon, authenticated;
