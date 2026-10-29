-- Story #346 (layer 1, E27 plan v2 B.10). Coupons. The server decides which coupon is valid now and which one is best (the quote, supabase/functions/quote).
-- Valid = active, inside its dates, under its max uses. Uses are counted from the bills of the orders that carry the code (bill.coupon.code), so there is no counter to drift.
-- ponytail: two orders placed at the same moment can both pass the last use; a lock or a counter comes if a coupon ever has a hard cap that matters.
-- Only the service role reads: the Edge Functions hold that key. Nobody reads the table by hand.
create table coupons (
  code text primary key check (code = upper(trim(code)) and length(code) between 2 and 40),
  title text not null check (length(title) between 1 and 80),
  kind text not null check (kind in ('flat', 'percent')),
  amount_paise integer not null default 0 check (amount_paise >= 0),
  percent integer not null default 0 check (percent between 0 and 100),
  cap_paise integer not null default 0 check (cap_paise >= 0),
  min_order_paise integer not null default 0 check (min_order_paise >= 0),
  first_order_only boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((kind = 'flat' and amount_paise > 0) or (kind = 'percent' and percent > 0))
);
alter table coupons enable row level security;
revoke all on coupons from public, anon, authenticated;

create function coupons_valid_v2() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'title', c.title, 'kind', c.kind, 'amount_paise', c.amount_paise, 'percent', c.percent,
    'cap_paise', c.cap_paise, 'min_order_paise', c.min_order_paise, 'first_order_only', c.first_order_only) order by c.code), '[]'::jsonb)
  from coupons c
  where c.active and now() >= c.starts_at and now() < c.ends_at
    and (c.max_uses is null or (select count(*) from orders o where o.bill -> 'coupon' ->> 'code' = c.code) < c.max_uses)
$$;

-- One coupon by its code (any case), or null when there is none or it is not valid now.
create function coupon_by_code_v2(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select e from jsonb_array_elements(coupons_valid_v2()) e where e ->> 'code' = upper(trim(p_code))
$$;

revoke all on function coupons_valid_v2() from public, anon, authenticated;
revoke all on function coupon_by_code_v2(text) from public, anon, authenticated;
grant execute on function coupons_valid_v2() to service_role;
grant execute on function coupon_by_code_v2(text) to service_role;
