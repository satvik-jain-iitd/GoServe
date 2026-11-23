# Story 944 (epic 1790), payments: rider_refused and the customer's confirm leave the payment row consistent.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_payment_state_consistent.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ("20261124110000_order_codes.sql", "20261124120000_kitchen_handover_code.sql", "20261124125000_rider_deliver_code.sql", "20261124126000_order_code_switch.sql", "20261124160000_admin_cancel_any.sql", "20261124170000_payment_state_consistent.sql")
MIGS = [] if os.environ.get("SKIP_MIG") else [open(os.path.join(HERE, "..", "supabase", "migrations", f)).read() for f in NAMES]
CUS, RID, RID2, KIT_U, KIT_U2, ADM = ("00000000-0000-0000-0000-0000000000c%d" % i for i in range(1, 7))
KIT, KIT2 = "00000000-0000-0000-0000-0000000000f3", "00000000-0000-0000-0000-0000000000f4"
O1 = "00000000-0000-0000-0000-0000000000b1"

SETUP = [f"insert into auth.users (id, email, aud, role, instance_id) values ('{u}', '{u}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"
         for u in (CUS, RID, RID2, KIT_U, KIT_U2, ADM)] + [
    f"insert into admins (user_id) values ('{ADM}')",
    f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016']), ('{KIT2}', 'Other kitchen', array['110017'])",
    f"insert into riders (user_id, name) values ('{RID}', 'Test rider'), ('{RID2}', 'Test rider two')",
    f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{KIT}', '{KIT_U}', 'kitchen'), ('{KIT2}', '{KIT_U2}', 'kitchen')",
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, customer_phone) values ('{O1}', '{KIT}', '{CUS}', 'k1', '[]', 100, 'x', '9000000000')",
    f"update orders set rider_id = '{RID}' where id = '{O1}'",
    "create temp table res (i serial, r jsonb)", "grant all on res to public", "grant all on res_i_seq to public"]
UPTO = {"placed": [], "accepted": ["accepted"], "preparing": ["accepted", "preparing"], "ready": ["accepted", "preparing", "ready"],
        "out_for_delivery": ["accepted", "preparing", "ready", "out_for_delivery"]}


def to(status):
    return [f"update orders set status='{s}' where id='{O1}'" for s in UPTO[status]]


def as_(uid, call):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)",
            f"insert into res (r) select {call}"]


def act(uid, action, arg=None):
    a = "null" if arg is None else "'" + arg.replace("'", "''") + "'"
    return as_(uid, f"act_on_order('{O1}', '{action}', {a})")


def run(*steps):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = ("reset role; select (select jsonb_agg(r order by i) from res) as rs, (select status from orders where id = '%s') as status, "
            "(select cancelled_by from orders where id = '%s') as by, (select cancel_reason from orders where id = '%s') as why, "
            "(select jsonb_agg(jsonb_build_object('actor', actor, 'reason', to_jsonb(e) ->> 'reason')) from order_events e where order_id = '%s' and event = 'order.cancelled') as evs, "
            "(select status from payments where order_id = '%s') as pay, (select updated_at from payments where order_id = '%s') as pay_at, (select count(*) from order_events where order_id = '%s') as n_ev" % (O1, O1, O1, O1, O1, O1, O1))
    r = sql("begin; " + "; ".join(MIGS + SETUP + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


def err(r):
    return [x.get("error") for x in r["rs"]]


INS = f"insert into payments (order_id, provider, provider_order_id, amount_paise, status) values ('{O1}', 'fake', 'p1', 100, '%s')"
ONLINE = f"update orders set payment_method = 'online', paid_at = now() where id = '{O1}'"


def refuse(uid=RID):
    return as_(uid, "to_jsonb(rider_refused('%s'))" % O1)


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PaymentStateConsistent(unittest.TestCase):
    def test_refused_paid_online_is_owed_back(self):
        r = run(ONLINE, INS % "paid", to("out_for_delivery"), refuse())
        self.assertEqual((r["status"], r["pay"]), ("cancelled", "refund_due"), r)

    def test_refused_unpaid_created_payment_is_closed(self):
        r = run(INS % "created", to("out_for_delivery"), refuse())
        self.assertEqual((r["status"], r["pay"]), ("cancelled", "failed"), r)

    def test_refused_cash_order_has_no_payment_row_and_still_cancels(self):
        r = run(to("out_for_delivery"), refuse())
        self.assertEqual((r["status"], r["pay"]), ("cancelled", None), r)

    def test_refused_twice_changes_nothing(self):
        again = f"do $$ begin perform rider_refused('{O1}'); exception when others then insert into res (r) values (jsonb_build_object('error', sqlerrm)); end $$"
        one = run(ONLINE, INS % "paid", to("out_for_delivery"), refuse())
        two = run(ONLINE, INS % "paid", to("out_for_delivery"), refuse(), again)
        self.assertEqual(two["rs"][-1], {"error": "order_not_found"}, two)
        self.assertEqual((two["pay"], two["n_ev"]), ("refund_due", one["n_ev"]), (one, two))

    def test_confirmed_paid_online_stays_paid_and_delivered(self):
        r = run(ONLINE, INS % "paid", to("out_for_delivery"), act(CUS, "confirm"))
        self.assertEqual((r["rs"][0]["ok"], r["status"], r["pay"]), (True, "delivered", "paid"), r)

    def test_confirmed_cash_order_has_no_payment_row(self):
        r = run(to("out_for_delivery"), act(CUS, "confirm"))
        self.assertEqual((r["rs"][0]["ok"], r["status"], r["pay"]), (True, "delivered", None), r)

    def test_second_confirm_changes_nothing(self):
        one = run(ONLINE, INS % "paid", to("out_for_delivery"), act(CUS, "confirm"))
        two = run(ONLINE, INS % "paid", to("out_for_delivery"), act(CUS, "confirm"), act(CUS, "confirm"))
        self.assertEqual(err(two)[1], "already_done", two)
        self.assertEqual((two["pay"], two["n_ev"]), (one["pay"], one["n_ev"]), (one, two))

    def test_confirm_after_refuse_does_not_revive_the_payment(self):
        r = run(ONLINE, INS % "paid", to("out_for_delivery"), refuse(), act(CUS, "confirm"))
        self.assertEqual((r["status"], r["pay"]), ("cancelled", "refund_due"), r)


if __name__ == "__main__":
    unittest.main()
