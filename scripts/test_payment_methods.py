# Story #1260 (epic #1259, boards P6, R7, A10): the payment methods setting and paid_by at the door.
# A setting holds the methods that are on (cash, upi_door); default cash and UPI at the door both on (owner, 10 Nov: UPI is on at go-live; the real QR gates prod, not the switch). Only an admin changes it, each change is logged with who and when, and the last method cannot go off.
# The rider's deliver step records how the order was paid: cash or upi_door; a method that is off is refused; no method counts as cash while cash is on. Customers read only the list that is on (payment_methods_on()). Cash totals do not count a UPI order.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it. Red run: SKIP_MIG=1.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_payment_methods.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_order_actions import SETUP, KITCHEN, RIDER, ADMIN, OTHER, CUST, K, O, ASSIGN, act, who

MIG = migration_inside(["20261110130000_payment_methods.sql"], "to_regproc('public.payment_methods_set_v2') is not null")
PM = "(select value from settings where name = 'payment_methods')"


def run(*steps, final=""):
    def flatten(x):
        return [y for e in x for y in flatten(e)] if isinstance(x, list) else [x]
    flat = flatten(list(steps))
    last = "reset role; select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + SETUP + ["update settings set value = '{\"object\": \"qr-test\"}'::jsonb where name = 'upi_qr'"] + flat + [last]) + "; rollback;")
    return r[-1] if isinstance(r, list) else r   # a refused statement comes back as an error dict; the tests that expect one read it as text


def setm(uid, method, on):
    return who(uid) + [f"insert into res (r) select payment_methods_set_v2('{method}', {str(on).lower()})"]


def to_out_for_delivery():
    return [act(KITCHEN, "accept"), act(KITCHEN, "prepare"), act(KITCHEN, "ready"), ASSIGN, act(RIDER, "pickup")]


