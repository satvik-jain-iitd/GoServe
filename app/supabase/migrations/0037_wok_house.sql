-- Story #290 (epic E16). An eleventh dream kitchen for East Delhi: Laxmi Nagar Wok House (Indo-Chinese), id md5('dream-kitchen-11'), pins 110092, 110091,
-- 110051, 12 dishes. Owner, 25 Oct: exactly ten kitchens, so Green Bowl Co (number 10) leaves the list and its ids stay unused (40 riders, four per kitchen). Prod already has this kitchen and the two pins from the owner's own SQL of 25 Oct,
-- so the pins go in with `on conflict do nothing` and prod keeps its values; the seed brings the kitchen back after a Reset. Closes follow-up F186.

insert into pin_points (pin, lat, lng) values
  ('110051', 28.656, 77.28),
  ('110091', 28.604, 77.297)
on conflict (pin) do nothing;

-- Seed. p: {"riders_per_kitchen":4,"online_pct":70}. Kitchen ids md5('dream-kitchen-<n>'), dish ids md5('dream-dish-<n>-<m>'), rider ids
-- md5('dream-rider-<n>'). Every row is marked synthetic. On a city that still has the random kitchens of 0028, run Reset first.
create or replace function sim_seed(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_per integer := least(greatest(coalesce((p->>'riders_per_kitchen')::integer, 4), 1), 20);
  v_online integer := least(greatest(coalesce((p->>'online_pct')::integer, 70), 0), 100);
  v_names text[] := array['Sachin Tendulkar', 'Virat Kohli', 'Kapil Dev', 'MS Dhoni', 'Sunil Gavaskar', 'Rahul Dravid', 'Sourav Ganguly', 'Mithali Raj', 'PV Sindhu', 'Mary Kom', 'Neeraj Chopra', 'Milkha Singh', 'Dhyan Chand', 'Abhinav Bindra', 'Saina Nehwal', 'Vishwanathan Anand', 'APJ Abdul Kalam', 'CV Raman', 'Homi Bhabha', 'Vikram Sarabhai', 'Srinivasa Ramanujan', 'Satyendra Nath Bose', 'Kalpana Chawla', 'Jagadish Chandra Bose', 'Amitabh Bachchan', 'Shah Rukh Khan', 'Dilip Kumar', 'Raj Kapoor', 'Madhubala', 'Nargis', 'Lata Mangeshkar', 'Kishore Kumar', 'Mohammed Rafi', 'Asha Bhosle', 'AR Rahman', 'Satyajit Ray', 'Ravi Shankar', 'Zakir Hussain', 'Bismillah Khan', 'Rabindranath Tagore'];
  v_city jsonb := $city$[
    {"n": 1, "name": "Dilli-6 Kebab Ghar", "address": "Near Jama Masjid, Old Delhi", "lat": 28.6507, "lng": 77.2334, "opens": "12:00", "closes": "23:00", "pins": ["110006", "110002", "110092"], "dishes": [["Mutton Seekh Kebab", "Kebabs", false, 260], ["Mutton Burra", "Kebabs", false, 450], ["Chicken Tikka", "Kebabs", false, 300], ["Chicken Seekh Kebab", "Kebabs", false, 240], ["Paneer Tikka", "Kebabs", true, 260], ["Mutton Korma", "Curries", false, 380], ["Mutton Nihari", "Curries", false, 330], ["Butter Chicken", "Curries", false, 320], ["Chicken Changezi", "Curries", false, 340], ["Mutton Biryani", "Rice", false, 380], ["Sheermal", "Breads", true, 40], ["Roomali Roti", "Breads", true, 20], ["Tandoori Roti", "Breads", true, 15], ["Phirni", "Sweets", true, 80]]},
    {"n": 2, "name": "Gali Parantha Rasoi", "address": "Chandni Chowk, Old Delhi", "lat": 28.6562, "lng": 77.23, "opens": "08:00", "closes": "22:00", "pins": ["110006", "110007", "110054", "110092"], "dishes": [["Aloo Parantha", "Paranthas", true, 70], ["Gobhi Parantha", "Paranthas", true, 80], ["Mattar Parantha", "Paranthas", true, 80], ["Paneer Parantha", "Paranthas", true, 100], ["Mooli Parantha", "Paranthas", true, 75], ["Mixed Veg Parantha", "Paranthas", true, 90], ["Lachha Parantha", "Paranthas", true, 60], ["Rabri Parantha", "Sweets", true, 90], ["Parantha Thali (2 paranthas, sabzi, chutney, pickle)", "Thali", true, 160], ["Aloo Sabzi", "Sides", true, 60], ["Dahi", "Sides", true, 40], ["Sweet Lassi", "Drinks", true, 70], ["Masala Chai", "Drinks", true, 30], ["Gajar Halwa", "Sweets", true, 90]]},
    {"n": 3, "name": "Punjab Da Dhaba", "address": "Rajouri Garden, West Delhi", "lat": 28.6492, "lng": 77.1219, "opens": "11:00", "closes": "23:30", "pins": ["110027", "110018", "110064"], "dishes": [["Dal Makhani", "Mains", true, 240], ["Paneer Butter Masala", "Mains", true, 280], ["Butter Chicken", "Mains", false, 340], ["Chicken Curry", "Mains", false, 300], ["Sarson Ka Saag", "Mains", true, 220], ["Makki Ki Roti", "Breads", true, 50], ["Butter Naan", "Breads", true, 55], ["Tandoori Roti", "Breads", true, 20], ["Lachha Parantha", "Breads", true, 50], ["Amritsari Kulcha", "Breads", true, 90], ["Jeera Rice", "Rice", true, 140], ["Boondi Raita", "Sides", true, 70], ["Punjabi Lassi", "Drinks", true, 90], ["Dhaba Thali", "Thali", true, 280]]},
    {"n": 4, "name": "Madras Tiffin Room", "address": "Lajpat Nagar, South Delhi", "lat": 28.5677, "lng": 77.2433, "opens": "07:30", "closes": "22:00", "pins": ["110024", "110014", "110049"], "dishes": [["Idli Sambar (2)", "Tiffin", true, 90], ["Medu Vada (2)", "Tiffin", true, 100], ["Plain Dosa", "Dosa", true, 110], ["Masala Dosa", "Dosa", true, 140], ["Rava Dosa", "Dosa", true, 150], ["Mysore Masala Dosa", "Dosa", true, 160], ["Onion Uttapam", "Dosa", true, 130], ["Ven Pongal", "Tiffin", true, 120], ["Rava Upma", "Tiffin", true, 100], ["Curd Rice", "Rice", true, 120], ["Lemon Rice", "Rice", true, 120], ["Filter Coffee", "Drinks", true, 60], ["Payasam", "Sweets", true, 90], ["South Indian Thali", "Thali", true, 260]]},
    {"n": 5, "name": "Bhodro Bangali", "address": "Chittaranjan Park, South Delhi", "lat": 28.5384, "lng": 77.248, "opens": "11:00", "closes": "22:30", "pins": ["110019", "110048", "110020"], "dishes": [["Kosha Mangsho", "Mains", false, 300], ["Macher Jhol", "Mains", false, 260], ["Bhetki Paturi", "Mains", false, 380], ["Chingri Malai Curry", "Mains", false, 420], ["Egg Roll", "Rolls", false, 90], ["Chicken Kathi Roll", "Rolls", false, 130], ["Luchi (4)", "Breads", true, 80], ["Aloo Dum", "Mains", true, 130], ["Basanti Pulao", "Rice", true, 160], ["Bengali Fish Thali", "Thali", false, 280], ["Bengali Veg Thali", "Thali", true, 220], ["Mishti Doi", "Sweets", true, 80], ["Rasgulla (2)", "Sweets", true, 70], ["Sandesh (2)", "Sweets", true, 90]]},
    {"n": 6, "name": "Tilla Momo House", "address": "Majnu ka Tilla, North Delhi", "lat": 28.6995, "lng": 77.2285, "opens": "11:00", "closes": "22:00", "pins": ["110054", "110009", "110007"], "dishes": [["Veg Steamed Momos (8)", "Momos", true, 120], ["Chicken Steamed Momos (8)", "Momos", false, 150], ["Chicken Fried Momos (8)", "Momos", false, 170], ["Paneer Momos (8)", "Momos", true, 140], ["Chicken Pan-fried Momos (8)", "Momos", false, 170], ["Veg Thukpa", "Soups", true, 150], ["Chicken Thukpa", "Soups", false, 190], ["Chicken Thenthuk", "Soups", false, 200], ["Tingmo (2)", "Breads", true, 60], ["Chicken Shaphale", "Snacks", false, 140], ["Laphing", "Snacks", true, 100], ["Chilli Chicken Dry", "Mains", false, 260], ["Veg Fried Rice", "Rice", true, 160], ["Tibetan Butter Tea", "Drinks", true, 70]]},
    {"n": 7, "name": "Karol Bagh Chaat Corner", "address": "Karol Bagh, Central Delhi", "lat": 28.6514, "lng": 77.1907, "opens": "10:00", "closes": "22:00", "pins": ["110005", "110055", "110060"], "dishes": [["Aloo Tikki Chaat", "Chaat", true, 90], ["Raj Kachori", "Chaat", true, 110], ["Dahi Bhalla", "Chaat", true, 90], ["Papdi Chaat", "Chaat", true, 90], ["Golgappa (6)", "Chaat", true, 60], ["Chole Bhature", "Mains", true, 130], ["Samosa (2)", "Snacks", true, 40], ["Kachori Sabzi", "Snacks", true, 70], ["Jalebi (250 g)", "Sweets", true, 100], ["Gulab Jamun (2)", "Sweets", true, 60], ["Kaju Katli (250 g)", "Sweets", true, 340], ["Rasmalai (2)", "Sweets", true, 110], ["Kulfi Falooda", "Sweets", true, 130], ["Sweet Lassi", "Drinks", true, 80]]},
    {"n": 8, "name": "Nizam Dum Biryani", "address": "Nizamuddin, South-Central Delhi", "lat": 28.5886, "lng": 77.2509, "opens": "12:00", "closes": "23:30", "pins": ["110013", "110003", "110014", "110092"], "dishes": [["Chicken Dum Biryani", "Biryani", false, 320], ["Mutton Dum Biryani", "Biryani", false, 380], ["Veg Dum Biryani", "Biryani", true, 240], ["Egg Biryani", "Biryani", false, 260], ["Chicken 65", "Starters", false, 220], ["Seekh Kebab", "Starters", false, 240], ["Chicken Korma", "Curries", false, 280], ["Mutton Korma", "Curries", false, 340], ["Mirchi Ka Salan", "Sides", true, 120], ["Boondi Raita", "Sides", true, 50], ["Sheermal", "Breads", true, 50], ["Double Ka Meetha", "Sweets", true, 110], ["Phirni", "Sweets", true, 90]]},
    {"n": 9, "name": "Thali Ghar CP", "address": "Connaught Place, Central Delhi", "lat": 28.6315, "lng": 77.2167, "opens": "11:30", "closes": "22:30", "pins": ["110001", "110002", "110055", "110092"], "dishes": [["Veg Thali", "Thali", true, 320], ["Deluxe Veg Thali", "Thali", true, 420], ["Non-veg Thali", "Thali", false, 460], ["Mini Thali", "Thali", true, 220], ["Rajma Chawal", "Mains", true, 180], ["Chole Bhature", "Mains", true, 190], ["Kadhi Chawal", "Mains", true, 170], ["Dal Tadka Rice", "Mains", true, 170], ["Paneer Lababdar", "Mains", true, 300], ["Butter Naan", "Breads", true, 60], ["Gulab Jamun (2)", "Sweets", true, 80], ["Chaas", "Drinks", true, 60]]},
    {"n": 11, "name": "Laxmi Nagar Wok House", "address": "Laxmi Nagar, East Delhi", "lat": 28.6304, "lng": 77.2773, "opens": "11:00", "closes": "23:00", "pins": ["110092", "110091", "110051"], "dishes": [["Veg Hakka Noodles", "Noodles", true, 150], ["Chicken Hakka Noodles", "Noodles", false, 180], ["Schezwan Noodles", "Noodles", true, 160], ["Veg Fried Rice", "Rice", true, 150], ["Chicken Fried Rice", "Rice", false, 180], ["Veg Manchurian Gravy", "Mains", true, 170], ["Chilli Chicken", "Mains", false, 240], ["Chilli Paneer", "Mains", true, 220], ["Veg Spring Roll (4)", "Starters", true, 130], ["Crispy Honey Chilli Potato", "Starters", true, 160], ["Hot and Sour Soup", "Soups", true, 110], ["Chicken Manchow Soup", "Soups", false, 130]]}
  ]$city$;
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
    v_j := 0;
    for v_d in select value from jsonb_array_elements(v_k->'dishes') loop
      v_j := v_j + 1;
      insert into menu_items (id, kitchen_id, session_id, name, price_paise, available, category, veg, sort, synthetic)
      values (md5('dream-dish-' || v_n || '-' || v_j)::uuid, v_kid, 'sim', v_d->>0, (v_d->>3)::integer * 100, true, v_d->>1, (v_d->>2)::boolean, v_j, true)
      on conflict (id) do update set name = excluded.name, price_paise = excluded.price_paise, available = true, category = excluded.category,
        veg = excluded.veg, sort = excluded.sort, synthetic = true;
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
