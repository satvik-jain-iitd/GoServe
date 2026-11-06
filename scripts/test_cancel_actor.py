# Story #904: cancel_order names the person who placed the order as the customer first, whatever else they are.
# Scenario: Given a customer who is also admin (or kitchen staff), when they cancel their own order with no reason, then it is cancelled, actor customer.
# Same harness as test_order_actions.py: every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_cancel_actor.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN
from test_order_actions import ADMIN, CUST, EVENTS, K, KITCHEN, O, OTHER, STATUS, act, run, who

def cancel(uid, reason=None):
    a = "null" if reason is None else f"'{reason}'"
    return who(uid) + [f"do $$ begin insert into res (r) select cancel_order('{O}', {a}); exception when others then insert into res (r) values (jsonb_build_object('error', sqlerrm)); end $$"]

ALSO_ADMIN = ["reset role", f"insert into admins (user_id) values ('{CUST}')"]
ALSO_STAFF = ["reset role", f"insert into kitchen_staff (kitchen_id, user_id) values ('{K}', '{CUST}')"]
LAST = "(select jsonb_agg(event || ':' || actor order by created_at, id) from order_events where order_id = '" + O + "') as ev"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class CancelActor(unittest.TestCase):
    def test_a_customer_who_is_also_admin_cancels_their_own_placed_order_with_no_reason(self):
        r = run(ALSO_ADMIN, cancel(CUST), final=STATUS + ", " + LAST)
        self.assertNotIn("error", r["rs"][0], r["rs"])
        self.assertEqual(r["status"], "cancelled")
        self.assertEqual(r["ev"][-1], "order.cancelled:customer")

    def test_a_customer_who_is_also_kitchen_staff_cancels_their_own_accepted_order_with_no_reason(self):
        r = run(act(KITCHEN, "accept"), ALSO_STAFF, cancel(CUST), final=STATUS + ", " + LAST)
        self.assertNotIn("error", r["rs"][1], r["rs"])
        self.assertEqual(r["status"], "cancelled")
        self.assertEqual(r["ev"][-1], "order.cancelled:customer")

    def test_an_admin_still_needs_a_reason_for_someone_elses_order(self):
        r = run(cancel(ADMIN), cancel(ADMIN, "test order"), final=STATUS + ", " + LAST)
        self.assertIn("reason_required", str(r["rs"][0]), r["rs"])
        self.assertEqual((r["status"], r["ev"][-1]), ("cancelled", "order.cancelled:admin"))

    def test_a_stranger_is_still_refused_and_preparing_still_cannot_be_cancelled(self):
        r = run(cancel(OTHER), act(KITCHEN, "accept"), act(KITCHEN, "prepare"), cancel(CUST), final=STATUS)
        self.assertIn("not_allowed", str(r["rs"][0]), r["rs"])
        self.assertIn("cannot_cancel", str(r["rs"][3]), r["rs"])
        self.assertEqual(r["status"], "preparing")


if __name__ == "__main__":
    unittest.main()
