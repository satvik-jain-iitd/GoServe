-- Story #50. The rider's "arriving" tap is an event, not a status (assumption A41): it writes one order_events row and leaves the status alone.
-- Same rules as the other order functions: one transaction, only the service role may call it.

create function rider_event(p_order uuid, p_session text, p_event text, p_actor text)
returns jsonb language plpgsql as $$
declare
  v_order orders;
begin
  if p_event is distinct from 'order.arriving' then
    raise exception 'invalid_event: %', p_event;   -- status steps go through change_status
  end if;

  select * into v_order from orders where id = p_order and session_id = p_session for update;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if v_order.status <> 'out_for_delivery' then
    raise exception 'illegal_event: % while %', p_event, v_order.status;
  end if;
  if exists (select 1 from order_events where order_id = v_order.id and event = p_event) then
    raise exception 'event_exists';
  end if;

  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, p_event, coalesce(p_actor, 'unknown'));
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

revoke execute on function rider_event(uuid, text, text, text) from public, anon, authenticated;
grant execute on function rider_event(uuid, text, text, text) to service_role;
