-- Story #1068 (2 of 3). Dispatch is event-driven inside the database; n8n SUB 22 is no longer in the path.
--   dispatch_order_db(order)  the pick of dispatch_order_v2 plus the decision_log row SUB 13 wrote (engine rules). Never raises: a refusal is an answer.
--   dispatch_waiting_db()     every ready order without a rider, oldest first, one try each.
--   triggers: an order turning Ready is dispatched at once; a rider coming online, or freed by a delivery or a cancel, picks up what waits.
-- Batch mode keeps its own tick (dispatch_tick): in batch mode nothing here assigns. A trigger never fails the write that fired it.
create function dispatch_order_db(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_cands jsonb;
  v_dec jsonb;
  v_pick text;
  v_role text := current_setting('request.jwt.claim.role', true);
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  if v_order.rider_id is not null then
    return jsonb_build_object('ok', true, 'rider_id', v_order.rider_id, 'already_assigned', true);
  end if;
  if v_order.status <> 'ready' then
    return jsonb_build_object('ok', false, 'error', 'not_ready', 'message', 'The order is not ready yet.');
  end if;
  v_cands := dispatch_candidates(p_order);
  if coalesce((v_cands ->> 'batch')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'batch_mode', 'message', 'Batch dispatch assigns this order on its own tick.');
  end if;
  if not exists (select 1 from jsonb_array_elements(v_cands -> 'riders') c where (c ->> 'free')::boolean) then
    return jsonb_build_object('ok', false, 'error', 'no_rider_free', 'message', 'No rider is free.');
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);   -- the rule function lets the service role in; put back below
  v_dec := decide_rider_rules_v2(v_order.session_id, v_order.kitchen_id, v_order.id, v_cands -> 'riders');
  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  v_pick := v_dec -> 'decision' ->> 'chosen_pick';
  if v_pick is null or v_pick = 'none' then
    return jsonb_build_object('ok', false, 'error', 'no_rider_free', 'message', 'No rider is free.');
  end if;
  return jsonb_build_object('ok', true, 'rider_id', v_pick, 'order', assign_rider(p_order, v_pick::uuid) -> 'order');
exception when others then
  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  return jsonb_build_object('ok', false, 'error', 'dispatch_failed', 'message', 'The rider could not be saved. Try again.');
end $$;

create function dispatch_waiting_db() returns integer
language plpgsql security definer set search_path = public as $$
declare
  o uuid;
  n integer := 0;
begin
  for o in select id from orders where status = 'ready' and rider_id is null order by created_at limit 20 loop
    if (dispatch_order_db(o) ->> 'ok')::boolean then n := n + 1; end if;
  end loop;
  return n;
end $$;

create function dispatch_on_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ready' and old.status is distinct from 'ready' and new.rider_id is null then
    perform dispatch_order_db(new.id);
  elsif new.status in ('delivered', 'cancelled') and old.status is distinct from new.status and old.rider_id is not null then
    perform dispatch_waiting_db();
  end if;
  return null;
exception when others then
  return null;
end $$;
create trigger orders_dispatch after update of status on orders
  for each row execute function dispatch_on_order_change();

create function dispatch_on_rider_online() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.online and (tg_op = 'INSERT' or not old.online) then
    perform dispatch_waiting_db();
  end if;
  return null;
exception when others then
  return null;
end $$;
create trigger riders_dispatch after insert or update of online on riders
  for each row execute function dispatch_on_rider_online();

revoke all on function dispatch_order_db(uuid) from public, anon, authenticated;
revoke all on function dispatch_waiting_db() from public, anon, authenticated;
revoke all on function dispatch_on_order_change() from public, anon, authenticated;
revoke all on function dispatch_on_rider_online() from public, anon, authenticated;
grant execute on function dispatch_order_db(uuid) to service_role;
grant execute on function dispatch_waiting_db() to service_role;
