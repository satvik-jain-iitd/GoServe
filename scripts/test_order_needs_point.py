# Story 1528: every order has an exact point. Scenario "The server refuses an order with no point": place_order_v2 refuses it with point_required,
# behind the settings switch order_needs_point, which starts off. Off: an order with no point still goes. On: refused; an order with a point goes;
# the same key again still answers the order that exists.
# Same harness as test_place_order_v2.py: every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 is the red run before the migration.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_needs_point.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, migration_inside
from test_place_order_v2 import BILL, K, LINES, place, run

FILE = "20261115120000_order_needs_point.sql"
MIG = migration_inside([FILE], "exists (select 1 from settings where name = 'order_needs_point')")
ON = "update settings set value = 'true'::jsonb where name = 'order_needs_point'"
POINT = f"insert into res (r) select place_order_v2('s1', '%s', {K}, '{LINES}'::jsonb, 'Flat 4, Green Park', 32000, '{BILL}'::jsonb, p_drop_lat => %s, p_drop_lng => %s)"
COUNT = "(select count(*) from orders where session_id = 's1') as n"


def go(*stmts, final=COUNT):
    return run(*([MIG] if MIG else []), *stmts, final=final)


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderNeedsPoint(unittest.TestCase):
    def test_s1_the_switch_starts_off_and_only_the_service_role_reads_it(self):
        r = go(final="(select value from settings where name = 'order_needs_point') as v")
        self.assertIs(r["v"], False, r)
        r = go("set local role authenticated", "create temp table seen as select name from settings where name = 'order_needs_point'", "reset role", final="(select count(*) from seen) as n")
        self.assertEqual(r["n"], 0, r)

    def test_s2_switch_off_an_order_with_no_point_still_goes(self):
        r = go(place())
        self.assertEqual((r["rs"][0]["ok"], r["n"]), (True, 1), r)

    def test_s3_switch_on_an_order_with_no_point_is_refused_and_nothing_is_written(self):
        for lat, lng in (("null", "null"), ("28.56", "null"), ("91", "77.2")):   # none, half a point, off the map
            r = go(ON, POINT % ("k1", lat, lng))
            self.assertEqual((r["rs"][0]["ok"], r["rs"][0].get("error"), r["rs"][0].get("message"), r["n"]), (False, "point_required", "Set your place on the map to place the order.", 0), (lat, lng, r))

    def test_s4_switch_on_an_order_with_a_point_goes_and_keeps_the_point(self):
        r = go(ON, POINT % ("k1", "28.56", "77.2"), final="(select drop_lat from orders where session_id = 's1') as lat")
        self.assertEqual((r["rs"][0]["ok"], r["lat"]), (True, 28.56), r)

    def test_s5_the_same_key_again_answers_the_order_that_exists_after_the_switch_goes_on(self):
        r = go(place(), ON, place())
        self.assertEqual((r["rs"][1]["ok"], r["rs"][1]["created"], r["rs"][1]["order"]["id"] == r["rs"][0]["order"]["id"], r["n"]), (True, False, True, 1), r)

    def test_s6_the_switch_holds_only_true_or_false(self):
        for v in ("1", '"yes"', "null"):
            with self.assertRaises(AssertionError) as refused:   # the helper raises on a database error
                go(f"update settings set value = '{v}'::jsonb where name = 'order_needs_point'")
            self.assertIn("settings_order_needs_point_rule", str(refused.exception), v)

    def test_s7_the_migration_is_safe_to_run_twice_and_keeps_a_switch_that_is_on(self):
        mig = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations", FILE)).read()
        r = go(ON, mig, mig, final="(select value from settings where name = 'order_needs_point') as v")
        self.assertIs(r["v"], True, r)


if __name__ == "__main__":
    unittest.main()
