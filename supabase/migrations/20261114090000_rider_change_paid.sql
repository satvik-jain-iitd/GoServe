-- Story 1448, review of PR 1467: orders.delivered_at, the moment an order turned delivered, set once. updated_at is not that moment:
-- the status trigger sets it on every update, so a Change or the night's hand-over moved it. Additive; safe to run twice.
alter table orders add column if not exists delivered_at timestamptz;
create or replace function orders_set_delivered_at() returns trigger language plpgsql as $$
begin
  if new.status = 'delivered' and new.delivered_at is null and (tg_op = 'INSERT' or old.status is distinct from 'delivered') then
    new.delivered_at := now();
  end if;
  return new;
end $$;
drop trigger if exists orders_delivered_at on orders;
create trigger orders_delivered_at before insert or update on orders for each row execute function orders_set_delivered_at();
-- Older delivered rows: the delivered event when there is one, else updated_at. The status trigger is held off so updated_at keeps its value.
alter table orders disable trigger orders_status_rule;
update orders o set delivered_at = coalesce((select min(e.created_at) from order_events e where e.order_id = o.id and e.event = 'order.delivered'), o.updated_at)
 where o.status = 'delivered' and o.delivered_at is null;
alter table orders enable trigger orders_status_rule;

-- Then: story 1448 (boards DV1, DV2, TC2; owner, 13 Nov 2026): "Change" on the rider's Delivered slip puts a wrong tap between cash and UPI right.
-- Only the order's own rider, only on a delivered order that already has cash or UPI, only to cash or UPI at the door,
-- only when that way is on, and only before the night's hand-over: once the kitchen has stamped any of this rider's cash at or after this delivery, the counted money is closed.
-- Each change leaves one trace line (old and new way), so the owner can see how often a tap was wrong.
create or replace function rider_change_paid(p_order uuid, p_method text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v orders%rowtype;
begin
  if p_method is null or p_method not in ('cash', 'upi_door') then
    return jsonb_build_object('ok', false, 'error', 'bad_method');
  end if;
  select * into v from orders where id = p_order and rider_id = auth.uid() and status = 'delivered' for update;
  if not found or v.paid_by is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v.cash_handed_at is not null or exists (
    select 1 from orders o where o.rider_id = v.rider_id and o.cash_handed_at is not null and o.cash_handed_at >= coalesce(v.delivered_at, v.updated_at)
  ) then
    return jsonb_build_object('ok', false, 'error', 'handed_over');
  end if;
  if not exists (select 1 from settings s, jsonb_array_elements_text(s.value) m where s.name = 'payment_methods' and m = p_method) then
    return jsonb_build_object('ok', false, 'error', 'method_off');   -- the same rule as act_on_order: a way that is off is never recorded
  end if;
  if v.paid_by = p_method then
    return jsonb_build_object('ok', true, 'paid_by', p_method);
  end if;
  update orders set paid_by = p_method where id = v.id;
  perform trace_write(v.id, 'app', 'rider_change_paid', v.paid_by || '>' || p_method, null, null);
  return jsonb_build_object('ok', true, 'paid_by', p_method);
end $$;
revoke execute on function rider_change_paid(uuid, text) from public, anon;
grant execute on function rider_change_paid(uuid, text) to authenticated;
