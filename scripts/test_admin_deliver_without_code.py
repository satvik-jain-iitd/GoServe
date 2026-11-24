# Story 1671 (epic 1652): an admin marks an order Delivered without the customer's code, with a typed reason, logged once with who and when.
# Every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_admin_deliver_without_code.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
import test_rider_deliver_code as b   # same throwaway users and order

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else "; ".join(open(os.path.join(HERE, "..", "supabase", "migrations", f)).read() for f in ("20261124220000_admin_deliver_without_code.sql", "20261124240000_admin_deliver_method.sql"))
O1 = b.O1


def call(uid, reason, method="cash"):
    method = "null" if method is None else f"'{method}'"
    r = "null" if reason is None else "'" + reason.replace("'", "''") + "'"
    return b.as_(uid, f"admin_deliver_without_code_v1('{O1}', {r}, {method})")


def run(*steps):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = ("reset role; select (select jsonb_agg(r order by i) from res) as rs, (select status from orders where id = '%s') as status, "
            "(select paid_by from orders where id = '%s') as paid, (select jsonb_agg(jsonb_build_object('actor', actor, 'reason', reason, 'by', by_user, 'at', created_at)) from order_events where order_id = '%s' and event = 'order.delivered_without_code') as ev" % (O1, O1, O1))
    r = sql("begin; " + "; ".join([x for x in b.MIGS] + b.SETUP + [MIG] + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class AdminDeliverWithoutCode(unittest.TestCase):
    def test_d1_admin_with_the_switch_on_delivers_and_one_event_keeps_who_when_why(self):
        r = run(b.READY, b.ON, call(b.ADM, "  Phone is dead  "))
        self.assertTrue(r["rs"][0]["ok"], r)
        self.assertEqual(r["status"], "delivered")
        self.assertEqual(len(r["ev"]), 1, r)
        self.assertEqual((r["ev"][0]["actor"], r["ev"][0]["reason"], r["ev"][0]["by"]), ("admin", "Phone is dead", b.ADM))
        self.assertTrue(r["ev"][0]["at"])

    def test_d2_a_reason_is_not_optional_and_at_most_200(self):
        for reason, err in ((None, "reason_required"), ("   ", "reason_required"), ("x" * 201, "reason_too_long")):
            r = run(b.READY, b.ON, call(b.ADM, reason))
            self.assertEqual(r["rs"][0]["error"], err, r)
            self.assertEqual(r["status"], "out_for_delivery")
            self.assertIsNone(r["ev"])
        self.assertTrue(run(b.READY, call(b.ADM, "x" * 200))["rs"][0]["ok"])

    def test_d3_nobody_but_an_admin_can_use_it(self):
        for uid in (b.RID, b.CUS, b.KIT_U):
            r = run(b.READY, b.ON, call(uid, "no code"))
            self.assertEqual(r["rs"][0]["error"], "not_allowed", uid)
            self.assertEqual(r["status"], "out_for_delivery")
            self.assertIsNone(r["ev"])

    def test_d4_the_rider_alone_is_still_refused_while_the_switch_is_on(self):
        r = run(b.READY, b.ON, b.act(b.RID, "deliver"))
        self.assertEqual(r["rs"][0]["error"], "code_required", r)

    def test_d5_the_method_is_required_and_never_guessed(self):
        for m in (None, "", "card", "CASH"):
            r = run(b.READY, b.ON, call(b.ADM, "Phone is dead", m))
            self.assertEqual(r["rs"][0]["error"], "method_required", (m, r))
            self.assertEqual(r["status"], "out_for_delivery")
            self.assertIsNone(r["ev"])
            self.assertIsNone(r["paid"])

    def test_d6_each_method_is_recorded_truthfully(self):
        for m, paid in (("cash", "cash"), ("upi_door", "upi_door"), ("not_collected", None)):
            r = run(b.READY, b.ON, call(b.ADM, "Phone is dead", m))
            self.assertTrue(r["rs"][0]["ok"], (m, r))
            self.assertEqual((r["status"], r["paid"], len(r["ev"])), ("delivered", paid, 1), (m, r))
