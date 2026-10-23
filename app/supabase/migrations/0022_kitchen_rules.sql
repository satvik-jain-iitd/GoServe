-- Story H1 (#184, epic E15, MVP 2.5). Rules for kitchens and dishes in the database itself, so no screen, script or import can break them.
-- An existing row that breaks a rule makes this migration fail (nothing is half applied): fix the row in the admin app first.

-- A kitchen that sells must be reachable: at least one pin code while it is active.
alter table kitchens add constraint kitchens_pin_required check (cardinality(pin_codes) >= 1 or not active);
-- An Indian mobile number: ten digits, the first one 6 to 9. A kitchen may have no phone yet.
alter table kitchens add constraint kitchens_phone_format check (phone is null or phone ~ '^[6-9][0-9]{9}$');
-- Opening and closing time must differ. Closing before opening is allowed: a kitchen open from 22:00 to 02:00.
alter table kitchens add constraint kitchens_hours_differ check (opens_at is null or closes_at is null or opens_at <> closes_at);
-- One name per kitchen, ignoring case.
create unique index kitchens_name_unique on kitchens (lower(name));

-- A dish costs something, and a kitchen does not list the same dish twice.
alter table menu_items drop constraint menu_items_price_paise_check;
alter table menu_items add constraint menu_items_price_positive check (price_paise > 0);
create unique index menu_items_name_unique on menu_items (kitchen_id, lower(name));
