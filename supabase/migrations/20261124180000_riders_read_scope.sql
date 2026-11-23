-- Story 944: riders_staff_read let ANY kitchen staff read EVERY rider row (name, phone, location).
-- Now a kitchen reads only the riders on its own orders. The hand-over and cash screens, and the rider
-- line on a ready ticket, read exactly those. Admin still reads all (admin_read), a rider reads own row (riders_own).
-- The customer's rider card goes through order_rider (security definer), not this table.
drop policy if exists riders_staff_read on riders;
create policy riders_staff_read on riders for select to authenticated using (
  exists (select 1 from orders o join kitchen_staff s on s.kitchen_id = o.kitchen_id
           where o.rider_id = riders.user_id and s.user_id = auth.uid()));
