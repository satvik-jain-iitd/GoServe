-- Story B3 (#159). An order carries who ordered: place_order copies the placing customer's saved name, phone and pin code (customers, 0013) into the order.
-- Nothing else in place_order changes (diff against 0013: the three variables, the lookup, the insert columns).

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
