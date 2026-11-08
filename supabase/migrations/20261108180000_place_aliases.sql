-- Story #1031: local names for served pins. GeoNames gives one post-office name per pin ("Shakarpur" for 110092), so "Laxmi Nagar" found nothing. Table pincode_aliases (an admin writes, the service role reads;
-- RLS hides every row from a customer) is seeded for the served pins. search_places(q) now returns the GeoNames name and the aliases together, and 50 candidates (was 20), so a served place does not fall past the cut.
create table pincode_aliases (
  id uuid primary key default gen_random_uuid(),
  pin text not null references pincodes (pin) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now()
);
create unique index pincode_aliases_pin_name on pincode_aliases (pin, lower(btrim(name)));
alter table pincode_aliases enable row level security;
create policy pincode_aliases_admin on pincode_aliases for all to authenticated using (is_admin()) with check (is_admin());
revoke all on pincode_aliases from public, anon, authenticated;
grant select, insert, update, delete on pincode_aliases to authenticated;

insert into pincode_aliases (pin, name)
select v.pin, v.name from (values
  ('110092', 'Laxmi Nagar'), ('110092', 'Lalita Park'), ('110092', 'Pandav Nagar'), ('110092', 'Preet Vihar'), ('110092', 'Shakarpur'),
  ('471001', 'Green Avenue Colony'), ('471001', 'Satai Road'), ('471001', 'Chhatarpur')
) as v(pin, name) where exists (select 1 from pincodes p where p.pin = v.pin)
on conflict do nothing;

create or replace function search_places(p_q text) returns table (pin text, place text, state text, lat double precision, lng double precision)
language sql stable security invoker set search_path = public as $$
  with q as (select lower(btrim(regexp_replace(coalesce(p_q, ''), '[%_\\]', '', 'g'))) as t),
  names as (
    select c.pin, c.place, c.state, c.lat, c.lng from pincodes c where c.place is not null
    union
    select c.pin, btrim(a.name), c.state, c.lat, c.lng from pincode_aliases a join pincodes c on c.pin = a.pin
  )
  select n.pin, n.place, n.state, n.lat, n.lng
  from names n, q
  where length(q.t) >= 3
    and (
      (q.t ~ '^[0-9]{3,6}$' and n.pin like q.t || '%')
      or lower(n.place) like q.t || '%'
      or lower(n.place) like '% ' || q.t || '%'
    )
  order by case when n.pin = q.t then 0 when lower(n.place) = q.t then 1 when lower(n.place) like q.t || '%' or n.pin like q.t || '%' then 2 else 3 end, n.place, n.pin
  limit 50
$$;
revoke all on function search_places(text) from public, anon, authenticated;
grant execute on function search_places(text) to service_role;
