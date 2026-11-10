# Story #1129 (board NK-A): the early-friend promise. "Tell me when you come here" writes a Rs 100 promise on the area_requests row (offer_paise, offered_at).
# When a kitchen serves that pin and the account places its first order, place_order_v2 takes Rs 100 off, once, and records it on the order. The client is never trusted for it.
# Every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it. Red run: SKIP_MIG=1.
import json, os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_place_order_v2 import K, D, SETUP, LINES, BILL, RES

MIG = migration_inside(["20261109130000_early_friend_followups.sql"], "to_regproc('public.early_friend_for') is not null")
SWITCH = migration_inside(["20261110160000_early_friend_switch.sql"], "to_regproc('public.early_friend_set_v2') is not null")
ON = "update settings set value = '{\"on\": true, \"amount_paise\": 10000}' where name = 'early_friend'"   # story 1329: the offer is off by default; these cases are about the offer being on
U = "00000000-0000-0000-0000-0000000000a9"
PIN = "110016"   # the kitchen K lists this pin
FAR = "560001"   # no kitchen lists this pin
CUSTOMER = lambda pin=PIN: f"insert into customers (user_id, phone, pin_code) values ('{U}', '9876543210', '{pin}')"
GIFT = json.dumps({"item_total_paise": 32000, "fees": {"delivery_paise": 0, "packaging_paise": 0, "total_paise": 0}, "discount_paise": 0, "tax_paise": 0, "to_pay_paise": 22000, "early_friend_paise": 10000})   # the bill the quote makes for a customer with the promise


def tap(pin=PIN, uid=U):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); select area_request_add_v2('{pin}'); reset role"


def order(key="k1", bill=BILL, pin=None):
    p = f", p_pin => '{pin}'" if pin else ""
    return f"insert into res (r) select place_order_v2('{U}', '{key}', {K}, '{LINES}'::jsonb, 'Flat 4, Green Park', 32000, '{bill}'::jsonb{p})"


def run(*stmts, final=""):
    last = f"select {RES} as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + ([SWITCH] if SWITCH else []) + [ON] + SETUP + ["create temp table res (i serial, r jsonb)"] + list(stmts) + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


