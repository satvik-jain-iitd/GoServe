# Story #968 (epic E32): an admin invites another admin by email before that person has ever signed in; the invite turns into the admins row on the first Google sign-in
# (or at the first open of /admin/ when the email was confirmed later). Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first;
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_admin_invite.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261107140000_admin_invite.sql")).read()
ADMIN, NOBODY, EXISTING, NEWBIE = ("00000000-0000-0000-0000-0000000000d%d" % i for i in (1, 2, 3, 4))


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def user(uid, email, confirmed=True):
    at = "now()" if confirmed else "null"
    return f"insert into auth.users (id, email, email_confirmed_at, aud, role, instance_id) values ('{uid}', {email!r}, {at}, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


SETUP = [user(ADMIN, "boss@example.com"), user(EXISTING, "old.customer@example.com"), user(NOBODY, "nobody@example.com"), f"insert into admins (user_id) values ('{ADMIN}')"]


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def add(email, who=ADMIN):
    return as_user(who, f"select admin_add_person({email!r}, 'admin', null)")


def is_admin_row(uid):
    return f"select (select count(*) from admins where user_id = '{uid}') a, (select count(*) from staff_invites where claimed_at is null) open, (select count(*) from staff_invites where claimed_at is not null) claimed"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class AdminInvite(unittest.TestCase):
    def test_s1_an_admin_email_with_no_account_becomes_an_invite_not_an_error(self):
        r = run(*SETUP, as_user(ADMIN, "create temp table r as select admin_add_person('Second.Admin@Gmail.com', 'admin', null) v"), "select v, (select count(*) from staff_invites) n, (select kind from staff_invites) k, (select email from staff_invites) e from r")
        self.assertIsInstance(r, list, r)
        self.assertEqual((r[-1]["v"], r[-1]["n"], r[-1]["k"], r[-1]["e"]), ({"invited": True}, 1, "admin", "second.admin@gmail.com"), r)

    def test_s2_the_same_email_in_another_case_is_one_invite(self):
        r = run(*SETUP, add("second.admin@gmail.com"), add("  SECOND.ADMIN@GMAIL.COM "), "select count(*) n from staff_invites")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[-1]["n"], 1, r)

    def test_s3_the_first_google_sign_in_makes_the_admins_row_and_marks_the_invite_claimed(self):
        r = run(*SETUP, add("second.admin@gmail.com"), user(NEWBIE, "Second.Admin@gmail.com"), is_admin_row(NEWBIE))
        self.assertIsInstance(r, list, r)
        self.assertEqual((r[-1]["a"], r[-1]["open"], r[-1]["claimed"]), (1, 0, 1), r)

    def test_s4_an_unconfirmed_email_claims_nothing_until_the_gate_check_after_it_is_confirmed(self):
        r = run(*SETUP, add("late@example.com"), user(NEWBIE, "late@example.com", confirmed=False), is_admin_row(NEWBIE))
        self.assertIsInstance(r, list, r)
        self.assertEqual((r[-1]["a"], r[-1]["open"]), (0, 1), r)
        r = run(*SETUP, add("late@example.com"), user(NEWBIE, "late@example.com", confirmed=False), f"update auth.users set email_confirmed_at = now() where id = '{NEWBIE}'",
                as_user(NEWBIE, "create temp table c as select claim_my_invites() n"), is_admin_row(NEWBIE) + ", (select n from c) now")
        self.assertEqual((r[-1]["now"], r[-1]["a"], r[-1]["open"]), (1, 1, 0), r)

    def test_s5_a_cancelled_invite_makes_nobody_an_admin(self):
        r = run(*SETUP, add("second.admin@gmail.com"), as_user(ADMIN, "select admin_cancel_invite((select id from staff_invites))"), user(NEWBIE, "second.admin@gmail.com"), is_admin_row(NEWBIE))
        self.assertIsInstance(r, list, r)
        self.assertEqual((r[-1]["a"], r[-1]["open"], r[-1]["claimed"]), (0, 0, 0), r)

    def test_s6_an_email_that_already_has_an_account_becomes_an_admin_at_once_as_before(self):
        r = run(*SETUP, as_user(ADMIN, "create temp table r as select admin_add_person('OLD.customer@example.com', 'admin', null) v"), is_admin_row(EXISTING) + ", (select v from r) v")
        self.assertIsInstance(r, list, r)
        self.assertEqual((r[-1]["v"], r[-1]["a"], r[-1]["open"]), ({"invited": False}, 1, 0), r)

    def test_s7_the_admin_list_shows_the_open_admin_invite_with_no_kitchen(self):
        r = run(*SETUP, add("second.admin@gmail.com"), as_user(ADMIN, "create temp table l as select * from admin_invites()"), "select (select kind from l) k, (select kitchen_id from l) kid, (select count(*) from l) n")
        self.assertIsInstance(r, list, r)
        self.assertEqual((r[-1]["k"], r[-1]["kid"], r[-1]["n"]), ("admin", None, 1), r)

    def test_s8_only_an_admin_can_invite_an_admin(self):
        self.assertIn("not_allowed", str(run(*SETUP, add("x@example.com", who=NOBODY))))

    def test_s9_a_kitchen_or_rider_invite_still_needs_its_own_shape(self):
        self.assertIn("invalid_kind", str(run(*SETUP, as_user(ADMIN, "select admin_add_person('z@example.com', 'kitchen', null)"))))


if __name__ == "__main__":
    unittest.main()
