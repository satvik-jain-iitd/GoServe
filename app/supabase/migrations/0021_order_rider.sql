-- Story D2 (#161, epic E13). The rider card: once a rider has the order, its customer may see the rider's first name and phone, to call.
-- Only the owner of the order (its session) gets an answer, and only while the order is ready or on the way. Riders stay unreadable otherwise (RLS on riders is unchanged).

create function order_rider(p_order uuid) returns table (name text, phone text)
language sql stable security definer set search_path = public as $$
  select split_part(coalesce(nullif(trim(r.name), ''), 'Your rider'), ' ', 1), r.phone
    from orders o join riders r on r.user_id = o.rider_id
   where o.id = p_order and o.session_id = auth.uid()::text and o.status in ('ready', 'out_for_delivery') and r.phone is not null
$$;
revoke execute on function order_rider(uuid) from public, anon;
grant execute on function order_rider(uuid) to authenticated;
