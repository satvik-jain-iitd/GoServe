#!/usr/bin/env python3
"""Story A1 (#148): prove migration 0013 on a real database. Everything runs in one transaction that is rolled back; nothing stays.
Each check runs as a given user (role authenticated, auth.uid() set) and records true or false. Prints one line per check and exits 1 on any false.
Usage: check_city_model.py dev   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import json, os, sys, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"
U = {n: f"00000000-0000-4000-8000-0000000000{i:02x}" for i, n in enumerate(["cust", "other", "staff", "rider", "rider2", "admin", "stranger", "cook", "newrider"], start=1)}
K1, K2 = "00000000-0000-4000-8000-0000000001a1", "00000000-0000-4000-8000-0000000001a2"
O = {n: f"00000000-0000-4000-8000-0000000002{i:02x}" for i, n in enumerate(["own", "far", "prep", "kit"], start=1)}
DISH = "00000000-0000-4000-8000-0000000003a1"

SETUP = f"""
insert into kitchens (id, name, pin_codes, open, active) values ('{K1}', 'check one', '{{110016,110017}}', true, true), ('{K2}', 'check two', '{{110001}}', true, true);
insert into menu_items (id, kitchen_id, name, price_paise, category, veg, sort) values ('{DISH}', '{K1}', 'check dish', 1000, 'main', true, 1);
insert into riders (user_id, name, online) values ('{U['rider']}', 'R One', false), ('{U['rider2']}', 'R Two', false);
insert into admins (user_id) values ('{U['admin']}');
insert into auth.users (id, email) values ('{U['admin']}', 'founder@check.test'), ('{U['cook']}', 'cook@check.test'), ('{U['newrider']}', 'newrider@check.test'), ('{U['rider2']}', 'rider2@check.test');
insert into kitchen_staff (kitchen_id, user_id) values ('{K1}', '{U['staff']}');
insert into customers (user_id, name, phone) values ('{U['cust']}', 'C', '9999999999'), ('{U['other']}', 'O', '8888888888');
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address, rider_id) values
  ('{O['own']}', '{K1}', '{U['cust']}', 'k-own', 'placed', '[]', 100, 'x', null),
  ('{O['far']}', '{K2}', '{U['other']}', 'k-far', 'placed', '[]', 100, 'x', null),
  ('{O['prep']}', '{K1}', '{U['cust']}', 'k-prep', 'preparing', '[]', 100, 'x', '{U['rider']}'),
  ('{O['kit']}', '{K1}', 'someone', 'k-kit', 'placed', '[]', 100, 'x', null);
