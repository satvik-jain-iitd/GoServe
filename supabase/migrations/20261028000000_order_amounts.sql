-- Story #538 (code layer). orders.total_paise means ONE thing: the amount the customer pays (the quote's to_pay_paise). v1 has no fees, so there it is also the
-- item total. v2 keeps the food value in bill.item_total_paise. Cash to collect is the total until the order is paid online, then nothing.
-- The ADR and the list of readers (cash day, numbers, kitchen ticket, rider list) are in the docs PR for #538.
alter table orders add constraint orders_total_is_to_pay
  check (bill is null or (bill ? 'to_pay_paise' and total_paise = (bill ->> 'to_pay_paise')::integer));

-- The food value of an order, v1 or v2.
create function order_item_total_paise(o orders) returns integer
language sql immutable as $$
  select case when o.bill is not null and o.bill ? 'item_total_paise' then (o.bill ->> 'item_total_paise')::integer else o.total_paise end
$$;

-- What the rider must collect at the door: nothing once the order is paid online.
create function order_cash_to_collect_paise(o orders) returns integer
language sql immutable as $$
  select case when o.paid_at is not null then 0 else o.total_paise end
$$;
