-- Story #292 (epic E16). Owner, 25 Oct: one menu of 12 dishes with 12 photos (it includes a Veg and a Non-veg Thali for the home screen's Today's thali), served by every one of the ten kitchens (0037 added the Wok House and dropped
-- Green Bowl Co).
-- Photos (#292): every kitchen serves the SAME 12 dishes with the SAME 12 photos (owner: photos cost storage, at most 12 different pictures). The photos come from
-- Openverse (licences cc0, pdm and by only: free commercial use, no share-alike). A CC BY photo is credited in the dish sheet through image_credit (title, creator,
-- licence). scripts/dish_photos.py saves each photo once in the public `menu` bucket and writes one row per dish to dish_photos. That table is reference data like
-- pin_points, so a Reset does not delete it; sim_seed puts the photo back on the dish. A dish with no row keeps no photo. Dishes of the dream kitchens that are not
-- one of the 12 are deleted (orders keep their own copy of their lines, so nothing breaks). Dish ids: md5('dream-dish-<kitchen number>-<dish number>').

create table if not exists dish_photos (
  dish_n integer primary key, image_url text not null, image_credit text not null,
  source_page text not null, title text not null default '', creator text not null default '', license text not null check (license in ('cc0', 'pdm', 'by')),
  license_version text not null default '', fetched_on date not null
);
alter table dish_photos enable row level security;
drop policy if exists dish_photos_read on dish_photos;
create policy dish_photos_read on dish_photos for select using (true);

-- Seed. p: {"riders_per_kitchen":4,"online_pct":70}. Rider ids md5('dream-rider-<n>'). Every row is marked synthetic. Run Reset first on a city that still has
-- the random kitchens of 0028.
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
  v_k jsonb; v_d jsonb; v_kid uuid; v_lat double precision; v_lng double precision; v_n integer; v_j integer; v_i integer; v_kitchens integer;
begin
  perform setseed(0.42);
  v_kitchens := jsonb_array_length(v_city);
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
  for v_i in 1..(v_per * v_kitchens) loop
    select (value->>'lat')::double precision, (value->>'lng')::double precision into v_lat, v_lng
      from jsonb_array_elements(v_city) with ordinality as t(value, ord) where ord = 1 + ((v_i - 1) % v_kitchens);
    insert into riders (user_id, name, phone, online, lat, lng, updated_at, synthetic)
    values (md5('dream-rider-' || v_i)::uuid, coalesce(v_names[v_i], 'Rider ' || v_i), to_char(9000001000 + v_i, 'FM9999999999'), random() * 100 < v_online,
            v_lat + (random() - 0.5) * 0.01, v_lng + (random() - 0.5) * 0.01, now(), true)
    on conflict (user_id) do update set name = excluded.name, phone = excluded.phone, online = excluded.online, lat = excluded.lat, lng = excluded.lng,
      updated_at = now(), synthetic = true;
  end loop;
  return jsonb_build_object('ok', true,
    'kitchens', (select count(*) from kitchens where synthetic), 'kitchens_open', (select count(*) from kitchens where synthetic and open),
    'riders', (select count(*) from riders where synthetic), 'riders_online', (select count(*) from riders where synthetic and online),
    'dishes', (select count(*) from menu_items where synthetic));
end $$;

revoke all on function sim_seed(jsonb) from public, anon, authenticated;
grant execute on function sim_seed(jsonb) to service_role;

-- The dishes of the dream kitchens that are not one of the 12 go.
delete from menu_items m
 where m.synthetic and m.kitchen_id in (select md5('dream-kitchen-' || n)::uuid from generate_series(1, 11) n)
   and m.id not in (select md5('dream-dish-' || n || '-' || d)::uuid from generate_series(1, 11) n, unnest(array[1,3,4,5,6,7,8,9,10,11,13,14]) d);
