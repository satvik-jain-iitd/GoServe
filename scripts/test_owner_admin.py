# Story #985: the owner account is the one superadmin, hardcoded. It can never be removed from the admins, is_admin() is true for it even when its row is gone,
# and its sign-in puts the row back. Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first;
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_owner_admin.py
import os, re, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG_FILE = os.path.join(HERE, "..", "supabase", "migrations", "20261108100000_owner_admin.sql")
MIG = "" if os.environ.get("SKIP_MIG") else open(MIG_FILE).read()
OTHER, NOBODY, OWNER2 = ("00000000-0000-0000-0000-0000000000f%d" % i for i in (1, 2, 3))


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def user(uid, email, confirmed=True):
    at = "now()" if confirmed else "null"
    return f"insert into auth.users (id, email, email_confirmed_at, aud, role, instance_id) values ('{uid}', {email!r}, {at}, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def unconfirmed_owner_twin():
    return "insert into auth.users (id, email, email_confirmed_at, aud, role, instance_id) values ('%s', owner_email(), null, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')" % NOBODY


_OWNER = re.search(r"select '([^']+)'::text", open(MIG_FILE).read()).group(1)
_row = sql(f"select id from auth.users where lower(email) = '{_OWNER}'") if TOKEN else []
OWNER_UUID = _row[0]["id"] if isinstance(_row, list) and _row else None   # the owner's account on this database (a literal, so a test can act as it)
OWNER_ID = "(select id from auth.users where lower(email) = owner_email())"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OwnerAdmin(unittest.TestCase):
    def test_s1_another_admin_cannot_remove_the_owner_and_the_row_stays(self):
        r = str(run(user(OTHER, "second.admin@example.com"), f"insert into admins (user_id) values ('{OTHER}') on conflict do nothing",
                    f"insert into admins (user_id) select {OWNER_ID} on conflict do nothing", as_user(OTHER, f"select admin_remove_person('admin', '{OWNER_UUID}', null)")))
        self.assertIn("owner_admin", r)
        r = run(user(OTHER, "second.admin@example.com"), f"insert into admins (user_id) values ('{OTHER}')", f"insert into admins (user_id) select {OWNER_ID} on conflict do nothing",
                "do $$ begin perform set_config('request.jwt.claim.sub', '" + OTHER + "', true); begin perform admin_remove_person('admin', (select id from auth.users where lower(email) = owner_email()), null); exception when others then null; end; end $$",
                f"select count(*) n from admins where user_id = {OWNER_ID}")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[-1]["n"], 1)

    def test_s2_another_admin_can_still_be_removed(self):
        r = run(user(OTHER, "second.admin@example.com"), f"insert into admins (user_id) values ('{OTHER}')", f"insert into admins (user_id) select {OWNER_ID} on conflict do nothing",
                as_user(OWNER2 if False else OTHER, f"select admin_remove_person('admin', '{OTHER}', null)"), f"select count(*) n from admins where user_id = '{OTHER}'")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[-1]["n"], 0)

    def test_s3_is_admin_is_true_for_the_owner_even_with_no_admins_row(self):
        r = run("delete from admins", as_user(OWNER_UUID, "create temp table x as select is_admin() a"), "select a from x")
        self.assertIsInstance(r, list, r)
        self.assertIs(r[-1]["a"], True)

    def test_s4_is_admin_stays_false_for_anyone_else_with_no_row(self):
        r = run(user(NOBODY, "nobody@example.com"), as_user(NOBODY, "create temp table x as select is_admin() a"), "select a from x")
        self.assertIsInstance(r, list, r)
        self.assertIs(r[-1]["a"], False)

    def test_s5_the_owner_sign_in_puts_the_admins_row_back(self):
        r = run("delete from admins", as_user(OWNER_UUID, "create temp table c as select claim_my_invites() n"), f"select count(*) n from admins where user_id = {OWNER_ID}")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[-1]["n"], 1)

    def test_s6_the_migration_puts_the_owner_row_in_when_the_user_exists(self):
        r = sql("begin; delete from admins; " + MIG + f"; select count(*) n from admins where user_id = {OWNER_ID}; rollback;")   # the row is gone before the migration runs
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[-1]["n"], 1)

    def test_s7_an_unconfirmed_address_with_the_owner_email_is_not_the_owner(self):
        r = run("delete from auth.users where lower(email) = owner_email()", unconfirmed_owner_twin(), as_user(NOBODY, "create temp table x as select is_admin() a"), "select a from x")
        self.assertIsInstance(r, list, r)
        self.assertIs(r[-1]["a"], False)


if __name__ == "__main__":
    unittest.main()
