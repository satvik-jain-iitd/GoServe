# Story #1015: the live delivery time comes from the server. order_tracking carries eta_lo_min, eta_hi_min and eta_late for every active order.
# Rule: ride = straight line x detour at a town scooter speed (versioned param `eta_rules`); placed = prep + ride; cooking = prep minutes left + ride;
# ready = rider to kitchen + kitchen to drop; out for delivery = rider to drop. hi = lo + buffer. Late = now + lo is past promised_at. No Ola call.
# Every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_eta.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN
from test_schema import sql
from test_order_tracking import O, K, PIN, RIDER, SETUP, make_order, ping
HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261108130000_live_eta.sql")).read()


def run(*steps, final=""):   # the migration runs inside the transaction, after the setup and before the order exists
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(SETUP) + "; " + MIG + "; " + "; ".join(flat + ["reset role", f"select {final}"]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]

ROW = f"(select row_to_json(t) from (select eta_min, eta_lo_min, eta_hi_min, eta_late from order_tracking where order_id = '{O}') t) as row"
GIVE = f"update orders set rider_id = '{RIDER}' where id = '{O}'"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderEta(unittest.TestCase):
    def test_a_placed_order_shows_a_range_from_prep_and_ride(self):
        # prep 20 + 1.1 km x 1.3 at 300 m a minute (4.77) = 24.77 -> 25; the range is 10 minutes wide
        r = run(make_order(), final=ROW)["row"]
        self.assertEqual((r["eta_lo_min"], r["eta_hi_min"], r["eta_min"], r["eta_late"]), (25, 35, 25, False), r)

    def test_the_orders_own_drop_point_beats_the_pin_centre(self):
        r = run(make_order(), f"update orders set drop_lat = 28.59, drop_lng = 77.20 where id = '{O}'", f"select refresh_order_tracking('{O}')", final=ROW)["row"]
        self.assertEqual(r["eta_lo_min"], 20, r)   # the drop point is the kitchen's own spot: no ride

    def test_no_place_for_the_drop_means_no_number(self):
        r = run(make_order(), f"delete from pin_points where pin = '{PIN}'", f"update orders set status = 'placed' where id = '{O}'", f"select refresh_order_tracking('{O}')", final=ROW)["row"]
        self.assertEqual((r["eta_lo_min"], r["eta_hi_min"]), (None, None), r)

    def test_cooking_counts_only_the_prep_minutes_left(self):
        base = make_order("accepted")
        r = run(base, f"update orders set accepted_at = now() - interval '10 minutes' where id = '{O}'", f"select refresh_order_tracking('{O}')", final=ROW)["row"]
        self.assertEqual(r["eta_lo_min"], 15, r)   # 10 left + 4.77
        r = run(base, f"update orders set accepted_at = now() - interval '30 minutes' where id = '{O}'", f"select refresh_order_tracking('{O}')", final=ROW)["row"]
        self.assertEqual(r["eta_lo_min"], 5, r)   # prep is over: the ride alone

    def test_the_kitchen_accepting_stamps_accepted_at(self):
        r = run(make_order("accepted"), final=f"(select accepted_at is not null as stamped from orders where id = '{O}') as row")["row"]
        self.assertEqual(r, True)

    def test_ready_counts_rider_to_kitchen_then_on(self):
        far = run(make_order("ready"), GIVE, ping(28.58), final=ROW)["row"]
        self.assertEqual(far["eta_lo_min"], 10, far)   # 2.2 km x 1.3 / 300 = 9.53

    def test_out_for_delivery_falls_as_the_rider_closes_in(self):
        a = run(make_order("out_for_delivery"), final=ROW)["row"]["eta_lo_min"]
        b = run(make_order("out_for_delivery"), ping(28.597), final=ROW)["row"]["eta_lo_min"]
        self.assertEqual((a, b), (5, 2))

    def test_running_late_when_the_estimate_is_past_the_promise(self):
        r = run(make_order(), f"update orders set promised_at = now() + interval '10 minutes' where id = '{O}'", f"select refresh_order_tracking('{O}')", final=ROW)["row"]
        self.assertEqual(r["eta_late"], True, r)   # 25 minutes to go, 10 promised
        r = run(make_order(), f"update orders set promised_at = now() + interval '60 minutes' where id = '{O}'", f"select refresh_order_tracking('{O}')", final=ROW)["row"]
        self.assertEqual(r["eta_late"], False, r)

    def test_delivered_and_cancelled_have_no_time(self):
        d = run(make_order("delivered"), final=ROW)["row"]
        self.assertEqual((d["eta_lo_min"], d["eta_hi_min"], d["eta_late"]), (None, None, False), d)
        c = run(make_order(), f"update orders set status = 'cancelled', cancel_reason = 'x' where id = '{O}'", final=ROW)["row"]
        self.assertEqual((c["eta_lo_min"], c["eta_hi_min"]), (None, None), c)

    def test_a_new_version_of_the_rules_changes_the_speed_without_code(self):
        v2 = "insert into params (session_id, key, value, version) values ('global', 'eta_rules', '{\"speed_m_min\": 600, \"detour\": 1.3, \"buffer_min\": 10}'::jsonb, 2)"
        r = run(v2, make_order(), final=ROW)["row"]
        self.assertEqual(r["eta_lo_min"], 23, r)   # 20 + 2.38 -> 23

    def test_the_rules_are_not_readable_by_a_customer(self):
        from test_order_tracking import who, CUST
        w = sql("begin; " + "; ".join(SETUP) + "; " + MIG + "; " + "; ".join(who(CUST) + ["select eta_rules()"]) + "; rollback;")
        self.assertIn("permission denied", str(w), w)


if __name__ == "__main__":
    unittest.main()
