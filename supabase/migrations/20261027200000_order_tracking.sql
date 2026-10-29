-- Story #352 (E27, plan v2 B.16). The live tracking feed: one row per order that carries the status, the rider's place and the ETA.
-- The channel is Supabase Realtime on this table. Row level security is the gate: only the customer who placed the order reads its row, so the
-- app subscribes to postgres_changes with the filter order_id=eq.<id>. Nobody writes the row by hand: a trigger on orders (status, rider) and
-- rider_ping (position) keep it. ETA = minutes at 250 m a minute (assumption A85). The place is the pin's drop point (pin_points, migration 0034).
create table order_tracking (
  order_id uuid primary key references orders (id) on delete cascade,
  session_id text not null,
  status text not null,
  rider_lat double precision,
  rider_lng double precision,
  eta_min integer,
  updated_at timestamptz not null default now()
);
alter table order_tracking enable row level security;
create policy tracking_own on order_tracking for select to authenticated using (session_id = auth.uid()::text);
revoke all on order_tracking from public, anon, authenticated;
grant select on order_tracking to authenticated;
alter publication supabase_realtime add table order_tracking;

create function refresh_order_tracking(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  k kitchens;
  r riders;
  d pin_points;
  v_eta integer;
begin
  select * into o from orders where id = p_order;
  if o.id is null then
    return;
  end if;
  select * into r from riders where user_id = o.rider_id;
  select * into k from kitchens where id = o.kitchen_id;
  select * into d from pin_points where pin = o.pin_code;
  if r.user_id is not null and r.lat is not null and d.pin is not null then
    if o.status = 'out_for_delivery' then
      v_eta := ceil(distance_m(r.lat, r.lng, d.lat, d.lng) / 250.0)::integer;
    elsif o.status = 'ready' and k.lat is not null then
      v_eta := ceil((distance_m(r.lat, r.lng, k.lat, k.lng) + distance_m(k.lat, k.lng, d.lat, d.lng)) / 250.0)::integer;
    end if;
  end if;
  insert into order_tracking (order_id, session_id, status, rider_lat, rider_lng, eta_min, updated_at)
  values (o.id, o.session_id, o.status, case when o.status in ('ready', 'out_for_delivery') then r.lat end, case when o.status in ('ready', 'out_for_delivery') then r.lng end, v_eta, now())
  on conflict (order_id) do update set status = excluded.status, rider_lat = excluded.rider_lat, rider_lng = excluded.rider_lng, eta_min = excluded.eta_min, updated_at = excluded.updated_at;
end $$;
revoke all on function refresh_order_tracking(uuid) from public, anon, authenticated;

create function orders_tracking_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_order_tracking(new.id);
  return null;
end $$;
create trigger orders_tracking after insert or update of status, rider_id on orders
  for each row execute function orders_tracking_trigger();

-- The rider's place moves the rows of the orders they carry (same body as 0024, plus the refresh).
create or replace function rider_ping(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from riders where user_id = auth.uid()) then
    raise exception 'not_allowed';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location';
  end if;
  update riders set lat = p_lat, lng = p_lng, updated_at = now() where user_id = auth.uid();
  insert into rider_pings (user_id, lat, lng) values (auth.uid(), p_lat, p_lng);
  perform refresh_order_tracking(id) from orders where rider_id = auth.uid() and status in ('ready', 'out_for_delivery');
end $$;
