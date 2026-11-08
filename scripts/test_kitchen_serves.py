# Story #1102: one serviceability rule. A kitchen serves a place when it is active and lists the place's pin OR the place is inside its radius.
# kitchen_serves is that rule in the database; place_order_v2 refuses an order the kitchen does not reach (not_served), so the map strip, the save and the order agree.
# Same harness as test_place_order_v2.py: every check ends in ROLLBACK. SKIP_MIG=1 is the red run.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_kitchen_serves.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_place_order_v2 import BILL, K, LINES, run

MIG = migration_inside(["20261109110000_kitchen_serves.sql"], "to_regprocedure('public.kitchen_serves(uuid,text,double precision,double precision)') is not null")
GOA = (15.25, 73.9417)
NEAR = f"update kitchens set pin_codes = array['403725'], lat = {GOA[0]}, lng = {GOA[1]}, radius_m = 3000 where id = {K}"
SERVES = lambda pin, lat, lng: f"select kitchen_serves({K}, {pin}, {lat}, {lng}) as v"


def go(*stmts, final):
    return run(*([MIG] if MIG else []), *stmts, final=final)


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class KitchenServes(unittest.TestCase):
    def test_s1_a_listed_pin_is_served_with_no_place(self):
        self.assertTrue(go(NEAR, final="kitchen_serves(" + K + ", '403725', null, null) as v")["v"])

    def test_s2_a_place_at_the_kitchen_is_served_with_another_pin_the_exact_case_of_1102(self):
        self.assertTrue(go(NEAR, final=f"kitchen_serves({K}, '403721', {GOA[0]}, {GOA[1]}) as v")["v"])

    def test_s3_far_away_with_an_unlisted_pin_is_not_served(self):
        self.assertFalse(go(NEAR, final=f"kitchen_serves({K}, '403721', 15.5, {GOA[1]}) as v")["v"])

    def test_s4_a_listed_pin_is_served_even_far_from_the_kitchen(self):
        self.assertTrue(go(NEAR, final=f"kitchen_serves({K}, '403725', 15.5, {GOA[1]}) as v")["v"])

    def test_s5_nothing_known_about_the_place_is_not_decided_here(self):
        self.assertTrue(go(NEAR, final=f"kitchen_serves({K}, null, null, null) as v")["v"])

    def test_s6_a_switched_off_kitchen_still_serves_the_switch_only_decides_open_or_paused(self):
        self.assertTrue(go(NEAR, f"update kitchens set active = false where id = {K}", final=f"kitchen_serves({K}, '403725', {GOA[0]}, {GOA[1]}) as v")["v"])

    def test_s7_place_order_refuses_a_drop_point_the_kitchen_does_not_reach(self):
        far = f"insert into res (r) select place_order_v2('s1', 'k1', {K}, '{LINES}'::jsonb, 'Flat 4, Far', 32000, '{BILL}'::jsonb, p_drop_lat => 15.5, p_drop_lng => {GOA[1]})"
        r = go(NEAR, far, final="(select count(*) from orders where client_order_key = 'k1') as n")
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0].get("error"), r["n"]), (False, "not_served", 0), r)

    def test_s8_place_order_takes_a_drop_point_at_the_kitchen(self):
        near = f"insert into res (r) select place_order_v2('s1', 'k1', {K}, '{LINES}'::jsonb, 'Flat 4, Near', 32000, '{BILL}'::jsonb, p_drop_lat => {GOA[0]}, p_drop_lng => {GOA[1]})"
        r = go(NEAR, near, final="(select count(*) from orders where client_order_key = 'k1') as n")
        self.assertEqual((r["rs"][0]["ok"], r["n"]), (True, 1), r)


    def test_s9_the_shared_cases_the_app_and_the_edge_function_run_too(self):
        import json
        cases = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "spec", "serviceability_cases.json")))["cases"]
        lit = lambda v: "null" if v is None else (f"'{v}'" if isinstance(v, str) else str(v).lower())
        for c in cases:
            k, pl = c["kitchen"], c["place"]
            setup = (f"update kitchens set pin_codes = array[{', '.join(lit(p) for p in k['pin_codes'])}]::text[], lat = {lit(k['lat'])}, lng = {lit(k['lng'])}, "
                     f"radius_m = {k['radius_m']}, active = {lit(k['active'])} where id = {K}")
            call = f"kitchen_serves({K}, {lit(c['pin'])}, {lit(pl['lat']) if pl else 'null'}, {lit(pl['lng']) if pl else 'null'}) as v"
            self.assertEqual(go(setup, final=call)["v"], c["served"], c["name"])


if __name__ == "__main__":
    unittest.main()
