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
               "pilot_watch_mark: a second mark writes nothing", "pilot_prune deletes pings older than 30 days and keeps the rest"]


def run(ref: str, query: str):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-check"})
    return json.load(urllib.request.urlopen(req))


def build() -> str:
    selects = [f"select 'c{i}' as k, v from c{i}" for i in range(len(checks))] + [f"select 'cx{j}' as k, v from cx{j}" for j in range(len(EXTRA_NAMES))] + [f"select 'dx{j}' as k, v from dx{j}" for j in range(len(DISPATCH_NAMES))] + [f"select 'dr{j}' as k, v from dr{j}" for j in range(len(RIDER_NAMES))] + [f"select 'ds{j}' as k, v from ds{j}" for j in range(len(STAFF_NAMES))] + [f"select 'dp{j}' as k, v from dp{j}" for j in range(len(PILOT_NAMES))]
    return "\n".join(["begin;", SETUP, *[sql for _, sql in checks], FINAL_EXTRA, DISPATCH, RIDER_CARD, STAFF, PILOT, " union all ".join(selects) + ";", "rollback;"])


if __name__ == "__main__":
    if sys.argv[1:] != ["dev"]:
        sys.exit("Usage: check_city_model.py dev (prod is never allowed)")
    rows = {r["k"]: r["v"] for r in run(DEV_REF, build())}
    names = [n for n, _ in checks] + EXTRA_NAMES + DISPATCH_NAMES + RIDER_NAMES + STAFF_NAMES + PILOT_NAMES
    keys = [f"c{i}" for i in range(len(checks))] + [f"cx{j}" for j in range(len(EXTRA_NAMES))] + [f"dx{j}" for j in range(len(DISPATCH_NAMES))] + [f"dr{j}" for j in range(len(RIDER_NAMES))] + [f"ds{j}" for j in range(len(STAFF_NAMES))] + [f"dp{j}" for j in range(len(PILOT_NAMES))]
    bad = 0
    for n, k in zip(names, keys):
        ok = rows.get(k) is True
        bad += not ok
        print(("ok   " if ok else "FAIL ") + n)
    print(f"{len(names) - bad} of {len(names)} checks passed")
    sys.exit(1 if bad else 0)
