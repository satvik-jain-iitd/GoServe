# Story 1664 (epic 1652): the kitchen hands over only with the rider's code.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_kitchen_handover.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIGS = [] if os.environ.get("SKIP_MIG") else [open(os.path.join(HERE, "..", "supabase", "migrations", f)).read()
                                              for f in ("20261124110000_order_codes.sql", "20261124120000_kitchen_handover_code.sql")]
CUS, RID, RID2, KIT_U, KIT_U2, ADM = ("00000000-0000-0000-0000-0000000000c%d" % i for i in range(1, 7))
KIT, KIT2 = "00000000-0000-0000-0000-0000000000f3", "00000000-0000-0000-0000-0000000000f4"
O1 = "00000000-0000-0000-0000-0000000000b1"
CODE = "(select c from cd)"   # read before the role drops: the app roles cannot see order_codes
WRONG = f"(case when {CODE} = '0000' then '1111' else '0000' end)"

SETUP = [f"insert into auth.users (id, email, aud, role, instance_id) values ('{u}', '{u}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"
         for u in (CUS, RID, RID2, KIT_U, KIT_U2, ADM)] + [
    f"insert into admins (user_id) values ('{ADM}')",
    f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016']), ('{KIT2}', 'Other kitchen', array['110017'])",
    f"insert into riders (user_id, name) values ('{RID}', 'Test rider'), ('{RID2}', 'Test rider two')",
    f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{KIT}', '{KIT_U}', 'kitchen'), ('{KIT2}', '{KIT_U2}', 'kitchen')",
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, customer_phone) values ('{O1}', '{KIT}', '{CUS}', 'k1', '[]', 100, 'x', '9000000000')",
    f"update orders set rider_id = '{RID}' where id = '{O1}'",
    "create temp table res (i serial, r jsonb)", "grant all on res to public", "grant all on res_i_seq to public",
    f"create temp table cd as select pickup_code as c from order_codes where order_id = '{O1}'", "grant select on cd to public"]
READY = ["update orders set status='accepted' where id='%s'" % O1, "update orders set status='preparing' where id='%s'" % O1, "update orders set status='ready' where id='%s'" % O1]
ON = "update settings set value = 'true'::jsonb where name = 'pickup_code_on'"


def as_(uid, call):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)",
            f"insert into res (r) select {call}"]


def hand(uid, code):
    c = "null" if code is None else code if code.startswith("(") else f"'{code}'"
    return as_(uid, f"kitchen_handover_v1('{O1}', {c})")


def pick(uid):
    return as_(uid, f"act_on_order('{O1}', 'pickup')")


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = ("reset role; select (select jsonb_agg(r order by i) from res) as rs, (select status from orders where id = '%s') as status, "
            "(select jsonb_agg(actor) from order_events where order_id = '%s' and event = 'order.picked_up') as actors, "
            "(select pickup_tries from order_codes where order_id = '%s') as tries, %s (select pickup_code from order_codes where order_id = '%s') as code" % (O1, O1, O1, final, O1))
    r = sql("begin; " + "; ".join(MIGS + SETUP + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


def err(r):
    return [x.get("error") for x in r["rs"]]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class KitchenHandover(unittest.TestCase):
    def test_switch_off_rider_pickup_works_and_handover_says_switch_off(self):
        r = run(READY, hand(KIT_U, "1234"))
        self.assertEqual(err(r), ["switch_off"], r)
        self.assertEqual(r["status"], "ready", r)
        r = run(READY, pick(RID))
        self.assertEqual((r["rs"][0]["ok"], r["status"], r["actors"]), (True, "out_for_delivery", ["rider"]), r)

    def test_switch_is_off_by_default(self):
        self.assertEqual(run(READY, "insert into res (r) select to_jsonb(pickup_code_on())")["rs"], [False])

    def test_right_code_moves_it_once_and_names_the_kitchen(self):
        r = run(ON, READY, hand(KIT_U, CODE), hand(KIT_U, CODE))
        self.assertEqual(r["rs"][0]["ok"], True, r)
        self.assertEqual((r["status"], r["actors"]), ("out_for_delivery", ["kitchen"]), r)
        self.assertEqual(r["rs"][1]["ok"], False, r)

    def test_missing_and_wrong_codes_are_refused_and_counted(self):
        r = run(ON, READY, hand(KIT_U, None), hand(KIT_U, ""), hand(KIT_U, WRONG))
        self.assertEqual(err(r), ["code_required", "code_required", "wrong_code"], r)
        self.assertEqual((r["status"], r["tries"], r["rs"][2]["tries_left"]), ("ready", 1, 4), r)

    def test_fifth_wrong_try_locks_and_the_right_code_then_fails(self):
        r = run(ON, READY, *[hand(KIT_U, WRONG)] * 5, hand(KIT_U, CODE))
        self.assertEqual(err(r), ["wrong_code"] * 4 + ["code_locked", "code_locked"], r)
        self.assertEqual(r["status"], "ready", r)

    def test_other_kitchen_rider_customer_cannot_call_it(self):
        r = run(ON, READY, hand(KIT_U2, CODE), hand(RID, CODE), hand(RID2, CODE), hand(CUS, CODE))
        self.assertEqual(err(r), ["not_allowed"] * 4, r)
        self.assertEqual((r["status"], r["tries"]), ("ready", 0), r)

    def test_not_ready_or_no_rider(self):
        self.assertEqual(err(run(ON, hand(KIT_U, CODE))), ["not_ready"])
        r = run(ON, READY, f"update orders set rider_id = null where id = '{O1}'", hand(KIT_U, CODE))
        self.assertEqual(err(r), ["not_ready"], r)

    def test_rider_pickup_is_code_required_with_switch_on_and_another_rider_not_allowed(self):
        r = run(ON, READY, pick(RID), pick(RID2))
        self.assertEqual(err(r), ["code_required", "not_allowed"], r)
        self.assertEqual(r["status"], "ready", r)

    def test_admin_pickup_works_and_names_admin(self):
        r = run(ON, READY, pick(ADM))
        self.assertEqual((r["rs"][0]["ok"], r["status"], r["actors"]), (True, "out_for_delivery", ["admin"]), r)

    def test_admin_handover_with_the_code_names_admin(self):
        r = run(ON, READY, hand(ADM, CODE))
        self.assertEqual((r["rs"][0]["ok"], r["actors"]), (True, ["admin"]), r)

    def test_no_message_holds_any_digit_of_the_code(self):
        r = run(ON, READY, hand(KIT_U, None), hand(KIT_U, WRONG), pick(RID), hand(RID, CODE), hand(KIT_U2, CODE), *[hand(KIT_U, WRONG)] * 4, hand(KIT_U, CODE))
        for x in r["rs"]:
            self.assertFalse(any(ch.isdigit() for ch in x.get("message", "")), x)
            self.assertNotIn(r["code"], str(x), x)


if __name__ == "__main__":
    unittest.main()
