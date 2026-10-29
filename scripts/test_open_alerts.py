# Story #718 (#619 layer d, board L1): "Tell me when it opens". A customer asks once per kitchen; when the kitchen opens, the push queue gets one row of kind kitchen_open.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_open_alerts.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

UID = "00000000-0000-0000-0000-0000000000c1"
K = "11111111-1111-1111-1111-111111111111"
EP = "https://web.push.apple.com/open1"
SUB = f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{UID}', '{EP}', 'k', 'a')"
CLOSE = f"update kitchens set open = false where id = '{K}'"
OPEN = f"update kitchens set open = true where id = '{K}'"


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


def as_user(body, uid=UID):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


ADD = as_user(f"create temp table a as select open_alert_add_v2('{K}') as v")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OpenAlerts(unittest.TestCase):
    def test_asking_without_allowed_alerts_is_refused_with_a_plain_line(self):
        r = run(CLOSE, ADD, "select v from a")
        self.assertEqual((r[-1]["v"]["error"], r[-1]["v"]["message"]), ("no_push", "Allow alerts first."), r)

    def test_asking_twice_keeps_one_row(self):
        r = run(SUB, CLOSE, ADD, as_user(f"select open_alert_add_v2('{K}')"), "select count(*)::int as n, (select v from a) as v from open_alerts")
        self.assertEqual((r[-1]["n"], r[-1]["v"]), (1, {"ok": True}), r)

    def test_a_kitchen_that_is_not_there_is_refused(self):
        r = run(SUB, as_user("create temp table a as select open_alert_add_v2('00000000-0000-0000-0000-000000000000') as v"), "select v from a")
        self.assertEqual(r[-1]["v"]["error"], "not_found", r)

    def test_while_the_kitchen_is_closed_the_sweep_queues_nothing(self):
        r = run(SUB, CLOSE, ADD, "select open_alerts_sweep()", "select (select count(*) from push_outbox)::int as q, (select count(*) from open_alerts)::int as a")
        self.assertEqual((r[-1]["q"], r[-1]["a"]), (0, 1), r)

    def test_when_it_opens_the_sweep_queues_one_row_and_forgets_the_ask(self):
        r = run(SUB, CLOSE, ADD, OPEN, "select open_alerts_sweep()", "select open_alerts_sweep()",
                "select count(*)::int as n, min(kind) as kind, min(status) as st, bool_and(order_id is null) as noorder, min(kitchen_id::text) as k, (select count(*) from open_alerts)::int as a from push_outbox")
        self.assertEqual((r[-1]["n"], r[-1]["kind"], r[-1]["st"], r[-1]["noorder"], r[-1]["k"], r[-1]["a"]), (1, "kitchen_open", "open", True, K, 0), r)

    def test_take_sweeps_first_and_hands_out_kind_and_kitchen(self):
        r = run(SUB, CLOSE, ADD, OPEN, "select push_outbox_take(10)->'rows'->0 as row")
        row = r[-1]["row"]
        self.assertEqual((row["session_id"], row["status"], row["kind"], row["kitchen_id"], row["order_id"]), (UID, "open", "kitchen_open", K, None), r)

    def test_an_order_row_still_says_kind_order(self):
        order = f"select place_order('{UID}', 'key1', jsonb_build_array(jsonb_build_object('menu_item_id', (select id from menu_items order by price_paise limit 1), 'qty', 1)), 'Flat 4')"
        r = run(SUB, order, "select push_outbox_take(10)->'rows'->0->>'kind' as kind")
        self.assertEqual(r[-1]["kind"], "order", r)

    def test_the_notification_names_the_kitchen_once(self):
        r = run(SUB, CLOSE, ADD, OPEN, "select open_alerts_sweep()", f"create temp table p1 as select push_latest('{EP}') as v", f"create temp table p2 as select push_latest('{EP}') as v",
                "select (select v from p1) as first, (select v from p2) as again")
        self.assertEqual(r[-1]["first"], {"title": "GoServe", "status": "open", "body": "GoServe Delhi Kitchen is open. Order now."}, r)
        self.assertIsNone(r[-1]["again"], r)   # no order, and the open line was shown already

    def test_the_signed_out_cannot_use_them(self):
        for call in (f"open_alert_add_v2('{K}')", "open_alerts_sweep()"):
            self.assertIn("permission denied", str(run("set local role anon", f"select {call}")), call)

    def test_a_customer_cannot_read_the_asks_or_sweep(self):
        self.assertIn("permission denied", str(run(as_user("select * from open_alerts"))))
        self.assertIn("permission denied", str(run(as_user("select open_alerts_sweep()"))))


if __name__ == "__main__":
    unittest.main()
