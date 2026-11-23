# Story 1320 (epic 1317): minutes to cook, ride and at the door, per delivered order, and an admin summary. Built from order_events.
# Every check ends in ROLLBACK (dev stays clean). Test rows sit in 2030 so real dev orders never count. SKIP_MIG=1 is the red run.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_stage_minutes.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
FILE = os.path.join(HERE, "..", "supabase", "migrations", "20261124100000_order_stage_minutes.sql")
MIG = "" if os.environ.get("SKIP_MIG") else open(FILE).read()
ADM, CUS = "00000000-0000-0000-0000-0000000000e1", "00000000-0000-0000-0000-0000000000e2"
KIT = "00000000-0000-0000-0000-0000000000e3"
FROM = "'2030-01-01'"


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def order(n, cook, ride, door, delivered=True):
    """Order n placed at 2030-01-01 10:00; stage minutes are cook, ride, door."""
    oid = "00000000-0000-0000-0000-%012d" % n
    t = lambda m: f"timestamptz '2030-01-01 10:00+00' + interval '{m} minutes'"
    ev = [("order.placed", 0), ("order.picked_up", cook), ("order.arriving", cook + ride)] + ([("order.delivered", cook + ride + door)] if delivered else [])
    return [f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{oid}', '{KIT}', 's-{n}', 'k{n}', '[]', 100, 'x')"] + \
           [f"insert into order_events (order_id, kitchen_id, session_id, event, actor, created_at) values ('{oid}', '{KIT}', 's-{n}', '{e}', 'customer', {t(m)})" for e, m in ev]


def run(orders, *stmts):
    setup = [user(ADM), user(CUS), f"insert into admins (user_id) values ('{ADM}')",
             f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016'])",
             "set local goserve.reset = 'on'"]
    body = [s for o in orders for s in order(*o)]
    return sql("begin; " + (MIG + "; " if MIG else "") + "; ".join(setup + body + list(stmts)) + "; rollback;")


ROWS = f"select cook_min::float c, ride_min::float r, door_min::float d, total_min::float t from order_stage_minutes_v1({FROM}) order by order_id"
SUM = f"select order_stage_summary_v1({FROM}) as s"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderStageMinutes(unittest.TestCase):
    def test_ac1_arriving_8_02_delivered_8_09_is_7_minutes_at_the_door(self):
        r = run([(1, 12, 9, 7)], as_user(ADM, ROWS))[-1]
        self.assertEqual(r, {"c": 12.0, "r": 9.0, "d": 7.0, "t": 28.0})

    def test_ac2_an_order_not_yet_delivered_is_left_out(self):
        self.assertEqual(run([(1, 12, 9, 7), (2, 5, 5, 5, False)], as_user(ADM, "select count(*) n from order_stage_minutes_v1(" + FROM + ")"))[-1]["n"], 1)

    def test_ac3_ten_orders_give_the_middle_the_worst_and_the_count_over_30(self):
        rows = [(i, 10, 8, 4) for i in range(1, 9)] + [(9, 30, 8, 4), (10, 12, 20, 12)]   # totals: 8 x 22, 42, 44
        s = run(rows, as_user(ADM, SUM))[-1]["s"]
        self.assertEqual((s["orders"], s["cook_median"], s["cook_max"], s["ride_median"], s["ride_max"], s["door_median"], s["door_max"], s["over_30"]),
                         (10, 10, 30, 8, 20, 4, 12, 2))

    def test_ac4_a_customer_and_no_one_are_refused(self):
        for who in (as_user(CUS, SUM), as_user(CUS, ROWS), "set local role anon; " + SUM):
            self.assertIn("not_admin" if "anon" not in who else "permission denied", str(run([(1, 1, 1, 1)], who)), who)

    def test_ac5_the_answer_has_no_name_phone_or_address(self):
        r = run([(1, 12, 9, 7)], "select array_agg(q.parameter_name::text) as cols from information_schema.routines r join information_schema.parameters q on q.specific_name = r.specific_name "
                "where r.routine_name = 'order_stage_minutes_v1' and q.parameter_mode = 'OUT'")[-1]["cols"]
        self.assertEqual(sorted(r), ["cook_min", "door_min", "order_id", "ride_min", "total_min"])

    def test_the_migration_file_runs_twice_without_error(self):
        if not MIG:
            self.skipTest("SKIP_MIG")
        sql("begin; " + MIG + "; " + MIG + "; rollback;")


if __name__ == "__main__":
    unittest.main()
