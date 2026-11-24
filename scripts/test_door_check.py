# Story #1322 (epic 1317): five minutes after Arriving, if the order is still on the road, ONE push (status door_check) is queued; a delivered or cancelled order gets none.
# Every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_door_check.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_push_outbox import UID, ORDER, SUB, PLACE, RIDER_ROW, step

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261124210000_door_check.sql")).read()
ROAD = step("accepted", "preparing", "ready", "out_for_delivery")
ARRIVED = lambda mins: [f"insert into order_events (order_id, kitchen_id, session_id, event, actor, created_at) select id, kitchen_id, session_id, 'order.arriving', 'rider', now() - interval '{mins} minutes' from orders where session_id = '{UID}'"]
CHECK = "select push_door_check_v1()"


def run(*stmts):
    return sql("begin; delete from push_outbox; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DoorCheck(unittest.TestCase):
    def rows(self, *stmts):
        r = run(*stmts, f"select coalesce(array_agg(status order by id), '{{}}') as s from push_outbox where session_id = '{UID}' and status = 'door_check'")
        self.assertIsInstance(r, list, r)
        return r[-1]["s"]

    def test_d1_arriving_six_minutes_ago_and_still_on_the_road_queues_one_push(self):
        self.assertEqual(self.rows(SUB, PLACE, RIDER_ROW, *ROAD, *ARRIVED(6), CHECK), ["door_check"])

    def test_d2_delivered_in_time_gets_none(self):
        self.assertEqual(self.rows(SUB, PLACE, RIDER_ROW, *ROAD, *ARRIVED(6), *step("delivered"), CHECK), [])

    def test_d3_cancelled_after_arriving_gets_none(self):
        self.assertEqual(self.rows(SUB, PLACE, RIDER_ROW, *ROAD, *ARRIVED(6), f"update orders set status='cancelled' where session_id='{UID}'", CHECK), [])

    def test_d4_only_four_minutes_after_arriving_gets_none_yet(self):
        self.assertEqual(self.rows(SUB, PLACE, RIDER_ROW, *ROAD, *ARRIVED(4), CHECK), [])

    def test_d5_a_second_run_adds_nothing(self):
        self.assertEqual(self.rows(SUB, PLACE, RIDER_ROW, *ROAD, *ARRIVED(6), CHECK, CHECK), ["door_check"])

    def test_d6_no_subscription_means_no_row_and_a_trace_line_says_why(self):
        r = run(PLACE, RIDER_ROW, *ROAD, *ARRIVED(6), CHECK, f"select (select count(*) from push_outbox where session_id = '{UID}' and status = 'door_check') as q, (select count(*) from order_trace where event='push_skipped' and result='no_subscription' and detail::text like '%door_check%') as why")
        self.assertEqual(r[-1], {"q": 0, "why": 1}, r)

    def test_d7_an_arriving_older_than_two_hours_is_left_alone(self):
        self.assertEqual(self.rows(SUB, PLACE, RIDER_ROW, *ROAD, *ARRIVED(180), CHECK), [])

    def test_d8_the_push_says_the_constant_and_a_named_minute_job_runs_it(self):
        r = run(SUB, PLACE, RIDER_ROW, *ROAD, *ARRIVED(6), CHECK, "select push_latest('https://web.push.apple.com/abc') as p, (select count(*) from cron.job where jobname = 'goserve-door-check' and schedule = '* * * * *') as job")
        self.assertEqual((r[-1]["p"]["status"], r[-1]["p"]["body"], r[-1]["job"]), ("door_check", "Your rider is close. Can't find them? Call.", 1), r)

    def test_d9_nobody_but_the_server_can_run_it(self):
        for role in ("anon", "authenticated"):
            self.assertIn("permission denied", str(run(f"set local role {role}", CHECK)), role)


if __name__ == "__main__":
    unittest.main()
