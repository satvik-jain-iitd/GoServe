-- Story #1017: who cancelled an order is a recorded fact, not a guess from the reason text.
-- Before: the customer screen called an order Declined when it had any cancel_reason, and cancel_order (story #904) wrote 'cancelled by customer' as the customer's reason,
-- so every customer cancel read as a kitchen decline. Now orders.cancelled_by holds customer, kitchen, admin or rider; cancel_order sets it from the actor it already works out;
-- the customer's own cancel stores no made-up reason; a trigger covers every other path (the rider's refusal at the door, the simulator).
alter table orders add column if not exists cancelled_by text;
alter table orders drop constraint if exists orders_cancelled_by_values;
alter table orders add constraint orders_cancelled_by_values check (cancelled_by is null or cancelled_by in ('customer', 'kitchen', 'admin', 'rider'));

-- Old rows: the event log already holds the actor; the reason text is the fallback.
update orders o set cancelled_by = coalesce(
  (select e.actor from order_events e where e.order_id = o.id and e.event = 'order.cancelled' and e.actor in ('customer', 'kitchen', 'admin') order by e.created_at desc limit 1),
  case when o.cancel_reason = 'refused_at_door' then 'rider' when o.cancel_reason = 'cancelled by customer' then 'customer' when o.cancel_reason is not null then 'kitchen' else 'customer' end)
where o.status = 'cancelled' and o.cancelled_by is null;
-- The made-up text goes: the actor is the fact.
update orders set cancel_reason = null where cancelled_by = 'customer' and cancel_reason = 'cancelled by customer';

create or replace function cancel_order(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders;
  v_actor text;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v from orders where id = p_order for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  v_actor := case when v.session_id = auth.uid()::text then 'customer' when is_admin() then 'admin' when is_my_kitchen(v.kitchen_id) then 'kitchen' end;
  if v_actor is null then
    raise exception 'not_allowed';
  end if;
  if v.status not in ('placed', 'accepted') then
    raise exception 'cannot_cancel: %', v.status;
  end if;
  if v_actor <> 'customer' and v_reason is null then
    raise exception 'reason_required';
  end if;
  update orders set status = 'cancelled', cancel_reason = v_reason, cancelled_by = v_actor where id = v.id returning * into v;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'order.cancelled', v_actor);
  return jsonb_build_object('order', to_jsonb(v));
end $$;
revoke execute on function cancel_order(uuid, text) from public, anon;
grant execute on function cancel_order(uuid, text) to authenticated;

-- Every other way an order becomes cancelled (the rider's refusal at the door, the simulator) names its actor from the reason it already writes.
create or replace function orders_set_cancelled_by() returns trigger language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.cancelled_by is null then
    new.cancelled_by := case when new.cancel_reason = 'refused_at_door' then 'rider' when new.cancel_reason is not null then 'kitchen' else 'customer' end;
  end if;
  return new;
end $$;
drop trigger if exists orders_cancelled_by_t on orders;
create trigger orders_cancelled_by_t before update on orders for each row execute function orders_set_cancelled_by();
