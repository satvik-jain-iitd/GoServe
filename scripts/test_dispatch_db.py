# Story #1068 (2 of 3): dispatch is event-driven inside the database. Given an order turning Ready, a rider coming online, or a rider freed,
# when it happens, then a waiting ready order gets its rider at once, with the same decision_log row SUB 13 wrote (engine rules).
# Every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN. Red run: SKIP_MIG=1.
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_dispatch_v2 import K, O, NEAR, MID, rider, order

DECIDE = migration_inside(["20261108200000_decide_rules.sql"], "to_regproc('public.decide_rider_rules_v2') is not null")   # L1, empty once dev has it
MIG = "; ".join(x for x in [DECIDE, migration_inside(["20261108220000_dispatch_in_db.sql"], "to_regproc('public.dispatch_order_db') is not null")] if x)
O2 = "00000000-0000-0000-0000-0000000000f2"
SETUP = [
    "update riders set online = false",   # dev has real riders online; only the test's own riders count (rolled back)
    f"insert into kitchens (id, name, pin_codes, lat, lng) values ('{K}', 'Test', array['110016'], 28.5494, 77.2001)",
    "insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'dispatch_mode', '{\"mode\":\"per_order\"}', 99999999)",
]
RIDER_OF = lambda o: f"(select rider_id::text from orders where id = '{o}')"
LOGS = lambda o: f"(select count(*) from decision_log where order_id = '{o}' and decision ->> 'engine' = 'rules' and decision ->> 'chosen_by' = 'rule')"


def run(*steps, final):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + SETUP + flat + [f"select {final}"]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DispatchInDb(unittest.TestCase):
    def test_an_order_turning_ready_gets_the_nearest_free_rider_and_a_decision_row(self):
        r = run(rider(MID, 0.01), rider(NEAR, 0.001), order(O), final=f"{RIDER_OF(O)} as rider, {LOGS(O)} as logs")
        self.assertEqual((r["rider"], r["logs"]), (NEAR, 1), r)

    def test_a_ready_order_with_nobody_free_waits_and_ready_still_stands(self):
        r = run(rider(NEAR, 0.001, online=False), order(O), final=f"{RIDER_OF(O)} as rider, (select status from orders where id = '{O}') as st")
        self.assertEqual((r["rider"], r["st"]), (None, "ready"), r)

    def test_a_rider_coming_online_picks_up_the_waiting_order(self):
        r = run(rider(NEAR, 0.001, online=False), order(O), f"update riders set online = true where user_id = '{NEAR}'", final=f"{RIDER_OF(O)} as rider, {LOGS(O)} as logs")
        self.assertEqual((r["rider"], r["logs"]), (NEAR, 1), r)

    def test_a_rider_freed_by_a_delivery_picks_up_the_waiting_order(self):
        r = run(rider(NEAR, 0.001), order(O, "ready"), order(O2, "ready"),
                f"update orders set status = 'out_for_delivery' where id = '{O}'", f"update orders set status = 'delivered' where id = '{O}'",
                final=f"{RIDER_OF(O2)} as rider")
        self.assertEqual(r["rider"], NEAR, r)   # O took NEAR on Ready; O2 waited; the delivery of O freed NEAR

    def test_batch_mode_is_left_to_its_own_tick(self):
        r = run("update params set value = '{\"mode\":\"batch\"}' where session_id = 'global' and key = 'dispatch_mode' and version = 99999999",
                rider(NEAR, 0.001), order(O), final=f"{RIDER_OF(O)} as rider")
        self.assertIsNone(r["rider"], r)


if __name__ == "__main__":
    unittest.main()
