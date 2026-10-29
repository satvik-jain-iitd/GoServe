# Story #342 (E27, plan v2 B.6): kitchens get a radius and a prep time; a customer outside every radius can ask 'Request here' (the waitlist).
# Scenario: Given a place outside every radius, when the customer taps 'Request here', then the place is saved and nobody can read the list back.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_serviceability.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "'00000000-0000-0000-0000-0000000000f1'"
SETUP = [f"insert into kitchens (id, name, pin_codes, lat, lng) values ({K}, 'Test', array['110016'], 28.5494, 77.2001)"]
ASK = "insert into waitlist (lat, lng, pin_code) values (28.9, 77.9, '110099')"


def run(*stmts):
    return sql("begin; " + "; ".join(SETUP + list(stmts)) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Serviceability(unittest.TestCase):
    def test_a_kitchen_has_a_radius_of_3_km_and_a_prep_time_of_20_minutes_by_default(self):
        r = run(f"select radius_m, prep_minutes from kitchens where id = {K}")
        self.assertEqual(r[-1], {"radius_m": 3000, "prep_minutes": 20}, r)

    def test_the_database_refuses_a_radius_that_is_too_small_or_too_large_and_a_negative_prep(self):
        for bad in ("radius_m = 50", "radius_m = 30000", "prep_minutes = -1"):
            self.assertIn("error", str(run(f"update kitchens set {bad} where id = {K}")), bad)

    def test_a_customer_with_no_login_can_ask_request_here(self):
        r = run("set local role anon", ASK, "reset role", "select count(*) as n from waitlist")
        self.assertEqual(r[-1], {"n": 1}, r)

    def test_nobody_but_the_service_role_can_read_the_waitlist(self):
        for role in ("anon", "authenticated"):
            self.assertIn("permission denied", str(run(ASK, f"set local role {role}", "select count(*) from waitlist")), role)

    def test_the_waitlist_refuses_a_bad_place_and_a_bad_pin(self):
        for bad in ("(91, 77.9, '110099')", "(28.9, 181, '110099')", "(28.9, 77.9, '1100')"):
            self.assertIn("error", str(run("set local role anon", f"insert into waitlist (lat, lng, pin_code) values {bad}")), bad)


if __name__ == "__main__":
    unittest.main()
