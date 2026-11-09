# Story #1129 (board NK-A): the early-friend promise. "Tell me when you come here" writes a Rs 100 promise on the area_requests row (offer_paise, offered_at).
# When a kitchen serves that pin and the account places its first order, place_order_v2 takes Rs 100 off, once, and records it on the order. The client is never trusted for it.
# Every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it. Red run: SKIP_MIG=1.
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_place_order_v2 import K, SETUP, LINES, BILL, RES

MIG = migration_inside(["20261109120000_early_friend.sql"], "exists (select 1 from information_schema.columns where table_name = 'area_requests' and column_name = 'offer_paise')")
U = "00000000-0000-0000-0000-0000000000a9"
PIN = "110016"   # the kitchen K lists this pin
FAR = "560001"   # no kitchen lists this pin
CUSTOMER = lambda pin=PIN: f"insert into customers (user_id, phone, pin_code) values ('{U}', '9876543210', '{pin}')"


def tap(pin=PIN, uid=U):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); select area_request_add_v2('{pin}'); reset role"


def order(key="k1"):
    return f"insert into res (r) select place_order_v2('{U}', '{key}', {K}, '{LINES}'::jsonb, 'Flat 4, Green Park', 32000, '{BILL}'::jsonb)"


def run(*stmts, final=""):
    last = f"select {RES} as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + SETUP + ["create temp table res (i serial, r jsonb)"] + list(stmts) + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


REQ = f"(select row_to_json(x) from (select offer_paise, offered_at is not null as stamped, offer_order_id is not null as used from area_requests where user_id = '{U}') x) as req"
TOTALS = f"(select jsonb_agg(jsonb_build_object('total', total_paise, 'off', bill->>'early_friend_paise', 'pay', bill->>'to_pay_paise') order by client_order_key) from orders where session_id = '{U}') as t"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class EarlyFriend(unittest.TestCase):
    def test_s1_the_tap_writes_the_promise_on_the_row(self):
        r = run(CUSTOMER(FAR), tap(FAR), final=REQ)
        self.assertEqual(r["req"], {"offer_paise": 10000, "stamped": True, "used": False}, r)

    def test_s2_the_first_order_at_a_served_pin_takes_rs_100_off_and_records_it(self):
        r = run(CUSTOMER(), tap(), order(), final=REQ + ", " + TOTALS)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["order"]["total_paise"]), (True, 22000), r)
        self.assertEqual(r["t"], [{"total": 22000, "off": "10000", "pay": "22000"}], r)
        self.assertEqual(r["req"]["used"], True, r)

    def test_s3_the_second_order_gets_nothing(self):
        r = run(CUSTOMER(), tap(), order("k1"), order("k2"), final=TOTALS)
        self.assertEqual([x["total"] for x in r["t"]], [22000, 32000], r)

    def test_s4_a_retry_of_the_first_order_does_not_spend_the_promise_twice(self):
        r = run(CUSTOMER(), tap(), order("k1"), order("k1"), final=TOTALS)
        self.assertEqual(([x["total"] for x in r["t"]], r["rs"][1]["created"]), ([22000], False), r)

    def test_s5_a_pin_we_still_do_not_serve_gets_nothing(self):
        r = run(CUSTOMER(), tap(FAR), order(), final=REQ + ", " + TOTALS)
        self.assertEqual(r["t"], [{"total": 32000, "off": None, "pay": "32000"}], r)
        self.assertEqual(r["req"]["used"], False, r)

    def test_s6_no_promise_no_discount(self):
        r = run(CUSTOMER(), order(), final=TOTALS)
        self.assertEqual(r["t"], [{"total": 32000, "off": None, "pay": "32000"}], r)

    def test_s7_a_first_order_that_was_cancelled_does_not_burn_a_promise_never_used(self):
        r = run(CUSTOMER(), order("k1"), f"update orders set status = 'cancelled' where session_id = '{U}'", tap(), order("k2"), final=TOTALS)
        self.assertEqual([x["total"] for x in r["t"]], [32000, 22000], r)

    def test_s8_the_discount_never_goes_below_zero(self):
        cheap = '{"item_total_paise": 3000, "fees": {"delivery_paise": 0, "packaging_paise": 0, "total_paise": 0}, "discount_paise": 0, "tax_paise": 0, "to_pay_paise": 3000}'
        one = f"insert into res (r) select place_order_v2('{U}', 'k1', {K}, '[{{\"menu_item_id\": \"00000000-0000-0000-0000-0000000000b2\", \"qty\": 1}}]'::jsonb, 'Flat 4', 14000, '{cheap.replace('3000', '14000')}'::jsonb)"
        r = run(CUSTOMER(), tap(), one, final=TOTALS)
        self.assertEqual(r["t"][0]["total"], 4000, r)


if __name__ == "__main__":
    unittest.main()
