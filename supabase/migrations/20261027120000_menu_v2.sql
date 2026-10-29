-- Story #343 (E27, plan v2 B.7). Menu v2: the dish fields a modern food app shows. Additive only: the PWA reads named columns, so it is not touched.
-- badge: a small mark on the dish. size_tag and protein_g: what the plate is. back_soon_at: when a sold-out dish comes back (the kitchen sets it).
-- created_at: when the dish was added, for the New collection. Dishes that exist today get a date before the New window, so nothing is "new" by accident.

alter table menu_items
  add column if not exists badge text check (badge in ('bestseller', 'new', 'chef')),
  add column if not exists size_tag text check (size_tag in ('small', 'regular', 'large')),
  add column if not exists protein_g integer check (protein_g >= 0 and protein_g <= 500),
  add column if not exists back_soon_at timestamptz,
  add column if not exists created_at timestamptz;

update menu_items set created_at = '2026-10-01T00:00:00Z' where created_at is null;
alter table menu_items alter column created_at set default now(), alter column created_at set not null;
