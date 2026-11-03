-- Story #873 (epic E32). Two things made Clear everything fail or break later:
-- 1. Supabase loads the `safeupdate` library on the PostgREST connection (role authenticator), and it refuses every DELETE or UPDATE without a WHERE clause there:
--    "DELETE requires a WHERE clause (21000)". Every statement below has a WHERE.
-- 2. Owner, 4 Nov 2026: "aisa kuch karna ki future me bhi chale chahe data badh bhi jaye". One call that deletes everything runs into the API's 8 second statement timeout
--    once the data grows. So the function works in slices: each call does ONE slice of at most p_limit rows and says whether it is done; the app calls it again until done.
--    A slice is one of: detach log rows, delete orders, or (when nothing is left of those) clear the small tables.
-- The old function with no argument is dropped so a call with no argument finds the one with the default.
-- It is the same promise as before: the run log, decision log, feedback and params keep every row (their kitchen and order keys are set to null),
-- accounts, settings, dish_photos and pin_points stay. It still needs is_admin() and the settings row clear_allowed = true.
drop function if exists sim_clear_all();

create function sim_clear_all(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 5000);
  v_budget integer; v_n integer; v_detached integer := 0; v_ids uuid[]; v_orders integer := 0; v_dishes integer; v_riders integer; v_kitchens integer;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if not coalesce((select (value #>> '{}')::boolean from settings where name = 'clear_allowed'), false) then
    return jsonb_build_object('ok', false, 'error', 'clear_not_allowed', 'message', 'Clear everything is switched off on this database.');
  end if;
  perform set_config('goserve.reset', 'on', true);   -- this transaction only: order_events are frozen except for this

  -- Slice 1: detach log rows from their kitchen and order. Nothing is deleted from the logs.
  v_budget := v_limit;
  update decision_log set kitchen_id = null, order_id = null where id in (select id from decision_log where kitchen_id is not null or order_id is not null limit v_budget);
  get diagnostics v_n = row_count; v_detached := v_detached + v_n; v_budget := v_budget - v_n;
  if v_budget > 0 then
    update run_log set kitchen_id = null where id in (select id from run_log where kitchen_id is not null limit v_budget);
    get diagnostics v_n = row_count; v_detached := v_detached + v_n; v_budget := v_budget - v_n;
  end if;
  if v_budget > 0 then
    update feedback set kitchen_id = null, order_id = null where id in (select id from feedback where kitchen_id is not null or order_id is not null limit v_budget);
    get diagnostics v_n = row_count; v_detached := v_detached + v_n; v_budget := v_budget - v_n;
  end if;
  if v_budget > 0 then
    update params set kitchen_id = null where id in (select id from params where kitchen_id is not null limit v_budget);
    get diagnostics v_n = row_count; v_detached := v_detached + v_n; v_budget := v_budget - v_n;
  end if;
  if v_detached > 0 then
    return jsonb_build_object('ok', true, 'done', false, 'logs_detached', v_detached, 'orders', 0, 'kitchens', 0, 'riders', 0, 'dishes', 0);
  end if;

  -- Slice 2: a batch of orders. Their order events go first; ratings, payments, tracking, trace and push jobs cascade.
  select array_agg(id) into v_ids from (select id from orders limit v_limit) s;
  if v_ids is not null then
    delete from order_events where order_id = any(v_ids);
    delete from orders where id = any(v_ids);
    get diagnostics v_orders = row_count;
    return jsonb_build_object('ok', true, 'done', false, 'logs_detached', 0, 'orders', v_orders, 'kitchens', 0, 'riders', 0, 'dishes', 0);
  end if;

  -- Slice 3: nothing is left to walk, so the small tables go and the call says done.
  delete from rider_pings where true;
  with gone as (delete from riders where true returning 1) select count(*) into v_riders from gone;
  with gone as (delete from menu_items where true returning 1) select count(*) into v_dishes from gone;
  delete from kitchen_staff where true;
  with gone as (delete from kitchens where true returning 1) select count(*) into v_kitchens from gone;
  return jsonb_build_object('ok', true, 'done', true, 'logs_detached', 0, 'orders', 0, 'kitchens', v_kitchens, 'riders', v_riders, 'dishes', v_dishes);
end $$;

revoke all on function sim_clear_all(integer) from public, anon;
grant execute on function sim_clear_all(integer) to authenticated;

-- The slices walk these foreign keys, and so does every delete of a kitchen, an order or a rider; without an index each walk reads the whole table.
-- Checked on goserve-dev with pg_indexes: these twelve had none.
create index if not exists decision_log_kitchen_id_idx on decision_log (kitchen_id);
create index if not exists decision_log_order_id_idx on decision_log (order_id);
create index if not exists feedback_kitchen_id_idx on feedback (kitchen_id);
create index if not exists params_kitchen_id_idx on params (kitchen_id);
create index if not exists run_log_kitchen_id_idx on run_log (kitchen_id);
create index if not exists order_events_order_id_idx on order_events (order_id);
create index if not exists order_events_kitchen_id_idx on order_events (kitchen_id);
create index if not exists orders_kitchen_id_idx on orders (kitchen_id);
create index if not exists orders_rider_id_idx on orders (rider_id);
create index if not exists open_alerts_kitchen_id_idx on open_alerts (kitchen_id);
create index if not exists push_outbox_kitchen_id_idx on push_outbox (kitchen_id);
create index if not exists push_outbox_order_id_idx on push_outbox (order_id);
