# Story #875 (epic E32), boards A-AddPerson-Invite and A-Kitchen-Invite: an admin invites a person by email before their first sign-in.
# The invite becomes a kitchen_staff or riders row when that email first signs in with Google. Every check ends in ROLLBACK.
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_staff_invites.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261105100000_staff_invites.sql")).read()
K1, K2 = "00000000-0000-0000-0000-0000000000e1", "00000000-0000-0000-0000-0000000000e2"
ADMIN, NOBODY, EXISTING, NEWBIE = ("00000000-0000-0000-0000-0000000000d%d" % i for i in (1, 2, 3, 4))


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def user(uid, email, confirmed=True):
    at = "now()" if confirmed else "null"
    return f"insert into auth.users (id, email, email_confirmed_at, aud, role, instance_id) values ('{uid}', {email!r}, {at}, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


SETUP = [
    f"insert into kitchens (id, session_id, name, active, open, pin_codes) values ('{K1}', 's', 'Tau Ka Dhaba', true, true, array['110001']), ('{K2}', 's', 'Amma Kitchen', true, true, array['110001'])",
    user(ADMIN, "boss@example.com"), user(EXISTING, "old.cook@example.com"), user(NOBODY, "nobody@example.com"),
    f"insert into admins (user_id) values ('{ADMIN}')",
]


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def add(email, kind="kitchen", kitchen=K1, who=ADMIN):
    k = f"'{kitchen}'" if kitchen else "null"
    return as_user(who, f"select admin_add_person({email!r}, '{kind}', {k})")


COUNTS = "select (select count(*) from staff_invites where claimed_at is null) open, (select count(*) from staff_invites where claimed_at is not null) claimed, (select count(*) from kitchen_staff where kitchen_id = '%s') staff, (select count(*) from riders) riders"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class StaffInvites(unittest.TestCase):
    def test_an_email_with_no_account_becomes_an_invite_not_an_error(self):
        r = run(*SETUP, as_user(ADMIN, "create temp table r as select admin_add_person('Sunita.Devi@Gmail.com', 'kitchen', '%s') v" % K1), "select v, (select count(*) from staff_invites) n, (select email from staff_invites) e from r")
        self.assertEqual(r[-1]["v"], {"invited": True}, r)
        self.assertEqual((r[-1]["n"], r[-1]["e"]), (1, "sunita.devi@gmail.com"), r)

    def test_the_same_email_in_another_case_is_still_one_invite(self):
        r = run(*SETUP, add("sunita.devi@gmail.com"), add("  SUNITA.DEVI@GMAIL.COM "), "select count(*) n from staff_invites")
        self.assertEqual(r[-1]["n"], 1, r)

    def test_an_email_that_has_an_account_joins_at_once_as_before(self):
        r = run(*SETUP, as_user(ADMIN, "create temp table r as select admin_add_person('OLD.cook@example.com', 'kitchen', '%s') v" % K1), "select v, (select count(*) from staff_invites) n, (select count(*) from kitchen_staff where user_id = '%s') s from r" % EXISTING)
        self.assertEqual((r[-1]["v"], r[-1]["n"], r[-1]["s"]), ({"invited": False}, 0, 1), r)

    def test_the_first_sign_in_creates_the_kitchen_row_and_marks_the_invite_claimed(self):
        r = run(*SETUP, add("sunita.devi@gmail.com"), user(NEWBIE, "Sunita.Devi@gmail.com"), COUNTS % K1 + ", (select claimed_user_id from staff_invites) who")
        self.assertEqual((r[-1]["open"], r[-1]["claimed"], r[-1]["staff"], r[-1]["who"]), (0, 1, 1, NEWBIE), r)

    def test_a_rider_invite_creates_the_rider_row(self):
        r = run(*SETUP, add("amit@example.com", "rider", None), "delete from riders", user(NEWBIE, "amit@example.com"), "select (select count(*) from riders where user_id = '%s') n" % NEWBIE)
        self.assertEqual(r[-1]["n"], 1, r)

    def test_a_cancelled_invite_joins_nothing_on_the_first_sign_in(self):
        r = run(*SETUP, add("sunita.devi@gmail.com"), as_user(ADMIN, "select admin_cancel_invite((select id from staff_invites))"), user(NEWBIE, "sunita.devi@gmail.com"), COUNTS % K1)
        self.assertEqual((r[-1]["open"], r[-1]["claimed"], r[-1]["staff"]), (0, 0, 0), r)

    def test_an_email_that_is_not_confirmed_claims_nothing_until_it_is(self):
        r = run(*SETUP, add("sunita.devi@gmail.com"), user(NEWBIE, "sunita.devi@gmail.com", confirmed=False), COUNTS % K1)
        self.assertEqual((r[-1]["open"], r[-1]["staff"]), (1, 0), r)

    def test_the_gate_check_claims_when_the_email_was_confirmed_after_the_sign_up(self):
        r = run(*SETUP, add("late@example.com"), user(NEWBIE, "late@example.com", confirmed=False), f"update auth.users set email_confirmed_at = now() where id = '{NEWBIE}'",
                as_user(NEWBIE, "create temp table c as select claim_my_invites() n"), COUNTS % K1 + ", (select n from c) claimed_now")
        self.assertEqual((r[-1]["claimed_now"], r[-1]["staff"], r[-1]["open"]), (1, 1, 0), r)

    def test_a_sign_up_never_fails_because_of_an_invite(self):
        bad = f"insert into staff_invites (email, kind, kitchen_id) values ('x@example.com', 'rider', null)"
        r = run(*SETUP, bad, "alter table riders add constraint riders_never check (false) not valid", user(NEWBIE, "x@example.com"), "select count(*) n from auth.users where id = '%s'" % NEWBIE)
        self.assertEqual(r[-1]["n"], 1, r)

    def test_only_an_admin_reads_adds_or_cancels_invites(self):
        r = run(*SETUP, add("a@example.com"), as_user(NOBODY, "create temp table n as select count(*) c from staff_invites"), "select c from n")
        self.assertEqual(r[-1]["c"], 0, r)
        self.assertIn("not_allowed", str(run(*SETUP, add("b@example.com", who=NOBODY))))
        self.assertIn("not_allowed", str(run(*SETUP, add("c@example.com"), as_user(NOBODY, "select admin_cancel_invite((select id from staff_invites))"))))

    def test_the_admin_list_names_the_kitchen_of_each_open_invite(self):
        r = run(*SETUP, add("sunita.devi@gmail.com"), add("amit@example.com", "rider", None), as_user(ADMIN, "create temp table l as select * from admin_invites()"),
                "select (select kitchen_name from l where email = 'sunita.devi@gmail.com') kn, (select kind from l where email = 'amit@example.com') rk")
        self.assertEqual((r[-1]["kn"], r[-1]["rk"]), ("Tau Ka Dhaba", "rider"), r)

    def test_a_person_already_in_another_kitchen_is_refused_and_the_kitchen_is_named(self):
        r = str(run(*SETUP, f"insert into kitchen_staff (kitchen_id, user_id) values ('{K2}', '{EXISTING}')", add("old.cook@example.com")))
        self.assertIn("already_staff", r)
        self.assertIn("Amma Kitchen", r)

    def test_a_bad_kind_or_a_kitchen_invite_without_a_kitchen_is_refused(self):
        for kind, kitchen in (("boss", K1), ("kitchen", None)):
            self.assertIn("invalid_kind", str(run(*SETUP, add("z@example.com", kind, kitchen))))


if __name__ == "__main__":
    unittest.main()
