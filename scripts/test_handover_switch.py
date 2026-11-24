# Story #1672: the two hand-over code switches (pickup_code_on, drop_code_on) are flipped by an admin through two functions; nobody else can.
# Same shape as otp_login_get_v2 / otp_login_set_v2. Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_handover_switch.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class HandoverSwitch(unittest.TestCase):
    ADMIN = "00000000-0000-0000-0000-0000000000a7"
    NOBODY = "00000000-0000-0000-0000-0000000000b7"

    def as_user(self, uid, body):
        return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"

    def test_h1_an_admin_reads_both_switches_off_by_default(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, "create temp table g as select handover_switch_get_v1() as v"), "select v from g")
        v = r[-1]["v"]
        self.assertEqual(v["kitchen"]["on"], False, r)
        self.assertEqual(v["customer"]["on"], False, r)
        self.assertIn("updated_at", v["kitchen"])

    def test_h2_an_admin_flips_the_kitchen_switch_alone_and_it_is_stamped(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, "create temp table g as select handover_switch_set_v1('kitchen', true) as v"),
                "select v from g", "select pickup_code_on() as k, drop_code_on() as c", "select updated_by from settings where name = 'pickup_code_on'")
        self.assertEqual(r[-1]["updated_by"], self.ADMIN, r)
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, "select handover_switch_set_v1('kitchen', true)"),
                "select pickup_code_on() as k, drop_code_on() as c")
        self.assertEqual((r[-1]["k"], r[-1]["c"]), (True, False), r)

    def test_h3_an_admin_flips_the_customer_switch_alone(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, "select handover_switch_set_v1('customer', true)"),
                "select pickup_code_on() as k, drop_code_on() as c")
        self.assertEqual((r[-1]["k"], r[-1]["c"]), (False, True), r)

    def test_h4_a_bad_name_or_value_is_refused_in_plain_words(self):
        for args in ("'both', true", "'kitchen', null"):
            r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, f"create temp table g as select handover_switch_set_v1({args}) as v"), "select v from g")
            self.assertEqual(r[-1]["v"]["ok"], False, (args, r))
            self.assertEqual(r[-1]["v"]["error"], "invalid_value", (args, r))

    def test_h5_someone_who_is_not_an_admin_cannot_read_or_flip_them(self):
        for call in ("handover_switch_get_v1()", "handover_switch_set_v1('kitchen', true)"):
            self.assertIn("not_admin", str(run(self.as_user(self.NOBODY, f"select {call}"))), call)
        r = run("select pickup_code_on() as k, drop_code_on() as c")
        self.assertEqual((r[-1]["k"], r[-1]["c"]), (False, False), r)

    def test_h6_the_signed_out_cannot_call_them(self):
        for call in ("handover_switch_get_v1()", "handover_switch_set_v1('kitchen', true)"):
            self.assertIn("permission denied", str(run("set local role anon", f"select {call}")), call)


if __name__ == "__main__":
    unittest.main()
