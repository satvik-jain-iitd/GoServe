# Story 1668 (epic 1652), layer A: the customer reads the drop code only while the delivery-code switch is on.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_code_switch.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ("20261124110000_order_codes.sql", "20261124120000_kitchen_handover_code.sql", "20261124125000_rider_deliver_code.sql", "20261124126000_order_code_switch.sql")
MIGS = [] if os.environ.get("SKIP_MIG") else [open(os.path.join(HERE, "..", "supabase", "migrations", f)).read() for f in NAMES]
CUS, CUS2, RID = ("00000000-0000-0000-0000-0000000000c%d" % i for i in range(1, 4))
KIT = "00000000-0000-0000-0000-0000000000f3"
O1 = "00000000-0000-0000-0000-0000000000b1"
NONE = {"ok": False, "error": "no_code", "message": "No code for you on this order."}
ON = "update settings set value = 'true'::jsonb where name = 'drop_code_on'"
OFF = "update settings set value = 'false'::jsonb where name = 'drop_code_on'"

SETUP = [f"insert into auth.users (id, email, aud, role, instance_id) values ('{u}', '{u}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')" for u in (CUS, CUS2, RID)] + [
    f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016'])",
    f"insert into riders (user_id, name) values ('{RID}', 'Test rider')",
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, customer_phone) values ('{O1}', '{KIT}', '{CUS}', 'k1', '[]', 100, 'x', '9000000000')",
    f"update orders set rider_id = '{RID}' where id = '{O1}'",
    "create temp table res (i serial, r jsonb)", "grant all on res to public", "grant all on res_i_seq to public"]


WALK = ["accepted", "preparing", "ready", "out_for_delivery", "delivered"]


def status(s):
    steps = WALK[:WALK.index(s) + 1] if s in WALK else ["cancelled"]
    return [f"update orders set status='{x}' where id='{O1}'" for x in steps]


def read(uid):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)",
            f"insert into res (r) select order_code_v1('{O1}')"]


def run(*stmts, twice=False):
    mig = MIGS + (MIGS[-1:] if twice and MIGS else [])
    out = sql("begin; " + "; ".join(mig + SETUP + [s for x in stmts for s in (x if isinstance(x, list) else [x])]) +
              "; reset role; select (select jsonb_agg(r order by i) from res) as rs, (select drop_code from order_codes where order_id = '%s') as d, (select pickup_code from order_codes where order_id = '%s') as p; rollback;" % (O1, O1))
    return out[-1] if isinstance(out, list) else {"error": out}


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderCodeSwitch(unittest.TestCase):
    def test_switch_off_customer_gets_the_plain_no_code(self):
        r = run(OFF, status("out_for_delivery"), read(CUS))
        self.assertEqual(r["rs"], [NONE], r)

    def test_switch_on_customer_gets_the_drop_code_never_the_pickup_code(self):
        r = run(ON, status("out_for_delivery"), read(CUS))
        self.assertEqual(r["rs"], [{"ok": True, "role": "customer", "drop_code": r["d"]}], r)
        self.assertNotIn(r["p"], str(r["rs"]))

    def test_a_second_device_gets_the_same_code(self):
        r = run(ON, status("out_for_delivery"), read(CUS), read(CUS))
        self.assertEqual(r["rs"][0], r["rs"][1], r)
        self.assertEqual(r["rs"][0]["drop_code"], r["d"], r)

    def test_a_stranger_gets_no_code_even_when_on(self):
        r = run(ON, status("out_for_delivery"), read(CUS2))
        self.assertEqual(r["rs"], [NONE], r)

    def test_delivered_and_cancelled_give_no_code(self):
        for s in ("delivered", "cancelled"):
            r = run(ON, status(s), read(CUS))
            self.assertEqual(r["rs"], [NONE], (s, r))

    def test_the_riders_pickup_code_does_not_depend_on_the_switch(self):
        r = run(OFF, status("out_for_delivery"), read(RID))
        self.assertEqual(r["rs"], [{"ok": True, "role": "rider", "pickup_code": r["p"]}], r)

    def test_the_migration_is_safe_to_run_twice(self):
        r = run(ON, status("out_for_delivery"), read(CUS), twice=True)
        self.assertEqual(r["rs"], [{"ok": True, "role": "customer", "drop_code": r["d"]}], r)


if __name__ == "__main__":
    unittest.main()
