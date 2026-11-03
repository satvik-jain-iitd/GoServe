-- Story #848 (epic E32), board A-Sim-Groups, approved 2026-11-04. The admin Simulator seeds the kitchens and the riders as two groups.
-- sim_seed takes p.part: 'kitchens' or 'riders' seeds that group only; missing or anything else seeds both, so the old Seed still works.
-- Same body as migration 0038 plus the part switch. sim_status also says how many kitchens and riders are real, and whether Clear is allowed here.

create or replace function sim_seed(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_per integer := least(greatest(coalesce((p->>'riders_per_kitchen')::integer, 4), 1), 20);
  v_online integer := least(greatest(coalesce((p->>'online_pct')::integer, 70), 0), 100);
  v_names text[] := array['Sachin Tendulkar', 'Virat Kohli', 'Kapil Dev', 'MS Dhoni', 'Sunil Gavaskar', 'Rahul Dravid', 'Sourav Ganguly', 'Mithali Raj', 'PV Sindhu', 'Mary Kom', 'Neeraj Chopra', 'Milkha Singh', 'Dhyan Chand', 'Abhinav Bindra', 'Saina Nehwal', 'Vishwanathan Anand', 'APJ Abdul Kalam', 'CV Raman', 'Homi Bhabha', 'Vikram Sarabhai', 'Srinivasa Ramanujan', 'Satyendra Nath Bose', 'Kalpana Chawla', 'Jagadish Chandra Bose', 'Amitabh Bachchan', 'Shah Rukh Khan', 'Dilip Kumar', 'Raj Kapoor', 'Madhubala', 'Nargis', 'Lata Mangeshkar', 'Kishore Kumar', 'Mohammed Rafi', 'Asha Bhosle', 'AR Rahman', 'Satyajit Ray', 'Ravi Shankar', 'Zakir Hussain', 'Bismillah Khan', 'Rabindranath Tagore'];
  v_city jsonb := $city$[
    {"n": 1, "name": "Dilli-6 Kebab Ghar", "address": "Near Jama Masjid, Old Delhi", "lat": 28.6507, "lng": 77.2334, "opens": "12:00", "closes": "23:00", "pins": ["110006", "110002", "110092"]},
    {"n": 2, "name": "Gali Parantha Rasoi", "address": "Chandni Chowk, Old Delhi", "lat": 28.6562, "lng": 77.23, "opens": "08:00", "closes": "22:00", "pins": ["110006", "110007", "110054", "110092"]},
    {"n": 3, "name": "Punjab Da Dhaba", "address": "Rajouri Garden, West Delhi", "lat": 28.6492, "lng": 77.1219, "opens": "11:00", "closes": "23:30", "pins": ["110027", "110018", "110064"]},
    {"n": 4, "name": "Madras Tiffin Room", "address": "Lajpat Nagar, South Delhi", "lat": 28.5677, "lng": 77.2433, "opens": "07:30", "closes": "22:00", "pins": ["110024", "110014", "110049"]},
    {"n": 5, "name": "Bhodro Bangali", "address": "Chittaranjan Park, South Delhi", "lat": 28.5384, "lng": 77.248, "opens": "11:00", "closes": "22:30", "pins": ["110019", "110048", "110020"]},
    {"n": 6, "name": "Tilla Momo House", "address": "Majnu ka Tilla, North Delhi", "lat": 28.6995, "lng": 77.2285, "opens": "11:00", "closes": "22:00", "pins": ["110054", "110009", "110007"]},
    {"n": 7, "name": "Karol Bagh Chaat Corner", "address": "Karol Bagh, Central Delhi", "lat": 28.6514, "lng": 77.1907, "opens": "10:00", "closes": "22:00", "pins": ["110005", "110055", "110060"]},
    {"n": 8, "name": "Nizam Dum Biryani", "address": "Nizamuddin, South-Central Delhi", "lat": 28.5886, "lng": 77.2509, "opens": "12:00", "closes": "23:30", "pins": ["110013", "110003", "110014", "110092"]},
    {"n": 9, "name": "Thali Ghar CP", "address": "Connaught Place, Central Delhi", "lat": 28.6315, "lng": 77.2167, "opens": "11:30", "closes": "22:30", "pins": ["110001", "110002", "110055", "110092"]},
    {"n": 11, "name": "Laxmi Nagar Wok House", "address": "Laxmi Nagar, East Delhi", "lat": 28.6304, "lng": 77.2773, "opens": "11:00", "closes": "23:00", "pins": ["110092", "110091", "110051"]}
  ]$city$;
  v_menu jsonb := $menu$[
    [1, "Butter Chicken", "Mains", false, 340],
    [3, "Dal Makhani", "Mains", true, 240],
    [4, "Chole Bhature", "Mains", true, 130],
    [5, "Amritsari Kulcha", "Breads", true, 90],
    [6, "Veg Fried Rice", "Rice", true, 150],
    [7, "Samosa (2)", "Snacks", true, 40],
    [8, "Gulab Jamun (2)", "Sweets", true, 60],
    [9, "Masala Chai", "Drinks", true, 30],
    [10, "Sweet Lassi", "Drinks", true, 80],
    [11, "Aloo Parantha", "Breads", true, 70],
    [13, "Veg Thali", "Thali", true, 199],
    [14, "Non-veg Thali", "Thali", false, 279]
  ]$menu$;
  v_part text := coalesce(p->>'part', 'both');   -- #848: 'kitchens' or 'riders' seeds one group; anything else seeds both, as before
  v_k jsonb; v_d jsonb; v_kid uuid; v_lat double precision; v_lng double precision; v_n integer; v_j integer; v_i integer; v_kitchens integer;
begin
  perform setseed(0.42);
  v_kitchens := jsonb_array_length(v_city);
  if v_part in ('both', 'kitchens') then
  for v_k in select value from jsonb_array_elements(v_city) loop
    v_n := (v_k->>'n')::integer;   -- the id comes from the kitchen's own number, so dropping one never moves another
    v_kid := md5('dream-kitchen-' || v_n)::uuid;
    insert into kitchens (id, session_id, name, address, phone, lat, lng, pin_codes, open, active, opens_at, closes_at, synthetic)
    values (v_kid, 'sim', v_k->>'name', v_k->>'address', to_char(9000000000 + v_n, 'FM9999999999'), (v_k->>'lat')::double precision, (v_k->>'lng')::double precision,
            array(select jsonb_array_elements_text(v_k->'pins')), true, true, (v_k->>'opens')::time, (v_k->>'closes')::time, true)
    on conflict (id) do update set name = excluded.name, address = excluded.address, phone = excluded.phone, lat = excluded.lat, lng = excluded.lng,
      pin_codes = excluded.pin_codes, open = true, active = true, opens_at = excluded.opens_at, closes_at = excluded.closes_at, synthetic = true;
    for v_d in select value from jsonb_array_elements(v_menu) loop
      v_j := (v_d->>0)::integer;
      insert into menu_items (id, kitchen_id, session_id, name, price_paise, available, category, veg, sort, synthetic, image_url, image_credit)
      values (md5('dream-dish-' || v_n || '-' || v_j)::uuid, v_kid, 'sim', v_d->>1, (v_d->>4)::integer * 100, true, v_d->>2, (v_d->>3)::boolean, v_j, true,
              (select p.image_url from dish_photos p where p.dish_n = v_j), (select p.image_credit from dish_photos p where p.dish_n = v_j))
      on conflict (id) do update set name = excluded.name, price_paise = excluded.price_paise, available = true, category = excluded.category,
        veg = excluded.veg, sort = excluded.sort, synthetic = true, image_url = excluded.image_url, image_credit = excluded.image_credit;
    end loop;
  end loop;
  end if;
  if v_part in ('both', 'riders') then
  for v_i in 1..(v_per * v_kitchens) loop
    select (value->>'lat')::double precision, (value->>'lng')::double precision into v_lat, v_lng
      from jsonb_array_elements(v_city) with ordinality as t(value, ord) where ord = 1 + ((v_i - 1) % v_kitchens);
    insert into riders (user_id, name, phone, online, lat, lng, updated_at, synthetic)
    values (md5('dream-rider-' || v_i)::uuid, coalesce(v_names[v_i], 'Rider ' || v_i), to_char(9000001000 + v_i, 'FM9999999999'), random() * 100 < v_online,
            v_lat + (random() - 0.5) * 0.01, v_lng + (random() - 0.5) * 0.01, now(), true)
    on conflict (user_id) do update set name = excluded.name, phone = excluded.phone, online = excluded.online, lat = excluded.lat, lng = excluded.lng,
      updated_at = now(), synthetic = true;
  end loop;
  end if;
  return jsonb_build_object('ok', true,
    'kitchens', (select count(*) from kitchens where synthetic), 'kitchens_open', (select count(*) from kitchens where synthetic and open),
    'riders', (select count(*) from riders where synthetic), 'riders_online', (select count(*) from riders where synthetic and online),
    'dishes', (select count(*) from menu_items where synthetic));
end $$;

revoke all on function sim_seed(jsonb) from public, anon, authenticated;
grant execute on function sim_seed(jsonb) to service_role;

create or replace function sim_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true,
    'enabled', coalesce((select (value->>'enabled')::boolean from params where session_id = 'global' and key = 'sim_enabled' order by version desc limit 1), false),
    'kitchens', (select count(*) from kitchens where synthetic), 'kitchens_open', (select count(*) from kitchens where synthetic and open),
    'riders', (select count(*) from riders where synthetic), 'riders_online', (select count(*) from riders where synthetic and online),
    'dishes', (select count(*) from menu_items where synthetic),
    'kitchens_real', (select count(*) from kitchens where not synthetic), 'riders_real', (select count(*) from riders where not synthetic),
    'clear_allowed', coalesce((select (value #>> '{}')::boolean from settings where name = 'clear_allowed'), false))
$$;

-- "Clear everything" (board A-Sim-Clear, dev only). The owner, 4 Nov 2026: remove all kitchens, riders, dishes and orders, the hand-made ones too;
-- the run log and the decision log stay, every row. Their kitchen and order keys are set to null so the rows outlive the kitchen (decision_log.kitchen_id was NOT NULL).
-- Accounts, settings, params, feedback, coupons, dish_photos and pin_points stay. It is a function the signed-in admin calls, never the simulator token,
-- and it refuses unless the settings row clear_allowed is true. That row is set by hand on dev and never on prod; this migration does not insert it.
alter table decision_log alter column kitchen_id drop not null;

create or replace function sim_clear_all()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_orders integer; v_dishes integer; v_riders integer; v_kitchens integer;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if not coalesce((select (value #>> '{}')::boolean from settings where name = 'clear_allowed'), false) then
    return jsonb_build_object('ok', false, 'error', 'clear_not_allowed', 'message', 'Clear everything is switched off on this database.');
  end if;
  perform set_config('goserve.reset', 'on', true);   -- this transaction only: order_events are frozen except for this
  update decision_log set kitchen_id = null, order_id = null where kitchen_id is not null or order_id is not null;
  update run_log set kitchen_id = null where kitchen_id is not null;
  update feedback set kitchen_id = null, order_id = null where kitchen_id is not null or order_id is not null;
  update params set kitchen_id = null where kitchen_id is not null;
  delete from order_events;
  with gone as (delete from orders returning 1) select count(*) into v_orders from gone;
  delete from rider_pings;
  with gone as (delete from riders returning 1) select count(*) into v_riders from gone;
  with gone as (delete from menu_items returning 1) select count(*) into v_dishes from gone;
  delete from kitchen_staff;
  with gone as (delete from kitchens returning 1) select count(*) into v_kitchens from gone;
  return jsonb_build_object('ok', true, 'kitchens', v_kitchens, 'riders', v_riders, 'dishes', v_dishes, 'orders', v_orders);
end $$;

revoke all on function sim_clear_all() from public, anon;
grant execute on function sim_clear_all() to authenticated;
