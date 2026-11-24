-- Story 1319 review fix. A money-due order (money_due_reason set) never gets a way of paying written later.
-- confirm_delivery already writes no paid_by (checked on dev), but after the customer's Yes the rider's deliver step records the method once
-- (act_on_order, story 1293), which would turn "money not collected" into cash. One guard on the table closes every writer: while money_due_reason is set, paid_by stays empty.
create or replace function orders_money_due_keeps_paid_by() returns trigger language plpgsql as $$
begin
  if new.money_due_reason is not null and old.paid_by is null then
    new.paid_by := null;
  end if;
  return new;
end $$;
drop trigger if exists orders_money_due_keeps_paid_by on orders;
create trigger orders_money_due_keeps_paid_by before update on orders for each row execute function orders_money_due_keeps_paid_by();
