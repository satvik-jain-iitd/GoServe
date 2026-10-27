# Story #348 (E27, plan v2 B.12): payments, built with a TEST DOUBLE (FakeGateway) until the owner's Razorpay KYC click.
# Scenario: Given a sandbox payment, when the webhook arrives with a good signature, then the order becomes paid; a cancel refunds.
# The database holds the state: a payment row per online order, the order waits for it (the kitchen cannot accept an unpaid online order), cash on delivery
# keeps today's path with no payment row, and a cancel makes a paid payment refund_due (the Edge Function then asks the gateway). The signature check is in
# the Edge Function (supabase/functions/payments).
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_payments.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "00000000-0000-0000-0000-0000000000b1"
O = "00000000-0000-0000-0000-0000000000f1"
O2 = "00000000-0000-0000-0000-0000000000f2"
CUST, KITCHEN, OTHER = [f"00000000-0000-0000-0000-0000000000a{i}" for i in (1, 2, 3)]
SETUP = [
    f"insert into auth.users (id) values ('{CUST}'), ('{KITCHEN}'), ('{OTHER}')",
    f"insert into kitchens (id, name, pin_codes) values ('{K}', 'Test', array['110016'])",
    f"insert into kitchen_staff (kitchen_id, user_id) values ('{K}', '{KITCHEN}')",
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{O}', '{K}', '{CUST}', 'k1', '[]', 28000, 'Flat 4')",
    "create temp table res (i serial, r jsonb)", "grant all on res to public", "grant all on res_i_seq to public",
]


def who(uid):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)"]


def q(stmt):
    return f"insert into res (r) select {stmt}"


def prepare(session=CUST, order=O):
    return q(f"payment_prepare_v2('{order}', '{session}')")


def create(pid="fake_order_1", session=CUST, order=O):
    return q(f"payment_create_v2('{order}', '{session}', 'fake', '{pid}')")


def paid(pid="fake_order_1", pay="fake_pay_1"):
    return q(f"payment_paid_v2('fake', '{pid}', '{pay}')")


def act(uid, action, arg=None, order=O):
    a = "null" if arg is None else f"'{arg}'"
    return who(uid) + [q(f"act_on_order('{order}', '{action}', {a})"), "reset role"]


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(SETUP + flat + ["reset role", "select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


PAY = f"(select row_to_json(p) from (select status, amount_paise, provider_order_id, provider_payment_id from payments where order_id = '{O}') p) as pay"
ORD = f"(select row_to_json(o) from (select payment_method, paid_at is not null as paid, status from orders where id = '{O}') o) as ord"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Payments(unittest.TestCase):
    def test_prepare_answers_the_amount_to_pay_from_the_order_and_only_to_the_customer_who_placed_it(self):
        r = run(prepare(), prepare(OTHER), prepare(order="00000000-0000-0000-0000-00000000dead"))
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["amount_paise"], r["rs"][0]["existing"]), (True, 28000, None), r)
        self.assertEqual([x["error"] for x in r["rs"][1:]], ["order_not_found", "order_not_found"])   # a stranger learns nothing

    def test_create_stores_a_created_payment_and_the_order_becomes_online(self):
        r = run(create(), final=PAY + ", " + ORD)
        self.assertEqual(r["rs"][0]["ok"], True, r)
        self.assertEqual(r["pay"], {"status": "created", "amount_paise": 28000, "provider_order_id": "fake_order_1", "provider_payment_id": None}, r)
        self.assertEqual((r["ord"]["payment_method"], r["ord"]["paid"]), ("online", False), r)

    def test_creating_twice_gives_the_same_payment_and_prepare_then_names_it(self):
        r = run(create(), create("fake_order_2"), prepare(), final="(select count(*) from payments where order_id = '" + O + "') as n")
        self.assertEqual(r["rs"][1]["payment"]["provider_order_id"], "fake_order_1", r)   # the first one stands
        self.assertEqual(r["rs"][2]["existing"], "fake_order_1", r)
        self.assertEqual(r["n"], 1)

    def test_a_good_webhook_marks_the_payment_and_the_order_paid_and_a_repeat_changes_nothing(self):
        r = run(create(), paid(), paid(), final=PAY + ", " + ORD)
        self.assertEqual((r["rs"][1]["ok"], r["rs"][1]["order_id"]), (True, O), r)
        self.assertEqual((r["rs"][2]["ok"], r["rs"][2]["already_paid"]), (True, True), r)
        self.assertEqual((r["pay"]["status"], r["pay"]["provider_payment_id"], r["ord"]["paid"]), ("paid", "fake_pay_1", True), r)

    def test_a_payment_the_database_does_not_know_is_refused(self):
        r = run(paid("nope"))
        self.assertEqual(r["rs"][0]["error"], "payment_not_found", r)

    def test_an_online_order_waits_for_the_payment_before_the_kitchen_can_accept_it(self):
        r = run(create(), act(KITCHEN, "accept"), paid(), act(KITCHEN, "accept"), final=ORD)
        self.assertEqual(r["rs"][1]["error"], "awaiting_payment", r)
        self.assertEqual((r["rs"][3]["ok"], r["ord"]["status"]), (True, "accepted"), r)

    def test_cash_on_delivery_keeps_todays_path_no_payment_row_and_the_kitchen_accepts_at_once(self):
        r = run(act(KITCHEN, "accept"), final=ORD + ", (select count(*) from payments) as n")
        self.assertEqual((r["rs"][0]["ok"], r["ord"]["payment_method"], r["n"]), (True, "cod", 0), r)

    def test_cancelling_a_paid_order_makes_the_payment_refund_due_and_the_refund_closes_it(self):
        r = run(create(), paid(), act(CUST, "cancel"), q(f"payment_refund_target_v2('{O}')"), q(f"payment_refunded_v2('{O}')"), final=PAY)
        self.assertEqual(r["rs"][3]["payment"], {"provider": "fake", "provider_payment_id": "fake_pay_1", "amount_paise": 28000}, r)
        self.assertEqual((r["rs"][4]["ok"], r["pay"]["status"]), (True, "refunded"), r)

    def test_cancelling_an_unpaid_online_order_closes_the_payment_without_a_refund(self):
        r = run(create(), act(CUST, "cancel"), q(f"payment_refund_target_v2('{O}')"), final=PAY)
        self.assertEqual((r["pay"]["status"], r["rs"][2]["error"]), ("failed", "nothing_to_refund"), r)

    def test_the_customer_reads_only_their_own_payment_and_nobody_writes_by_hand(self):
        r = run(create(), who(CUST), final="(select count(*) from payments) as n")
        self.assertEqual(r["n"], 1)
        other = sql("begin; " + "; ".join(SETUP + [create()] + who(OTHER) + ["select count(*) as n from payments"]) + "; rollback;")
        self.assertEqual(other[-1], {"n": 0}, other)
        for stmt in (f"update payments set status = 'paid' where order_id = '{O}'", f"insert into payments (order_id, provider, provider_order_id, amount_paise) values ('{O}', 'x', 'y', 1)"):
            w = sql("begin; " + "; ".join(SETUP + [create()] + who(CUST) + [stmt]) + "; rollback;")
            self.assertIn("permission denied", str(w), stmt)

    def test_only_the_service_role_can_call_the_payment_functions(self):
        for role in ("anon", "authenticated"):
            for stmt in (f"select payment_prepare_v2('{O}', '{CUST}')", f"select payment_paid_v2('fake', 'x', 'y')"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
