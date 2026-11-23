# Story 1665 (epic 1652): Delivered is refused without the customer's code.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_rider_deliver_code.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIGS = [] if os.environ.get("SKIP_MIG") else [open(os.path.join(HERE, "..", "supabase", "migrations", f)).read()
                                              for f in ("20261124110000_order_codes.sql", "20261124120000_kitchen_handover_code.sql", "20261124125000_rider_deliver_code.sql")]
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
    f"create temp table pc as select pickup_code as p from order_codes where order_id = '{O1}'", "grant select on pc to public",
    f"create temp table cd as select drop_code as c from order_codes where order_id = '{O1}'", "grant select on cd to public"]
READY = ["update orders set status='accepted' where id='%s'" % O1, "update orders set status='preparing' where id='%s'" % O1, "update orders set status='ready' where id='%s'" % O1, "update orders set status='out_for_delivery' where id='%s'" % O1]
OLD = ["update orders set status='accepted' where id='%s'" % O1, "update orders set status='preparing' where id='%s'" % O1, "update orders set status='ready' where id='%s'" % O1]
ON = "update settings set value = 'true'::jsonb where name = 'drop_code_on'"


def as_(uid, call):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)",
            f"insert into res (r) select {call}"]


def deliv(uid, code, method="cash"):
    c = "null" if code is None else code if code.startswith("(") else f"'{code}'"
    m = "null" if method is None else f"'{method}'"
    return as_(uid, f"rider_deliver_v1('{O1}', {c}, {m})")


def hand(uid, code):
    c = "null" if code is None else code if code.startswith("(") else f"'{code}'"
    return as_(uid, f"kitchen_handover_v1('{O1}', {c})")


def act(uid, action, arg="cash"):
    a = "null" if arg is None else f"'{arg}'"
    return as_(uid, f"act_on_order('{O1}', '{action}', {a})")


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = ("reset role; select (select jsonb_agg(r order by i) from res) as rs, (select status from orders where id = '%s') as status, "
            "(select jsonb_agg(actor) from order_events where order_id = '%s' and event = 'order.delivered') as actors, "
            "(select drop_tries from order_codes where order_id = '%s') as tries, %s (select drop_code from order_codes where order_id = '%s') as code, (select paid_by from orders where id = '%s') as paid, (select pickup_code from order_codes where order_id = '%s') as pcode" % (O1, O1, O1, final, O1, O1, O1))
    r = sql("begin; " + "; ".join(MIGS + SETUP + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


def err(r):
    return [x.get("error") for x in r["rs"]]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RiderDeliverCode(unittest.TestCase):
    def test_switch_off_keeps_todays_deliver(self):
        r = run(READY, deliv(RID, "1234"), act(RID, "deliver"))
        self.assertEqual(err(r)[0], "switch_off", r)
        self.assertEqual((r["rs"][1]["ok"], r["status"], r["actors"], r["paid"]), (True, "delivered", ["rider"], "cash"), r)

    def test_switch_is_off_by_default(self):
        self.assertEqual(run(READY, "insert into res (r) select to_jsonb(drop_code_on())")["rs"], [False])

    def test_right_code_delivers_once_with_method_and_rider_actor(self):
        r = run(ON, READY, deliv(RID, CODE, "upi_door"), deliv(RID, CODE, "upi_door"))
        self.assertEqual(r["rs"][0]["ok"], True, r)
        self.assertEqual((r["status"], r["actors"], r["paid"]), ("delivered", ["rider"], "upi_door"), r)
        self.assertEqual(r["rs"][1]["ok"], False, r)

    def test_missing_and_wrong_codes_are_refused_and_counted(self):
        r = run(ON, READY, deliv(RID, None), deliv(RID, ""), deliv(RID, WRONG))
        self.assertEqual(err(r), ["code_required", "code_required", "wrong_code"], r)
        self.assertEqual((r["status"], r["tries"], r["rs"][2]["tries_left"]), ("out_for_delivery", 1, 4), r)

    def test_fifth_wrong_try_locks_and_the_right_code_then_fails(self):
        r = run(ON, READY, *[deliv(RID, WRONG)] * 5, deliv(RID, CODE))
        self.assertEqual(err(r), ["wrong_code"] * 4 + ["code_locked", "code_locked"], r)
        self.assertEqual(r["status"], "out_for_delivery", r)

    def test_other_rider_kitchen_customer_get_not_allowed_without_a_hint(self):
        r = run(ON, READY, deliv(RID2, CODE), deliv(KIT_U, CODE), deliv(CUS, CODE), act(RID2, "deliver"), act(KIT_U, "deliver"), deliv(ADM, CODE))
        self.assertEqual(err(r), ["not_allowed"] * 6, r)
        self.assertEqual((r["status"], r["tries"]), ("out_for_delivery", 0), r)
        self.assertEqual(len({x["message"] for x in r["rs"]}), 1, r)

    def test_riders_own_act_on_order_deliver_is_code_required(self):
        r = run(ON, READY, act(RID, "deliver"))
        self.assertEqual(err(r), ["code_required"], r)
        self.assertEqual(r["status"], "out_for_delivery", r)

    def test_admin_deliver_works_and_names_admin(self):
        r = run(ON, READY, act(ADM, "deliver"))
        self.assertEqual((r["rs"][0]["ok"], r["status"], r["actors"]), (True, "delivered", ["admin"]), r)

    def test_riders_not_delivered_path_is_never_blocked_by_the_code(self):
        r = run(ON, READY, act(RID, "cancel", "customer not home"))
        self.assertNotEqual(err(r), ["code_required"], r)

    def test_pickup_code_does_not_deliver(self):
        r = run(ON, READY, deliv(RID, "(select p from pc)"))
        self.assertEqual(err(r), ["wrong_code"], r)
        self.assertEqual(r["status"], "out_for_delivery", r)

    def test_not_out_for_delivery(self):
        r = run(ON, OLD, deliv(RID, CODE))
        self.assertEqual(err(r), ["not_ready"], r)

    def test_no_message_holds_any_digit_of_the_code(self):
        r = run(ON, READY, deliv(RID, None), deliv(RID, WRONG), act(RID, "deliver"), deliv(RID2, CODE), *[deliv(RID, WRONG)] * 4, deliv(RID, CODE))
        for x in r["rs"]:
            self.assertFalse(any(ch.isdigit() for ch in x.get("message", "")), x)
            self.assertNotIn(r["code"], str(x), x)

    def test_migration_is_safe_to_run_twice(self):
        r = run(ON, READY, open(os.path.join(HERE, "..", "supabase", "migrations", "20261124125000_rider_deliver_code.sql")).read() if MIGS else "select 1", deliv(RID, CODE))
        self.assertEqual(r["rs"][0]["ok"], True, r)


if __name__ == "__main__":
    unittest.main()