"""
IDS = ", ".join(f"'{v}'" for v in O.values())
checks: list[tuple[str, str]] = []   # (name, sql that leaves one row in temp table c<N>)


def as_user(uid: str, body: str) -> str:
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body} reset role;"


def true_for(name: str, who: str, expr: str):
    """expr is a boolean SQL expression, evaluated as the user."""
    i = len(checks)
    checks.append((name, as_user(U[who], f"create temp table c{i} as select ({expr}) as v;")))


def raises(name: str, who: str, stmt: str, expect_ok: bool = False):
    """stmt must raise (or, with expect_ok, must not)."""
    i = len(checks)
    ok, bad = ("true", "false") if not expect_ok else ("false", "true")
    checks.append((name, as_user(U[who], f"do $$ begin {stmt}; create temp table c{i} as select {bad} as v; exception when others then create temp table c{i} as select {ok} as v; end $$;")))


def rows(name: str, who: str, stmt: str, n: int):
    """stmt (insert or update) must touch exactly n rows. Data-changing statements cannot sit inside a select, so a DO block counts them."""
    i = len(checks)
    checks.append((name, as_user(U[who], f"do $$ declare n integer; begin {stmt}; get diagnostics n = row_count; create temp table c{i} as select (n = {n}) as v; end $$;")))


cnt = lambda t, ids: f"(select count(*) from {t} where id in ({ids}))"
true_for("staff reads only the orders of the own kitchen", "staff", f"{cnt('orders', IDS)} = 3")
true_for("admin reads every order", "admin", f"{cnt('orders', IDS)} = 4")
true_for("rider reads only the order assigned to them", "rider", f"{cnt('orders', IDS)} = 1")
true_for("another rider reads none", "rider2", f"{cnt('orders', IDS)} = 0")
true_for("stranger reads none", "stranger", f"{cnt('orders', IDS)} = 0")
true_for("customer reads own customers row only", "cust", "(select count(*) from customers) = 1")
true_for("admin reads all customers", "admin", f"(select count(*) from customers where user_id in ('{U['cust']}', '{U['other']}')) = 2")
true_for("kitchen staff sees the riders", "staff", f"(select count(*) from riders where user_id in ('{U['rider']}', '{U['rider2']}')) = 2")
true_for("a rider sees only their own row", "rider", "(select count(*) from riders) = 1")
raises("a customer cannot make themselves admin", "cust", f"insert into admins (user_id) values ('{U['cust']}')")
raises("a stranger cannot add a kitchen", "stranger", "insert into kitchens (name) values ('nope')")
rows("a non-admin update of a kitchen changes nothing", "stranger", f"update kitchens set name = 'x' where id = '{K1}'", 0)
rows("an admin can update a kitchen", "admin", f"update kitchens set name = 'check one b' where id = '{K1}'", 1)
rows("an admin can add a dish", "admin", f"insert into menu_items (kitchen_id, name, price_paise) values ('{K1}', 'new', 500)", 1)
rows("a rider can go online", "rider", f"update riders set online = true where user_id = '{U['rider']}'", 1)
rows("a rider cannot change another rider", "rider", f"update riders set online = true where user_id = '{U['rider2']}'", 0)
rows("a customer saves their own profile", "cust", f"update customers set name = 'C2' where user_id = '{U['cust']}'", 1)
raises("a customer cannot edit another profile", "cust", f"update customers set name = 'x' where user_id = '{U['other']}'; if not found then raise exception 'none'; end if", expect_ok=False)
raises("a customer cancels their own placed order", "cust", f"perform cancel_order('{O['own']}', null)", expect_ok=True)
raises("a customer cannot cancel someone else's order", "cust", f"perform cancel_order('{O['far']}', 'x')")
raises("a preparing order cannot be cancelled", "cust", f"perform cancel_order('{O['prep']}', 'x')")
raises("staff cannot cancel another kitchen's order", "staff", f"perform cancel_order('{O['far']}', 'x')")
raises("staff cancel an order of their kitchen with a reason", "staff", f"perform cancel_order('{O['kit']}', 'out of stock')", expect_ok=True)
raises("an admin cancels any order", "admin", f"perform cancel_order('{O['far']}', 'test')", expect_ok=True)
raises("staff must give a reason", "staff", f"perform cancel_order('{O['kit']}', '')")

FINAL_EXTRA = f"""
create temp table cx0 as select (select status from orders where id = '{O['own']}') = 'cancelled' and (select cancel_reason from orders where id = '{O['own']}') = 'cancelled by customer' and (select count(*) from order_events where order_id = '{O['own']}' and event = 'order.cancelled') = 1 as v;
do $$ begin begin update orders set status = 'accepted' where id = '{O['own']}'; create temp table cx1 as select false as v; exception when others then create temp table cx1 as select true as v; end; end $$;
do $$ begin begin insert into kitchen_staff (kitchen_id, user_id, role) values ('{K1}', '{U['stranger']}', 'rider'); create temp table cx2 as select false as v; exception when others then create temp table cx2 as select true as v; end; end $$;
insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address, created_at)
  select '{K1}', 'cap-today', 'k' || g, '[]', 100, 'x', now() from generate_series(1, 20) g;
insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address, created_at)
  select '{K1}', 'cap-old', 'k' || g, '[]', 100, 'x', now() - interval '2 days' from generate_series(1, 20) g;
do $$ begin begin perform place_order('cap-today', 'new', '[{{"menu_item_id":"{DISH}","qty":1}}]'::jsonb, 'x'); create temp table cx3 as select false as v; exception when others then create temp table cx3 as select (sqlerrm like '%session_order_cap%') as v; end; end $$;
do $$ begin begin perform place_order('cap-old', 'new', '[{{"menu_item_id":"{DISH}","qty":1}}]'::jsonb, 'x'); create temp table cx4 as select true as v; exception when others then create temp table cx4 as select false as v; end; end $$;

