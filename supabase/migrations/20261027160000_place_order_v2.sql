-- Story #347 (E27, plan v2 B.11). Place order v2: the transaction behind POST /orders.
-- The Edge Function quotes the cart (the only bill math, #345). This function checks the kitchen, the dishes, the add-on picks and the item total
-- again, inside the one transaction that writes the order, so the price the customer saw is the price paid, or the answer is price_changed.
-- It writes what today's place_order writes (items, total, address, contact, the order.placed event) plus the quote in `bill`.
-- Refusals are answers, not exceptions: {ok:false, error, message}. Only the service role may call it (the Edge Function holds that key).
alter table orders add column bill jsonb;

create function place_order_v2(p_session text, p_key text, p_kitchen uuid, p_lines jsonb, p_address text, p_item_total integer, p_bill jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_line jsonb;
  v_dish menu_items;
  v_qty integer;
  v_opts uuid[];
  v_pick jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_items integer := 0;
  v_order orders;
  v_name text;
  v_phone text;
  v_pin text;
  v_to_pay integer;
begin
  if p_session is null or length(trim(p_session)) = 0 or p_key is null or length(trim(p_key)) = 0 or p_kitchen is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request', 'message', 'The request is not complete.');
  end if;
  if p_address is null or length(trim(p_address)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_address', 'message', 'Add a delivery address.');
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_order', 'message', 'Add a dish first.');
  end if;
  v_to_pay := (p_bill->>'to_pay_paise')::integer;
  if v_to_pay is null or v_to_pay < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request', 'message', 'The bill is missing.');
  end if;

  -- a retry: return the order that already exists, before any other check
  select * into v_order from orders where session_id = p_session and client_order_key = p_key;
  if v_order.id is not null then
    return jsonb_build_object('ok', true, 'created', false, 'order', to_jsonb(v_order));
  end if;

  if not exists (select 1 from kitchens where id = p_kitchen and kitchen_open_now(open, active, opens_at, closes_at, now())) then
    return jsonb_build_object('ok', false, 'error', 'kitchen_closed', 'message', 'The kitchen is not taking orders now.');
  end if;

  -- one session cannot fill the database (ADR-009): 20 orders in the last 24 hours
  if (select count(*) from orders where session_id = p_session and created_at > now() - interval '24 hours') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'session_order_cap', 'message', 'Too many orders today. Try again tomorrow.');
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line->>'qty')::integer;
    select * into v_dish from menu_items where id = (v_line->>'menu_item_id')::uuid and kitchen_id = p_kitchen for share;
    if v_dish.id is null then
      return jsonb_build_object('ok', false, 'error', 'unknown_dish', 'message', 'This dish is not on the menu.');
    end if;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      return jsonb_build_object('ok', false, 'error', 'invalid_quantity', 'message', 'Pick 1 to 20 of a dish.');
    end if;
    if not v_dish.available then
      return jsonb_build_object('ok', false, 'error', 'sold_out', 'message', v_dish.name || ' is sold out.');
    end if;
    select coalesce(array_agg(x::uuid), '{}') into v_opts from jsonb_array_elements_text(coalesce(v_line->'option_ids', '[]'::jsonb)) x;
    v_pick := validate_options(v_dish.id, v_opts);
    if not (v_pick->>'ok')::boolean then
      return jsonb_build_object('ok', false, 'error', v_pick->>'error', 'message', v_pick->>'message');
    end if;
    v_items := v_items + (v_dish.price_paise + (v_pick->>'extra_paise')::integer) * v_qty;
    v_lines := v_lines || jsonb_build_object('menu_item_id', v_dish.id, 'name', v_dish.name, 'qty', v_qty, 'price_paise', v_dish.price_paise,
      'extras_paise', (v_pick->>'extra_paise')::integer, 'option_ids', to_jsonb(v_opts));
  end loop;

  if v_items <> p_item_total then
    return jsonb_build_object('ok', false, 'error', 'price_changed', 'message', 'A price changed. Check the bill again.');
  end if;

  select c.name, c.phone, c.pin_code into v_name, v_phone, v_pin from customers c where c.user_id::text = p_session;

  insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address, customer_name, customer_phone, pin_code, bill)
  values (p_kitchen, p_session, p_key, v_lines, v_to_pay, trim(p_address), v_name, v_phone, v_pin, p_bill)
  on conflict (session_id, client_order_key) do nothing
  returning * into v_order;

  if v_order.id is null then  -- two retries at the same moment: the other one won
    select * into v_order from orders where session_id = p_session and client_order_key = p_key;
    return jsonb_build_object('ok', true, 'created', false, 'order', to_jsonb(v_order));
  end if;

  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.placed', 'customer');
  return jsonb_build_object('ok', true, 'created', true, 'order', to_jsonb(v_order));
end $$;
revoke all on function place_order_v2(text, text, uuid, jsonb, text, integer, jsonb) from public, anon, authenticated;
grant execute on function place_order_v2(text, text, uuid, jsonb, text, integer, jsonb) to service_role;
