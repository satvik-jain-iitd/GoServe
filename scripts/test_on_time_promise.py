# Story #353 (E27, plan v2 B.17): an on-time promise. The promised time is stored when the order is made; a late delivery gives the customer a personal coupon.
# Scenario: Given a promised time, when delivery is later, then a coupon is created for that customer.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_on_time_promise.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN
from test_payments import O, CUST, OTHER, q, run
from test_ratings import walk

LATE = f"update orders set promised_at = now() - interval '5 minutes' where id = '{O}'"
COUPONS = ("(select coalesce(jsonb_agg(row_to_json(c) order by c.code), '[]'::jsonb) from (select code, session_id, kind, amount_paise, max_uses, order_id, active, "
           "(ends_at - starts_at) as span from coupons where order_id is not null) c) as late")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OnTimePromise(unittest.TestCase):
    def test_the_promised_time_is_stored_when_the_order_is_made_default_45_minutes(self):
        r = run(final=f"(select extract(epoch from (promised_at - created_at)) / 60 as mins from orders where id = '{O}') ")
        self.assertEqual(round(float(r["mins"])), 45, r)

    def test_the_promise_follows_the_versioned_param(self):
        newer = "insert into params (session_id, key, value, version) values ('global', 'on_time_promise', '{\"promise_min\": 30, \"late_coupon_paise\": 5000, \"late_coupon_days\": 30}', 99)"
        make = f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{O[:-1]}7', '00000000-0000-0000-0000-0000000000b1', '{CUST}', 'k7', '[]', 100, 'x')"
        r = run(newer, make, final=f"(select extract(epoch from (promised_at - created_at)) / 60 as mins from orders where id = '{O[:-1]}7')")
        self.assertEqual(round(float(r["mins"])), 30, r)

    def test_a_late_delivery_makes_one_personal_coupon_for_that_customer_the_scenario(self):
        r = run(*late_walk(), final=COUPONS)
        self.assertEqual(len(r["late"]), 1, r)
        c = r["late"][0]
        self.assertEqual((c["session_id"], c["kind"], c["amount_paise"], c["max_uses"], c["order_id"], c["active"]), (CUST, "flat", 5000, 1, O, True), r)
        self.assertTrue(c["code"].startswith("LATE-"), r)
        self.assertEqual(c["span"], "30 days", r)

    def test_an_on_time_delivery_makes_no_coupon(self):
        r = run(*walk(), final=COUPONS)
        self.assertEqual(r["late"], [], r)

    def test_a_cancelled_late_order_makes_no_coupon(self):
        r = run(LATE, f"update orders set status = 'cancelled' where id = '{O}'", final=COUPONS)
        self.assertEqual(r["late"], [], r)

    def test_a_personal_coupon_is_not_public_and_is_listed_only_for_its_customer(self):
        r = run(*late_walk(), q("coupons_valid_v2()"), q(f"coupons_for_session_v2('{CUST}')"), q(f"coupons_for_session_v2('{OTHER}')"))
        codes = lambda i: [c["code"] for c in r["rs"][i]]
        self.assertEqual(codes(0), [], r)
        self.assertEqual(len(codes(1)), 1, r)
        self.assertEqual(codes(2), [], r)


def late_walk():
    return [LATE] + walk()


if __name__ == "__main__":
    unittest.main()
