-- Story H5 (#188, epic E16). The synthetic city: fake kitchens, riders and dishes, all marked, seeded and reset by two
-- functions that only the service role may call (n8n GS MAIN 30 Simulator). Customers are never synthetic. No orders are made.
-- Deterministic: the same seed gives the same names, places and ids, so a test can be repeated. Reset deletes synthetic rows only.

alter table kitchens add column if not exists synthetic boolean not null default false;
alter table riders add column if not exists synthetic boolean not null default false;
alter table menu_items add column if not exists synthetic boolean not null default false;
create index if not exists kitchens_synthetic on kitchens (synthetic) where synthetic;
create index if not exists riders_synthetic on riders (synthetic) where synthetic;

-- Seed. p: {"kitchens":10,"riders":20,"dishes_per_kitchen":6,"seed":42,"open_pct":80,"online_pct":70}. Ids are made from the seed and the
-- index, so a second seed with the same values updates the same rows instead of adding more. Pin codes 900001.. (no Indian pin starts with 9).
create or replace function sim_seed(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_k integer := least(greatest(coalesce((p->>'kitchens')::integer, 10), 1), 50);
  v_r integer := least(greatest(coalesce((p->>'riders')::integer, 20), 1), 200);
  v_d integer := least(greatest(coalesce((p->>'dishes_per_kitchen')::integer, 6), 1), 12);
  v_seed integer := coalesce((p->>'seed')::integer, 42);
  v_open integer := least(greatest(coalesce((p->>'open_pct')::integer, 80), 0), 100);
  v_online integer := least(greatest(coalesce((p->>'online_pct')::integer, 70), 0), 100);
  v_areas text[] := array['Hauz Khas','Lajpat Nagar','Saket','Rohini','Dwarka','Janakpuri','Pitampura','Mayur Vihar','Vasant Kunj','Karol Bagh',
    'Rajouri Garden','Greater Kailash','Malviya Nagar','Kalkaji','Preet Vihar','Shalimar Bagh','Model Town','Paschim Vihar','Uttam Nagar','Laxmi Nagar',
    'Punjabi Bagh','Chittaranjan Park','Green Park','Defence Colony','Nehru Place','Okhla','Sarita Vihar','Vikaspuri','Tilak Nagar','Ashok Vihar',
    'Civil Lines','Kamla Nagar','Rajendra Nagar','Patel Nagar','Moti Nagar','Kirti Nagar','Tagore Garden','Subhash Nagar','Najafgarh','Narela'];
  v_kinds text[] := array['Kitchen','Rasoi','Dhaba','Tiffin','Thali House','Bhojnalaya'];
  v_first text[] := array['Amit','Rahul','Sunil','Vikas','Deepak','Ravi','Manoj','Sanjay','Ajay','Rohit','Pawan','Sachin','Mukesh','Dinesh','Ramesh','Suresh','Anil','Vinod','Arun','Naveen'];
  v_last text[] := array['Kumar','Singh','Sharma','Yadav','Verma','Gupta','Mishra','Pandey','Chauhan','Tiwari'];
  v_dishes text[] := array['Dal Makhani','Paneer Butter Masala','Rajma Chawal','Chole Bhature','Aloo Paratha','Kadhi Chawal','Shahi Paneer','Baingan Bharta',
    'Palak Paneer','Mix Veg','Jeera Rice','Butter Naan','Tandoori Roti','Veg Biryani','Chicken Curry','Butter Chicken','Egg Curry','Mutton Rogan Josh',
    'Chicken Biryani','Keema Pav','Dal Tadka','Matar Paneer','Bhindi Masala','Gobi Aloo','Malai Kofta','Kadai Paneer','Paneer Tikka','Veg Pulao',
    'Curd Rice','Khichdi','Poha','Upma','Idli Sambar','Masala Dosa','Pav Bhaji','Vada Pav','Chicken Tikka','Fish Curry','Prawn Masala','Chicken Korma',
    'Gulab Jamun','Kheer','Rasmalai','Gajar Halwa','Lassi','Masala Chai','Chaas','Raita','Papad','Green Salad','Veg Thali','Non-veg Thali','Mini Thali',
    'Sarson Saag','Makki Roti','Litti Chokha','Dal Baati','Pindi Chole','Amritsari Kulcha','Lachha Paratha'];
  v_kid uuid; v_rid uuid; v_name text; v_lat double precision; v_lng double precision; v_i integer; v_j integer; v_pin text;
  v_kitchens uuid[] := '{}';
begin
  perform setseed(((v_seed % 100000)::double precision) / 100000.0);
  for v_i in 1..v_k loop
    v_kid := md5('sim-kitchen-' || v_seed || '-' || v_i)::uuid;
    v_name := v_areas[1 + ((v_i - 1) % array_length(v_areas, 1))] || ' ' || v_kinds[1 + ((v_i * 7) % array_length(v_kinds, 1))];
    v_lat := 28.50 + random() * 0.22;   -- Delhi box, roughly 28.50 to 28.72 north
    v_lng := 77.05 + random() * 0.30;   -- 77.05 to 77.35 east
    v_pin := to_char(900000 + v_i, 'FM999999');
    insert into kitchens (id, session_id, name, address, phone, lat, lng, pin_codes, open, active, opens_at, closes_at, synthetic)
    values (v_kid, 'sim', v_name, v_areas[1 + ((v_i - 1) % array_length(v_areas, 1))] || ', New Delhi', to_char(9000000000 + v_i, 'FM9999999999'),
            v_lat, v_lng, array[v_pin], random() * 100 < v_open, true, '11:00', '23:00', true)
    on conflict (id) do update set name = excluded.name, address = excluded.address, phone = excluded.phone, lat = excluded.lat, lng = excluded.lng,
      pin_codes = excluded.pin_codes, open = excluded.open, active = true, synthetic = true;
    v_kitchens := v_kitchens || v_kid;
    for v_j in 1..v_d loop
      insert into menu_items (id, kitchen_id, session_id, name, price_paise, available, category, veg, sort, synthetic)
      values (md5('sim-dish-' || v_seed || '-' || v_i || '-' || v_j)::uuid, v_kid, 'sim',
              v_dishes[1 + (((v_i - 1) * v_d + (v_j - 1)) % array_length(v_dishes, 1))], (8 + floor(random() * 25)::integer) * 1000, true,
              case when v_j <= 2 then 'Mains' when v_j <= 4 then 'Breads and rice' else 'Sides' end, true, v_j, true)
      on conflict (id) do update set name = excluded.name, price_paise = excluded.price_paise, available = true, synthetic = true;
    end loop;
  end loop;
  for v_i in 1..v_r loop
    v_rid := md5('sim-rider-' || v_seed || '-' || v_i)::uuid;
    v_kid := v_kitchens[1 + ((v_i - 1) % v_k)];
    select lat, lng into v_lat, v_lng from kitchens where id = v_kid;
    insert into riders (user_id, name, phone, online, lat, lng, updated_at, synthetic)
    values (v_rid, v_first[1 + ((v_i - 1) % array_length(v_first, 1))] || ' ' || v_last[1 + ((v_i * 3) % array_length(v_last, 1))],
            to_char(9000001000 + v_i, 'FM9999999999'), random() * 100 < v_online,
            v_lat + (random() - 0.5) * 0.01, v_lng + (random() - 0.5) * 0.01, now(), true)
    on conflict (user_id) do update set name = excluded.name, phone = excluded.phone, online = excluded.online, lat = excluded.lat, lng = excluded.lng,
      updated_at = now(), synthetic = true;
  end loop;
  return jsonb_build_object('ok', true, 'seed', v_seed,
    'kitchens', (select count(*) from kitchens where synthetic), 'kitchens_open', (select count(*) from kitchens where synthetic and open),
    'riders', (select count(*) from riders where synthetic), 'riders_online', (select count(*) from riders where synthetic and online),
    'dishes', (select count(*) from menu_items where synthetic));
end $$;

-- Reset: every synthetic row goes, and nothing else. Orders on a synthetic kitchen (there should be none) go first with their events and
-- decisions, so the keys hold; the frozen order_events trigger lets the delete through only while goserve.reset is on (migration 0006).
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
  with gone as (delete from orders where kitchen_id in (select id from kitchens where synthetic) returning 1) select count(*) into v_orders from gone;
  update orders set rider_id = null where rider_id in (select user_id from riders where synthetic);   -- a real order never has one; belt and braces
  with gone as (delete from menu_items where synthetic or kitchen_id in (select id from kitchens where synthetic) returning 1) select count(*) into v_dishes from gone;
  delete from kitchen_staff where kitchen_id in (select id from kitchens where synthetic);
  with gone as (delete from riders where synthetic returning 1) select count(*) into v_riders from gone;
  with gone as (delete from kitchens where synthetic returning 1) select count(*) into v_kitchens from gone;
  return jsonb_build_object('ok', true, 'kitchens', v_kitchens, 'riders', v_riders, 'dishes', v_dishes, 'orders', v_orders);
end $$;

-- The two cities never mix (review of #258): a rider is a candidate only for a kitchen of the same kind, and assign_rider refuses a mismatch
-- with the same rider_not_available the n8n SUB 19 already handles. Same bodies as migration 0018 plus the one match on `synthetic`.
create or replace function dispatch_candidates(p_order uuid) returns jsonb
language plpgsql stable as $$
declare
  v_order orders;
  v_kitchen kitchens;
begin
  select * into v_order from orders where id = p_order;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  select * into v_kitchen from kitchens where id = v_order.kitchen_id;
  return jsonb_build_object('riders', coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'free', c.free, 'distance_m', c.distance_m, 'trips_done', c.trips_done) order by c.distance_m, c.trips_done)
    from (
      select r.user_id::text as id,
             not exists (select 1 from orders o where o.rider_id = r.user_id and o.status in ('ready', 'out_for_delivery')) as free,
             case when r.lat is null or v_kitchen.lat is null then 0 else round(distance_m(v_kitchen.lat, v_kitchen.lng, r.lat, r.lng))::integer end as distance_m,
             (select count(*) from orders o where o.rider_id = r.user_id and o.status in ('out_for_delivery', 'delivered')
                and (o.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)::integer as trips_done
      from riders r where r.online and r.synthetic = v_kitchen.synthetic
      order by 3, 4
      limit 10
    ) c), '[]'::jsonb));
end $$;

create or replace function assign_rider(p_order uuid, p_rider uuid) returns jsonb
language plpgsql as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order for update;
  if v_order.id is null then
    raise exception 'order_not_found';
  end if;
  if v_order.rider_id = p_rider then
    return jsonb_build_object('order', to_jsonb(v_order));
  end if;
  if v_order.status <> 'ready' or v_order.rider_id is not null then
    raise exception 'not_ready';
  end if;
  if not exists (select 1 from riders r join kitchens k on k.id = v_order.kitchen_id
                 where r.user_id = p_rider and r.online and r.synthetic = k.synthetic) then
    raise exception 'rider_not_available';
  end if;
  update orders set rider_id = p_rider where id = v_order.id returning * into v_order;
  insert into order_events (order_id, kitchen_id, session_id, event, actor)
  values (v_order.id, v_order.kitchen_id, v_order.session_id, 'order.assigned', 'dispatch');
  return jsonb_build_object('order', to_jsonb(v_order));
end $$;

revoke all on function sim_seed(jsonb) from public, anon, authenticated;
revoke all on function sim_reset() from public, anon, authenticated;
grant execute on function sim_seed(jsonb) to service_role;
grant execute on function sim_reset() to service_role;
