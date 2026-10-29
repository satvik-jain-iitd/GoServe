# Story #349 (E27, plan v2 B.13): status, confirm, events and cancel on v2. Scenario: Given an order, when the kitchen and rider act, then the order goes
# placed to delivered with its seven events once each.
# act_on_order is the one door: it reads who is asking from the login (auth.uid()), checks that this person may take this step on this order,
# then calls the same change_status, rider_event, confirm_delivery and cancel_order that n8n calls today. Refusals are answers, not exceptions.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_actions.py
import json, os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "00000000-0000-0000-0000-0000000000b1"
K2 = "00000000-0000-0000-0000-0000000000b9"
D = "00000000-0000-0000-0000-0000000000b2"
CUST, KITCHEN, RIDER, OTHER, ADMIN, KITCHEN2 = [f"00000000-0000-0000-0000-0000000000a{i}" for i in range(1, 7)]
O = "00000000-0000-0000-0000-0000000000f1"
LINE = json.dumps([{"menu_item_id": D, "qty": 1, "option_ids": []}])
SETUP = [
    f"insert into auth.users (id) values ('{CUST}'), ('{KITCHEN}'), ('{RIDER}'), ('{OTHER}'), ('{ADMIN}'), ('{KITCHEN2}')",
    f"insert into kitchens (id, name, pin_codes) values ('{K}', 'Test', array['110016']), ('{K2}', 'Other', array['110017'])",
    f"insert into menu_items (id, kitchen_id, name, price_paise) values ('{D}', '{K}', 'Thali', 14000)",
    f"insert into kitchen_staff (kitchen_id, user_id) values ('{K}', '{KITCHEN}'), ('{K2}', '{KITCHEN2}')",
    f"insert into riders (user_id) values ('{RIDER}')",
    f"insert into admins (user_id) values ('{ADMIN}')",
    "create temp table res (i serial, r jsonb)",
    "grant all on res to public", "grant all on res_i_seq to public",
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{O}', '{K}', '{CUST}', 'k1', '[]', 14000, 'Flat 4')",
    f"insert into order_events (order_id, kitchen_id, session_id, event, actor) values ('{O}', '{K}', '{CUST}', 'order.placed', 'customer')",
]


def who(uid):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)"]


def act(uid, action, arg=None, order=O):
    a = "null" if arg is None else f"'{arg}'"
    return who(uid) + [f"insert into res (r) select act_on_order('{order}', '{action}', {a})"]


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = "reset role; select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(SETUP + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


