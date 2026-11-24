# Story 1319 review fix: a customer's later Yes on a money-due order must not write cash (paid_by stays empty).
# Every check ends in ROLLBACK. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_money_due_confirm.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
import test_rider_deliver_code as b
import test_money_not_collected as m

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261124250000_money_due_confirm.sql")).read()
O1 = b.O1


def run(*steps):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = ("reset role; select (select jsonb_agg(r order by i) from res) as rs, (select status from orders where id = '%s') as status, (select paid_by from orders where id = '%s') as paid, "
            "(select money_due_reason from orders where id = '%s') as reason" % (O1, O1, O1))
    r = sql("begin; " + "; ".join(list(b.MIGS) + b.SETUP + [m.MIG, MIG] + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


def confirm():
    return b.act(b.CUS, "confirm", None)   # the customer's Yes goes through act_on_order


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class MoneyDueConfirm(unittest.TestCase):
    def test_c1_the_customers_yes_after_money_not_collected_writes_no_cash(self):
        r = run(b.READY, m.call(b.RID, "will_pay_later"), confirm())
        self.assertEqual((r["status"], r["paid"], r["reason"]), ("delivered", None, "will_pay_later"), r)

    def test_c2_a_later_rider_deliver_after_that_yes_writes_no_cash_either(self):
        r = run(b.READY, m.call(b.RID, "will_pay_later"), confirm(), b.act(b.RID, "deliver", "cash"))
        self.assertIsNone(r["paid"], r)

    def test_c3_an_ordinary_order_still_records_cash_after_the_yes(self):
        r = run(b.READY, confirm(), b.act(b.RID, "deliver", "cash"))
        self.assertEqual(r["paid"], "cash", r)
