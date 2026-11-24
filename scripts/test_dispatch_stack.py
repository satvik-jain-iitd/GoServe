# Story #1484 (v2 port, switch OFF): a Ready packet joins a rider already heading to the SAME kitchen, only when settings stack_max >= 2.
# Missing row or stack_max = 1 is today's rule: one order, one rider. A third packet at stack_max = 2 is refused.
# Every check ends in ROLLBACK. Red run: SKIP_MIG=1. Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_dispatch_stack.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_dispatch_db import SETUP, RIDER_OF
from test_dispatch_v2 import O, NEAR, MID, rider, order

MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations", "20261124210000_dispatch_stack.sql")).read()
O2, O3 = "00000000-0000-0000-0000-0000000000f2", "00000000-0000-0000-0000-0000000000f3"
STACK = lambda n, key="stack_max": f"insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', '{key}', '{n}', 99999999)"


def run(*steps, final):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    # the migration replaces dispatch_order_db; on a dev that already has the older one the create or replace is enough
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + SETUP + flat + [f"select {final}"]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DispatchStack(unittest.TestCase):
    def test_a_no_setting_row_is_today_two_orders_two_riders(self):   # also (d): the default is 1
        r = run(rider(NEAR, 0.001), rider(MID, 0.01), order(O), order(O2), final=f"{RIDER_OF(O)} as a, {RIDER_OF(O2)} as b")
        self.assertEqual((r["a"], r["b"]), (NEAR, MID), r)

    def test_a2_stack_max_1_is_today_too(self):
        r = run(STACK(1), rider(NEAR, 0.001), rider(MID, 0.01), order(O), order(O2), final=f"{RIDER_OF(O)} as a, {RIDER_OF(O2)} as b")
        self.assertEqual((r["a"], r["b"]), (NEAR, MID), r)

    def test_b_stack_max_2_two_ready_orders_one_kitchen_get_the_same_rider(self):
        r = run(STACK(2), rider(NEAR, 0.001), rider(MID, 0.01), order(O), order(O2), final=f"{RIDER_OF(O)} as a, {RIDER_OF(O2)} as b")
        self.assertEqual((r["a"], r["b"]), (NEAR, NEAR), r)

    def test_c_a_third_packet_at_stack_max_2_is_refused(self):
        r = run(STACK(2), rider(NEAR, 0.001), rider(MID, 0.01), order(O), order(O2), order(O3), final=f"{RIDER_OF(O3)} as c")
        self.assertEqual(r["c"], MID, r)   # the second rider is free, the full trip is not used
        r = run(STACK(2), rider(NEAR, 0.001), order(O), order(O2), order(O3), final=f"{RIDER_OF(O3)} as c")
        self.assertIsNone(r["c"], r)   # nobody else: it waits unassigned as today

    def test_e_six_minutes_over_the_5_minute_cap_does_not_stack(self):
        r = run(STACK(2), rider(NEAR, 0.001), rider(MID, 0.01), order(O), "set local session_replication_role = replica",   # the events table is frozen; the test back-dates one row
                f"update order_events set created_at = now() - interval '6 minutes' where order_id = '{O}'", "set local session_replication_role = origin", order(O2),
                final=f"{RIDER_OF(O2)} as b")
        self.assertEqual(r["b"], MID, r)


if __name__ == "__main__":
    unittest.main()