EVENTS = "(select jsonb_agg(event order by created_at, id) from order_events where order_id = '" + O + "') as ev"
STATUS = "(select status from orders where id = '" + O + "') as status"
ASSIGN = ["reset role", f"update orders set rider_id = '{RIDER}' where id = '{O}'"]   # the dispatcher is not under test


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderActions(unittest.TestCase):
    def test_the_kitchen_and_the_rider_take_an_order_from_placed_to_delivered_with_seven_events_once_each(self):
        r = run(act(KITCHEN, "accept"), act(KITCHEN, "prepare"), act(KITCHEN, "ready"), ASSIGN,
                act(RIDER, "pickup"), act(RIDER, "arriving"), act(RIDER, "deliver"), final=EVENTS + ", " + STATUS)
        self.assertEqual([x["ok"] for x in r["rs"]], [True] * 6, r["rs"])
        self.assertEqual(r["status"], "delivered")
        self.assertEqual(r["ev"], ["order.placed", "order.accepted", "order.preparing", "order.ready", "order.picked_up", "order.arriving", "order.delivered"])

    def test_the_answer_carries_the_order_with_its_new_status(self):
        r = run(act(KITCHEN, "accept"))
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["order"]["status"]), (True, "accepted"))

    def test_an_admin_may_take_a_kitchen_step(self):
        self.assertEqual(run(act(ADMIN, "accept"))["rs"][0]["ok"], True)

    def test_nobody_else_may_take_a_step(self):
        r = run(act(CUST, "accept"), act(OTHER, "accept"), act(KITCHEN2, "accept"), act(KITCHEN, "accept"), act(KITCHEN, "prepare"), act(KITCHEN, "ready"),
                act(OTHER, "pickup"), act(KITCHEN, "pickup"), ASSIGN, act(OTHER, "pickup"), act(CUST, "pickup"), final=STATUS)
        got = [x.get("error") for x in r["rs"]]
        self.assertEqual(got[:3], ["not_allowed"] * 3)           # the customer, a stranger, another kitchen's staff
        self.assertEqual(got[3:6], [None, None, None])           # the right kitchen goes on
        self.assertEqual(got[6:], ["not_allowed"] * 4)           # a stranger, the kitchen, a rider who is not assigned, the customer
        self.assertEqual(r["status"], "ready")

    def test_a_step_done_twice_or_skipped_is_refused_and_writes_no_event(self):
        r = run(act(KITCHEN, "ready"), act(KITCHEN, "accept"), act(KITCHEN, "accept"), final=EVENTS)
        self.assertEqual([x.get("error") for x in r["rs"]], ["illegal_step", None, "already_done"])
        self.assertEqual(r["ev"], ["order.placed", "order.accepted"])

    def test_an_unknown_order_and_an_unknown_action_have_their_own_codes(self):
        r = run(act(KITCHEN, "accept", order="00000000-0000-0000-0000-00000000dead"), act(KITCHEN, "fly"))
        self.assertEqual([x["error"] for x in r["rs"]], ["order_not_found", "invalid_action"])

    def test_no_login_is_unauthorized_and_the_role_anon_cannot_call_it(self):
        r = run(["reset role", "select set_config('request.jwt.claims', '', true)", f"insert into res (r) select act_on_order('{O}', 'accept', null)"])
        self.assertEqual(r["rs"][0]["error"], "unauthorized")
        out = sql("begin; " + "; ".join(SETUP + ["reset role", "set local role anon", f"select act_on_order('{O}', 'accept', null)"]) + "; rollback;")
        self.assertIn("permission denied", str(out))

    def test_the_customer_confirms_cash_once_and_nobody_else_can(self):
        r = run(act(KITCHEN, "accept"), act(KITCHEN, "prepare"), act(KITCHEN, "ready"), act(OTHER, "confirm"), act(CUST, "confirm"), act(CUST, "confirm"),
                final=EVENTS + ", (select paid_by from orders where id = '" + O + "') as paid, " + STATUS)
        self.assertEqual([x.get("error") for x in r["rs"][3:]], ["not_allowed", None, "already_done"])
        self.assertEqual((r["status"], r["paid"]), ("delivered", "cash"))
        self.assertEqual(r["ev"].count("order.confirmed"), 1)

    def test_the_customer_may_cancel_a_placed_order_and_it_writes_one_cancelled_event(self):
        r = run(act(CUST, "cancel"), final=EVENTS + ", " + STATUS)
        self.assertEqual((r["rs"][0]["ok"], r["status"], r["ev"]), (True, "cancelled", ["order.placed", "order.cancelled"]))

    def test_the_kitchen_needs_a_reason_to_cancel_and_nobody_cancels_after_ready(self):
        r = run(act(KITCHEN, "cancel"), act(KITCHEN, "cancel", "out of rice"), final=STATUS)
        self.assertEqual([x.get("error") for x in r["rs"]], ["reason_required", None])
        self.assertEqual(r["status"], "cancelled")
        late = run(act(KITCHEN, "accept"), act(KITCHEN, "prepare"), act(KITCHEN, "ready"), act(CUST, "cancel"))
        self.assertEqual(late["rs"][3]["error"], "cannot_cancel")
        self.assertEqual(run(act(OTHER, "cancel"))["rs"][0]["error"], "not_allowed")


if __name__ == "__main__":
    unittest.main()
