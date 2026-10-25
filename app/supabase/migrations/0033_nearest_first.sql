-- Story #272 (epic E23, from follow-up F178 and the E9 control arm). Per-order mode: when an order is ready, the NEAREST free rider gets it.
-- Trips today break a tie only between riders within `near_band_m` (500 m) of the nearest one. Before this, the rule took the rider with the fewest trips first, even a
-- far one (SUB 13). The rule lives here, in SQL, as a rank; the n8n guard just follows the rank. Real and synthetic still never mix.
-- A rider with no place on the map, or with a ping older than `fresh_ping_s`, ranks after the ones that have both; if nobody is fresh the stale riders still count, by distance only (no band).

insert into params (kitchen_id, session_id, key, value, version)
values (null, 'global', 'per_order_rules', '{"near_band_m":500,"fresh_ping_s":90}', 1)
on conflict (session_id, key, version) do nothing;

create or replace function dispatch_candidates(p_order uuid) returns jsonb
language plpgsql stable as $$
declare
  v_order orders;
  v_kitchen kitchens;
  v_rules jsonb := coalesce((select value from params where session_id = 'global' and key = 'per_order_rules' order by version desc limit 1), '{}'::jsonb);
  v_band double precision := coalesce((v_rules ->> 'near_band_m')::double precision, 500);
  v_fresh double precision := coalesce((v_rules ->> 'fresh_ping_s')::double precision, 90);
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if dispatch_batch_on() then
    return jsonb_build_object('riders', '[]'::jsonb, 'batch', true);
  end if;
  select * into v_kitchen from kitchens where id = v_order.kitchen_id;
  return jsonb_build_object('riders', coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'free', c.free, 'distance_m', c.distance_m, 'trips_done', c.trips_done, 'rank', c.rank) order by c.rank)
    from (
      select u.*, row_number() over (
               order by (not u.free), (not u.usable), case when u.in_band then 0 else 1 end,
                        case when u.in_band or not u.usable then u.trips_done end, u.distance_m, u.id) as rank
      from (
        select b.*, (b.usable and b.free and b.distance_m <= min(b.distance_m) filter (where b.usable and b.free) over () + case when b.fresh_any then v_band else 0 end) as in_band
        from (
          select r.user_id::text as id,
                 not exists (select 1 from orders o where o.rider_id = r.user_id and o.status in ('ready', 'out_for_delivery')) as free,
                 case when r.lat is null or v_kitchen.lat is null then 999999 else round(distance_m(v_kitchen.lat, v_kitchen.lng, r.lat, r.lng))::integer end as distance_m,
                 (select count(*) from orders o where o.rider_id = r.user_id and o.status in ('out_for_delivery', 'delivered')
                    and (o.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)::integer as trips_done,
                 (r.lat is not null and v_kitchen.lat is not null and (extract(epoch from now() - r.updated_at) <= v_fresh or not bool_or(r.lat is not null and extract(epoch from now() - r.updated_at) <= v_fresh) over ())) as usable,
                 coalesce(bool_or(r.lat is not null and extract(epoch from now() - r.updated_at) <= v_fresh) over (), false) as fresh_any
          from riders r where r.online and r.synthetic = v_kitchen.synthetic
        ) b
      ) u
      order by rank
      limit 10
    ) c), '[]'::jsonb));
end $$;

revoke execute on function dispatch_candidates(uuid) from public, anon, authenticated;
grant execute on function dispatch_candidates(uuid) to service_role;
