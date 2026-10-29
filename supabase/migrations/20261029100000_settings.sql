-- Story #619 layer b. The admin's settings: one row per name. The first is the sold-out swap discount, a percent of the new item's price, paid by us.
-- Owner, 29 Oct: 10 by default, changed by the admin in the admin panel (layer d), not a constant in code. 0 to 50, whole numbers.
-- Only the service role reads and writes; the orders and quote functions read it at quote time, and the admin screen goes through a function (layer d).
create table settings (
  name text primary key check (char_length(name) between 1 and 60),
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint settings_swap_discount_pct_rule check (name <> 'swap_discount_pct'
    or (jsonb_typeof(value) = 'number' and (value #>> '{}')::numeric between 0 and 50 and (value #>> '{}')::numeric = floor((value #>> '{}')::numeric)))
);
alter table settings enable row level security;
revoke all on settings from public, anon, authenticated;
insert into settings (name, value) values ('swap_discount_pct', '10'::jsonb);
