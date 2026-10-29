-- Owner, 29 Oct 2026 (epic E16): the seeded kitchens and riders stay on prod for the Play testers, and the admin Seed/Reset must switch them fully off.
-- sim_reset (0028) forgot two things that grew later: the pings of a synthetic rider (rider_pings has no foreign key, so they stayed behind as orphans)
-- and a late coupon made for an order on a synthetic kitchen (coupons.order_id is set null on delete, so the coupon stayed). Same body as 0028 plus those two deletes.
-- Orders, trace, outbox, ratings, payments and tracking already follow their order by on delete cascade. PROD: the owner runs this file; DEV only for the coder.
create or replace function sim_reset()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_orders integer; v_dishes integer; v_riders integer; v_kitchens integer;
begin
  perform set_config('goserve.reset', 'on', true);   -- this transaction only
  delete from order_events where kitchen_id in (select id from kitchens where synthetic);
  delete from decision_log where kitchen_id in (select id from kitchens where synthetic);
  delete from run_log where kitchen_id in (select id from kitchens where synthetic);
  delete from feedback where kitchen_id in (select id from kitchens where synthetic);
  delete from params where kitchen_id in (select id from kitchens where synthetic);
  delete from coupons where order_id in (select id from orders where kitchen_id in (select id from kitchens where synthetic));
  with gone as (delete from orders where kitchen_id in (select id from kitchens where synthetic) returning 1) select count(*) into v_orders from gone;
  update orders set rider_id = null where rider_id in (select user_id from riders where synthetic);   -- a real order never has one; belt and braces
  delete from rider_pings where user_id in (select user_id from riders where synthetic);
  with gone as (delete from menu_items where synthetic or kitchen_id in (select id from kitchens where synthetic) returning 1) select count(*) into v_dishes from gone;
  delete from kitchen_staff where kitchen_id in (select id from kitchens where synthetic);
  with gone as (delete from riders where synthetic returning 1) select count(*) into v_riders from gone;
  with gone as (delete from kitchens where synthetic returning 1) select count(*) into v_kitchens from gone;
  return jsonb_build_object('ok', true, 'kitchens', v_kitchens, 'riders', v_riders, 'dishes', v_dishes, 'orders', v_orders);
end $$;
