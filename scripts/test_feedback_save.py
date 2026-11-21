# Story 1750 (owner, 21 Nov 2026): a signed-in person saves his own report with feedback_save_v2; no n8n. Every check ends in ROLLBACK (dev stays clean), with a throwaway user and made-up words.
# SKIP_MIG=1 runs against the database as it is (the red run before the migration). Test output never prints row content.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_feedback_save.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261121100000_feedback_save.sql")).read()
A, B, R, K, ADM, C = ("00000000-0000-0000-0000-0000000000e%d" % i for i in (1, 2, 3, 4, 5, 6))   # C has no order: delete_my_account refuses a person with an open one
KIT = "00000000-0000-0000-0000-0000000000f1"
OWN, OTHER, RIDE, KITCH = ("00000000-0000-0000-0000-0000000000c%d" % i for i in (1, 2, 3, 4))


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def save(role="customer", order="null", text="'made up words'", doing="'ordering'", ctx="'{}'::jsonb"):
    return f"select feedback_save_v2('{role}', 'menu', {order}, {doing}, {text}, {ctx}) as r"


SETUP = [user(A), user(B), user(R), user(K), user(ADM), user(C),
         f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016'])",
         f"insert into riders (user_id, name) values ('{R}', 'Test rider')",
         f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{KIT}', '{K}', 'kitchen')",
         f"insert into orders (id, kitchen_id, client_order_key, items, total_paise, address, session_id) values ('{OWN}', '{KIT}', 'fb-own', '[]', 100, 'x', '{A}')",
         f"insert into orders (id, kitchen_id, client_order_key, items, total_paise, address, session_id, rider_id) values ('{RIDE}', '{KIT}', 'fb-ride', '[]', 100, 'x', '{B}', '{R}')"]


