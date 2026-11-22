# Story 1754 (epic 1753, owner 21 Nov 2026): the delivery fee is one number the admin owns, in a settings row, with a log of every change.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users and made-up words. SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_delivery_fee.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261122100000_delivery_fee.sql")).read()
ADM, CUS, RID, KIT_U = ("00000000-0000-0000-0000-0000000000d%d" % i for i in (1, 2, 3, 4))
KIT = "00000000-0000-0000-0000-0000000000f2"


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def setfee(v):
    return f"select delivery_fee_set_v1({v}) as r"


SETUP = [user(ADM), user(CUS), user(RID), user(KIT_U),
         f"insert into admins (user_id) values ('{ADM}')",
         f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016'])",
         f"insert into riders (user_id, name) values ('{RID}', 'Test rider')",
         f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{KIT}', '{KIT_U}', 'kitchen')"]
LOG = "select count(*) as n from delivery_fee_log where by_label is distinct from 'dev seed'"


def run(*stmts):
    return sql("begin; " + (MIG + "; " if MIG else "") + "; ".join(SETUP + list(stmts)) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DeliveryFee(unittest.TestCase):
    def test_ac1_an_admin_reads_the_fee_who_set_it_and_when(self):
        r = run(as_user(ADM, setfee(3000)), as_user(ADM, "select delivery_fee_get_v1() as r"))
        g = r[-1]["r"]
        self.assertEqual(g["amount_paise"], 3000, g)
        self.assertEqual(g["updated_by"], ADM + "@example.com", g)
        self.assertTrue(g["updated_at"], g)

    def test_ac2_an_admin_sets_the_fee_the_row_holds_it_and_the_log_has_one_new_row_with_his_id(self):
        self.assertEqual(run(as_user(ADM, setfee(3000)))[-1]["r"], {"ok": True, "changed": True})   # the API answers with the last select only
        r = run(as_user(ADM, setfee(3000)), "select (select (value ->> 'amount_paise')::int from settings where name = 'delivery_fee') as a, "
                "(select count(*) from delivery_fee_log where by_label is distinct from 'dev seed') as n, "
                "(select bool_and(by_user = '" + ADM + "' and amount_paise = 3000) from delivery_fee_log where by_label is distinct from 'dev seed') as mine")
        self.assertEqual(r[-1], {"a": 3000, "n": 1, "mine": True}, r)

    def test_ac3_a_bad_value_is_refused_by_name_with_the_words_and_nothing_changes(self):
        state = "select (select (value ->> 'amount_paise')::int from settings where name = 'delivery_fee') as a, (select count(*) from delivery_fee_log where by_label is distinct from 'dev seed') as n"
        start = run(state)[-1]
        for v in ("-100", "20100", "150", "null", "99"):
            self.assertEqual(run(as_user(ADM, setfee(v)))[-1]["r"], {"ok": False, "error": "invalid_amount", "message": "Type 0 to 200 rupees."}, v)
            self.assertEqual(run(as_user(ADM, setfee(v)), state)[-1], start | {"n": 0}, v)   # the row is as the migration left it; no log row

    def test_ac3_the_edges_0_and_20000_are_accepted(self):
        for v in (0, 20000):
            self.assertTrue(run(as_user(ADM, setfee(v)))[-1]["r"]["ok"], v)

    def test_ac4_a_customer_a_rider_a_kitchen_and_a_signed_out_caller_cannot_read_or_set_it(self):
        for who in (CUS, RID, KIT_U):
            for call in ("select delivery_fee_get_v1() as r", setfee(1000)):
                r = run(as_user(who, call))
                self.assertIn("not_admin", str(r), (who, call, r))
        for call in ("select delivery_fee_get_v1() as r", setfee(1000)):
            self.assertIn("not_admin", str(run(call)), call)   # no uid set: auth.uid() is null
        r = run("select has_function_privilege('anon', 'delivery_fee_get_v1()', 'execute') as g, has_function_privilege('anon', 'delivery_fee_set_v1(integer)', 'execute') as s, "
                "has_function_privilege('authenticated', 'delivery_fee_get_v1()', 'execute') as ag, has_function_privilege('authenticated', 'delivery_fee_set_v1(integer)', 'execute') as asx")
        self.assertEqual(r, [{"g": False, "s": False, "ag": True, "asx": True}])

    def test_ac4_the_admin_check_comes_before_the_amount_check(self):
        self.assertIn("not_admin", str(run(as_user(CUS, setfee(150)))))

    def test_ac4_the_log_is_closed_to_every_role(self):
        r = run("select has_table_privilege('authenticated', 'delivery_fee_log', 'select') as a, has_table_privilege('anon', 'delivery_fee_log', 'select') as b, "
                "(select relrowsecurity from pg_class where relname = 'delivery_fee_log') as rls")
        self.assertEqual(r, [{"a": False, "b": False, "rls": True}])

    def test_ac5_the_same_value_again_changes_nothing_and_adds_no_log_row(self):
        self.assertEqual(run(as_user(ADM, setfee(3000)), as_user(ADM, setfee(3000)))[-1]["r"], {"ok": True, "changed": False})
        self.assertEqual(run(as_user(ADM, setfee(3000)), as_user(ADM, setfee(3000)), LOG)[-1], {"n": 1})

    def test_ac6_the_migration_file_runs_twice_without_error(self):
        if not MIG:
            self.skipTest("SKIP_MIG")
        self.assertEqual(run(MIG, "select 1 as ok")[-1], {"ok": 1})

    def test_ac7_on_a_dev_database_the_first_run_seeds_2000_and_one_dev_seed_row_elsewhere_0_and_none_and_a_second_run_changes_nothing(self):
        if not MIG:
            self.skipTest("SKIP_MIG")
        fresh = "delete from delivery_fee_log; delete from settings where name = 'delivery_fee'"
        get = "select (value ->> 'amount_paise')::int as a, (select count(*) from delivery_fee_log) as n from settings where name = 'delivery_fee'"
        dev = run(fresh, "update settings set value = 'true'::jsonb where name = 'clear_allowed'", MIG, get)
        self.assertEqual(dev[-1], {"a": 2000, "n": 1}, dev)
        self.assertEqual(run(fresh, "update settings set value = 'true'::jsonb where name = 'clear_allowed'", MIG, "select 1", get, MIG, get)[-1], {"a": 2000, "n": 1})
        prod = run(fresh, "delete from settings where name = 'clear_allowed'", MIG, get)
        self.assertEqual(prod[-1], {"a": 0, "n": 0}, prod)
        self.assertEqual(run(fresh, "delete from settings where name = 'clear_allowed'", MIG, MIG, get)[-1], {"a": 0, "n": 0})

    def test_the_table_check_refuses_a_bad_value_even_from_a_direct_write(self):
        r = run("update settings set value = '{\"amount_paise\": 150}'::jsonb where name = 'delivery_fee'")
        self.assertIn("settings_delivery_fee_rule", str(r), r)


if __name__ == "__main__":
    unittest.main()
