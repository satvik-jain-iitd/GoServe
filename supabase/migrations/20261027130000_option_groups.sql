-- Story #344 (E27, plan v2 B.8). Add-on groups: a dish can have choices (spice level, extras), each group with a minimum and a maximum.
-- Public to read (the menu shows them); only the service role writes. validate_options is the one place that says whether a pick is allowed:
-- Quote (#345) and Place order v2 (#347) call it, so every app gets the same answer.

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  sort integer not null default 0,
  check (max_select >= min_select)
);
create index option_groups_dish on option_groups (menu_item_id, sort);

create table options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references option_groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  price_paise integer not null default 0 check (price_paise >= 0),
  available boolean not null default true,
  sort integer not null default 0
);
create index options_group on options (group_id, sort);

alter table option_groups enable row level security;
alter table options enable row level security;
create policy option_groups_read on option_groups for select using (true);
create policy options_read on options for select using (true);

-- p_option_ids: the options the customer picked for ONE dish. Answers {ok, extra_paise} or {ok:false, error, message, ...}; never raises for a bad pick.
create or replace function validate_options(p_menu_item uuid, p_option_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ids uuid[] := coalesce(p_option_ids, '{}');
  g record;
  v_n integer;
  v_extra integer;
begin
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
    return jsonb_build_object('ok', false, 'error', 'duplicate_option', 'message', 'Each option can be picked once.');
  end if;
  if exists (select 1 from unnest(v_ids) x where not exists (
       select 1 from options o join option_groups og on og.id = o.group_id where o.id = x and og.menu_item_id = p_menu_item)) then
    return jsonb_build_object('ok', false, 'error', 'unknown_option', 'message', 'This option is not on this dish.');
  end if;
  if exists (select 1 from options o where o.id = any (v_ids) and not o.available) then
    return jsonb_build_object('ok', false, 'error', 'option_unavailable', 'message', 'This option is sold out.');
  end if;
  for g in select id, name, min_select, max_select from option_groups where menu_item_id = p_menu_item order by sort, name loop
    select count(*) into v_n from options where group_id = g.id and id = any (v_ids);
    if v_n < g.min_select then
      return jsonb_build_object('ok', false, 'error', 'option_group_min', 'group', g.name, 'min', g.min_select, 'picked', v_n,
                                'message', format('Pick at least %s for %s.', g.min_select, g.name));
    elsif v_n > g.max_select then
      return jsonb_build_object('ok', false, 'error', 'option_group_max', 'group', g.name, 'max', g.max_select, 'picked', v_n,
                                'message', format('Pick at most %s for %s.', g.max_select, g.name));
    end if;
  end loop;
  select coalesce(sum(price_paise), 0) into v_extra from options where id = any (v_ids);
  return jsonb_build_object('ok', true, 'extra_paise', v_extra);
end $$;
revoke all on function validate_options(uuid, uuid[]) from public;
grant execute on function validate_options(uuid, uuid[]) to anon, authenticated, service_role;
