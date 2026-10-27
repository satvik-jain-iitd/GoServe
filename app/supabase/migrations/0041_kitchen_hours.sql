-- Story #321 (M.2, plan v2 H.2). Opening hours are obeyed on the server too: a kitchen outside its hours takes no new order.
-- kitchen_open_now is the one rule, the same as app/src/lib/hours.ts: India time; the switch and active always close a kitchen;
-- with both hours set, open from opens_at (included) to closes_at (not included); closes_at before opens_at means across midnight; no hours, the switch decides.
-- Only the kitchen check inside place_order changes (diff against 0019: that one condition).

create or replace function kitchen_open_now(p_open boolean, p_active boolean, p_opens time, p_closes time, p_at timestamptz)
returns boolean language sql immutable as $$
  select case
    when not coalesce(p_open, false) or not coalesce(p_active, false) then false
    when p_opens is null or p_closes is null or p_opens = p_closes then true
    when p_opens < p_closes then (p_at at time zone 'Asia/Kolkata')::time >= p_opens and (p_at at time zone 'Asia/Kolkata')::time < p_closes
    else (p_at at time zone 'Asia/Kolkata')::time >= p_opens or (p_at at time zone 'Asia/Kolkata')::time < p_closes
  end
$$;

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
  v_name text;
  v_phone text;
  v_pin text;
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

  -- a closed or inactive kitchen takes no new order (a retry of an order already placed was answered above)
  if not exists (select 1 from kitchens where id = v_kitchen and kitchen_open_now(open, active, opens_at, closes_at, now())) then
    raise exception 'kitchen_closed';
  end if;

  -- one session cannot fill the database (ADR-009): 20 orders in the last 24 hours
  if (select count(*) from orders where session_id = p_session and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'session_order_cap';
  end if;

  -- who ordered: the placing customer's saved details (their session id is their user id); the kitchen and the rider need them
  select c.name, c.phone, c.pin_code into v_name, v_phone, v_pin from customers c where c.user_id::text = p_session;

  insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address, customer_name, customer_phone, pin_code)
  values (v_kitchen, p_session, p_key, v_lines, v_total, trim(p_address), v_name, v_phone, v_pin)
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
