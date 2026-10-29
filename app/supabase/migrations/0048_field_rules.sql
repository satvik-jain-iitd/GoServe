-- Story #187 (H4). The database is the truth for the fields a customer types; the app and the Edge Functions mirror these rules (docs/product/validation-rules.md).
-- The customer's saved details and the order address had no rules at all: any text of any length could be written. Same limits as the app and the Edge Functions already use.
-- NOT VALID: rows written before today are not checked (they may hold odd values); every new row and every update is.
alter table customers
  add constraint customers_name_rule check (name is null or char_length(name) between 1 and 80) not valid,
  add constraint customers_phone_rule check (phone is null or phone ~ '^([6-9][0-9]{9})?$') not valid,
  add constraint customers_address_rule check (address is null or char_length(address) <= 300) not valid,
  add constraint customers_pin_rule check (pin_code is null or pin_code ~ '^([0-9]{6})?$') not valid;
alter table orders add constraint orders_address_rule check (address is null or char_length(address) <= 300) not valid;
