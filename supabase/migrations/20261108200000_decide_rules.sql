-- Story #1068 (1 of 3). The Rules decision moves from n8n SUB 13 into the database: same inputs, same pick, the same decision_log row.
-- The rule (decide_guard.js): among the riders that are free, follow the database's rank when every rider has one, else the fewest trips, then the shortest distance;
-- nobody free means 'none'. Jev and Laya are not ported: the engine is always Rules, so jev is null and jev_status says engine_rules (as SUB 13 wrote with Rules on).
-- Refusals are answers, not exceptions: {ok:false, error, message}. An admin (the ops screen) or the service role may ask.
create function decide_rider_rules_v2(p_session text, p_kitchen uuid, p_order uuid, p_riders jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb;
  v_ranked boolean;
  v_pick text;
  v_options jsonb;
  v_decision jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(is_admin(), false) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'Only an admin can ask for a decision.');
  end if;
  if jsonb_typeof(p_riders) is distinct from 'array' or jsonb_array_length(p_riders) not between 1 and 10
     or exists (select 1 from jsonb_array_elements(p_riders) r
                where jsonb_typeof(r) <> 'object' or jsonb_typeof(r -> 'id') <> 'string' or length(r ->> 'id') not between 1 and 36 or jsonb_typeof(r -> 'free') <> 'boolean')
     or (select count(distinct r ->> 'id') from jsonb_array_elements(p_riders) r) <> jsonb_array_length(p_riders)
     or coalesce(trim(p_session), '') = '' or length(p_session) > 64 or p_kitchen is null or p_order is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request', 'message', 'The decision is missing something.');
  end if;
  v_ranked := (select bool_and(coalesce(jsonb_typeof(r -> 'rank') = 'number', false)) from jsonb_array_elements(p_riders) r);   -- a missing rank is false, never null
  v_state := jsonb_build_object('order_id', p_order, 'riders', (
    select jsonb_agg(jsonb_build_object('id', r ->> 'id', 'free', (r ->> 'free')::boolean,
      'distance_m', coalesce(case when jsonb_typeof(r -> 'distance_m') = 'number' then (r ->> 'distance_m')::numeric end, 0),
      'trips_done', coalesce(case when jsonb_typeof(r -> 'trips_done') = 'number' then (r ->> 'trips_done')::numeric end, 0)) order by o)
    from jsonb_array_elements(p_riders) with ordinality as t(r, o)));
  select r ->> 'id' into v_pick from jsonb_array_elements(p_riders) with ordinality as t(r, o)
   where (r ->> 'free')::boolean
   order by case when v_ranked then (r ->> 'rank')::numeric end,
            case when not v_ranked then coalesce(case when jsonb_typeof(r -> 'trips_done') = 'number' then (r ->> 'trips_done')::numeric end, 0) end,
            case when not v_ranked then coalesce(case when jsonb_typeof(r -> 'distance_m') = 'number' then (r ->> 'distance_m')::numeric end, 0) end, o
   limit 1;
  v_pick := coalesce(v_pick, 'none');
  v_options := (select jsonb_agg(r ->> 'id' order by o) from jsonb_array_elements(p_riders) with ordinality as t(r, o)) || '["none"]'::jsonb;
  v_decision := jsonb_build_object('use_case', 'D1', 'schema_version', 1, 'engine', 'rules', 'order_id', p_order, 'state', v_state, 'options', v_options, 'rule_pick', v_pick,
    'jev', null, 'jev_status', 'engine_rules', 'chosen_pick', v_pick, 'chosen_by', 'rule', 'chosen_chance', 1, 'params_version', 1, 'place', 'demo', 'result', null);
  insert into decision_log (kitchen_id, session_id, order_id, decision) values (p_kitchen, p_session, p_order, v_decision);
  return jsonb_build_object('ok', true, 'decision', v_decision);
end $$;
revoke all on function decide_rider_rules_v2(text, uuid, uuid, jsonb) from public, anon;
grant execute on function decide_rider_rules_v2(text, uuid, uuid, jsonb) to authenticated, service_role;
