# Story 1654: a rider is saved with a real name and a 10-digit mobile; only an admin sets or changes them. Made-up names, phone 9000000000.
# Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first; SKIP_MIG=1 is the red run.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_rider_name_mobile.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261124130000_rider_name_mobile.sql")).read()
ADMIN, NOBODY, HASLOGIN, NEWBIE = ("00000000-0000-0000-0000-0000000000e%d" % i for i in (1, 2, 3, 4))


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def user(uid, email):
    return f"insert into auth.users (id, email, email_confirmed_at, aud, role, instance_id) values ('{uid}', {email!r}, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


SETUP = [user(ADMIN, "boss@example.com"), user(HASLOGIN, "has.login@example.com"), user(NOBODY, "nobody@example.com"), f"insert into admins (user_id) values ('{ADMIN}')"]


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def add(email, kind="rider", name="'Ravi Kumar'", phone="'9000000000'", who=ADMIN):
    return as_user(who, f"select admin_add_person({email!r}, '{kind}', null, {name}, {phone})")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RiderNameMobile(unittest.TestCase):
    def test_a_rider_with_a_login_gets_the_name_and_phone(self):
        r = run(*SETUP, add("has.login@example.com"), f"select name, phone from riders where user_id = '{HASLOGIN}'")
        self.assertEqual(r[-1], {"name": "Ravi Kumar", "phone": "9000000000"}, r)

    def test_an_invited_rider_gets_them_at_the_claim(self):
        r = run(*SETUP, add("new.rider@example.com"), user(NEWBIE, "new.rider@example.com"), "select claim_staff_invites('%s', 'new.rider@example.com')" % NEWBIE,
                f"select name, phone from riders where user_id = '{NEWBIE}'")
        self.assertEqual(r[-1], {"name": "Ravi Kumar", "phone": "9000000000"}, r)

    def test_a_missing_name_or_bad_mobile_is_refused(self):
        for args, code in (("null, '9000000000'", "rider_name_needed"), ("'   ', '9000000000'", "rider_name_needed"), ("'Ravi', null", "rider_phone_bad"),
                           ("'Ravi', '900000000'", "rider_phone_bad"), ("'Ravi', '90000000001'", "rider_phone_bad"), ("'Ravi', '90000abcde'", "rider_phone_bad")):
            r = run(*SETUP, as_user(ADMIN, f"select admin_add_person('x@example.com', 'rider', null, {args})"))
            self.assertIn(code, str(r), args)

    def test_a_name_over_40_is_refused_not_cut(self):
        long = "'" + "a" * 41 + "'"
        self.assertIn("rider_name_long", str(run(*SETUP, add("x@example.com", name=long))))
        r = run(*SETUP, add("has.login@example.com", name="'" + "a" * 40 + "'"), f"select char_length(name) n from riders where user_id = '{HASLOGIN}'")
        self.assertEqual(r[-1]["n"], 40, r)

    def test_kitchen_and_admin_are_added_as_before_with_no_name(self):
        r = run(*SETUP, as_user(ADMIN, "select admin_add_person('has.login@example.com', 'admin', null)"), f"select count(*) c from admins where user_id = '{HASLOGIN}'")
        self.assertEqual(r[-1]["c"], 1, r)

    def test_a_non_admin_is_refused(self):
        self.assertIn("not_allowed", str(run(*SETUP, add("x@example.com", who=NOBODY))))

    def test_an_admin_edits_a_rider_and_a_non_admin_cannot(self):
        up = lambda who: as_user(who, f"select admin_set_rider('{HASLOGIN}', 'Sita Devi', '9000000001')")
        r = run(*SETUP, add("has.login@example.com"), up(ADMIN), f"select name, phone from riders where user_id = '{HASLOGIN}'")
        self.assertEqual(r[-1], {"name": "Sita Devi", "phone": "9000000001"}, r)
        self.assertIn("not_allowed", str(run(*SETUP, add("has.login@example.com"), up(NOBODY))))
        bad = as_user(ADMIN, f"select admin_set_rider('{HASLOGIN}', '', '9000000001')")
        self.assertIn("rider_name_needed", str(run(*SETUP, add("has.login@example.com"), bad)))

    def test_the_file_runs_twice(self):
        r = run(*SETUP, MIG, add("has.login@example.com"), "select count(*) c from pg_proc where proname = 'admin_add_person'")
        self.assertEqual(r[-1]["c"], 1, r)


if __name__ == "__main__":
    unittest.main()
