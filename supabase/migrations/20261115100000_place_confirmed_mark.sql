-- Story 1529 (owner, 15 Nov 2026): the first-open screen "Where does the food go?" and the alerts ask show once only.
-- The mark is on the customer's own row: the time he first confirmed a place on the pin map. It is on the server, so a second phone and a sign out do not bring the screens back.
-- A column on `customers`, not a new table: the row is already one per customer, and its row level security already lets a customer read and write only his own row
-- (customers_own, customers_insert_own, customers_update_own, migration 0013). No new policy and no new grant are needed.
-- No backfill: the app sets the mark by itself for a customer who already has a saved address.
-- Additive and safe to run twice.
alter table customers add column if not exists place_confirmed_at timestamptz;
comment on column customers.place_confirmed_at is 'Story 1529: when this customer first confirmed a delivery place. Not null: the first-open screen and the alerts ask do not show again.';
