-- Story #1484 (v2 port, switch OFF). dispatch_order_db learns to stack: settings stack_max (default 1 = today, row missing = 1) and stack_added_max_min (default 5).
-- Nothing else changes: with stack_max = 1 the function takes the same path as before. Stacked packets skip decide_rider_rules_v2 (no decision_log row for the join).
create or replace function dispatch_stack_max() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::integer from params where session_id = 'global' and key = 'stack_max' order by version desc limit 1), 1)
$$;
revoke all on function dispatch_stack_max() from public, anon, authenticated;
create or replace function dispatch_order_db(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_cands jsonb;
  v_dec jsonb;
  v_pick text;
  v_role text := current_setting('request.jwt.claim.role', true);
  v_max integer := dispatch_stack_max();   -- 1 = today: one order, one rider
  v_cap double precision := coalesce((select (value #>> '{}')::double precision from params where session_id = 'global' and key = 'stack_added_max_min' order by version desc limit 1), 5);
  v_stack uuid;
begin
  perform pg_advisory_xact_lock(hashtext('goserve_dispatch'));   -- one dispatch at a time: two Ready orders can never read the same rider as free
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
  if v_max >= 2 then   -- stacking: a rider holding Ready orders of this same kitchen, none picked up yet, with room, and the first customer's added wait inside the cap
    select o.rider_id into v_stack
    from orders o join riders r on r.user_id = o.rider_id and r.online
    where o.kitchen_id = v_order.kitchen_id and o.rider_id is not null
      and o.rider_id::text in (select c ->> 'id' from jsonb_array_elements(v_cands -> 'riders') c)
    group by o.rider_id
    having count(*) filter (where o.status = 'ready') >= 1
       and count(*) filter (where o.status = 'out_for_delivery') = 0
       and count(*) filter (where o.status = 'ready') < v_max
       and (count(*) filter (where o.status = 'ready') < 2 or not exists (select 1 from jsonb_array_elements(v_cands -> 'riders') c where (c ->> 'free')::boolean))   -- a third packet only when nobody is free
       and extract(epoch from now() - min((select e.created_at from order_events e where e.order_id = o.id and e.event in ('order.ready', 'order.assigned') order by e.created_at desc limit 1))) / 60 <= v_cap
    order by count(*) desc limit 1;
    if v_stack is not null then
      return jsonb_build_object('ok', true, 'rider_id', v_stack, 'stacked', true, 'order', assign_rider(p_order, v_stack) -> 'order');
    end if;
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
  if exists (select 1 from orders where rider_id = v_pick::uuid and status in ('ready', 'out_for_delivery')) then   -- belt and braces after the lock
    return jsonb_build_object('ok', false, 'error', 'no_rider_free', 'message', 'No rider is free.');
  end if;
  return jsonb_build_object('ok', true, 'rider_id', v_pick, 'order', assign_rider(p_order, v_pick::uuid) -> 'order');
exception when others then
  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  return jsonb_build_object('ok', false, 'error', 'dispatch_failed', 'message', 'The rider could not be saved. Try again.');
end $$;
