-- Story #44. Session isolation (ADR-010), Realtime, and the Delhi sample menu.
-- Reads only: the phone never writes with the anon key (ADR-009). n8n writes with the service role.

alter table menu_items add column image_url text, add column image_credit text;

alter table kitchens enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_events enable row level security;
alter table decision_log enable row level security;
alter table run_log enable row level security;
alter table params enable row level security;

-- Anonymous sign-in gives each browser its own user. Its id is the session id.
create policy kitchen_read on kitchens for select to anon, authenticated using (true);
create policy menu_read on menu_items for select to anon, authenticated using (true);
create policy orders_own_session on orders for select to authenticated using (session_id = auth.uid()::text);
create policy events_own_session on order_events for select to authenticated using (session_id = auth.uid()::text);
-- decision_log, run_log, params: no policy, so only the service role can read them.

alter publication supabase_realtime add table orders, order_events;

insert into kitchens (id, name) values ('11111111-1111-1111-1111-111111111111', 'GoServe Delhi Kitchen');

insert into menu_items (kitchen_id, name, price_paise, image_url, image_credit) values
  ('11111111-1111-1111-1111-111111111111', 'Butter Chicken', 32000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_makhani.jpg?width=640', 'File:Chicken makhani.jpg, CC BY-SA 2.0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Chole Bhature', 18000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chole_Bhature_1.jpg?width=640', 'File:Chole Bhature 1.jpg, CC BY-SA 4.0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Paneer Tikka', 26000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Panir_Tikka_Indian_cheese_grilled.jpg?width=640', 'File:Panir Tikka Indian cheese grilled.jpg, CC BY 2.0 de, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Dal Makhani', 22000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Dal_Makhani.jpg?width=640', 'File:Dal Makhani.jpg, CC BY-SA 2.0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Chicken Biryani', 29000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_Hyderabadi_Biryani.JPG?width=640', 'File:Chicken Hyderabadi Biryani.JPG, CC BY-SA 4.0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Samosa (2 pieces)', 6000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Samosa_with_sweet_chutney.jpg?width=640', 'File:Samosa with sweet chutney.jpg, CC0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Steamed Momos', 12000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Steamed_Momos_-_KOLKATA.jpg?width=640', 'File:Steamed Momos - KOLKATA.jpg, CC BY-SA 4.0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Aloo Paratha', 9000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Aloo_Paratha_(96238).jpg?width=640', 'File:Aloo Paratha (96238).jpg, CC BY-SA 4.0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Gulab Jamun (2 pieces)', 8000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Two_Gulab_Jamun_in_a_plate_01.jpg?width=640', 'File:Two Gulab Jamun in a plate 01.jpg, CC BY-SA 4.0, Wikimedia Commons'),
  ('11111111-1111-1111-1111-111111111111', 'Pani Puri', 7000, 'https://commons.wikimedia.org/wiki/Special:FilePath/Crispy_Pani_Puri.jpg?width=640', 'File:Crispy Pani Puri.jpg, CC BY-SA 4.0, Wikimedia Commons');
