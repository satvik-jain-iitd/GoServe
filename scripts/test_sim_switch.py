# Story (owner, 29 Oct 2026, epic E16): the seeded kitchens and riders stay on prod for the Play testers, and the admin Seed/Reset must switch them fully off.
# Scenario: Given the dream city and rows in every table that grew after migration 0028 (trace, push outbox, open alerts, rating, payment, coupon, decisions, rider pings, a guest order),
# when sim_reset() runs, then no synthetic kitchen, rider or dish is left, every real kitchen, its menu, its orders and its riders are unchanged, a real pin still finds its kitchen, a synthetic-only pin finds none, and Seed brings the same city back.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_sim_switch.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

GUEST = "00000000-0000-0000-0000-0000000000c1"
O1, O2, O3 = [f"00000000-0000-0000-0000-0000000000d{i}" for i in (1, 2, 3)]
SYN_K = "(select id from kitchens where synthetic order by name limit 1)"
SYN_DISH = f"(select id from menu_items where kitchen_id = {SYN_K} limit 1)"
SYN_RIDER = "(select user_id from riders where synthetic order by name limit 1)"
REAL = {
    "kitchens": "(select md5(coalesce(string_agg(k::text, '|' order by id), '')) from kitchens k where not synthetic)",
    "menu": "(select md5(coalesce(string_agg(m::text, '|' order by id), '')) from menu_items m where not synthetic and kitchen_id in (select id from kitchens where not synthetic))",
    "orders": "(select md5(coalesce(string_agg(o::text, '|' order by id), '')) from orders o where kitchen_id in (select id from kitchens where not synthetic))",
    "riders": "(select md5(coalesce(string_agg(r::text, '|' order by user_id), '')) from riders r where not synthetic)",
}
SYN = {
    "kitchens": "(select count(*) from kitchens where synthetic)", "riders": "(select count(*) from riders where synthetic)",
    "dishes": "(select count(*) from menu_items where synthetic)",
    "orders": "(select count(*) from orders where id in ('%s', '%s', '%s'))" % (O1, O2, O3),
    "trace": f"(select count(*) from order_trace where order_id in ('{O1}', '{O2}', '{O3}'))",
    "outbox": f"(select count(*) from push_outbox where order_id in ('{O1}', '{O2}', '{O3}') or kitchen_id in (select id from kitchens where synthetic))",
    "alerts": "(select count(*) from open_alerts where kitchen_id in (select id from kitchens where synthetic))",
    "rating": f"(select count(*) from order_ratings where order_id in ('{O1}', '{O2}', '{O3}'))",
    "payment": f"(select count(*) from payments where order_id in ('{O1}', '{O2}', '{O3}'))",
    "decisions": "(select count(*) from decision_log where session_id = 'sim-switch')",
    "pings": "(select count(*) from rider_pings where user_id not in (select user_id from riders))",
    "coupons": "(select count(*) from coupons where code = 'SWITCH1')",   # a late coupon made for a sim order goes with the order
}
SETUP = [
    "create temp table res (i serial, r jsonb)",
    "insert into res (r) select jsonb_build_object('real', jsonb_build_object(" + ", ".join(f"'{k}', {v}" for k, v in REAL.items()) + "))",
    "insert into res (r) select sim_seed('{}'::jsonb)",
    "insert into res (r) select jsonb_build_object('seeded', jsonb_build_object(" + ", ".join(f"'{k}', {v}" for k, v in SYN.items() if k in ("kitchens", "riders", "dishes")) + "))",
    f"insert into auth.users (id) values ('{GUEST}')",
    # a guest order and two sim orders on synthetic kitchens
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, status) values "
    f"('{O1}', {SYN_K}, '{GUEST}', 'sw1', '[]', 20000, 'Flat 4', 'delivered'), ('{O2}', {SYN_K}, 'sim', 'sw2', '[]', 15000, 'Sim road', 'placed'), "
    f"('{O3}', {SYN_K}, 'sim', 'sw3', '[]', 9000, 'Sim road 2', 'delivered')",
    f"update orders set rider_id = {SYN_RIDER} where id = '{O3}'",
    f"insert into order_trace (order_id, actor, event) values ('{O1}', 'app', 'placed'), ('{O2}', 'sim', 'tick')",
    f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{GUEST}', 'https://push.test/sw', 'k', 'a')",
    f"insert into push_outbox (order_id, session_id, status) values ('{O1}', '{GUEST}', 'placed')",
    f"insert into push_outbox (session_id, status, kind, kitchen_id) values ('{GUEST}', 'open', 'kitchen_open', {SYN_K})",
    f"insert into open_alerts (session_id, kitchen_id) values ('{GUEST}', {SYN_K})",
    f"insert into order_ratings (order_id, food_score) values ('{O1}', 5)",
    f"insert into payments (order_id, provider, provider_order_id, amount_paise) values ('{O1}', 'fake', 'sw-pay-1', 20000)",
    f"insert into coupons (code, title, kind, amount_paise, ends_at, session_id, order_id) values ('SWITCH1', 'Late', 'flat', 1000, now() + interval '1 day', '{GUEST}', '{O1}')",
    f"insert into decision_log (kitchen_id, session_id, order_id, decision) values ({SYN_K}, 'sim-switch', '{O1}', '{{}}')",
    f"insert into rider_pings (user_id, lat, lng) values ({SYN_RIDER}, 28.6, 77.2)",
    "insert into res (r) select jsonb_build_object('rows', jsonb_build_object(" + ", ".join(f"'{k}', {v}" for k, v in SYN.items()) + "))",
]
RESET = ["insert into res (r) select sim_reset()", "insert into res (r) select jsonb_build_object('after', jsonb_build_object(" + ", ".join(f"'{k}', {v}" for k, v in SYN.items()) + ", "
         + ", ".join(f"'real_{k}', {v}" for k, v in REAL.items()) + "))"]