def run(*stmts):
    return sql("begin; " + (MIG + "; " if MIG else "") + "; ".join(SETUP + list(stmts)) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class FeedbackSave(unittest.TestCase):
    def test_ac1_a_customer_saves_one_row_with_his_own_uid_the_order_and_gets_the_id(self):
        r = run(as_user(A, save(order=f"'{OWN}'")), "select count(*) as n, bool_and(session_id = '" + A + "') as mine, bool_and(order_id = '" + OWN + "') as ord, bool_and(kitchen_id = '" + KIT + "') as kit from feedback")
        self.assertEqual(r[-1] if isinstance(r, list) else r, {"n": 1, "mine": True, "ord": True, "kit": True}, r)

    def test_ac1_the_answer_has_an_id(self):
        r = run(as_user(A, save()))
        self.assertTrue(r[0]["r"]["ok"] and r[0]["r"]["id"], r)

    def test_ac2_no_sign_in_is_refused_and_saves_nothing(self):
        r = run("set local role anon; select feedback_save_v2('customer','menu',null,'other','x') as r")
        self.assertIn("permission denied", str(r))   # anon has no execute; an empty uid is refused by name inside, too (below)
        r2 = run("select feedback_save_v2('customer','menu',null,'other','x') as r")   # no uid set: auth.uid() is null
        self.assertEqual(r2[0]["r"]["error"], "not_signed_in")
        self.assertEqual(run("select count(*) as n from feedback where session_id = '" + A + "'"), [{"n": 0}])

    def test_ac3_empty_long_and_foreign_role_are_refused_by_name(self):
        for text, role, name in [("''", "customer", "text_empty"), ("'   '", "customer", "text_empty"), (f"repeat('x', 2001)", "customer", "text_too_long"),
                                 ("'ok'", "kitchen", "role_not_yours"), ("'ok'", "rider", "role_not_yours"), ("'ok'", "ops", "role_not_yours"), ("'ok'", "bogus", "bad_role_or_doing")]:
            r = run(as_user(A, save(role=role, text=text)))
            self.assertEqual(r[0]["r"]["error"], name, (name, r))
            self.assertEqual(run(as_user(A, save(role=role, text=text)), "select count(*) as n from feedback where session_id = '" + A + "'")[-1], {"n": 0}, name)   # a refused call saved nothing

    def test_ac3_context_over_8kb_is_refused(self):
        r = run(as_user(A, save(ctx="jsonb_build_object('x', repeat('y', 9000))")))
        self.assertEqual(r[0]["r"]["error"], "context_too_big")

    def test_order_not_yours_per_role(self):
        self.assertEqual(run(as_user(A, save(order=f"'{RIDE}'")))[0]["r"]["error"], "order_not_yours")   # a customer: not his order
        self.assertEqual(run(as_user(B, save(order=f"'{OWN}'")))[0]["r"]["error"], "order_not_yours")
        self.assertTrue(run(as_user(K, save(role="kitchen", order=f"'{OWN}'", doing="'cooking'")))[0]["r"]["ok"])   # kitchen staff: an order of his kitchen
        self.assertTrue(run(as_user(R, save(role="rider", order=f"'{RIDE}'", doing="'delivering'")))[0]["r"]["ok"])   # a rider: assigned to him
        self.assertEqual(run(as_user(R, save(role="rider", order=f"'{OWN}'", doing="'delivering'")))[0]["r"]["error"], "order_not_yours")

    def test_ac4_the_11th_report_in_an_hour_is_refused_by_name(self):
        r = run(*[as_user(A, save()) for _ in range(10)], as_user(A, save()))
        self.assertEqual(r[-1]["r"]["error"], "too_many")
        self.assertEqual(run(*[as_user(A, save()) for _ in range(10)], as_user(B, save()))[-1]["r"]["ok"], True)   # another person has his own ten

    def test_ac5_the_account_delete_removes_the_row(self):   # the real delete_my_account(), called as the person, inside the rolled-back transaction
        r = run(as_user(C, save()), as_user(C, "select delete_my_account()"), "select count(*) as n from feedback where session_id = '" + C + "'")
        self.assertEqual(r[-1], {"n": 0}, r)
        self.assertEqual(run(as_user(C, save()), "select count(*) as n from feedback where session_id = '" + C + "'")[-1], {"n": 1})   # and without the delete the row is there

    def test_ac5_the_pii_purge_removes_the_row(self):   # purge_deleted_accounts_v2: every account marked deleted more than p_days ago; days = -1 takes the one marked in this transaction
        r = run(as_user(A, save()), f"insert into profiles (user_id, deleted_at) values ('{A}', now())", "select purge_deleted_accounts_v2(-1) as p",
                "select count(*) as n from feedback where session_id = '" + A + "'")
        self.assertEqual(r[-1], {"n": 0}, r)

    def test_a_kitchen_report_with_no_order_takes_the_kitchen_from_the_staff_row(self):
        r = run(as_user(K, save(role="kitchen", doing="'cooking'")), "select kitchen_id = '" + KIT + "' as k from feedback where session_id = '" + K + "'")
        self.assertEqual(r[-1], {"k": True}, r)

    def test_an_admin_saves_as_ops_and_console_with_and_without_an_order(self):
        make = f"insert into admins (user_id) values ('{ADM}')"
        for role in ("ops", "console"):
            self.assertTrue(run(make, as_user(ADM, save(role=role, doing="'watching ops'")))[-1]["r"]["ok"], role)
            r = run(make, as_user(ADM, save(role=role, order=f"'{OWN}'", doing="'watching ops'")), "select kitchen_id = '" + KIT + "' as k, order_id = '" + OWN + "' as o from feedback where session_id = '" + ADM + "'")
            self.assertEqual(r[-1], {"k": True, "o": True}, (role, r))
        self.assertEqual(run(as_user(ADM, save(role="ops", doing="'watching ops'")))[-1]["r"]["error"], "role_not_yours")   # a person who is not an admin

    def test_a_screen_name_over_80_letters_is_refused_by_name(self):
        r = run(as_user(A, "select feedback_save_v2('customer', repeat('s', 81), null, 'other', 'made up words') as r"))
        self.assertEqual(r[-1]["r"]["error"], "screen_too_long", r)
        r = run(as_user(A, "select feedback_save_v2('customer', repeat('s', 80), null, 'other', 'made up words') as r"))
        self.assertTrue(r[-1]["r"]["ok"], r)

    def test_the_function_is_not_open_to_the_phone_anon_role(self):
        r = run("select has_function_privilege('anon', 'feedback_save_v2(text,text,uuid,text,text,jsonb)', 'execute') as a, has_function_privilege('authenticated', 'feedback_save_v2(text,text,uuid,text,text,jsonb)', 'execute') as b")
        self.assertEqual(r, [{"a": False, "b": True}])

    def test_the_migration_file_runs_twice_without_error(self):
        if not MIG:
            self.skipTest("SKIP_MIG")
        r = run(MIG, "select 1 as ok")
        self.assertEqual(r[-1], {"ok": 1}, r)


if __name__ == "__main__":
    unittest.main()
