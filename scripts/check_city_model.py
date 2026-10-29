#!/usr/bin/env python3
"""Story A1 (#148): prove migration 0013 on a real database. Everything runs in one transaction that is rolled back; nothing stays.
Each check runs as a given user (role authenticated, auth.uid() set) and records true or false. Prints one line per check and exits 1 on any false.
Usage: check_city_model.py dev   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import vault as gsvault
import json, os, sys, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"
U = {n: f"00000000-0000-4000-8000-0000000000{i:02x}" for i, n in enumerate(["cust", "other", "staff", "rider", "rider2", "admin", "stranger", "cook", "newrider"], start=1)}
K1, K2 = "00000000-0000-4000-8000-0000000001a1", "00000000-0000-4000-8000-0000000001a2"
O = {n: f"00000000-0000-4000-8000-0000000002{i:02x}" for i, n in enumerate(["own", "far", "prep", "kit"], start=1)}
DISH = "00000000-0000-4000-8000-0000000003a1"
EP = "https://push.example/check-endpoint"   # story A7: a push subscription of the customer

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
update menu_items set available = true where id = '{DISH}';   -- the A6 checks marked it sold out
update kitchens set open = true where id = '{K1}';
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


# Story A5 (#152): dispatch. dispatch_candidates and assign_rider are for the service role (n8n) only; run here as the database owner.
DISPATCH = f"""
update riders set online = true, lat = 28.56, lng = 77.21 where user_id = '{U['rider']}';
update orders set status = 'ready' where id = '{O['prep']}';   -- the rider already carries one ready order, so is not free
update riders set online = true, lat = 28.90, lng = 77.60 where user_id = '{U['rider2']}';
update kitchens set lat = 28.5494, lng = 77.2001 where id = '{K1}';
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address) values ('00000000-0000-4000-8000-0000000002e1', '{K1}', 'dispatch-s', 'k-d1', 'ready', '[]', 100, 'x');
create temp table dx0 as select (select jsonb_array_length(dispatch_candidates('00000000-0000-4000-8000-0000000002e1') -> 'riders')) = 2 as v;
create temp table dx1 as select (dispatch_candidates('00000000-0000-4000-8000-0000000002e1') -> 'riders' -> 0 ->> 'id') = '{U['rider']}' as v;
create temp table dx2 as select (select (r ->> 'free')::boolean from jsonb_array_elements(dispatch_candidates('00000000-0000-4000-8000-0000000002e1') -> 'riders') r where r ->> 'id' = '{U['rider']}') is false as v;
create temp table dx3 as select ((dispatch_candidates('00000000-0000-4000-8000-0000000002e1') -> 'riders' -> 0 ->> 'distance_m')::int between 100 and 2000) as v;
do $$ begin begin perform dispatch_candidates('00000000-0000-4000-8000-0000000002ff'); create temp table dx4 as select false as v; exception when others then create temp table dx4 as select (sqlerrm like '%order_not_found%') as v; end; end $$;
do $$ begin perform assign_rider('00000000-0000-4000-8000-0000000002e1', '{U['rider2']}'); end $$;
create temp table dx5 as select (select rider_id from orders where id = '00000000-0000-4000-8000-0000000002e1') = '{U['rider2']}' and (select count(*) from order_events where order_id = '00000000-0000-4000-8000-0000000002e1' and event = 'order.assigned') = 1 as v;
do $$ begin perform assign_rider('00000000-0000-4000-8000-0000000002e1', '{U['rider2']}'); end $$;
create temp table dx6 as select (select count(*) from order_events where order_id = '00000000-0000-4000-8000-0000000002e1' and event = 'order.assigned') = 1 as v;
do $$ begin begin perform assign_rider('00000000-0000-4000-8000-0000000002e1', '{U['rider']}'); create temp table dx7 as select false as v; exception when others then create temp table dx7 as select (sqlerrm like '%not_ready%') as v; end; end $$;
do $$ begin begin perform assign_rider('{O['own']}', '{U['rider']}'); create temp table dx8 as select false as v; exception when others then create temp table dx8 as select (sqlerrm like '%not_ready%') as v; end; end $$;
update orders set rider_id = null, status = 'ready' where id = '{O['prep']}';
update riders set online = false where user_id = '{U['rider']}';
do $$ begin begin perform assign_rider('{O['prep']}', '{U['rider']}'); create temp table dx9 as select false as v; exception when others then create temp table dx9 as select (sqlerrm like '%rider_not_available%') as v; end; end $$;
create temp table dx10 as select (select count(*) from orders where id = '{O['prep']}' and rider_id is null) = 1 as v;
update menu_items set available = true where id = '{DISH}';
update kitchens set open = false where id = '{K1}';
do $$ begin begin perform place_order('closed-s', 'closed-1', '[{{"menu_item_id":"{DISH}","qty":1}}]'::jsonb, 'x'); create temp table dx11 as select false as v; exception when others then create temp table dx11 as select (sqlerrm like '%kitchen_closed%') as v; end; end $$;
update kitchens set open = true, active = false where id = '{K1}';
do $$ begin begin perform place_order('closed-s', 'closed-2', '[{{"menu_item_id":"{DISH}","qty":1}}]'::jsonb, 'x'); create temp table dx12 as select false as v; exception when others then create temp table dx12 as select (sqlerrm like '%kitchen_closed%') as v; end; end $$;
update kitchens set active = true where id = '{K1}';
do $$ begin perform place_order('closed-s', 'closed-3', '[{{"menu_item_id":"{DISH}","qty":1}}]'::jsonb, 'x'); end $$;
create temp table dx13 as select (select count(*) from orders where session_id = 'closed-s') = 1 as v;
create temp table dx14 as select (push_targets('{U['cust']}') -> 'targets' -> 0 ->> 'endpoint') = '{EP}' as v;
do $$ begin perform push_forget('{EP}'); end $$;
create temp table dx15 as select jsonb_array_length(push_targets('{U['cust']}') -> 'targets') = 0 as v;
"""
DISPATCH_NAMES = ["candidates: both online riders are listed", "candidates: the nearest rider is first", "candidates: a rider with an open ready order is not free", "candidates: the distance to the kitchen is in metres", "candidates: an unknown order is refused",
                  "assign: the rider is saved on the order and one event is written", "assign: a second call for the same rider changes nothing", "assign: another rider cannot take an assigned order", "assign: an order that is not ready is refused",
                  "assign: a rider who is offline is refused", "assign: a refused call leaves the order unassigned",
                  "place_order refuses a closed kitchen", "place_order refuses an inactive kitchen", "place_order works again once the kitchen is open and active",
                  "push_targets lists the endpoint for the session (service role)", "push_forget removes it"]


# Story A6 (#153): the kitchen's own controls.
rows("kitchen staff mark a dish of their kitchen sold out", "staff", f"update menu_items set available = false where id = '{DISH}'", 1)
rows("a stranger cannot mark a dish sold out", "stranger", f"update menu_items set available = true where id = '{DISH}'", 0)
raises("kitchen staff close their own kitchen", "staff", f"perform set_kitchen_open('{K1}', false)", expect_ok=True)
true_for("the kitchen is closed after that", "admin", f"(select not open from kitchens where id = '{K1}')")
raises("kitchen staff cannot close another kitchen", "staff", f"perform set_kitchen_open('{K2}', false)")
raises("an admin can open any kitchen", "admin", f"perform set_kitchen_open('{K1}', true)", expect_ok=True)
raises("a stranger cannot open or close a kitchen", "stranger", f"perform set_kitchen_open('{K1}', false)")
raises("#272: a stranger cannot flip the per-order pick", "stranger", "perform set_per_order_pick('nearest_band')")
raises("#272: an unknown pick is refused", "admin", "perform set_per_order_pick('fastest')")


# Story A7 (#154): web push subscriptions and the notification text.
raises("a customer saves their push subscription", "cust", f"perform save_push('{EP}', 'P', 'A')", expect_ok=True)
raises("an empty subscription is refused", "cust", "perform save_push('', 'P', 'A')")
true_for("a customer reads only their own subscription", "cust", f"(select count(*) from push_subscriptions) = 1")
true_for("another customer cannot read it", "other", f"(select count(*) from push_subscriptions) = 0")
true_for("push_latest says what the newest order is, for a stranger asking with the endpoint (the service worker has no login)", "stranger", f"(push_latest('{EP}') ->> 'body') in ('Your order was cancelled.', 'Your order is being cooked.', 'Your order is ready.')")
true_for("push_latest knows nothing about an unknown endpoint", "stranger", "push_latest('https://push.example/nope') is null")
raises("a customer cannot call the service-only push_targets", "cust", f"perform push_targets('{U['cust']}')")
raises("a customer cannot call push_forget", "cust", f"perform push_forget('{EP}')")


# Story D2 (#161): the rider card. Only the owner of an order sees its rider, and only while the order is ready or on the way.
def _as(uid: str, i: int, expr: str) -> str:
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); create temp table dr{i} as select ({expr}) as v; reset role;"
RIDER_CARD = f"""
update riders set name = 'Ravi Kumar', phone = '9876500000' where user_id = '{U['rider']}';
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address, rider_id) values ('00000000-0000-4000-8000-0000000002e2', '{K1}', '{U['cust']}', 'k-rc', 'preparing', '[]', 100, 'x', '{U['rider']}');
{_as(U['cust'], 0, f"(select count(*) from order_rider('00000000-0000-4000-8000-0000000002e2')) = 0")}
update orders set status = 'ready' where id = '00000000-0000-4000-8000-0000000002e2';
{_as(U['cust'], 1, f"(select name = 'Ravi' and phone = '9876500000' from order_rider('00000000-0000-4000-8000-0000000002e2'))")}
{_as(U['other'], 2, f"(select count(*) from order_rider('00000000-0000-4000-8000-0000000002e2')) = 0")}
{_as(U['stranger'], 3, f"(select count(*) from order_rider('00000000-0000-4000-8000-0000000002e2')) = 0")}
update orders set status = 'out_for_delivery' where id = '00000000-0000-4000-8000-0000000002e2';
{_as(U['cust'], 4, f"(select count(*) from order_rider('00000000-0000-4000-8000-0000000002e2')) = 1")}
update orders set status = 'delivered' where id = '00000000-0000-4000-8000-0000000002e2';
{_as(U['cust'], 5, f"(select count(*) from order_rider('00000000-0000-4000-8000-0000000002e2')) = 0")}
"""
RIDER_NAMES = ["rider card: nothing while the order is still being cooked", "rider card: the owner sees the first name and the phone once the order is ready", "rider card: another customer sees nothing",
               "rider card: a stranger sees nothing", "rider card: still there while the order is on the way", "rider card: gone once the order is delivered"]


# Story H1 (#184): kitchen and dish rules (migration 0022). Run as the admin, so row level security allows the write and only the rule can refuse it.
raises("a kitchen with no pin code cannot be active", "admin", "insert into kitchens (name, pin_codes, active) values ('rule no pins', '{}', true)")
raises("a kitchen with no pin code can be saved while inactive", "admin", "insert into kitchens (name, pin_codes, active) values ('rule inactive', '{}', false)", expect_ok=True)
raises("a kitchen phone must be ten digits starting 6 to 9", "admin", "insert into kitchens (name, pin_codes, phone) values ('rule phone', '{110016}', '1234567890')")
raises("a good kitchen phone is accepted", "admin", "insert into kitchens (name, pin_codes, phone) values ('rule phone ok', '{110016}', '9876543210')", expect_ok=True)
raises("the opening and closing time cannot be the same", "admin", "insert into kitchens (name, pin_codes, opens_at, closes_at) values ('rule hours', '{110016}', '10:00', '10:00')")
raises("a late-night kitchen (22:00 to 02:00) is accepted", "admin", "insert into kitchens (name, pin_codes, opens_at, closes_at) values ('rule night', '{110016}', '22:00', '02:00')", expect_ok=True)
raises("a kitchen name is unique, ignoring case", "admin", "insert into kitchens (name, pin_codes) values ('CHECK TWO', '{110016}')")
raises("a dish price of zero is refused", "admin", f"insert into menu_items (kitchen_id, name, price_paise) values ('{K1}', 'free dish', 0)")
raises("a dish name is unique in its kitchen, ignoring case", "admin", f"insert into menu_items (kitchen_id, name, price_paise) values ('{K1}', 'CHECK DISH', 500)")
raises("the same dish name in another kitchen is fine", "admin", f"insert into menu_items (kitchen_id, name, price_paise) values ('{K2}', 'check dish', 500)", expect_ok=True)


# Story H3 (#186): one kitchen per staff account. Run as the database owner, then read as the users.
def _ask(uid: str, i: int, expr: str) -> str:
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); create temp table ds{i} as select ({expr}) as v; reset role;"
STAFF = f"""
insert into kitchen_staff (kitchen_id, user_id) values ('{K2}', '{U['admin']}');
{_ask(U['admin'], 0, f"(select count(*) from kitchen_staff) = 2 and (select count(*) from kitchen_staff where user_id = auth.uid()) = 1 and (select kitchen_id from kitchen_staff where user_id = auth.uid()) = '{K2}'")}
{_ask(U['staff'], 1, "(select count(*) from kitchen_staff) = 1")}
do $$ begin begin insert into kitchen_staff (kitchen_id, user_id) values ('{K2}', '{U['staff']}'); create temp table ds2 as select false as v; exception when unique_violation then create temp table ds2 as select true as v; end; end $$;
do $$ begin perform set_config('request.jwt.claim.sub', '{U['admin']}', true); end $$;
{_ask(U['admin'], 3, f"(select count(*) from (select admin_add_person('cook@check.test', 'kitchen', '{K1}')) x) = 1")}
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['admin']}', true); perform admin_add_person('cook@check.test', 'kitchen', '{K2}'); reset role; create temp table ds4 as select false as v; exception when others then reset role; create temp table ds4 as select (sqlerrm like '%already_staff%') as v; end; end $$;
{_ask(U['admin'], 5, f"(select count(*) from kitchen_staff where user_id = '{U['cook']}') = 1")}
"""
STAFF_NAMES = ["an admin who is also staff reads every staff row but the query for their own user returns only their kitchen", "kitchen staff read only their own row",
               "a second kitchen for the same staff account is refused by the database", "an admin adds a person to a kitchen",
               "adding that person to a second kitchen is refused with already_staff", "the person stays in one kitchen"]


# Story H14 (#204): pilot numbers, watch, rider pings, platform, call and refused at the door (migration 0024).
# Fixtures sit 36 hours back, on kitchen K1 only, so the window (and p_kitchen) keeps real dev rows out of the numbers.
P = {n: f"00000000-0000-4000-8000-0000000004{i:02x}" for i, n in enumerate(["ontime", "late", "refused", "unseen", "norider", "outnow"], start=1)}
BASE = "(date_trunc('hour', now() - interval '36 hours') + interval '10 minutes')"
WIN = f"({BASE} - interval '10 minutes'), ({BASE} + interval '50 minutes'), '{K1}'"
def _p(uid: str, i: int, expr: str) -> str:
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); create temp table dp{i} as select ({expr}) as v; reset role;"
def _pn(i: int, expr: str) -> str:   # as the database owner (the service role has no user id)
    return f"select set_config('request.jwt.claim.sub', '', true); create temp table dp{i} as select ({expr}) as v;"
def _ev(o: str, ev: str, mins: int, actor: str = "system") -> str:
    return f"insert into order_events (order_id, kitchen_id, session_id, event, actor, created_at) select id, kitchen_id, session_id, '{ev}', '{actor}', {BASE} + interval '{mins} minutes' from orders where id = '{o}';"
def _call(uid: str, stmt: str) -> str:   # a volatile call in its own statement, so the next statement sees what it wrote
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); do $$ begin perform {stmt}; end $$; reset role;"
NUM = f"pilot_numbers({WIN})->'numbers'"
PILOT = f"""
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address, rider_id, created_at, updated_at, paid_by, client_platform, cancel_reason) values
  ('{P['ontime']}', '{K1}', '{U['cust']}', 'p-on', 'delivered', '[]', 20000, 'x', '{U['rider']}', {BASE}, {BASE}, 'cash', 'ios', null),
  ('{P['late']}', '{K1}', '{U['other']}', 'p-late', 'delivered', '[]', 10000, 'x', '{U['rider']}', {BASE} + interval '5 minutes', {BASE}, 'cash', 'ios', null),
  ('{P['refused']}', '{K1}', '{U['cust']}', 'p-ref', 'cancelled', '[]', 5000, 'x', '{U['rider']}', {BASE} + interval '6 minutes', {BASE}, null, 'android', 'refused_at_door');
{_ev(P['ontime'], 'order.accepted', 1)}{_ev(P['ontime'], 'order.picked_up', 12)}{_ev(P['ontime'], 'order.delivered', 30)}{_ev(P['ontime'], 'customer.call', 15, 'customer')}
{_ev(P['late'], 'order.accepted', 9)}{_ev(P['late'], 'order.picked_up', 25)}{_ev(P['late'], 'order.delivered', 45)}
{_ev(P['refused'], 'order.accepted', 7)}{_ev(P['refused'], 'order.picked_up', 20)}
insert into rider_pings (user_id, at, lat, lng) values
  ('{U['rider']}', {BASE} + interval '13 minutes', 28.6, 77.2), ('{U['rider']}', {BASE} + interval '28 minutes', 28.6, 77.2),
  ('{U['rider']}', {BASE} + interval '26 minutes', 28.6, 77.2), ('{U['rider']}', {BASE} + interval '30 minutes', 28.6, 77.2), ('{U['rider']}', {BASE} + interval '36 minutes', 28.6, 77.2),
  ('{U['rider']}', {BASE} + interval '33 minutes', 28.6, 77.2), ('{U['rider']}', {BASE} + interval '41 minutes', 28.6, 77.2), ('{U['rider']}', {BASE} + interval '44 minutes', 28.6, 77.2),
  ('{U['rider']}', now() - interval '31 days', 28.6, 77.2);
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address, rider_id, created_at, updated_at) values
  ('{P['unseen']}', '{K1}', '{U['cust']}', 'p-unseen', 'placed', '[]', 100, 'x', null, now() - interval '10 minutes', now() - interval '10 minutes'),
  ('{P['norider']}', '{K1}', '{U['cust']}', 'p-norider', 'ready', '[]', 100, 'x', null, now() - interval '30 minutes', now() - interval '10 minutes'),
  ('{P['outnow']}', '{K1}', '{U['cust']}', 'p-now', 'out_for_delivery', '[]', 100, 'x', '{U['rider']}', now() - interval '20 minutes', now() - interval '5 minutes');
{_call(U['rider'], "rider_ping(28.61, 77.21)")}
{_p(U['rider'], 0, "(select lat from riders where user_id = auth.uid()) = 28.61")}
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['stranger']}', true); perform rider_ping(28.6, 77.2); reset role; create temp table dp1 as select false as v; exception when others then reset role; create temp table dp1 as select (sqlerrm like '%not_allowed%') as v; end; end $$;
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['rider']}', true); perform rider_ping(95, 77.2); reset role; create temp table dp2 as select false as v; exception when others then reset role; create temp table dp2 as select (sqlerrm like '%invalid_location%') as v; end; end $$;
{_call(U['cust'], f"order_platform('{P['unseen']}', 'ios')")}
{_p(U['cust'], 3, f"(select client_platform from orders where id = '{P['unseen']}') = 'ios'")}
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['cust']}', true); perform order_platform('{P['norider']}', 'toaster'); reset role; create temp table dp4 as select false as v; exception when others then reset role; create temp table dp4 as select (sqlerrm like '%invalid_platform%') as v; end; end $$;
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['other']}', true); perform order_platform('{P['norider']}', 'ios'); reset role; create temp table dp5 as select false as v; exception when others then reset role; create temp table dp5 as select (sqlerrm like '%order_not_found%') as v; end; end $$;
{_call(U['cust'], f"customer_call('{P['outnow']}')")}
{_pn(6, f"(select count(*) from order_events where order_id = '{P['outnow']}' and event = 'customer.call' and actor = 'customer') = 1")}
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['stranger']}', true); perform customer_call('{P['outnow']}'); reset role; create temp table dp7 as select false as v; exception when others then reset role; create temp table dp7 as select (sqlerrm like '%order_not_found%') as v; end; end $$;
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['rider2']}', true); perform rider_refused('{P['outnow']}'); reset role; create temp table dp8 as select false as v; exception when others then reset role; create temp table dp8 as select (sqlerrm like '%order_not_found%') as v; end; end $$;
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['rider']}', true); perform rider_refused('{P['norider']}'); reset role; create temp table dp9 as select false as v; exception when others then reset role; create temp table dp9 as select (sqlerrm like '%order_not_found%') as v; end; end $$;
{_call(U['rider'], f"rider_refused('{P['outnow']}')")}
{_pn(10, f"(select status = 'cancelled' and cancel_reason = 'refused_at_door' from orders where id = '{P['outnow']}') and (select count(*) from order_events where order_id = '{P['outnow']}' and event = 'order.cancelled' and actor = 'rider') = 1")}
{_pn(11, f"(select (value->>'orders_day')::int = 30 and (value->>'on_time_pct')::int = 80 and (value->>'ios_share')::numeric = 0.33 from params where session_id = 'global' and key = 'pilot_breakpoints' and version = 1)")}
{_pn(12, f"({NUM}->>'orders_day')::int = 3 and ({NUM}->>'tickets_hour')::int = 3 and ({NUM}->>'missed_day')::int = 1")}
{_pn(13, f"({NUM}->>'on_time_pct')::numeric = 50 and ({NUM}->>'deliveries_rider_hour')::int = 2 and ({NUM}->>'cash_rider')::numeric = 300")}
{_pn(14, f"({NUM}->>'refused_pct')::numeric = 33.3 and ({NUM}->>'ios_share')::numeric = 0.67 and ({NUM}->>'calls_share')::numeric = 0.33")}
{_pn(15, f"({NUM}->>'gap_share')::numeric = 0.5 and ({NUM}->>'pins')::int = 2 and {NUM}->'radius_km' = 'null'::jsonb and {NUM}->'realtime' = 'null'::jsonb")}
{_pn(16, f"pilot_numbers(now() - interval '5 days', now() - interval '4 days', '{K2}')->'numbers'->>'on_time_pct' is null and (pilot_numbers(now() - interval '5 days', now() - interval '4 days', '{K2}')->'numbers'->>'orders_day')::int = 0")}
{_p(U['cust'], 17, "(select count(*) from rider_pings) = 0")}
{_p(U['admin'], 18, f"pilot_numbers({WIN})->'numbers'->>'orders_day' = '3'")}
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['cust']}', true); perform pilot_numbers(now() - interval '1 day', now(), null); reset role; create temp table dp19 as select false as v; exception when others then reset role; create temp table dp19 as select (sqlerrm like '%not_allowed%') as v; end; end $$;
{_pn(20, f"(select count(*) from pilot_watch(3, 5) where order_id = '{P['unseen']}' and kind = 'accept_late') = 1 and (select count(*) from pilot_watch(3, 5) where order_id = '{P['norider']}' and kind = 'rider_late') = 1")}
{_pn(21, f"(select count(*) from pilot_watch(3, 5) where order_id in ('{P['ontime']}', '{P['late']}', '{P['refused']}', '{P['outnow']}')) = 0")}
{_pn(22, f"pilot_watch_mark(jsonb_build_array(jsonb_build_object('order_id', '{P['unseen']}', 'kind', 'accept_late'), jsonb_build_object('order_id', '{P['norider']}', 'kind', 'rider_late'))) = 2")}
{_pn(23, f"(select count(*) from pilot_watch(3, 5) where order_id in ('{P['unseen']}', '{P['norider']}')) = 0 and (select count(*) from order_events where order_id = '{P['unseen']}' and event = 'watch.accept_late') = 1")}
{_pn(24, f"pilot_watch_mark(jsonb_build_array(jsonb_build_object('order_id', '{P['unseen']}', 'kind', 'accept_late'))) = 0")}
create temp table dpn as select pilot_prune() as n;
{_pn(26, "(pilot_numbers(now() - interval '1 day', now(), null)->'numbers'->>'pins')::int = (select max(cardinality(pin_codes)) from kitchens where active)")}
{_pn(25, f"(select n from dpn) >= 1 and (select count(*) from rider_pings where at < now() - interval '30 days') = 0 and (select count(*) from rider_pings where user_id = '{U['rider']}' and lat = 28.61) = 1 and (select count(*) from rider_pings where user_id = '{U['rider']}') >= 9")}
"""
PILOT_NAMES = ["rider_ping updates the rider's last place (the history row is counted in the prune check)", "rider_ping refuses someone who is not a rider", "rider_ping refuses a place outside the earth",
               "the owner of an order saves the phone platform", "an unknown platform is refused", "another customer cannot set the platform", "the owner's Call tap writes one customer.call event",
               "a stranger's Call tap is refused", "another rider cannot mark the order refused", "an order that is not on the way cannot be marked refused",
               "the assigned rider marks an order refused at the door: cancelled, reason, one event by the rider", "params holds pilot_breakpoints version 1 with the table's numbers",
               "pilot_numbers: orders, busiest hour and missed tickets", "pilot_numbers: on time share, deliveries per rider hour, cash per rider", "pilot_numbers: refused share, iPhone share, call share",
               "pilot_numbers: location gap share, pin codes, and unmeasured numbers are null", "pilot_numbers: a quiet kitchen gives zero orders and no shares", "nobody reads the ping history directly (only the functions do)",
               "pilot_numbers: an admin may read", "pilot_numbers: a customer is refused", "pilot_watch: an unseen placed order and a ready order with no rider are listed",
               "pilot_watch: finished and on-the-way orders are not listed", "pilot_watch_mark writes one event per order", "pilot_watch: marked orders are not listed again and the event is stored",
               "pilot_watch_mark: a second mark writes nothing", "pilot_prune deletes pings older than 30 days and keeps the rest", "pilot_numbers: pin codes served is the most around one kitchen, not the sum over all kitchens"]


# Story H15 (#205): platform health numbers and the cost caps (migration 0025). Read as the database owner, like the service role.
def _hn(i: int, expr: str) -> str:
    return f"select set_config('request.jwt.claim.sub', '', true); create temp table dh{i} as select ({expr}) as v;"
HEALTH = f"""
{_hn(0, "(health_numbers()->>'db_mb')::numeric > 0 and (health_numbers()->>'connections')::int >= 1")}
{_hn(1, "(health_numbers()->'rows'->>'orders')::int >= 4 and (health_numbers()->'rows') ?& array['orders', 'run_log', 'rider_pings', 'order_events']")}
{_hn(2, "health_numbers()->'oldest' ?& array['orders', 'run_log', 'rider_pings', 'order_events']")}
{_hn(3, "(health_numbers()->'caps'->>'openrouter_usd')::numeric = 2 and (health_numbers()->'caps'->>'supabase_mb')::int = 500 and (health_numbers()->'caps'->>'n8n_errors_day')::int = 5")}
{_hn(4, "(select count(*) from params where session_id = 'global' and key = 'cost_caps' and version = 1) = 1")}
do $$ begin begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{U['cust']}', true); perform health_numbers(); reset role; create temp table dh5 as select false as v; exception when others then reset role; create temp table dh5 as select (sqlerrm like '%permission denied%') as v; end; end $$;
"""
HEALTH_NAMES = ["health_numbers: database size and open connections", "health_numbers: row counts of the four growing tables", "health_numbers: the oldest row of each", "health_numbers: the cost caps come from params (cost_caps v1)",
                "params holds cost_caps version 1", "a signed-in customer cannot call health_numbers"]

# Story H5 (#188): the synthetic city never mixes with the real one. A synthetic rider is no candidate for a real kitchen and cannot be assigned;
# a synthetic kitchen's order sees synthetic riders only. Run as the database owner (the functions are service_role only).
SIMR2 = "00000000-0000-4000-8000-00000000005b"
SIMR, SIMK, SIMO, SIMD = "00000000-0000-4000-8000-00000000005a", "00000000-0000-4000-8000-0000000001a5", "00000000-0000-4000-8000-0000000002e5", "00000000-0000-4000-8000-0000000003a5"
SIM = f"""
insert into riders (user_id, name, online, lat, lng, synthetic) values ('{SIMR}', 'Sim Rider', true, 28.55, 77.20, true);
insert into kitchens (id, name, pin_codes, open, active, lat, lng, synthetic) values ('{SIMK}', 'Sim Rasoi', '{{900001}}', true, true, 28.55, 77.20, true);
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address) values ('{SIMO}', '{SIMK}', 'sim', 'k-s1', 'ready', '[]', 100, 'x');
create temp table dm0 as select not exists (select 1 from jsonb_array_elements(dispatch_candidates('00000000-0000-4000-8000-0000000002e1') -> 'riders') r where r ->> 'id' = '{SIMR}') as v;
do $$ begin begin perform assign_rider('{O['prep']}', '{SIMR}'); create temp table dm1 as select false as v; exception when others then create temp table dm1 as select (sqlerrm like '%rider_not_available%') as v; end; end $$;
create temp table dm2 as select (select jsonb_agg(r ->> 'id') from jsonb_array_elements(dispatch_candidates('{SIMO}') -> 'riders') r) = '["{SIMR}"]'::jsonb as v;
do $$ begin perform assign_rider('{SIMO}', '{SIMR}'); end $$;
create temp table dm3 as select (select rider_id from orders where id = '{SIMO}') = '{SIMR}' as v;
insert into menu_items (id, kitchen_id, name, price_paise, category, veg, sort, available, synthetic) values ('{SIMD}', '{SIMK}', 'sim dish', 1000, 'main', true, 1, true, true);
create temp table dm4 as select (sim_tick('{{"kitchen_flip_pct":100}}') ->> 'skipped') = 'sim_disabled' and (select lat from riders where user_id = '{SIMR}') = 28.55 and (select open from kitchens where id = '{SIMK}') as v;
do $$ begin perform sim_enable('{{"enabled":true}}'); end $$;
create temp table dm_t as select sim_tick('{{"kitchen_flip_pct":100,"dish_flip_pct":100,"rider_flip_pct":100}}') as t;
create temp table dm_h as select (extract(hour from now() at time zone 'Asia/Kolkata') between 11 and 22) as open_hours;   -- H7: kitchens flip only 11:00 to 23:00 India time
create temp table dm5 as select ((t ->> 'riders_moved')::int = 1 and (t ->> 'kitchens_flipped')::int = (case when open_hours then 1 else 0 end) and (t ->> 'dishes_flipped')::int = 1 and (t ->> 'riders_flipped')::int = 1) as v from dm_t, dm_h;
create temp table dm6 as select (select round(distance_m(28.55, 77.20, lat, lng)) between 100 and 300 and updated_at > now() - interval '5 seconds' from riders where user_id = '{SIMR}') as v;
create temp table dm7 as select (select lat = 28.90 and lng = 77.60 from riders where user_id = '{U['rider2']}') and (select open from kitchens where id = '{K1}') and (select available from menu_items where id = '{DISH}') as v;
create temp table dm8 as select ((select open from kitchens where id = '{SIMK}') = (select not open_hours from dm_h)) and (select not available from menu_items where id = '{SIMD}') and (select not online from riders where user_id = '{SIMR}') as v;
insert into riders (user_id, name, online, lat, lng, synthetic) values ('{SIMR2}', 'Far Sim Rider', true, 28.58, 77.20, true);   -- 3.3 km north of Sim Rasoi
create temp table dm_t2 as select sim_tick('{{"kitchen_flip_pct":0,"dish_flip_pct":0,"rider_flip_pct":0}}') as t;
create temp table dm9 as select (select round(distance_m(lat, lng, 28.55, 77.20)) between 3000 and 3250 from riders where user_id = '{SIMR2}') as v;
do $$ begin perform sim_enable('{{"enabled":false}}'); end $$;
create temp table dm10 as select (select (value ->> 'enabled')::boolean from params where session_id = 'global' and key = 'sim_enabled' order by version desc limit 1) is false and (sim_tick() ->> 'skipped') = 'sim_disabled' as v;
create temp table dm11 as select (sim_status() ->> 'enabled')::boolean is false and (sim_status() ->> 'kitchens')::int = 1 and (sim_status() ->> 'riders')::int = 2 and (sim_status() ->> 'dishes')::int = 1 and (sim_status() ->> 'riders_online')::int = 1 as v;
"""
SIM_NAMES = ["H5: a synthetic online rider is no candidate for a real kitchen's order", "H5: assign_rider refuses a synthetic rider on a real order (rider_not_available)",
             "H5: a synthetic kitchen's order sees synthetic riders only", "H5: a synthetic rider takes a synthetic order",
             "H6: sim_tick does nothing while sim_enabled is off", "H6: an enabled tick moves one rider, flips one kitchen and one dish (100%)",
             "H6: the synthetic rider moved 100 to 300 m and was stamped", "H6: the real rider, kitchen and dish did not change",
             "H6: the synthetic kitchen (in opening hours), dish and rider flipped", "H6: a rider more than 1 km from every synthetic kitchen walks toward the nearest one",
             "H6: sim_enable off writes a new params version and the tick skips again",
             "H7: sim_status says off and counts the synthetic kitchens, riders (online) and dishes"]

# Story #263: the decision engine switch. Run as users; the functions check is_admin() on the caller. A checked copy of the row starts at Rules version 1.
def _eng(uid: str, i: int, expr: str) -> str:
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); create temp table de{i} as select ({expr}) as v; reset role;"
def _eng_raises(uid: str, i: int, stmt: str, msg: str) -> str:
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); do $$ begin begin perform {stmt}; create temp table de{i} as select false as v; exception when others then create temp table de{i} as select (sqlerrm like '%{msg}%') as v; end; end $$; reset role;"
ENGINE = f"""
delete from params where session_id = 'global' and key = 'decision_engine';
insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'decision_engine', '{{"engine":"rules","by":"system"}}', 1);
{_eng(U['admin'], 0, "get_decision_engine() ->> 'engine' = 'rules' and (get_decision_engine() ->> 'version')::int = 1 and (get_decision_engine() -> 'engines' ->> 'laya')::boolean is false")}
{_call(U['admin'], "set_decision_engine('jev')")}
{_eng(U['admin'], 1, "get_decision_engine() ->> 'engine' = 'jev' and (get_decision_engine() ->> 'version')::int = 2 and get_decision_engine() ->> 'by' = 'founder@check.test'")}
{_call(U['admin'], "set_decision_engine('jev')")}
create temp table de2 as select (select count(*) from params where session_id = 'global' and key = 'decision_engine') = 2 as v;
{_eng_raises(U['admin'], 3, "set_decision_engine('laya')", 'laya_not_deployed')}
{_eng_raises(U['admin'], 4, "set_decision_engine('gpt')", 'invalid_engine')}
{_eng_raises(U['cust'], 5, "set_decision_engine('rules')", 'not_admin')}
{_eng_raises(U['cust'], 6, "get_decision_engine()", 'not_admin')}
create temp table de7 as select (select count(*) from params where session_id = 'global' and key = 'decision_engine') = 2 as v;
do $$ begin begin set local role anon; perform set_decision_engine('rules'); reset role; create temp table de8 as select false as v; exception when others then reset role; create temp table de8 as select (sqlerrm like '%permission denied%') as v; end; end $$;
{_call(U['admin'], "set_decision_engine('rules')")}
create temp table de9 as select (select count(*) from params where session_id = 'global' and key = 'decision_engine') = 3 and (select value ->> 'engine' from params where session_id = 'global' and key = 'decision_engine' order by version desc limit 1) = 'rules' as v;
"""
ENGINE_NAMES = ["#263: an admin reads the engine: Rules, version 1, Laya not ready", "#263: an admin sets Jev: version 2, changed by their email", "#263: setting the same engine again writes no new row",
                "#263: Laya is refused (laya_not_deployed)", "#263: an unknown engine is refused (invalid_engine)", "#263: a non-admin cannot set (not_admin)", "#263: a non-admin cannot read (not_admin)",
                "#263: refused calls wrote no row", "#263: the anon role has no permission to call it", "#263: back to Rules is version 3: every change is a new row"]
# Story #263 layer 2: Stage 1 batch dispatch. dispatch_match is a pure function (jsonb in, jsonb out); dispatch_tick reads the tables and applies it.
# Numbers: 0.0009 degrees of latitude is 100 m; a rider 1000 m away is 336 s from the kitchen (x1.4 detour at 15 km/h); the send time is ready - travel - 120 s.
import json as _json
_NOW = 1000000
def _M(riders, orders, kitchens=None, params=None, now=_NOW):
    ks = kitchens or [{"id": "k1", "lat": 28.55, "lng": 77.20}, {"id": "k2", "lat": 28.56, "lng": 77.20}]
    r = [{"ping_age_s": 10, "trips": 0, "load": [], **x} for x in riders]
    return "dispatch_match('" + _json.dumps({"now": now, "params": params or {}, "riders": r, "orders": orders, "kitchens": ks}) + "'::jsonb)"
def _R(i, north_m, trips=0, k=(28.55, 77.20), **kw):
    return {"id": i, "lat": k[0] + north_m * 0.0009 / 100, "lng": k[1], "trips": trips, **kw}
def _O(i, ready_in, k="k1"):
    return {"id": i, "kitchen_id": k, "ready_at": _NOW + ready_in}
def _dd(i, expr):
    return f"create temp table dd{i} as select ({expr}) as v;"
def _dd_raises(uid, i, stmt, msg):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); do $$ begin begin perform {stmt}; create temp table dd{i} as select false as v; exception when others then create temp table dd{i} as select (sqlerrm like '%{msg}%') as v; end; end $$; reset role;"
def _pair(m, o, r, stacked=None):
    st = "" if stacked is None else f" and (a->>'stacked')::boolean = {str(stacked).lower()}"
    return f"exists (select 1 from jsonb_array_elements({m} -> 'assignments') a where a->>'order_id' = '{o}' and a->>'rider_id' = '{r}'{st})"
def _n(m, n):
    return f"jsonb_array_length({m} -> 'assignments') = {n}"
_k2 = (28.56, 77.20)
_m_notdue = _M([_R("ra", 1000)], [_O("o1", 900)])
_m_due = _M([_R("ra", 1000)], [_O("o1", 400)])
_m_best = _M([_R("ra", 200), _R("rb", 200, k=_k2)], [_O("o1", -60), _O("o2", -60, "k2")])
_m_stale = _M([_R("ra", 200, ping_age_s=120)], [_O("o1", -60)])
_m_fair = _M([_R("ra", 300, trips=5), _R("rb", -300, trips=1)], [_O("o1", -60)])
_m_st_ok = _M([_R("ra", 200)], [_O("o1", -10), _O("o2", 60)])
_m_st_gap = _M([_R("ra", 200)], [_O("o1", -10), _O("o2", 230)])
_m_st_far = _M([_R("ra", 200)], [_O("o1", -10), _O("o2", 400)])
_m_st_max = _M([_R("ra", 200)], [_O("o1", -10), _O("o2", -10), _O("o3", -10)])
_m_st_kit = _M([_R("ra", 200)], [_O("o1", -10), _O("o2", -10, "k2")])
_m_st_load = _M([_R("ra", 200, load=[{"order_id": "o0", "kitchen_id": "k1", "ready_at": _NOW + 30}])], [_O("o1", 60)])
_m_st_busy = _M([_R("ra", 200, load=[{"order_id": "o0", "kitchen_id": "k1", "ready_at": _NOW + 30}])], [_O("o1", 60, "k2")])
_zr = lambda n_o, n_r: _M([_R(f"r{j}", 200 + 50 * j) for j in range(n_r)], [_O(f"o{j}", -60) for j in range(n_o)])
def _zone(m, state):
    return f"({m} -> 'zones') @> '[{{\"kitchen_id\":\"k1\",\"state\":\"{state}\"}}]'::jsonb"
DK, DKS, DRR, DSR, DOR, DOS, DZ = ("00000000-0000-4000-8000-0000000001d1", "00000000-0000-4000-8000-0000000001d2", "00000000-0000-4000-8000-00000000006a", "00000000-0000-4000-8000-00000000006b",
    "00000000-0000-4000-8000-0000000002d1", "00000000-0000-4000-8000-0000000002d2", "00000000-0000-4000-8000-0000000002d3")
DISP = f"""
delete from params where session_id = 'global' and key in ('decision_engine', 'dispatch_mode');
insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'decision_engine', '{{"engine":"rules","by":"system"}}', 1), (null, 'global', 'dispatch_mode', '{{"mode":"per_order","by":"system"}}', 1);
{_dd(0, f"{_n(_m_notdue, 0)} and ({_m_notdue} -> 'zones') is not null")}
{_dd(1, _pair(_m_due, "o1", "ra"))}
{_dd(2, f"{_pair(_m_best, 'o1', 'ra')} and {_pair(_m_best, 'o2', 'rb')} and {_n(_m_best, 2)}")}
{_dd(3, _n(_m_stale, 0))}
{_dd(4, _pair(_m_fair, "o1", "rb"))}
{_dd(5, f"{_pair(_m_st_ok, 'o1', 'ra', False)} and {_pair(_m_st_ok, 'o2', 'ra', True)}")}
{_dd(6, f"{_pair(_m_st_gap, 'o1', 'ra')} and {_n(_m_st_gap, 1)}")}
{_dd(7, f"{_pair(_m_st_far, 'o1', 'ra')} and {_n(_m_st_far, 1)}")}
{_dd(8, _n(_m_st_max, 2))}
{_dd(9, f"{_pair(_m_st_kit, 'o1', 'ra')} and {_n(_m_st_kit, 1)}")}
{_dd(10, _pair(_m_st_load, "o1", "ra", True))}
{_dd(11, _n(_m_st_busy, 0))}
{_dd(12, f"{_zone(_zr(4, 2), 'open')} and {_zone(_zr(6, 2), 'slow')} and {_zone(_zr(7, 2), 'closed')}")}
{_dd(13, f"{_zone(_M([], [_O('o1', -60)]), 'closed')} and {_zone(_M([_R('ra', 200)], []), 'open')}")}
{_dd(14, f"({_M([_R('ra', 200)], [_O('o1', -60)], params={'detour': 3.0})} -> 'assignments' -> 0 ->> 'travel_s')::numeric > 100 and ({_M([_R('ra', 200)], [_O('o1', -60)])} -> 'assignments' -> 0 ->> 'travel_s')::numeric between 60 and 70")}
insert into kitchens (id, name, pin_codes, open, active, lat, lng, synthetic) values ('{DK}', 'Disp Real', '{{110098}}', true, true, 28.55, 77.20, false), ('{DKS}', 'Disp Sim', '{{900098}}', true, true, 28.55, 77.20, true);
insert into riders (user_id, name, online, lat, lng, synthetic) values ('{DRR}', 'Real Rider', true, 28.5518, 77.20, false), ('{DSR}', 'Sim Rider', true, 28.5509, 77.20, true);
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address) values
  ('{DOR}', '{DK}', 'disp-s', 'dk-1', 'preparing', '[]', 100, 'x'), ('{DOS}', '{DKS}', 'sim', 'dk-2', 'preparing', '[]', 100, 'x');
