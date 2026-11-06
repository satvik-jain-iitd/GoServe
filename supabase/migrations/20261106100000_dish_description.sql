-- Story #779 (epic E32): one short line under each dish ("slow cooked overnight, butter on top"). Optional, at most 60 characters.
alter table menu_items add column if not exists description text;
alter table menu_items drop constraint if exists menu_items_description_len;
alter table menu_items add constraint menu_items_description_len check (description is null or char_length(description) <= 60);
