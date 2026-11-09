-- Story #1145 (follow-ups to #1129, money): (1) a cancelled or declined first order gives the promise back; (2) the quote shows the gift before Place order and place_order_v2 only checks
-- that the bill agrees with what the database would give, so no amount comes from the app; (3) the delivery address's pin, not the profile pin, decides the promise and serviceability (#1113).
-- early_friend_for is the one rule, used by the quote (a preview) and mirrored in place_order_v2.
create function early_friend_for(p_session text, p_pin text, p_items integer) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((
    select least(a.offer_paise, greatest(p_items, 0))
    from area_requests a
    where a.user_id::text = p_session and a.pin = p_pin and a.offer_paise > 0 and a.offer_order_id is null
      and not exists (select 1 from orders o where o.session_id = p_session and o.status <> 'cancelled')), 0)
$$;
revoke all on function early_friend_for(text, text, integer) from public, anon, authenticated;

create function release_early_friend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update area_requests set offer_order_id = null where offer_order_id = new.id;
  return new;
end $$;
create trigger orders_release_early_friend after update of status on orders
  for each row when (new.status = 'cancelled' and old.status is distinct from 'cancelled') execute function release_early_friend();

drop function public.place_order_v2(text, text, uuid, jsonb, text, integer, jsonb, double precision, double precision, text);
create or replace function public.place_order_v2(p_session text, p_key text, p_kitchen uuid, p_lines jsonb, p_address text, p_item_total integer, p_bill jsonb, p_drop_lat double precision default null, p_drop_lng double precision default null, p_instructions text default null, p_pin text default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_drop_ok boolean := p_drop_lat between -90 and 90 and p_drop_lng between -180 and 180;   -- half a fix, or one off the map, is no fix
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
  v_note text := nullif(trim(p_instructions), '');
  v_promise area_requests;
  v_off integer := 0;
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
  if length(v_note) > 200 then
    return jsonb_build_object('ok', false, 'error', 'instructions_too_long', 'message', 'Keep the note to 200 characters.');
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

  -- story #1102: the one serviceability rule, the same as the map strip and the menu. Checked only when the order says where it goes (a pin or a drop point).
  select c.name, c.phone, c.pin_code into v_name, v_phone, v_pin from customers c where c.user_id::text = p_session;
  v_pin := coalesce(nullif(trim(p_pin), ''), v_pin);   -- story #1113: the pin of the address the order goes to; the profile pin only when the order does not say
  if not kitchen_serves(p_kitchen, v_pin, case when v_drop_ok then p_drop_lat end, case when v_drop_ok then p_drop_lng end) then
    return jsonb_build_object('ok', false, 'error', 'not_served', 'message', 'This kitchen does not reach that address.');
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


  -- story #1129, #1145: the early-friend promise. The quote already took it off and showed it (bill.early_friend_paise); here the database decides again and the two must agree.
  -- A bill that is missing a gift the promise gives, or carries one nobody promised, is refused as a changed price: nothing is silently changed after the customer saw the bill.
  -- The row is locked so two orders at the same moment cannot both take it.
  select * into v_promise from area_requests
   where user_id::text = p_session and pin = v_pin and offer_paise > 0 and offer_order_id is null for update;
  if v_promise.user_id is not null and not exists (select 1 from orders where session_id = p_session and status <> 'cancelled') then
    v_off := least(v_promise.offer_paise, v_items);
  end if;
  if coalesce((p_bill->>'early_friend_paise')::integer, 0) <> v_off then
    return jsonb_build_object('ok', false, 'error', 'price_changed', 'message', 'A price changed. Check the bill again.');
  end if;

  insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address, customer_name, customer_phone, pin_code, bill, drop_lat, drop_lng, instructions)
  values (p_kitchen, p_session, p_key, v_lines, v_to_pay, trim(p_address), v_name, v_phone, v_pin, p_bill,
          case when v_drop_ok then p_drop_lat end, case when v_drop_ok then p_drop_lng end, v_note)
  on conflict (session_id, client_order_key) do nothing
  returning * into v_order;

  if v_order.id is null then  -- two retries at the same moment: the other one won
    select * into v_order from orders where session_id = p_session and client_order_key = p_key;
    return jsonb_build_object('ok', true, 'created', false, 'order', to_jsonb(v_order));
  end if;

  if v_off > 0 then
    update area_requests set offer_order_id = v_order.id where user_id = v_promise.user_id and pin = v_promise.pin;
  end if;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.placed', 'customer');
  return jsonb_build_object('ok', true, 'created', true, 'order', to_jsonb(v_order));
end $$;
revoke all on function place_order_v2(text, text, uuid, jsonb, text, integer, jsonb, double precision, double precision, text, text) from public, anon, authenticated;
grant execute on function place_order_v2(text, text, uuid, jsonb, text, integer, jsonb, double precision, double precision, text, text) to service_role;
