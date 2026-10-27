# Story #557 (layer 2 of #348): an unpaid online order does not stay stuck.
# Scenario: Given an online order not paid for 15 minutes, when the expiry runs, then the payment is failed and the order is cash on delivery
# and the kitchen can accept it; a paid order is never touched. The customer can also switch to cash by hand.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_payment_expiry.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN
from test_payments import O, CUST, KITCHEN, OTHER, PAY, ORD, create, paid, act, q, run


def age(minutes):
    return f"update payments set created_at = now() - interval '{minutes} minutes' where order_id = '{O}'"


def expire(minutes=15):
    return q(f"payment_expire_v2({minutes})")


def to_cash(session=CUST, order=O):
    return q(f"payment_switch_to_cash_v2('{order}', '{session}')")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PaymentExpiry(unittest.TestCase):
    def test_a_payment_older_than_the_limit_fails_and_the_order_goes_back_to_cash_and_the_kitchen_can_accept(self):
        r = run(create(), age(16), expire(), act(KITCHEN, "accept"), final=PAY + ", " + ORD)
        self.assertEqual((r["rs"][1]["ok"], r["rs"][1]["expired"]), (True, 1), r)
        self.assertEqual(r["pay"]["status"], "failed", r)
        self.assertEqual((r["ord"]["payment_method"], r["ord"]["status"]), ("cod", "accepted"), r)

    def test_a_young_payment_is_left_alone(self):
        r = run(create(), age(5), expire(), final=PAY + ", " + ORD)
        self.assertEqual(r["rs"][1]["expired"], 0, r)
        self.assertEqual((r["pay"]["status"], r["ord"]["payment_method"]), ("created", "online"), r)

    def test_a_paid_order_is_never_touched(self):
        r = run(create(), paid(), age(60), expire(), final=PAY + ", " + ORD)
        self.assertEqual(r["rs"][2]["expired"], 0, r)
        self.assertEqual((r["pay"]["status"], r["ord"]["payment_method"], r["ord"]["paid"]), ("paid", "online", True), r)

    def test_a_late_webhook_after_the_expiry_is_refused_not_paid(self):
        r = run(create(), age(16), expire(), paid())
        self.assertEqual(r["rs"][2]["error"], "payment_closed", r)

    def test_the_customer_switches_to_cash_and_the_payment_closes(self):
        r = run(create(), to_cash(), act(KITCHEN, "accept"), final=PAY + ", " + ORD)
        self.assertEqual(r["rs"][1]["ok"], True, r)
        self.assertEqual((r["pay"]["status"], r["ord"]["payment_method"], r["ord"]["status"]), ("failed", "cod", "accepted"), r)

    def test_switching_is_refused_for_a_stranger_and_for_a_paid_order(self):
        r = run(create(), to_cash(OTHER), paid(), to_cash(), final=ORD)
        self.assertEqual(r["rs"][1]["error"], "order_not_found", r)
        self.assertEqual(r["rs"][3]["error"], "already_paid", r)
        self.assertEqual(r["ord"]["payment_method"], "online", r)

    def test_switching_a_cash_order_again_changes_nothing(self):
        r = run(to_cash(), to_cash(), final=ORD)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][1]["ok"], r["ord"]["payment_method"]), (True, True, "cod"), r)

    def test_only_the_service_role_can_call_them(self):
        from test_schema import sql
        from test_payments import SETUP
        for role in ("anon", "authenticated"):
            for stmt in ("select payment_expire_v2(15)", f"select payment_switch_to_cash_v2('{O}', '{CUST}')"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
