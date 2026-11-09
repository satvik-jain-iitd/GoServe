# Story #905: the order keeps the customer's drop point, and a kitchen keeps its location with the accuracy and the date.
# Scenario: Given a device fix, when the order is placed, then orders.drop_lat and drop_lng hold it; a typed address leaves both null.
# Same harness as test_place_order_v2.py: every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_drop_point.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN
from test_place_order_v2 import BILL, K, LINES, run


def place_at(drop, key="k1"):
    return (f"insert into res (r) select place_order_v2('s1', '{key}', {K}, '{LINES}'::jsonb, 'Flat 4, Green Park', 32000, '{BILL}'::jsonb{drop})")


DROP = "(select jsonb_build_object('lat', drop_lat, 'lng', drop_lng) from orders where client_order_key = 'k1') as drop_point"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DropPoint(unittest.TestCase):
    def test_an_order_with_a_device_fix_keeps_the_drop_point(self):
        r = run(place_at(", p_drop_lat => 28.5677, p_drop_lng => 77.2432"), final=DROP)
        self.assertTrue(r["rs"][0]["ok"], r)
        self.assertEqual(r["drop_point"], {"lat": 28.5677, "lng": 77.2432})

    def test_an_order_with_no_fix_leaves_both_null(self):
        r = run(place_at(""), final=DROP)
        self.assertTrue(r["rs"][0]["ok"], r)
        self.assertEqual(r["drop_point"], {"lat": None, "lng": None})

    def test_half_a_fix_or_a_fix_off_the_map_is_dropped_and_the_order_still_goes(self):
        for drop in (", p_drop_lat => 28.5, p_drop_lng => null", ", p_drop_lat => 91, p_drop_lng => 77"):
            r = run(place_at(drop), final=DROP)
            self.assertTrue(r["rs"][0]["ok"], r)
            self.assertEqual(r["drop_point"], {"lat": None, "lng": None}, drop)

    def test_a_kitchen_keeps_its_location_with_accuracy_and_date(self):
        r = run(f"update kitchens set lat = 28.5677, lng = 77.2432, location_accuracy_m = 25, location_at = '2026-11-06T09:00:00Z' where id = {K}",
                final=f"(select to_jsonb(k) - 'id' from kitchens k where id = {K}) as k")
        self.assertEqual([r["k"]["lat"], r["k"]["lng"], r["k"]["location_accuracy_m"]], [28.5677, 77.2432, 25])
        self.assertTrue(r["k"]["location_at"].startswith("2026-11-06T09:00:00"))


if __name__ == "__main__":
    unittest.main()
