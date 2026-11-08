-- Story #1029: place search from our own pincodes table. Two columns hold the GeoNames place (post office) name and the state (seeded by the two files after this one).
-- search_places(q): a pin or the start of one (3 to 6 digits) matches by pin; words match the start of the place name or the start of any word in it. Best matches first, 20 candidates.
-- The place-search function marks each candidate served and returns five. For the service role only: the app asks the function, never the table by name.
alter table pincodes add column if not exists place text, add column if not exists state text;

create function search_places(p_q text) returns table (pin text, place text, state text, lat double precision, lng double precision)
language sql stable security invoker set search_path = public as $$
  with q as (select lower(btrim(regexp_replace(coalesce(p_q, ''), '[%_\\]', '', 'g'))) as t)
  select c.pin, c.place, c.state, c.lat, c.lng
  from pincodes c, q
  where length(q.t) >= 3 and c.place is not null
    and (
      (q.t ~ '^[0-9]{3,6}$' and c.pin like q.t || '%')
      or lower(c.place) like q.t || '%'
      or lower(c.place) like '% ' || q.t || '%'
    )
  order by case when c.pin = q.t then 0 when lower(c.place) = q.t then 1 when lower(c.place) like q.t || '%' or c.pin like q.t || '%' then 2 else 3 end, c.place, c.pin
  limit 20
$$;
revoke all on function search_places(text) from public, anon, authenticated;
grant execute on function search_places(text) to service_role;
