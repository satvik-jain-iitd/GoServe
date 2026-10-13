-- Story #45. The database does the order work; n8n only calls it (ADR-007, ADR-009).
-- Each function runs in one transaction: the order and its event are written together or not at all.
-- Only the service role (n8n) may call them. The phone keys cannot.

create function place_order(p_session text, p_key text, p_items jsonb, p_address text)
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

  insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address)
  values (v_kitchen, p_session, p_key, v_lines, v_total, trim(p_address))
  on conflict (session_id, client_order_key) do nothing
  returning * into v_order;

  if v_order.id is null then  -- a retry: return the order that already exists
    select * into v_order from orders where session_id = p_session and client_order_key = p_key;
    return jsonb_build_object('created', false, 'order', to_jsonb(v_order));
  end if;

  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.placed', 'customer');
  return jsonb_build_object('created', true, 'order', to_jsonb(v_order));
end $$;

create function change_status(p_order uuid, p_session text, p_to text, p_actor text)
returns jsonb language plpgsql as $$
declare
  v_order orders;
  v_event text;
begin
  v_event := case p_to
    when 'accepted' then 'order.accepted'
    when 'preparing' then 'order.preparing'
    when 'ready' then 'order.ready'
    when 'out_for_delivery' then 'order.picked_up'
    when 'delivered' then 'order.delivered'
  end;
  if v_event is null then
    raise exception 'invalid_status: %', p_to;
  end if;

  select * into v_order from orders where id = p_order and session_id = p_session for update;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;

  -- the trigger orders_status_rule rejects a skipped or backward step
  update orders set status = p_to where id = v_order.id returning * into v_order;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, v_event, coalesce(p_actor, 'unknown'));
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

revoke execute on function place_order(text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function change_status(uuid, text, text, text) from public, anon, authenticated;
grant execute on function place_order(text, text, jsonb, text) to service_role;
grant execute on function change_status(uuid, text, text, text) to service_role;