LOG = "(select count(*) from payment_methods_log) as logs"
PAID = f"(select paid_by from orders where id = '{O}') as paid_by, (select status from orders where id = '{O}') as status"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PaymentMethods(unittest.TestCase):
    def test_s1_the_default_is_cash_and_upi_at_the_door_both_on(self):
        self.assertEqual(run(final=PM + " as pm")["pm"], ["cash", "upi_door"])

    def test_s2_both_on_then_admin_turns_cash_off_leaves_upi_and_one_log_row(self):
        r = run(setm(ADMIN, "cash", False), final=PM + " as pm, " + LOG)
        self.assertEqual((r["rs"][0]["ok"], r["pm"], r["logs"]), (True, ["upi_door"], 1), r)

    def test_s3_only_cash_on_then_turning_cash_off_is_refused_and_says_one_must_stay_on(self):
        r = run(setm(ADMIN, "upi_door", False), setm(ADMIN, "cash", False), final=PM + " as pm, " + LOG)
        self.assertEqual((r["rs"][1]["ok"], r["rs"][1]["error"], r["pm"], r["logs"]), (False, "last_method", ["cash"], 1), r)
        self.assertEqual(r["rs"][1]["message"], "One way to pay must stay on.")

    def test_s4_a_non_admin_cannot_change_or_read_the_admin_view(self):
        self.assertIn("not_admin", str(run(who(OTHER), "select payment_methods_set_v2('upi_door', false)")))
        self.assertIn("not_admin", str(run(who(CUST), "select payment_methods_get_v2()")))

    def test_s5_the_same_change_twice_changes_nothing_the_second_time_and_logs_once(self):
        r = run(setm(ADMIN, "upi_door", False), setm(ADMIN, "upi_door", False), final=PM + " as pm, " + LOG)
        self.assertEqual((r["rs"][0]["changed"], r["rs"][1]["changed"], r["pm"], r["logs"]), (True, False, ["cash"], 1), r)

    def test_s6_an_unknown_method_is_refused(self):
        self.assertEqual(run(setm(ADMIN, "card", True))["rs"][0]["error"], "invalid_method")

    def test_s7_the_log_says_who_and_what_and_only_an_admin_reads_it(self):
        r = run(setm(ADMIN, "upi_door", False), final="(select by_user::text from payment_methods_log) as by, (select methods from payment_methods_log) as methods")
        self.assertEqual((r["by"], r["methods"]), (ADMIN, ["cash"]), r)
        self.assertIn("permission denied", str(run("set local role anon", "select * from payment_methods_log")))
        self.assertEqual(run("set local role authenticated", "create temp table t as select count(*) as c from payment_methods_log", "reset role", final="(select c from t) as c")["c"], 0)   # a signed-in non-admin sees no row

    def test_s8_a_customer_reads_only_the_list_that_is_on_never_the_log_or_who_changed_it(self):
        r = run(setm(ADMIN, "upi_door", False), "set local role anon", "create temp table seen as select payment_methods_on() as v, (select count(*) from settings where name = 'payment_methods') as rows", "reset role", final="(select v from seen) as v, (select rows from seen) as rows")
        self.assertEqual((r["v"], r["rows"]), (["cash"], 0), r)   # the list that is on; the table itself stays closed
        self.assertIn("permission denied", str(run("set local role anon", "update settings set value = '[]'::jsonb where name = 'payment_methods'")))

    def test_s9_the_setting_holds_only_known_methods_and_at_least_one(self):
        for v in ("[]", '["card"]', '"cash"', "null", "{}"):
            self.assertIn("violates", str(run(f"update settings set value = '{v}'::jsonb where name = 'payment_methods'")), v)

    def test_s10_a_rider_marks_cash_and_paid_by_is_cash(self):
        r = run(to_out_for_delivery(), act(RIDER, "deliver", "cash"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["paid_by"], r["status"]), (True, "cash", "delivered"), r)

    def test_s11_a_rider_marks_upi_at_the_door_when_it_is_on(self):
        r = run(to_out_for_delivery(), act(RIDER, "deliver", "upi_door"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["rs"][-1]["order"]["paid_by"], r["paid_by"], r["status"]), (True, "upi_door", "upi_door", "delivered"), r)

    def test_s12_upi_at_the_door_off_refuses_and_the_order_is_not_delivered(self):
        r = run(setm(ADMIN, "upi_door", False), to_out_for_delivery(), act(RIDER, "deliver", "upi_door"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["rs"][-1]["error"], r["paid_by"], r["status"]), (False, "method_off", None, "out_for_delivery"), r)

    def test_s13_an_unknown_method_is_refused_and_the_order_is_not_delivered(self):
        r = run(to_out_for_delivery(), act(RIDER, "deliver", "card"), final=PAID)
        self.assertEqual((r["rs"][-1]["error"], r["status"]), ("invalid_method", "out_for_delivery"), r)

    def test_s14_an_old_rider_app_sends_no_method_it_counts_as_cash_when_cash_is_on(self):
        r = run(to_out_for_delivery(), act(RIDER, "deliver"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["paid_by"], r["status"]), (True, "cash", "delivered"), r)

    def test_s15_no_method_with_cash_off_is_refused_with_a_clear_error(self):
        r = run(setm(ADMIN, "cash", False), to_out_for_delivery(), act(RIDER, "deliver"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["rs"][-1]["error"], r["paid_by"], r["status"]), (False, "method_off", None, "out_for_delivery"), r)

    def test_s16_a_rider_mid_delivery_when_upi_is_turned_off_can_still_deliver_by_cash(self):
        r = run(to_out_for_delivery(), setm(ADMIN, "upi_door", False), act(RIDER, "deliver", "cash"), final=PAID)
        self.assertEqual((r["rs"][-1]["ok"], r["paid_by"], r["status"]), (True, "cash", "delivered"), r)

    def test_s17_a_delivered_upi_order_is_not_cash_in_the_kitchen_totals_or_the_rider_handover(self):
        r = run(to_out_for_delivery(), act(RIDER, "deliver", "upi_door"),
                final=f"(select count(*) from orders where id = '{O}' and status = 'delivered' and (paid_by is null or paid_by = 'cash')) as cash_rows")
        self.assertEqual(r["cash_rows"], 0, r)

    def test_s18_a_second_deliver_with_another_method_is_already_done_and_paid_by_stays(self):
        r = run(to_out_for_delivery(), act(RIDER, "deliver", "cash"), act(RIDER, "deliver", "upi_door"), final=PAID)
        self.assertEqual((r["rs"][-2]["ok"], r["rs"][-1]["ok"], r["rs"][-1]["error"], r["paid_by"], r["status"]), (True, False, "already_done", "cash", "delivered"), r)

    def test_s19_a_second_deliver_with_the_same_method_is_already_done_too_and_nothing_moves(self):
        r = run(to_out_for_delivery(), act(RIDER, "deliver", "upi_door"), act(RIDER, "deliver", "upi_door"), final=PAID)
        self.assertEqual((r["rs"][-1]["error"], r["paid_by"], r["status"]), ("already_done", "upi_door", "delivered"), r)


if __name__ == "__main__":
    unittest.main()
