#!/usr/bin/env python3
"""Story A4 (#151): the scale proof for one city, on the dev database. 10 kitchens each serving its own pin code, 20 riders online, 100 customers who each
place one order by their pin code (every order is sent twice, like a retry). Everything runs in one transaction that is rolled back, so nothing stays.
Prints: orders=N lost=N duplicates=N wrong_kitchen=N unassigned=N. It fails on any loss, duplicate or wrong kitchen.
`--riders` also fails when an order has no rider; rider assignment arrives with layer A5, so before that unassigned is only reported.
Usage: city_check.py dev [--riders]   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import json, os, sys, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"


def uid(prefix: str, i: str) -> str:
    return f"('00000000-0000-4000-8000-{prefix}' || lpad({i}::text, 8, '0'))"


def build_sql(kitchens: int, riders: int, customers: int) -> str:
    return f"""begin;
insert into kitchens (id, name, pin_codes, open, active)
  select {uid('000c', 'g')}::uuid, 'city check ' || lpad(g::text, 2, '0'), array[(900000 + g)::text], true, true from generate_series(1, {kitchens}) g;
insert into menu_items (id, kitchen_id, name, price_paise)
  select {uid('000d', 'g')}::uuid, {uid('000c', 'g')}::uuid, 'check dish', 10000 from generate_series(1, {kitchens}) g;
insert into riders (user_id, name, online, lat, lng)
  select {uid('000e', 'g')}::uuid, 'check rider ' || g, true, 28.5 + g / 1000.0, 77.2 from generate_series(1, {riders}) g;
insert into customers (user_id, name, phone, address, pin_code)
  select {uid('000f', 'g')}::uuid, 'Customer ' || g, '9' || lpad(g::text, 9, '0'), 'Flat ' || g, (900000 + 1 + (g - 1) % {kitchens})::text from generate_series(1, {customers}) g;
do $$
declare c record; k uuid; d uuid;
begin
  for c in select * from customers where name like 'Customer %' loop
    select id into k from kitchens where pin_codes @> array[c.pin_code] and open and active order by name limit 1;
    select id into d from menu_items where kitchen_id = k limit 1;
    perform place_order(c.user_id::text, 'check-' || c.user_id, jsonb_build_array(jsonb_build_object('menu_item_id', d, 'qty', 1)), c.address);
    perform place_order(c.user_id::text, 'check-' || c.user_id, jsonb_build_array(jsonb_build_object('menu_item_id', d, 'qty', 1)), c.address);   -- the retry
  end loop;
end $$;
select count(*)::int as orders,
  ({customers} - count(distinct o.session_id))::int as lost,
  (count(*) - count(distinct (o.session_id, o.client_order_key)))::int as duplicates,
  (count(*) filter (where not exists (select 1 from kitchens k where k.id = o.kitchen_id and k.pin_codes @> array[c.pin_code])))::int as wrong_kitchen,
  (count(*) filter (where o.rider_id is null))::int as unassigned
from orders o join customers c on c.user_id::text = o.session_id where c.name like 'Customer %';
rollback;"""


def summary(r: dict) -> str:
    return " ".join(f"{k}={r[k]}" for k in ("orders", "lost", "duplicates", "wrong_kitchen", "unassigned"))


def passed(r: dict, need_riders: bool) -> bool:
    return r["lost"] == 0 and r["duplicates"] == 0 and r["wrong_kitchen"] == 0 and (r["unassigned"] == 0 or not need_riders)


def run(ref: str, query: str):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-city"})
    return json.load(urllib.request.urlopen(req))


if __name__ == "__main__":
    if sys.argv[1:2] != ["dev"]:
        sys.exit("Usage: city_check.py dev [--riders] (prod is never allowed)")
    row = run(DEV_REF, build_sql(10, 20, 100))[0]
    print(summary(row))
    ok = passed(row, "--riders" in sys.argv)
    print("OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)