insert into order_events (order_id, kitchen_id, session_id, event, actor, created_at) values
  ('{DOR}', '{DK}', 'disp-s', 'order.accepted', 'kitchen', now() - interval '14 minutes'), ('{DOS}', '{DKS}', 'sim', 'order.accepted', 'kitchen', now() - interval '14 minutes');
create temp table dd15 as select (dispatch_tick() ->> 'skipped') = 'not_batch' and (select rider_id from orders where id = '{DOR}') is null as v;
do $$ begin begin perform assign_rider('{DOR}', '{DRR}'); create temp table dd28 as select false as v; exception when others then create temp table dd28 as select (sqlerrm like '%not_ready%') and (select rider_id from orders where id = '{DOR}') is null as v; end; end $$;
create temp table dd16 as select not dispatch_batch_on() and (dispatch_candidates('{DOR}') ->> 'batch') is distinct from 'true' as v;
{_dd_raises(U['admin'], 29, "set_dispatch_mode('batch')", 'gate_rider_app')}
insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'dispatch_gates', '{{"rider_app_early_job": true}}', 2) on conflict (session_id, key, version) do nothing;
{_call(U['admin'], "set_dispatch_mode('batch')")}
create temp table dd17 as select dispatch_batch_on() and (dispatch_candidates('{DOR}') ->> 'batch') = 'true' and (select (value ->> 'mode') = 'batch' from params where session_id = 'global' and key = 'dispatch_mode' order by version desc limit 1) as v;
create temp table dd_t as select dispatch_tick() as t;
create temp table dd18 as select (select rider_id from orders where id = '{DOR}') = '{DRR}' and (select synthetic from riders where user_id = (select rider_id from orders where id = '{DOS}')) as v;
create temp table dd19 as select ((select count(*) from order_events where order_id = '{DOR}' and event = 'order.assigned') = 1 and (t ->> 'assigned')::int >= 2) as v from dd_t;
create temp table dd20 as select exists (select 1 from zone_state where kitchen_id = '{DK}' and state = 'open') as v;
update params set value = '{{"engine":"jev","by":"x"}}' where session_id = 'global' and key = 'decision_engine';
create temp table dd21 as select not dispatch_batch_on() and (dispatch_tick() ->> 'skipped') = 'not_batch' as v;
update params set value = '{{"engine":"rules","by":"x"}}' where session_id = 'global' and key = 'decision_engine';
insert into zone_state (kitchen_id, state, eta_extra_min) values ('{DK}', 'closed', 10) on conflict (kitchen_id) do update set state = 'closed';
do $$ begin begin insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address) values ('{DZ}', '{DK}', 'disp-s', 'dk-3', 'placed', '[]', 100, 'x'); create temp table dd22 as select false as v; exception when others then create temp table dd22 as select (sqlerrm like '%zone_closed%') as v; end; end $$;
update zone_state set state = 'slow' where kitchen_id = '{DK}';
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address) values ('{DZ}', '{DK}', 'disp-s', 'dk-3', 'placed', '[]', 100, 'x');
create temp table dd23 as select exists (select 1 from orders where id = '{DZ}') as v;
delete from orders where id = '{DZ}';
{_call(U['admin'], "set_dispatch_mode('per_order')")}
update zone_state set state = 'closed' where kitchen_id = '{DK}';
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address) values ('{DZ}', '{DK}', 'disp-s', 'dk-3', 'placed', '[]', 100, 'x');
create temp table dd24 as select exists (select 1 from orders where id = '{DZ}') as v;
{_dd_raises(U['cust'], 25, "set_dispatch_mode('batch')", 'not_admin')}
{_dd_raises(U['admin'], 26, "set_dispatch_mode('fast')", 'invalid_mode')}
create temp table dd27 as select (select count(*) from params where session_id = 'global' and key = 'dispatch_mode') = 3 as v;
"""
DISP_NAMES = ["#263 L2: an order whose send time has not come gets no rider", "#263 L2: when its send time has come the rider is assigned", "#263 L2: best pair first, no crossing of kitchens",
  "#263 L2: a rider with a stale ping is not used", "#263 L2: equal travel, the rider with fewer trips today wins", "#263 L2: a second order of the same kitchen, ready within the gap, stacks",
  "#263 L2: a gap that adds more than 5 min does not stack", "#263 L2: ready more than 5 min apart does not stack", "#263 L2: never more than 2 orders for one rider",
  "#263 L2: orders of another kitchen do not stack", "#263 L2: a rider already waiting for one order takes a second of the same kitchen", "#263 L2: a rider waiting at one kitchen takes no order of another",
  "#263 L2: zone throttle: 4 orders for 2 riders open, 6 slow, 7 closed", "#263 L2: no rider and an order waiting is closed; nothing waiting is open", "#263 L2: the detour factor is a tunable",
  "#263 L2: the tick does nothing while the mode is per order", "#263 L2: per-order mode: no batch flag for SUB 22", "#263 L2: an admin can set the batch mode and SUB 22 is told to stand down",
  "#263 L2: the tick gives real orders to real riders and synthetic orders to synthetic riders", "#263 L2: the assignment writes one order.assigned event", "#263 L2: the tick writes the zone state",
  "#263 L2: with the engine on Jev the batch rule is off", "#263 L2: a closed zone refuses a new order in batch mode", "#263 L2: a slow zone still takes the order",
  "#263 L2: in per-order mode a closed zone changes nothing", "#263 L2: a non-admin cannot set the mode", "#263 L2: an unknown mode is refused", "#263 L2: every mode change is a new row",
  "#263 L2: in per-order mode an early assignment (food still being made) is refused", "#263 L2: batch mode is refused while the rider app cannot show an early job (hard gate)"]
# Story #272: per-order mode picks the nearest free rider; trips today break a tie only inside a band (params per_order_rules.near_band_m, 500 m).
NK = "00000000-0000-4000-8000-0000000001e1"
NO = "00000000-0000-4000-8000-0000000002e8"
NR = {n: f"00000000-0000-4000-8000-0000000007{i:02x}" for i, n in enumerate(["a", "b", "c", "d"], start=1)}
def _nr(name, north_m, trips=0, extra=""):
    lat = "null" if north_m is None else f"28.55 + {north_m} * 0.0009 / 100"
    return f"insert into riders (user_id, name, online, lat, lng, synthetic) values ('{NR[name]}', 'N {name}', true, {lat}, 77.20, false);"
def _pos(name):
    return f"(select min(ord) from jsonb_array_elements(dispatch_candidates('{NO}') -> 'riders') with ordinality t(r, ord) where r ->> 'id' = '{NR[name]}')"
def _trips(name, n):
    return "".join(f"insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address, rider_id) values (gen_random_uuid(), '{NK}', 'near-{name}', 'nk-{name}-{i}', 'delivered', '[]', 100, 'x', '{NR[name]}');" for i in range(n))
def _dn(i, expr):
    return f"create temp table dn{i} as select ({expr}) as v;"
NEAR = f"""
delete from params where session_id = 'global' and key in ('decision_engine', 'dispatch_mode');
insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'decision_engine', '{{"engine":"rules","by":"system"}}', 1), (null, 'global', 'dispatch_mode', '{{"mode":"per_order","by":"system"}}', 1);
update riders set online = false where not synthetic and user_id not in ('{NR['a']}', '{NR['b']}', '{NR['c']}', '{NR['d']}');
insert into kitchens (id, name, pin_codes, open, active, lat, lng, synthetic) values ('{NK}', 'Near Kitchen', '{{110097}}', true, true, 28.55, 77.20, false);
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address) values ('{NO}', '{NK}', 'near-s', 'nk-0', 'ready', '[]', 100, 'x');
{_nr("a", 400)}{_nr("b", 3000)}{_trips("a", 3)}
{_dn(8, f"not (dispatch_candidates('{NO}') -> 'riders' -> 0 ? 'rank') and {_pos('a')} < {_pos('b')}")}
insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'per_order_rules', '{{"pick":"nearest_band","near_band_m":500,"fresh_ping_s":90}}', 3);
{_dn(0, f"{_pos('a')} < {_pos('b')}")}
update riders set lat = 28.55 + 300 * 0.0009 / 100 where user_id = '{NR['a']}';
update riders set lat = 28.55 + 600 * 0.0009 / 100 where user_id = '{NR['b']}';
{_dn(1, f"{_pos('b')} < {_pos('a')}")}
insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'per_order_rules', '{{"pick":"nearest_band","near_band_m":100,"fresh_ping_s":90}}', 4) on conflict (session_id, key, version) do nothing;
{_dn(2, f"{_pos('a')} < {_pos('b')}")}
delete from params where session_id = 'global' and key = 'per_order_rules' and version = 4;
{_nr("c", None)}
{_dn(3, f"{_pos('a')} < {_pos('c')} and {_pos('b')} < {_pos('c')}")}
update riders set updated_at = now() - interval '5 minutes' where user_id = '{NR['a']}';
{_dn(4, f"{_pos('b')} < {_pos('a')} and {_pos('a')} is not null")}
update riders set updated_at = now() - interval '5 minutes' where user_id in ('{NR['b']}', '{NR['c']}');
{_dn(5, f"jsonb_array_length(dispatch_candidates('{NO}') -> 'riders') >= 3 and {_pos('a')} < {_pos('b')}")}
update riders set updated_at = now() where user_id in ('{NR['a']}', '{NR['b']}', '{NR['c']}');
insert into orders (id, kitchen_id, session_id, client_order_key, status, items, total_paise, address, rider_id) values (gen_random_uuid(), '{NK}', 'near-a2', 'nk-busy', 'out_for_delivery', '[]', 100, 'x', '{NR['a']}');
{_dn(6, f"{_pos('b')} < {_pos('a')} and (select (r ->> 'free')::boolean from jsonb_array_elements(dispatch_candidates('{NO}') -> 'riders') r where r ->> 'id' = '{NR['a']}') is false")}
{_dn(7, f"(select bool_and((r ->> 'rank')::int = ord) from jsonb_array_elements(dispatch_candidates('{NO}') -> 'riders') with ordinality t(r, ord))")}
delete from params where session_id = 'global' and key = 'per_order_rules' and version = 3;
"""
NEAR_NAMES = ["#272: a free rider 400 m away beats one 3 km away even with more trips", "#272: two riders inside the 500 m band: fewer trips today wins",
  "#272: the band is a tunable (100 m: the nearer rider wins again)", "#272: a rider with no place on the map is last",
  "#272: a stale ping ranks behind a fresh one, but is still a candidate", "#272: only stale pings: still candidates, nearest first",
  "#272: a rider on a delivery ranks behind free riders even if nearer", "#272: the list comes back in rank order, rank 1, 2, 3 ...", "#272: default params (pick fewest_trips) give today's order exactly, no rank"]

def run(ref: str, query: str):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {gsvault.setting(os.environ, 'SUPABASE_ACCESS_TOKEN', '02_databases.env')}", "Content-Type": "application/json", "User-Agent": "goserve-check"})
    return json.load(urllib.request.urlopen(req))


def build() -> str:
    selects = [f"select 'c{i}' as k, v from c{i}" for i in range(len(checks))] + [f"select 'cx{j}' as k, v from cx{j}" for j in range(len(EXTRA_NAMES))] + [f"select 'dx{j}' as k, v from dx{j}" for j in range(len(DISPATCH_NAMES))] + [f"select 'dr{j}' as k, v from dr{j}" for j in range(len(RIDER_NAMES))] + [f"select 'ds{j}' as k, v from ds{j}" for j in range(len(STAFF_NAMES))] + [f"select 'dp{j}' as k, v from dp{j}" for j in range(len(PILOT_NAMES))] + [f"select 'dh{j}' as k, v from dh{j}" for j in range(len(HEALTH_NAMES))] + [f"select 'dm{j}' as k, v from dm{j}" for j in range(len(SIM_NAMES))] + [f"select 'de{j}' as k, v from de{j}" for j in range(len(ENGINE_NAMES))] + [f"select 'dd{j}' as k, v from dd{j}" for j in range(len(DISP_NAMES))] + [f"select 'dn{j}' as k, v from dn{j}" for j in range(len(NEAR_NAMES))]
    return "\n".join(["begin;", SETUP, *[sql for _, sql in checks], FINAL_EXTRA, DISPATCH, RIDER_CARD, STAFF, PILOT, HEALTH, SIM, ENGINE, DISP, NEAR, " union all ".join(selects) + ";", "rollback;"])


if __name__ == "__main__":
    if sys.argv[1:] != ["dev"]:
        sys.exit("Usage: check_city_model.py dev (prod is never allowed)")
    rows = {r["k"]: r["v"] for r in run(DEV_REF, build())}
    names = [n for n, _ in checks] + EXTRA_NAMES + DISPATCH_NAMES + RIDER_NAMES + STAFF_NAMES + PILOT_NAMES + HEALTH_NAMES + SIM_NAMES + ENGINE_NAMES + DISP_NAMES + NEAR_NAMES
    keys = [f"c{i}" for i in range(len(checks))] + [f"cx{j}" for j in range(len(EXTRA_NAMES))] + [f"dx{j}" for j in range(len(DISPATCH_NAMES))] + [f"dr{j}" for j in range(len(RIDER_NAMES))] + [f"ds{j}" for j in range(len(STAFF_NAMES))] + [f"dp{j}" for j in range(len(PILOT_NAMES))] + [f"dh{j}" for j in range(len(HEALTH_NAMES))] + [f"dm{j}" for j in range(len(SIM_NAMES))] + [f"de{j}" for j in range(len(ENGINE_NAMES))] + [f"dd{j}" for j in range(len(DISP_NAMES))] + [f"dn{j}" for j in range(len(NEAR_NAMES))]
    bad = 0
    for n, k in zip(names, keys):
        ok = rows.get(k) is True
        bad += not ok
        print(("ok   " if ok else "FAIL ") + n)
    print(f"{len(names) - bad} of {len(names)} checks passed")
    sys.exit(1 if bad else 0)
