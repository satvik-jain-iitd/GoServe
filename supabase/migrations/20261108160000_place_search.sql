-- Story #1027: what the `place-search` function needs. A cache of Nominatim answers by normalised query (30 days are kept by the function; nothing about the caller is stored with it)
-- and the one-a-second slot that Nominatim's policy asks for in total, kept in the database so every instance of the function shares it. Both are for the service role only.
create table place_search_cache (
  key text primary key check (length(key) between 3 and 100),
  results jsonb not null,
  created_at timestamptz not null default now()
);
alter table place_search_cache enable row level security;
revoke all on place_search_cache from public, anon, authenticated;

insert into settings (name, value) values ('place_search_slot', jsonb_build_object('at', '1970-01-01T00:00:00Z')) on conflict (name) do nothing;

create function place_search_take_slot() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_took integer;
begin
  update settings set value = jsonb_build_object('at', clock_timestamp())
   where name = 'place_search_slot' and (value ->> 'at')::timestamptz <= clock_timestamp() - interval '1 second';
  get diagnostics v_took = row_count;
  return v_took = 1;
end $$;
revoke all on function place_search_take_slot() from public, anon, authenticated;
grant execute on function place_search_take_slot() to service_role;