insert into customers (user_id, name, phone, pin_code) values ('{U['stranger']}', 'Asha', '9876543210', '110016') on conflict (user_id) do update set name = 'Asha', phone = '9876543210', pin_code = '110016';
do $$ begin perform place_order('{U['stranger']}', 'contact-1', '[{{"menu_item_id":"{DISH}","qty":1}}]'::jsonb, 'Flat 4'); end $$;
create temp table cx5 as select (select customer_name || '/' || customer_phone || '/' || pin_code from orders where session_id = '{U['stranger']}' and client_order_key = 'contact-1') = 'Asha/9876543210/110016' as v;
"""
EXTRA_NAMES = ["cancel wrote the status, the default customer reason and one event", "a cancelled order cannot move on", "kitchen_staff refuses role rider (riders live in riders)", "the 21st order of a session today is refused", "orders older than a day do not count to the cap", "place_order copies the customer's name, phone and pin code into the order"]


# Story A2 (#149): the admin functions of migration 0014.
true_for("an admin lists the people with their emails", "admin", "(select count(*) from admin_people() where email in ('founder@check.test', 'rider2@check.test')) = 2")
raises("a non-admin cannot list the people", "stranger", "perform * from admin_people()")
raises("an admin adds kitchen staff by email", "admin", f"perform admin_add_person('Cook@Check.test', 'kitchen', '{K1}')", expect_ok=True)
true_for("the added staff row exists for that kitchen", "admin", f"(select count(*) from kitchen_staff where user_id = '{U['cook']}' and kitchen_id = '{K1}') = 1")
raises("an admin adds a rider by email", "admin", "perform admin_add_person('newrider@check.test', 'rider', null)", expect_ok=True)
raises("an unknown email is refused", "admin", "perform admin_add_person('nobody@check.test', 'rider', null)")
raises("a bad kind is refused", "admin", f"perform admin_add_person('cook@check.test', 'boss', '{K1}')")
raises("kitchen staff needs a kitchen", "admin", "perform admin_add_person('cook@check.test', 'kitchen', null)")
raises("a non-admin cannot add people", "stranger", "perform admin_add_person('cook@check.test', 'admin', null)")
raises("an admin removes kitchen staff", "admin", f"perform admin_remove_person('kitchen', '{U['cook']}', '{K1}')", expect_ok=True)
true_for("the removed staff row is gone", "admin", f"(select count(*) from kitchen_staff where user_id = '{U['cook']}') = 0")
raises("the last admin cannot be removed", "admin", f"perform admin_remove_person('admin', '{U['admin']}', null)")
raises("a non-admin cannot remove people", "stranger", f"perform admin_remove_person('rider', '{U['rider']}', null)")


# Story A3 (#150): dish photos in the public bucket `menu`; only an admin writes.
raises("an admin adds a dish photo", "admin", "insert into storage.objects (bucket_id, name) values ('menu', 'check/a.png')", expect_ok=True)
raises("a non-admin cannot add a dish photo", "stranger", "insert into storage.objects (bucket_id, name) values ('menu', 'check/b.png')")


# Story A4 (#151): the day's numbers view (security_invoker, so row level security decides what is counted).
DAY = "(now() at time zone 'Asia/Kolkata')::date"
true_for("an admin's day numbers count the kitchen's orders and cancels", "admin", f"(select orders = 3 and cancelled = 2 and delivered = 0 from day_numbers where kitchen_id = '{K1}' and day = {DAY})")
true_for("kitchen staff see the numbers of their own kitchen only", "staff", f"(select count(*) from day_numbers where kitchen_id = '{K1}') = 1 and (select count(*) from day_numbers where kitchen_id = '{K2}') = 0")
true_for("a stranger counts nothing", "stranger", f"(select count(*) from day_numbers where kitchen_id in ('{K1}', '{K2}')) = 0")


def run(ref: str, query: str):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-check"})
    return json.load(urllib.request.urlopen(req))


def build() -> str:
    selects = [f"select 'c{i}' as k, v from c{i}" for i in range(len(checks))] + [f"select 'cx{j}' as k, v from cx{j}" for j in range(len(EXTRA_NAMES))]
    return "\n".join(["begin;", SETUP, *[sql for _, sql in checks], FINAL_EXTRA, " union all ".join(selects) + ";", "rollback;"])


if __name__ == "__main__":
    if sys.argv[1:] != ["dev"]:
        sys.exit("Usage: check_city_model.py dev (prod is never allowed)")
    rows = {r["k"]: r["v"] for r in run(DEV_REF, build())}
    names = [n for n, _ in checks] + EXTRA_NAMES
    keys = [f"c{i}" for i in range(len(checks))] + [f"cx{j}" for j in range(len(EXTRA_NAMES))]
    bad = 0
    for n, k in zip(names, keys):
        ok = rows.get(k) is True
        bad += not ok
        print(("ok   " if ok else "FAIL ") + n)
    print(f"{len(names) - bad} of {len(names)} checks passed")
    sys.exit(1 if bad else 0)
