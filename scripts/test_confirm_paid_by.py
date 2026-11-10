# Story #1293 (epic #1259): the customer's Yes never sets or changes how the order was paid. Only the rider's deliver step records it (story #1260).
# If the customer confirms first, the rider can still record the method once. Every check ends in ROLLBACK. Red run: SKIP_MIG=1.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_confirm_paid_by.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_order_actions import SETUP, KITCHEN, RIDER, ADMIN, CUST, O, ASSIGN, act, who

MIG = migration_inside(["20261110140000_confirm_keeps_paid_by.sql"], "(select prosrc from pg_proc where proname = 'confirm_delivery') not like '%paid_by = ''cash''%'")
PAID = f"(select paid_by from orders where id = '{O}') as paid_by, (select status from orders where id = '{O}') as status"


def run(*steps, final=""):
    def flatten(x):
        return [y for e in x for y in flatten(e)] if isinstance(x, list) else [x]
    flat = flatten(list(steps))
    last = "reset role; select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + SETUP + flat + [last]) + "; rollback;")
    return r[-1] if isinstance(r, list) else r


def out():
    return [act(KITCHEN, "accept"), act(KITCHEN, "prepare"), act(KITCHEN, "ready"), ASSIGN, act(RIDER, "pickup")]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class ConfirmKeepsPaidBy(unittest.TestCase):
    def test_c1_the_customer_confirms_first_the_order_is_delivered_and_paid_by_stays_empty(self):
        r = run(out(), act(CUST, "confirm"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["status"], r["paid_by"]), (True, "delivered", None), r)

    def test_c2_the_rider_records_upi_first_then_the_customer_confirms_and_upi_stays(self):
        r = run(out(), act(RIDER, "deliver", "upi_door"), act(CUST, "confirm"), final=PAID)
        self.assertEqual((r["rs"][-2]["ok"], r["rs"][-1]["error"], r["paid_by"]), (True, "already_done", "upi_door"), r)

    def test_c3_the_customer_confirms_first_then_the_rider_can_still_record_upi_once(self):
        r = run(out(), act(CUST, "confirm"), act(RIDER, "deliver", "upi_door"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["rs"][-1]["order"]["paid_by"], r["paid_by"], r["status"]), (True, "upi_door", "upi_door", "delivered"), r)

    def test_c4_after_that_a_second_deliver_with_another_method_is_already_done_and_paid_by_stays(self):
        r = run(out(), act(CUST, "confirm"), act(RIDER, "deliver", "upi_door"), act(RIDER, "deliver", "cash"), final=PAID)
        self.assertEqual((r["rs"][-1]["error"], r["paid_by"]), ("already_done", "upi_door"), r)

    def test_c5_a_second_confirm_is_already_done_and_adds_no_second_confirmation(self):
        r = run(out(), act(CUST, "confirm"), act(CUST, "confirm"),
                final=f"(select count(*) from order_events where order_id = '{O}' and event = 'order.confirmed') as confirmed, " + PAID)
        self.assertEqual((r["rs"][-1]["error"], r["confirmed"], r["paid_by"]), ("already_done", 1, None), r)

    def test_c6_a_method_that_is_off_is_still_refused_after_the_customer_confirmed(self):
        r = run(out(), act(CUST, "confirm"), who(ADMIN), "insert into res (r) select payment_methods_set_v2('upi_door', false)", act(RIDER, "deliver", "upi_door"), final=PAID)
        self.assertEqual((r["rs"][-1]["error"], r["paid_by"]), ("method_off", None), r)

    def test_c7_only_the_assigned_rider_can_record_it_after_the_customer_confirmed(self):
        r = run(out(), act(CUST, "confirm"), act(CUST, "deliver", "upi_door"), final=PAID)
        self.assertEqual((r["rs"][-1]["error"], r["paid_by"]), ("not_allowed", None), r)


if __name__ == "__main__":
    unittest.main()
