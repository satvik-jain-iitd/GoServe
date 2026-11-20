# Story 1689: one rider speed. The phone (RIDER_KMPH = 20) and the server (eta_rules.speed_m_min) agree: 20 km/h = 333.33 m a minute.
# Scenario: Given a kitchen 2000 m in a straight line from the drop point and an order on the way with the rider at the kitchen,
# when the tracking row is refreshed, then eta_lo_min is 8 (2000 x 1.3 / 333.33 = 7.8; at 300 it was 9).
# Every check ends in ROLLBACK. The dev DB already holds the earlier ETA migration; this file runs the new one on top, inside the transaction.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_one_rider_speed.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_order_tracking import O, K, RIDER, SETUP, make_order, who, CUST
HERE = os.path.dirname(os.path.abspath(__file__))
_f = os.path.join(HERE, "..", "supabase", "migrations", "20261119150000_one_rider_speed.sql")
MIG = open(_f).read() if os.path.exists(_f) else ""

FAR = f"update kitchens set lat = 28.582 where id = '{K}'"   # 0.018 deg of latitude = 2000 m south of the pin point (28.60); the rider (28.59) moves to the kitchen
AT_KITCHEN = f"update riders set lat = 28.582, lng = 77.20 where user_id = '{RIDER}'"


def run(*steps, mig=MIG, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(SETUP) + "; " + mig + "; " + "; ".join(flat + ["reset role", f"select {final}"]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OneRiderSpeed(unittest.TestCase):
    def test_a_kitchen_2000_m_away_with_the_rider_there_gives_8_minutes(self):
        r = run(FAR, make_order("out_for_delivery"), AT_KITCHEN, f"select refresh_order_tracking('{O}')",
                final=f"(select eta_lo_min from order_tracking where order_id = '{O}') as n")
        self.assertEqual(r["n"], 8, r)

    def test_the_rules_say_333_33_a_minute(self):
        r = run(final="(eta_rules() ->> 'speed_m_min')::numeric as n")
        self.assertEqual(float(r["n"]), 333.33, r)

    def test_the_file_runs_twice_and_leaves_one_version_2_row(self):
        r = run(final="(select count(*) from params where session_id = 'global' and key = 'eta_rules' and version = 2) as n", mig=MIG + ";" + MIG)
        self.assertEqual(r["n"], 1, r)

    def test_a_customer_still_cannot_read_the_rules(self):
        w = sql("begin; " + "; ".join(SETUP) + "; " + MIG + "; " + "; ".join(who(CUST) + ["select eta_rules()"]) + "; rollback;")
        self.assertIn("permission denied", str(w), w)


if __name__ == "__main__":
    unittest.main()
