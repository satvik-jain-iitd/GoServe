-- Story #350 (E27, plan v2 B.14). Dispatch on v2: when the food is ready, the database picks the rider and saves it, in one transaction.
-- It reads the candidates the database ranks (dispatch_candidates) and takes the rule's pick, the same as SUB 13: follow the rank when every
-- rider has one (pick nearest_band), else a free rider with the fewest trips today, then the nearest. Then assign_rider saves it and writes order.assigned.
-- Jev advice and the decision_log row stay in SUB 13; this is the rule alone. Batch mode keeps its own tick (dispatch_tick), so it answers batch_mode.
-- Refusals are answers, not exceptions: {ok:false, error, message}. Only the service role may call it.
create function dispatch_order_v2(p_order uuid) returns jsonb
language plpgsql as $$
declare
  v_order orders;
  v_cands jsonb;
  v_rider text;
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  if v_order.rider_id is not null then   -- already done: the same rider, no second event
    return jsonb_build_object('ok', true, 'rider_id', v_order.rider_id, 'already_assigned', true);
  end if;
  if v_order.status <> 'ready' then
    return jsonb_build_object('ok', false, 'error', 'not_ready', 'message', 'The order is not ready yet.');
  end if;
  v_cands := dispatch_candidates(p_order);
  if coalesce((v_cands ->> 'batch')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'batch_mode', 'message', 'Batch dispatch assigns this order on its own tick.');
  end if;
  select c ->> 'id' into v_rider
  from jsonb_array_elements(v_cands -> 'riders') c
  where (c ->> 'free')::boolean
  order by case when (select bool_and(r ? 'rank') from jsonb_array_elements(v_cands -> 'riders') r) then (c ->> 'rank')::integer end,
           (c ->> 'trips_done')::integer, (c ->> 'distance_m')::integer, c ->> 'id'
  limit 1;
  if v_rider is null then
    return jsonb_build_object('ok', false, 'error', 'no_rider_free', 'message', 'No rider is free.');
  end if;
  return jsonb_build_object('ok', true, 'rider_id', v_rider, 'order', assign_rider(p_order, v_rider::uuid) -> 'order');
exception when others then
  if sqlerrm like 'not_ready%' then
    return jsonb_build_object('ok', false, 'error', 'not_ready', 'message', 'The order is not ready yet.');
  elsif sqlerrm like 'rider_not_available%' then
    return jsonb_build_object('ok', false, 'error', 'rider_not_available', 'message', 'The rider went offline. Try again.');
  end if;
  return jsonb_build_object('ok', false, 'error', 'dispatch_failed', 'message', 'The rider could not be saved. Try again.');
end $$;
revoke all on function dispatch_order_v2(uuid) from public, anon, authenticated;
grant execute on function dispatch_order_v2(uuid) to service_role;
