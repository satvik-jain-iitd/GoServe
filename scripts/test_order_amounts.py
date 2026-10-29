# Story #538 (code layer): orders.total_paise is the amount to pay, in v1 and v2. The food value is readable in both, and a paid online order collects no cash.
# Scenario: Given a v1 order and a v2 order with a fee, when both are read, then total_paise is the amount to pay in both.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_amounts.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, O2, SETUP, run

BILL = '{"item_total_paise": 28000, "to_pay_paise": 30000}'
V2 = f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, bill) values ('{O2}', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'k2', '[]', 30000, 'x', '{BILL}')"
AMOUNTS = "(select jsonb_agg(jsonb_build_object('id', id, 'item', order_item_total_paise(o), 'collect', order_cash_to_collect_paise(o)) order by client_order_key) from orders o) as amounts"


def by_id(r):
    return {a["id"]: a for a in r["amounts"]}


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderAmounts(unittest.TestCase):
    def test_a_v1_order_has_no_bill_so_the_item_total_is_the_total(self):
        a = by_id(run(final=AMOUNTS))
        self.assertEqual((a[O]["item"], a[O]["collect"]), (28000, 28000), a)

    def test_a_v2_order_with_a_fee_collects_the_amount_to_pay_and_keeps_the_food_value(self):
        a = by_id(run(V2, final=AMOUNTS))
        self.assertEqual((a[O2]["item"], a[O2]["collect"]), (28000, 30000), a)

    def test_a_paid_online_order_collects_no_cash(self):
        a = by_id(run(V2, f"update orders set payment_method = 'online', paid_at = now() where id = '{O2}'", final=AMOUNTS))
        self.assertEqual((a[O2]["item"], a[O2]["collect"]), (28000, 0), a)

    def test_an_online_order_not_yet_paid_still_owes_its_total(self):
        a = by_id(run(V2, f"update orders set payment_method = 'online' where id = '{O2}'", final=AMOUNTS))
        self.assertEqual(a[O2]["collect"], 30000, a)

    def test_a_total_that_is_not_the_amount_to_pay_in_the_bill_is_refused(self):
        bad = V2.replace("30000, 'x'", "28000, 'x'")   # total_paise 28000 while the bill says to_pay 30000
        r = sql("begin; " + "; ".join(SETUP + [bad]) + "; rollback;")
        self.assertIn("orders_total_is_to_pay", str(r), r)

    def test_a_bill_without_to_pay_is_refused(self):
        bad = V2.replace('"to_pay_paise": 30000', '"x": 1')
        r = sql("begin; " + "; ".join(SETUP + [bad]) + "; rollback;")
        self.assertIn("orders_total_is_to_pay", str(r), r)


if __name__ == "__main__":
    unittest.main()
