-- Story #354 (E27, plan v2 B.18). A customer rates the food and the rider of a delivered order. One rating per order. Only the service role writes (the Edge Function
-- holds that key); nobody reads the table by hand. The older `feedback` table is for testers' reports and is not touched.
-- Refusals are answers, not exceptions: {ok:false, error, message}.
create table order_ratings (
  order_id uuid primary key references orders (id) on delete cascade,
  food_score integer not null check (food_score between 1 and 5),
  rider_score integer check (rider_score between 1 and 5),
  comment text check (comment is null or length(comment) <= 500),
  created_at timestamptz not null default now()
);
alter table order_ratings enable row level security;
revoke all on order_ratings from public, anon, authenticated;

create function rate_order_v2(p_order uuid, p_session text, p_food integer, p_rider integer, p_comment text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders;
begin
  select * into o from orders where id = p_order and session_id = p_session;
  if o.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  if o.status <> 'delivered' then
    return jsonb_build_object('ok', false, 'error', 'not_delivered', 'message', 'You can rate an order once it is delivered.');
  end if;
  if p_food is null or p_food not between 1 and 5 or (p_rider is not null and p_rider not between 1 and 5) then
    return jsonb_build_object('ok', false, 'error', 'invalid_score', 'message', 'Pick 1 to 5.');
  end if;
  if p_comment is not null and length(p_comment) > 500 then
    return jsonb_build_object('ok', false, 'error', 'invalid_comment', 'message', 'Keep the note under 500 letters.');
  end if;
  if p_rider is not null and o.rider_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_rider', 'message', 'This order had no rider to rate.');
  end if;
  insert into order_ratings (order_id, food_score, rider_score, comment) values (o.id, p_food, p_rider, nullif(trim(p_comment), ''))
  on conflict (order_id) do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_rated', 'message', 'You already rated this order.');
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function rate_order_v2(uuid, text, integer, integer, text) from public, anon, authenticated;
grant execute on function rate_order_v2(uuid, text, integer, integer, text) to service_role;
