-- Story A1 (#148, epic E7). One data model for a city: kitchens with pin codes, customers, riders, admins, cancel.
-- Follows 0011: new tables carry RLS, a security-definer helper reads the role tables, only the service role writes order state.

-- Kitchens and menu: what a customer needs to find a kitchen and read its menu.
alter table kitchens
  add column address text, add column phone text, add column lat double precision, add column lng double precision,
  add column pin_codes text[] not null default '{}',
  add column open boolean not null default true,
  add column active boolean not null default true;
alter table menu_items
  add column category text, add column veg boolean not null default true, add column sort integer not null default 0;

-- People. No foreign key to auth.users, like kitchen_staff (0011).
create table customers (
  user_id uuid primary key, name text, phone text, address text, pin_code text, updated_at timestamptz not null default now()
);
create table riders (
  user_id uuid primary key, name text, phone text, online boolean not null default false,
  lat double precision, lng double precision, updated_at timestamptz not null default now()
);
create table admins (user_id uuid primary key, created_at timestamptz not null default now());
alter table customers enable row level security;
alter table riders enable row level security;
alter table admins enable row level security;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- A rider is city-wide, not a kitchen's: rider rows leave kitchen_staff, which keeps role 'kitchen' only.
insert into riders (user_id) select user_id from kitchen_staff where role = 'rider' on conflict do nothing;
delete from kitchen_staff where role = 'rider';
alter table kitchen_staff drop constraint kitchen_staff_role_check;
alter table kitchen_staff add constraint kitchen_staff_role_check check (role = 'kitchen');

-- Orders: who ordered, who delivers, why it was cancelled.
alter table orders
  add column customer_name text, add column customer_phone text, add column pin_code text,
  add column rider_id uuid references riders (user_id), add column cancel_reason text;
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'));

-- Status rule: one step forward; placed or accepted may go to cancelled; cancelled and delivered are final.
create or replace function orders_check_status() returns trigger language plpgsql as $$
declare
  steps text[] := array['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
begin
  if new.status <> old.status then
    if new.status = 'cancelled' then
      if old.status not in ('placed', 'accepted') then
        raise exception 'illegal status step: % to cancelled', old.status;
      end if;
    elsif old.status = 'cancelled' or array_position(steps, new.status) is distinct from array_position(steps, old.status) + 1 then
      raise exception 'illegal status step: % to %', old.status, new.status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Cancel: the customer who placed it, the kitchen's staff, or an admin; only while placed or accepted. Writes the event.
create function cancel_order(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders;
  v_actor text;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v from orders where id = p_order for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  v_actor := case when is_admin() then 'admin' when is_my_kitchen(v.kitchen_id) then 'kitchen' when v.session_id = auth.uid()::text then 'customer' end;
  if v_actor is null then
    raise exception 'not_allowed';
  end if;
  if v.status not in ('placed', 'accepted') then
    raise exception 'cannot_cancel: %', v.status;
  end if;
  v_reason := coalesce(v_reason, case when v_actor = 'customer' then 'cancelled by customer' end);
  if v_reason is null then
    raise exception 'reason_required';
  end if;
  update orders set status = 'cancelled', cancel_reason = v_reason where id = v.id returning * into v;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'order.cancelled', v_actor);
  return jsonb_build_object('order', to_jsonb(v));
end $$;
revoke execute on function cancel_order(uuid, text) from public, anon;
grant execute on function cancel_order(uuid, text) to authenticated;

-- Policies. Reads: own rows; kitchen staff see riders; a rider sees the orders assigned to them (the kitchen-wide rider read is gone with the role).
create policy customers_own on customers for select to authenticated using (user_id = auth.uid());
create policy customers_insert_own on customers for insert to authenticated with check (user_id = auth.uid());
create policy customers_update_own on customers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy riders_own on riders for select to authenticated using (user_id = auth.uid());
create policy riders_update_own on riders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy riders_staff_read on riders for select to authenticated using (exists (select 1 from kitchen_staff where user_id = auth.uid()));
create policy admins_own on admins for select to authenticated using (user_id = auth.uid());
create policy orders_my_rider on orders for select to authenticated using (rider_id = auth.uid());
create policy events_my_rider on order_events for select to authenticated using (exists (select 1 from orders o where o.id = order_id and o.rider_id = auth.uid()));

-- Admin: read everything that matters, write the setup tables.
create policy admin_read on orders for select to authenticated using (is_admin());
create policy admin_read on order_events for select to authenticated using (is_admin());
create policy admin_read on decision_log for select to authenticated using (is_admin());
create policy admin_read on run_log for select to authenticated using (is_admin());
create policy admin_read on feedback for select to authenticated using (is_admin());
create policy admin_read on customers for select to authenticated using (is_admin());
create policy admin_read on riders for select to authenticated using (is_admin());
create policy admin_read on kitchen_staff for select to authenticated using (is_admin());
create policy admin_read on admins for select to authenticated using (is_admin());
create policy admin_write on kitchens for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_write on menu_items for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_write on kitchen_staff for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_write on riders for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_write on admins for all to authenticated using (is_admin()) with check (is_admin());
-- A kitchen's staff may edit its dishes (sold out, story A6).
create policy staff_update_menu on menu_items for update to authenticated using (is_my_kitchen(kitchen_id)) with check (is_my_kitchen(kitchen_id));

-- The 20-order brake is per session per day, not per session for ever (0004). place_order is replaced as a whole; only the cap line changes.
create or replace function place_order(p_session text, p_key text, p_items jsonb, p_address text)
returns jsonb language plpgsql as $$
declare
  v_kitchen uuid;
  v_lines jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_item jsonb;
  v_dish menu_items;
  v_qty integer;
  v_order orders;
begin
  if p_session is null or length(trim(p_session)) = 0 or p_key is null or length(trim(p_key)) = 0 then
    raise exception 'invalid_request';
  end if;
  if p_address is null or length(trim(p_address)) = 0 then
    raise exception 'invalid_address';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_item: no items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (v_item->>'qty')::integer;
      select * into v_dish from menu_items where id = (v_item->>'menu_item_id')::uuid and available;
    exception when others then
      raise exception 'invalid_item: bad line';
    end;
    if v_dish.id is null or v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'invalid_item: unknown dish or quantity';
    end if;
    v_kitchen := coalesce(v_kitchen, v_dish.kitchen_id);
    if v_dish.kitchen_id <> v_kitchen then
      raise exception 'invalid_item: dishes from two kitchens';
    end if;
    -- the price comes from the menu, never from the phone
    v_total := v_total + v_dish.price_paise * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'menu_item_id', v_dish.id, 'name', v_dish.name, 'qty', v_qty, 'price_paise', v_dish.price_paise);
  end loop;

  select * into v_order from orders where session_id = p_session and client_order_key = p_key;
  if v_order.id is not null then  -- a retry: return the order that already exists
    return jsonb_build_object('created', false, 'order', to_jsonb(v_order));
  end if;

  -- one session cannot fill the database (ADR-009): 20 orders in the last 24 hours
  if (select count(*) from orders where session_id = p_session and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'session_order_cap';
  end if;

  insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address)
  values (v_kitchen, p_session, p_key, v_lines, v_total, trim(p_address))
  on conflict (session_id, client_order_key) do nothing
  returning * into v_order;

  if v_order.id is null then  -- two retries at the same moment: the other one won
    select * into v_order from orders where session_id = p_session and client_order_key = p_key;
    return jsonb_build_object('created', false, 'order', to_jsonb(v_order));
  end if;

  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.placed', 'customer');
  return jsonb_build_object('created', true, 'order', to_jsonb(v_order));
end $$;
