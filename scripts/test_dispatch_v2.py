# Story #350 (E27, plan v2 B.14): dispatch on v2. Scenario: Given a ready order, when dispatch runs, then a rider is assigned by the rule.
# dispatch_order_v2 is one transaction: it reads the candidates the database ranks (dispatch_candidates), takes the rule's pick (the same as SUB 13's
# rule: follow the rank when every rider has one, else a free rider with the fewest trips today, then the nearest) and saves it with assign_rider.
# Jev advice and the decision_log row stay in SUB 13; this is the rule alone. Batch mode keeps its own tick (dispatch_tick).
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_dispatch_v2.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "00000000-0000-0000-0000-0000000000b1"
O = "00000000-0000-0000-0000-0000000000f1"
NEAR, MID, FAR = [f"00000000-0000-0000-0000-0000000000c{i}" for i in (1, 2, 3)]
STEPS = ["accepted", "preparing", "ready"]
# the kitchen is at (28.5494, 77.2001); a rider 0.001 degree of latitude away is about 111 m off
SETUP = [
    f"insert into kitchens (id, name, pin_codes, lat, lng) values ('{K}', 'Test', array['110016'], 28.5494, 77.2001)",
    "insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'dispatch_mode', '{\"mode\":\"per_order\"}', 99999999)",
    "create temp table res (i serial, r jsonb)",
]


def rider(rid, dlat, online=True):
    return f"insert into riders (user_id, online, lat, lng, updated_at) values ('{rid}', {str(online).lower()}, {28.5494 + dlat}, 77.2001, now())"


def order(oid, status="ready", rider_id=None):
    """An order walked up to `status` one legal step at a time; a rider is saved on it last."""
    stmts = [f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{oid}', '{K}', 's-{oid[-3:]}', 'k', '[]', 100, 'x')"]
    for s in ["accepted", "preparing", "ready", "out_for_delivery", "delivered"]:
        if status == "placed":
            break
        stmts.append(f"update orders set status = '{s}' where id = '{oid}'")
        if s == status:
            break
    if rider_id:
        stmts.append(f"update orders set rider_id = '{rider_id}' where id = '{oid}'")
    return stmts


def dispatch(oid=O):
    return f"insert into res (r) select dispatch_order_v2('{oid}')"


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = "select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(SETUP + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


ASSIGNED = f"(select count(*) from order_events where order_id = '{O}' and event = 'order.assigned') as assigned, (select rider_id::text from orders where id = '{O}') as rider"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DispatchV2(unittest.TestCase):
    def test_a_ready_order_gets_the_nearest_free_rider_and_one_assigned_event(self):
        r = run(rider(FAR, 0.02), rider(NEAR, 0.001), rider(MID, 0.01), order(O), dispatch(), final=ASSIGNED)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["rider_id"]), (True, NEAR), r)
        self.assertEqual((r["assigned"], r["rider"]), (1, NEAR))

    def test_the_rule_prefers_the_rider_with_fewer_trips_today_over_a_nearer_one(self):
        two = [order(f"00000000-0000-0000-0000-00000000d00{i}", "delivered", NEAR) for i in (1, 2)]
        r = run(rider(NEAR, 0.001), rider(MID, 0.01), *two, order(O), dispatch(), final=ASSIGNED)
        self.assertEqual(r["rs"][0]["rider_id"], MID, r)

    def test_a_rider_who_is_busy_or_offline_is_not_chosen(self):
        busy = order("00000000-0000-0000-0000-00000000d001", "ready", NEAR)
        r = run(rider(NEAR, 0.001), rider(MID, 0.01, online=False), rider(FAR, 0.02), busy, order(O), dispatch(), final=ASSIGNED)
        self.assertEqual(r["rs"][0]["rider_id"], FAR, r)

    def test_nobody_free_answers_no_rider_free_and_writes_nothing(self):
        r = run(rider(NEAR, 0.001, online=False), order(O), dispatch(), final=ASSIGNED)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["error"]), (False, "no_rider_free"), r)
        self.assertEqual((r["assigned"], r["rider"]), (0, None))

    def test_an_order_that_is_not_ready_or_does_not_exist_is_refused(self):
        r = run(rider(NEAR, 0.001), order(O, "preparing"), dispatch(), dispatch("00000000-0000-0000-0000-00000000dead"))
        self.assertEqual([x["error"] for x in r["rs"]], ["not_ready", "order_not_found"])

    def test_running_it_again_keeps_the_same_rider_and_writes_no_second_event(self):
        r = run(rider(NEAR, 0.001), rider(MID, 0.01), order(O), dispatch(), dispatch(), final=ASSIGNED)
        self.assertEqual([x["rider_id"] for x in r["rs"]], [NEAR, NEAR])
        self.assertEqual(r["assigned"], 1)

    def test_batch_mode_leaves_the_order_to_its_own_tick(self):
        batch = "insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'dispatch_mode', '{\"mode\":\"batch\"}', 99999999)"
        r = run("delete from params where key = 'dispatch_mode' and version = 99999999", batch, rider(NEAR, 0.001), order(O), dispatch(), final=ASSIGNED)
        self.assertEqual((r["rs"][0]["error"], r["assigned"]), ("batch_mode", 0), r)

    def test_nearest_band_follows_the_databases_rank(self):
        rules = "insert into params (kitchen_id, session_id, key, value, version) values (null, 'global', 'per_order_rules', '{\"pick\":\"nearest_band\",\"near_band_m\":500,\"fresh_ping_s\":90}', 99999999)"
        two = [order(f"00000000-0000-0000-0000-00000000d00{i}", "delivered", NEAR) for i in (1, 2)]
        r = run(rules, rider(NEAR, 0.001), rider(MID, 0.01), *two, order(O), dispatch(), final=ASSIGNED)
        self.assertEqual(r["rs"][0]["rider_id"], NEAR, r)   # inside the 500 m band the nearest wins; trips only break a tie inside the band

    def test_only_the_service_role_can_call_it(self):
        for role in ("anon", "authenticated"):
            r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", f"select dispatch_order_v2('{O}')"]) + "; rollback;")
            self.assertIn("permission denied", str(r), role)


if __name__ == "__main__":
    unittest.main()
