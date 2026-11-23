# Story 1791 (epic 1790): an admin cancels any order before Delivered, with a reason.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_admin_cancel_any.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ("20261124110000_order_codes.sql", "20261124120000_kitchen_handover_code.sql", "20261124125000_rider_deliver_code.sql", "20261124126000_order_code_switch.sql", "20261124160000_admin_cancel_any.sql")
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
            "(select status from payments where order_id = '%s') as pay" % (O1, O1, O1, O1, O1))
    r = sql("begin; " + "; ".join(MIGS + SETUP + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


def err(r):
    return [x.get("error") for x in r["rs"]]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class AdminCancelAny(unittest.TestCase):
    def test_ac1_admin_cancels_in_every_status_before_delivered(self):
        for st in UPTO:
            r = run(to(st), act(ADM, "cancel", "Kitchen closed"))
            self.assertEqual((r["rs"][0]["ok"], r["status"], r["by"], r["why"]), (True, "cancelled", "admin", "Kitchen closed"), (st, r))

    def test_ac1_arriving_is_cancelled_too(self):
        r = run(to("out_for_delivery"), act(RID, "arriving"), act(ADM, "cancel", "Wrong address"))
        self.assertEqual((r["rs"][1]["ok"], r["status"], r["by"]), (True, "cancelled", "admin"), r)

    def test_ac1_delivered_is_refused_named(self):
        r = run(to("out_for_delivery"), "update orders set status='delivered' where id='%s'" % O1, act(ADM, "cancel", "Too late"))
        self.assertEqual((err(r), r["status"], r["by"]), (["already_delivered"], "delivered", None), r)

    def test_ac1_second_tap_answers_already_done_and_changes_nothing(self):
        r = run(to("preparing"), act(ADM, "cancel", "Kitchen closed"), act(ADM, "cancel", "Other words"))
        self.assertEqual((err(r)[1], r["why"], len(r["evs"])), ("already_done", "Kitchen closed", 1), r)

    def test_ac2_reason_required_trimmed_and_capped(self):
        r = run(to("preparing"), act(ADM, "cancel", None), act(ADM, "cancel", "   "), act(ADM, "cancel", "x" * 201))
        self.assertEqual((err(r), r["status"]), (["reason_required", "reason_required", "reason_too_long"], "preparing"), r)
        r = run(to("preparing"), act(ADM, "cancel", "  " + "y" * 200 + "  "))
        self.assertEqual((r["rs"][0]["ok"], r["why"]), (True, "y" * 200), r)

    def test_ac3_event_names_admin_with_reason_and_rider_is_released(self):
        r = run(to("out_for_delivery"), act(ADM, "cancel", "Kitchen closed"))
        self.assertEqual(r["evs"], [{"actor": "admin", "reason": "Kitchen closed"}], r)
        self.assertEqual(r["status"], "cancelled", r)   # a rider's open job and "busy" both read status; cancelled is neither

    def test_ac3_rider_is_free_for_dispatch_again(self):
        # the cancelled order no longer counts as an open job of the rider
        O2 = "00000000-0000-0000-0000-0000000000b2"
        r = run(to("out_for_delivery"), act(ADM, "cancel", "Kitchen closed"), "reset role",
                f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, customer_phone) values ('{O2}', '{KIT}', '{CUS}', 'k2', '[]', 100, 'x', '9000000000')",
                f"insert into res (r) select jsonb_build_object('open', (select count(*) from orders where rider_id = '{RID}' and status not in ('delivered','cancelled')))")
        self.assertEqual(r["rs"][1]["open"], 0, r)

    def test_ac4_paid_payment_is_owed_back_unpaid_is_closed(self):
        ins = f"insert into payments (order_id, provider, provider_order_id, amount_paise, status) values ('{O1}', 'fake', 'p1', 100, '%s')"
        self.assertEqual(run(ins % "paid", to("preparing"), act(ADM, "cancel", "Kitchen closed"))["pay"], "refund_due")
        self.assertEqual(run(ins % "created", to("preparing"), act(ADM, "cancel", "Kitchen closed"))["pay"], "failed")

    def test_ac5_kitchen_keeps_its_rules(self):
        r = run(to("preparing"), act(KIT_U, "cancel", "Out of rice"), act(KIT_U2, "cancel", "Not mine"))
        self.assertEqual((err(r), r["status"]), (["cannot_cancel", "not_allowed"], "preparing"), r)
        r = run(to("accepted"), act(KIT_U, "cancel", "Out of rice"))
        self.assertEqual((r["rs"][0]["ok"], r["by"]), (True, "kitchen"), r)

    def test_ac5_rider_cannot_cancel_through_the_door(self):
        r = run(to("out_for_delivery"), act(RID, "cancel", "Nope"), act(RID2, "cancel", "Nope"))
        self.assertEqual((err(r), r["status"]), (["not_allowed", "not_allowed"], "out_for_delivery"), r)

    def test_ac5_customer_keeps_its_rules(self):
        r = run(to("preparing"), act(CUS, "cancel", None))
        self.assertEqual((err(r), r["status"]), (["cannot_cancel"], "preparing"), r)
        r = run(act(CUS, "cancel", None))
        self.assertEqual((r["rs"][0]["ok"], r["by"], r["why"]), (True, "customer", None), r)

    def test_rider_at_the_door_gets_a_named_answer_after_the_admin_cancels(self):
        r = run(to("out_for_delivery"), act(ADM, "cancel", "Kitchen closed"), act(RID, "deliver", "cash"), act(RID, "arriving"), act(RID, "pickup"))
        self.assertTrue(all(x.get("ok") is False and x.get("error") for x in r["rs"][1:]), r)   # named, never ok, never a crash
        self.assertEqual(r["status"], "cancelled", r)
        r = run(to("out_for_delivery"), act(ADM, "cancel", "Kitchen closed"), as_(RID, "rider_deliver_v1('%s', '1234', 'cash')" % O1))
        self.assertEqual(err(r)[1], "not_ready", r)

    def test_rider_refused_after_admin_cancel_is_a_named_error_not_a_second_cancel(self):
        q = "begin; " + "; ".join(MIGS + SETUP + to("out_for_delivery") + act(ADM, "cancel", "Kitchen closed") + as_(RID, "to_jsonb(rider_refused('%s'))" % O1)) + "; rollback;"
        r = sql(q)
        self.assertIn("order_not_found", str(r), r)

    def test_hundredth_customer_reason_is_plain_text(self):
        r = run(to("preparing"), act(ADM, "cancel", "<b>x</b>"))
        self.assertEqual((r["why"], r["evs"][0]["reason"]), ("<b>x</b>", "<b>x</b>"), r)


if __name__ == "__main__":
    unittest.main()
