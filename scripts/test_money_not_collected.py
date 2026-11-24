# Story 1319 (epic 1317): "Money not collected" at the door. The order is Delivered with a money-due reason, never cash in hand.
# Every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_money_not_collected.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
import test_rider_deliver_code as b   # same throwaway users and order

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261124230000_money_not_collected.sql")).read()
O1 = b.O1


def call(uid, reason, note=None):
    r = "null" if reason is None else f"'{reason}'"
    n = "null" if note is None else "'" + note.replace("'", "''") + "'"
    return b.as_(uid, f"rider_money_not_collected_v1('{O1}', {r}, {n})")


def run(*steps):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = ("reset role; select (select jsonb_agg(r order by i) from res) as rs, (select status from orders where id = '%s') as status, "
            "(select paid_by from orders where id = '%s') as paid, (select money_due_reason from orders where id = '%s') as reason, (select money_due_note from orders where id = '%s') as note, "
            "(select count(*) from order_events where order_id = '%s' and event = 'order.delivered') as delivered" % (O1, O1, O1, O1, O1))
    r = sql("begin; " + "; ".join(list(b.MIGS) + b.SETUP + [MIG] + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class MoneyNotCollected(unittest.TestCase):
    def test_m1_each_of_the_four_reasons_delivers_with_no_paid_by(self):
        for reason in ("says_already_paid", "will_pay_later", "did_not_have_money"):
            r = run(b.READY, call(b.RID, reason, "ignored words"))
            self.assertTrue(r["rs"][0]["ok"], r)
            self.assertEqual((r["status"], r["paid"], r["reason"], r["note"], r["delivered"]), ("delivered", None, reason, None, 1), r)
        r = run(b.READY, call(b.RID, "other", "  Wallet at home  "))
        self.assertEqual((r["status"], r["paid"], r["reason"], r["note"]), ("delivered", None, "other", "Wallet at home"), r)

    def test_m2_a_reason_is_not_optional_and_other_needs_one_to_200_characters(self):
        for reason, note, err in ((None, None, "reason_required"), ("nonsense", None, "reason_required"), ("other", None, "note_required"),
                                  ("other", "   ", "note_required"), ("other", "x" * 201, "note_too_long")):
            r = run(b.READY, call(b.RID, reason, note))
            self.assertEqual(r["rs"][0]["error"], err, (reason, r))
            self.assertEqual((r["status"], r["reason"]), ("out_for_delivery", None))
        self.assertTrue(run(b.READY, call(b.RID, "other", "x" * 200))["rs"][0]["ok"])

    def test_m3_only_the_riders_own_order(self):
        for uid in (b.RID2, b.CUS, b.KIT_U, b.ADM):
            r = run(b.READY, call(uid, "will_pay_later"))
            self.assertEqual(r["rs"][0]["error"], "not_allowed", uid)
            self.assertEqual(r["status"], "out_for_delivery")

    def test_m4_the_code_is_still_asked_when_the_customer_code_switch_is_on(self):
        r = run(b.READY, b.ON, call(b.RID, "will_pay_later"))
        self.assertEqual(r["rs"][0]["error"], "code_required", r)
        self.assertEqual((r["status"], r["reason"]), ("out_for_delivery", None))

    def test_m5_only_while_out_for_delivery_and_never_twice(self):
        r = run(b.OLD, call(b.RID, "will_pay_later"))
        self.assertEqual(r["rs"][0]["error"], "not_ready", r)
        r = run(b.READY, call(b.RID, "will_pay_later"), call(b.RID, "other", "again"))
        self.assertEqual(r["rs"][1]["error"], "not_ready", r)
        self.assertEqual(r["reason"], "will_pay_later")
