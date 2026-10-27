-- Story #353 (E27, plan v2 B.17). The on-time promise. The promised time is stored when an order is made (any path). A late delivery gives that customer one personal coupon.
-- The numbers are a versioned global param `on_time_promise`: promise_min (default 45), late_coupon_paise (5000), late_coupon_days (30). A change is a new version, never an edit.
-- A personal coupon (session_id set) never shows in the public list. coupons_for_session_v2 gives the public ones plus the customer's own, for the quote to use (layer 2).
insert into params (session_id, key, value, version)
select 'global', 'on_time_promise', '{"promise_min": 45, "late_coupon_paise": 5000, "late_coupon_days": 30}'::jsonb, 1
where not exists (select 1 from params where session_id = 'global' and key = 'on_time_promise');

alter table orders add column promised_at timestamptz;
alter table coupons add column session_id text, add column order_id uuid unique references orders (id) on delete set null;

create function on_time_promise_rules() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from params where session_id = 'global' and key = 'on_time_promise' and kitchen_id is null order by version desc limit 1),
    '{"promise_min": 45, "late_coupon_paise": 5000, "late_coupon_days": 30}'::jsonb)
$$;
revoke all on function on_time_promise_rules() from public, anon, authenticated;

create function orders_set_promise() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.promised_at := coalesce(new.promised_at, now() + make_interval(mins => (on_time_promise_rules() ->> 'promise_min')::integer));
  return new;
end $$;
revoke all on function orders_set_promise() from public, anon, authenticated;
create trigger orders_promise before insert on orders for each row execute function orders_set_promise();

create function orders_late_coupon() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rules jsonb := on_time_promise_rules();
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.promised_at is not null and now() > new.promised_at then
    insert into coupons (code, title, kind, amount_paise, ends_at, max_uses, session_id, order_id)
    values ('LATE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), 'Sorry we were late', 'flat', (v_rules ->> 'late_coupon_paise')::integer,
      now() + make_interval(days => (v_rules ->> 'late_coupon_days')::integer), 1, new.session_id, new.id)
    on conflict (order_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function orders_late_coupon() from public, anon, authenticated;
create trigger orders_late_coupon after update of status on orders for each row execute function orders_late_coupon();

-- The public list is for everyone: a personal coupon is not in it.
create or replace function coupons_valid_v2() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'title', c.title, 'kind', c.kind, 'amount_paise', c.amount_paise, 'percent', c.percent,
    'cap_paise', c.cap_paise, 'min_order_paise', c.min_order_paise, 'first_order_only', c.first_order_only) order by c.code), '[]'::jsonb)
  from coupons c
  where c.session_id is null and c.active and now() >= c.starts_at and now() < c.ends_at
    and (c.max_uses is null or (select count(*) from orders o where o.bill -> 'coupon' ->> 'code' = c.code) < c.max_uses)
$$;

-- The public coupons plus this customer's own.
create function coupons_for_session_v2(p_session text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(e order by e ->> 'code'), '[]'::jsonb) from (
    select e from jsonb_array_elements(coupons_valid_v2()) e
    union all
    select jsonb_build_object('code', c.code, 'title', c.title, 'kind', c.kind, 'amount_paise', c.amount_paise, 'percent', c.percent,
      'cap_paise', c.cap_paise, 'min_order_paise', c.min_order_paise, 'first_order_only', c.first_order_only)
    from coupons c
    where c.session_id = p_session and c.active and now() >= c.starts_at and now() < c.ends_at
      and (c.max_uses is null or (select count(*) from orders o where o.bill -> 'coupon' ->> 'code' = c.code) < c.max_uses)
  ) t(e)
$$;
revoke all on function coupons_for_session_v2(text) from public, anon, authenticated;
grant execute on function coupons_for_session_v2(text) to service_role;