AGAIN = ["insert into res (r) select sim_seed('{}'::jsonb)",
         "insert into res (r) select jsonb_build_object('again', jsonb_build_object(" + ", ".join(f"'{k}', {v}" for k, v in SYN.items() if k in ("kitchens", "riders", "dishes")) + "))"]


def run(*steps):
    r = sql("begin; " + "; ".join(SETUP + [s for st in steps for s in st] + ["select (select jsonb_agg(r order by i) from res) as rs"]) + "; rollback;")
    assert isinstance(r, list), r
    return {k: v for x in r[-1]["rs"] for k, v in x.items()}


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class SimSwitch(unittest.TestCase):
    def test_reset_removes_every_synthetic_row_and_every_row_that_hangs_on_one(self):
        r = run(RESET)
        self.assertTrue(r["ok"], r)
        a = r["after"]
        self.assertEqual({k: a[k] for k in SYN}, {k: 0 for k in SYN}, a)

    def test_every_real_kitchen_its_menu_its_orders_and_riders_are_unchanged(self):
        r = run(RESET)
        a = r["after"]
        self.assertEqual({k: a["real_" + k] for k in REAL}, r["real"], r)

    def test_a_real_pin_still_finds_its_kitchen_and_a_synthetic_only_pin_finds_none(self):
        r = run(RESET, ["insert into res (r) select jsonb_build_object('pins', jsonb_build_object("
                        "'real_kitchens_with_menu', (select count(*) from kitchens k where not synthetic and active and exists (select 1 from menu_items m where m.kitchen_id = k.id)), "
                        "'synthetic_only', (select count(*) from kitchens where pin_codes && (select array_agg(p) from (select unnest(pin_codes) p from kitchens where synthetic) s) and not synthetic)))"])
        self.assertGreaterEqual(r["pins"]["real_kitchens_with_menu"], 1, r)
        self.assertEqual(r["pins"]["synthetic_only"], 0, r)   # no real kitchen serves a pin that only the synthetic city used

    def test_seed_after_reset_brings_back_the_same_city(self):
        r = run(RESET, AGAIN)
        self.assertEqual(r["again"], r["seeded"], r)
        self.assertGreater(r["seeded"]["kitchens"], 0, r)


if __name__ == "__main__":
    unittest.main()
