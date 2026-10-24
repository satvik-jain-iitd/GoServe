-- Story #229 (F147, epic E20). The evening hand-over: the kitchen confirms a rider's cash. Each cash order the rider delivered and
-- still holds is stamped cash_handed_at, so "Cash in hand" on the rider's Today and on the kitchen's Kitchen tab drop to the same number.
-- The cash day itself (a 23:30 delivery seen at 00:10) is a client rule bound to the kitchen's closing time; nothing to store.

alter table orders add column if not exists cash_handed_at timestamptz null;

-- Only staff of the kitchen may confirm, and only for that kitchen's orders. Returns how many orders were stamped.
create or replace function kitchen_handover(p_rider uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_kitchen uuid;
  v_n integer;
begin
  select kitchen_id into v_kitchen from kitchen_staff where user_id = auth.uid() limit 1;
  if v_kitchen is null then
    raise exception 'not_allowed';
  end if;
  update orders
     set cash_handed_at = now()
   where kitchen_id = v_kitchen
     and rider_id = p_rider
     and status = 'delivered'
     and cash_handed_at is null
     and (paid_by is null or paid_by = 'cash');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function kitchen_handover(uuid) from public;
grant execute on function kitchen_handover(uuid) to authenticated;
