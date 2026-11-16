# Story #1017: who cancelled an order is a recorded fact (orders.cancelled_by), set by cancel_order from the actor it works out and by a trigger for every other path; old rows are backfilled; the customer's own cancel stores no made-up reason.
# Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction (after the setup); SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_cancelled_by.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_order_actions import ADMIN, CUST, K, KITCHEN, O, SETUP, who

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261108120000_cancelled_by.sql")).read()
NEW = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261116100000_decline_is_not_cancel.sql")).read()   # story #1602
SHOW = "select cancelled_by, cancel_reason, status from orders where id = '" + O + "'"
STAFF_CUST = f"insert into kitchen_staff (kitchen_id, user_id) values ('{K}', '{CUST}')"   # the person who ordered is also staff of that kitchen (story #1602)
ADMIN_CUST = f"insert into admins (user_id) values ('{CUST}')"


def run(*steps, before_mig=(), show=SHOW):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(SETUP + list(before_mig)) + "; " + MIG + "; " + NEW + "; " + "; ".join(flat + ["reset role", show]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1][0] if isinstance(r[-1], list) else r[-1]


def cancel(uid, reason=None):
    a = "null" if reason is None else f"'{reason}'"
    return who(uid) + [f"select cancel_order('{O}', {a})"]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class CancelledBy(unittest.TestCase):
    def test_s1_a_customers_own_cancel_is_customer_and_stores_no_reason(self):
        r = run(cancel(CUST))
        self.assertEqual((r["cancelled_by"], r["cancel_reason"], r["status"]), ("customer", None, "cancelled"))

    def test_s2_the_kitchen_cancels_with_its_words_and_is_kitchen(self):
        r = run(cancel(KITCHEN, "We are out of paneer tonight."))
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("kitchen", "We are out of paneer tonight."))

    def test_s3_an_admin_cancels_with_a_reason_and_is_admin(self):
        r = run(cancel(ADMIN, "Closed today."))
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("admin", "Closed today."))

    def test_s4_the_riders_refusal_at_the_door_is_named_rider_by_the_trigger(self):
        r = run("reset role", f"update orders set status = 'cancelled', cancel_reason = 'refused_at_door' where id = '{O}'")
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("rider", "refused_at_door"))

    def test_s5_an_old_customer_cancel_is_backfilled_to_customer_with_the_made_up_text_gone(self):
        legacy = [f"update orders set status = 'cancelled', cancel_reason = 'cancelled by customer' where id = '{O}'",
                  f"insert into order_events (order_id, kitchen_id, session_id, event, actor) values ('{O}', '00000000-0000-0000-0000-0000000000b1', '{CUST}', 'order.cancelled', 'customer')"]
        r = run(before_mig=legacy)
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("customer", None))

    def test_s6_an_old_kitchen_decline_keeps_its_words_and_is_kitchen(self):
        legacy = [f"update orders set status = 'cancelled', cancel_reason = 'We are out.' where id = '{O}'",
                  f"insert into order_events (order_id, kitchen_id, session_id, event, actor) values ('{O}', '00000000-0000-0000-0000-0000000000b1', '{CUST}', 'order.cancelled', 'kitchen')"]
        r = run(before_mig=legacy)
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("kitchen", "We are out."))

    def test_s7_a_value_outside_the_four_is_refused(self):
        r = str(sql("begin; " + "; ".join(SETUP) + "; " + MIG + f"; update orders set cancelled_by = 'bot' where id = '{O}'; rollback;"))
        self.assertIn("orders_cancelled_by_values", r)

    # Story #1602: what the caller does decides the actor, not who the caller is. A reason from staff or an admin is a decline, even on their own order.
    def test_s8_staff_who_placed_the_order_declines_with_a_reason_and_is_kitchen(self):
        r = run(cancel(CUST, "We are out of paneer tonight."), before_mig=[STAFF_CUST])
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("kitchen", "We are out of paneer tonight."))

    def test_s9_an_admin_who_placed_the_order_declines_with_a_reason_and_is_admin(self):
        r = run(cancel(CUST, "Closed today."), before_mig=[ADMIN_CUST])
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("admin", "Closed today."))

    def test_s10_staff_who_placed_the_order_cancels_with_no_reason_and_is_customer(self):
        r = run(cancel(CUST), before_mig=[STAFF_CUST])
        self.assertEqual((r["cancelled_by"], r["cancel_reason"], r["status"]), ("customer", None, "cancelled"))

    def test_s11_an_old_customer_row_with_a_reason_becomes_kitchen_and_one_without_stays_customer(self):
        up = lambda why: f"update orders set status = 'cancelled', cancelled_by = 'customer', cancel_reason = {why} where id = '{O}'"
        r = run(before_mig=[up("'Out of paneer.'")])
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("kitchen", "Out of paneer."))
        r = run(before_mig=[up("null")])
        self.assertEqual((r["cancelled_by"], r["cancel_reason"]), ("customer", None))

    def test_s12_the_customer_gets_the_decline_alert_in_case_s8(self):
        sub = f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{CUST}', 'https://web.push.apple.com/abc', 'k', 'a')"
        r = run(cancel(CUST, "We are out of paneer tonight."), before_mig=[STAFF_CUST, sub],
                show=f"select count(*)::int as n from push_outbox where order_id = '{O}' and status = 'cancelled'")
        self.assertEqual(r["n"], 1)


if __name__ == "__main__":
    unittest.main()
