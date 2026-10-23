-- Story A4 (#151, epic E8). The day's numbers per kitchen, from one view. The day is the day in India.
-- security_invoker: the view reads orders as the caller, so row level security decides what is counted: an admin sees every kitchen,
-- a kitchen's staff see their own kitchen, anyone else sees only their own orders. anon gets nothing.
create view day_numbers with (security_invoker = true) as
select (o.created_at at time zone 'Asia/Kolkata')::date as day,
       o.kitchen_id,
       k.name as kitchen_name,
       count(*)::integer as orders,
       (count(*) filter (where o.status = 'delivered'))::integer as delivered,
       (count(*) filter (where o.status = 'cancelled'))::integer as cancelled,
       coalesce(sum(o.total_paise) filter (where o.status = 'delivered' and o.paid_by = 'cash'), 0)::bigint as cash_paise
from orders o join kitchens k on k.id = o.kitchen_id
group by 1, 2, 3;
revoke all on day_numbers from public, anon;
grant select on day_numbers to authenticated;