REQ = f"(select row_to_json(x) from (select offer_paise, offered_at is not null as stamped, offer_order_id is not null as used from area_requests where user_id = '{U}') x) as req"
TOTALS = f"(select jsonb_agg(jsonb_build_object('total', total_paise, 'off', bill->>'early_friend_paise', 'pay', bill->>'to_pay_paise') order by client_order_key) from orders where session_id = '{U}') as t"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class EarlyFriend(unittest.TestCase):
    def test_s1_the_tap_writes_the_promise_on_the_row(self):
        r = run(CUSTOMER(FAR), tap(FAR), final=REQ)
        self.assertEqual(r["req"], {"offer_paise": 10000, "stamped": True, "used": False}, r)

    def test_s2_the_first_order_at_a_served_pin_carries_the_gift_the_quote_showed_and_spends_the_promise(self):
        r = run(CUSTOMER(), tap(), order(bill=GIFT), final=REQ + ", " + TOTALS)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["order"]["total_paise"]), (True, 22000), r)
        self.assertEqual(r["t"], [{"total": 22000, "off": "10000", "pay": "22000"}], r)
        self.assertEqual(r["req"]["used"], True, r)

    def test_s2b_a_bill_without_the_gift_while_the_promise_stands_is_refused_never_silently_changed(self):
        r = run(CUSTOMER(), tap(), order(), final=REQ + ", " + TOTALS)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["error"], r["t"], r["req"]["used"]), (False, "price_changed", None, False), r)

    def test_s2c_a_bill_that_claims_a_gift_nobody_promised_is_refused(self):
        r = run(CUSTOMER(), order(bill=GIFT), final=TOTALS)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["error"], r["t"]), (False, "price_changed", None), r)

    def test_s3_the_second_order_gets_nothing_and_a_bill_with_the_gift_is_refused(self):
        r = run(CUSTOMER(), tap(), order("k1", GIFT), order("k2"), order("k3", GIFT), final=TOTALS)
        self.assertEqual([x["total"] for x in r["t"]], [22000, 32000], r)
        self.assertEqual(r["rs"][2]["error"], "price_changed", r)

    def test_s4_a_retry_of_the_first_order_does_not_spend_the_promise_twice(self):
        r = run(CUSTOMER(), tap(), order("k1", GIFT), order("k1", GIFT), final=TOTALS)
        self.assertEqual(([x["total"] for x in r["t"]], r["rs"][1]["created"]), ([22000], False), r)

    def test_s5_a_pin_we_still_do_not_serve_gets_nothing(self):
        r = run(CUSTOMER(), tap(FAR), order(), final=REQ + ", " + TOTALS)
        self.assertEqual(r["t"], [{"total": 32000, "off": None, "pay": "32000"}], r)
        self.assertEqual(r["req"]["used"], False, r)

    def test_s6_no_promise_no_discount(self):
        r = run(CUSTOMER(), order(), final=TOTALS)
        self.assertEqual(r["t"], [{"total": 32000, "off": None, "pay": "32000"}], r)

    def test_s7_a_cancelled_first_order_releases_the_promise_and_the_next_order_gets_it(self):
        r = run(CUSTOMER(), tap(), order("k1", GIFT), f"update orders set status = 'cancelled' where session_id = '{U}'", order("k2", GIFT), final=REQ + ", " + TOTALS)
        self.assertEqual([x["total"] for x in r["t"]], [22000, 22000], r)
        self.assertEqual(r["req"]["used"], True, r)   # now spent by the second order

    def test_s7b_the_promise_is_free_again_the_moment_the_first_order_is_cancelled(self):
        r = run(CUSTOMER(), tap(), order("k1", GIFT), f"update orders set status = 'cancelled', cancelled_by = 'kitchen', cancel_reason = 'Out of stock' where session_id = '{U}'", final=REQ)
        self.assertEqual(r["req"]["used"], False, r)

    def test_s8_the_gift_never_takes_the_bill_below_zero(self):
        cheap = json.dumps({"item_total_paise": 6000, "fees": {"delivery_paise": 0, "packaging_paise": 0, "total_paise": 0}, "discount_paise": 0, "tax_paise": 0, "to_pay_paise": 0, "early_friend_paise": 6000})
        one = f"insert into res (r) select place_order_v2('{U}', 'k1', {K}, '[{{\"menu_item_id\": \"00000000-0000-0000-0000-0000000000b2\", \"qty\": 1}}]'::jsonb, 'Flat 4', 6000, '{cheap}'::jsonb)"
        r = run(f"update menu_items set price_paise = 6000 where id = {D}", CUSTOMER(), tap(), one, final=TOTALS)
        self.assertEqual((r["rs"][0]["ok"], r["t"][0]["total"]), (True, 0), r)

    def test_s9_the_delivery_pin_decides_not_the_profile_pin(self):
        r = run(CUSTOMER(FAR), tap(), order(bill=GIFT, pin=PIN), final=REQ + ", " + TOTALS)
        self.assertEqual((r["rs"][0]["ok"], r["t"]), (True, [{"total": 22000, "off": "10000", "pay": "22000"}]), r)

    def test_s9b_a_delivery_pin_no_kitchen_serves_is_refused_whatever_the_profile_says(self):
        r = run(CUSTOMER(PIN), order(pin=FAR), final=TOTALS)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["error"], r["t"]), (False, "not_served", None), r)

    def test_s10_the_preview_says_what_the_order_will_take_and_then_nothing(self):
        r = run(CUSTOMER(), tap(), f"insert into res (r) select to_jsonb(early_friend_for('{U}', '{PIN}', 32000))", order(bill=GIFT), f"insert into res (r) select to_jsonb(early_friend_for('{U}', '{PIN}', 32000))")
        self.assertEqual([r["rs"][0], r["rs"][2]], [10000, 0], r)


if __name__ == "__main__":
    unittest.main()
