-- Story #976: a customer keeps more than one saved address (Home, Office, a parent's house). The table `addresses` already exists from story #341 (never used by the app, owner-only row level security,
-- empty on dev); this migration reshapes it instead of making a second one. Rows belong to the login (auth.uid), so the same Google account on a new phone has them.
-- Nothing is lost: house, building, landmark and is_default stay as unused columns. A row now holds the words the customer confirmed or typed (`address`) and its pin; lat and lng are optional;
-- last_used_at says which one was used last. The order keeps its own copy of the text and pin, as today. Nothing here is filled from Ola Maps by us in bulk.
alter table addresses add column address text;
alter table addresses add column last_used_at timestamptz not null default now();
update addresses set address = btrim(concat_ws(', ', house, building, landmark)) where address is null;
alter table addresses alter column address set not null;
alter table addresses add constraint addresses_address_len check (length(btrim(address)) between 5 and 300);
alter table addresses alter column house drop not null;
alter table addresses alter column building drop not null;
alter table addresses alter column lat drop not null;
alter table addresses alter column lng drop not null;
alter table addresses add constraint addresses_place_pair check ((lat is null) = (lng is null));
drop index if exists addresses_user;
create index addresses_user_used on addresses (user_id, last_used_at desc);
grant select, insert, update, delete on addresses to authenticated;

-- A customer has at most 20 saved addresses: a hundred taps on Add cannot grow a table without end.
create function addresses_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from addresses where user_id = new.user_id) >= 20 then
    raise exception 'addresses_cap' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger addresses_cap_t before insert on addresses for each row execute function addresses_cap();

-- The tunable: how near (metres) the phone must be to a saved address for that address to be picked on open. 200 is a guess from GPS error, to be measured on the owner's phone.
insert into settings (name, value) values ('address_near_m', '200'::jsonb) on conflict (name) do nothing;
create function address_near_m() returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::integer from settings where name = 'address_near_m' and jsonb_typeof(value) = 'number'), 200)
$$;
revoke all on function address_near_m() from public, anon;
grant execute on function address_near_m() to authenticated;
