-- Story 944 (epic 1790), payments. rider_refused (the customer refused or is not there) cancelled the order but left its payment row alone:
-- a paid payment stayed 'paid' on a cancelled order, so the money was never marked owed back. Now it follows the same rule as any cancel (story 348):
-- a paid payment becomes refund_due, an unpaid one is closed (failed).
-- This function existed on dev only, in no migration file. Its full body is here now; the first three statements are unchanged from dev.
-- confirm_delivery was tested and is already safe (no payment write, a second call answers already_done), so it is not rebuilt.
create or replace function rider_refused(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v orders;
begin
  select * into v from orders where id = p_order and rider_id = auth.uid() and status = 'out_for_delivery' for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  update orders set status = 'cancelled', cancel_reason = 'refused_at_door' where id = v.id;
  insert into order_events (order_id, kitchen_id, session_id, event, actor) values (v.id, v.kitchen_id, v.session_id, 'order.cancelled', 'rider');
  update payments set status = case when status = 'paid' then 'refund_due' else 'failed' end, updated_at = now() where order_id = v.id and status in ('created', 'paid');
end $$;
