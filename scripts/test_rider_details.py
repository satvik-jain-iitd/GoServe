# Story 1654 layer 1: a rider is saved with a real name and mobile (made-up names and 9000000000 only).
# The migration is NOT applied to dev. Each check runs the migration file and then the checks inside one BEGIN..ROLLBACK, so nothing persists.
# Red run before the file exists: it runs against the current dev schema (the file is missing, so nothing is added).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_rider_details.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations", "20261119140000_rider_details.sql")
MIG = open(FILE).read() if os.path.exists(FILE) else ""
K1 = "00000000-0000-0000-0000-0000000000e1"
ADMIN, NOBODY, EXISTING, NEWBIE = ("00000000-0000-0000-0000-0000000000d%d" % i for i in (1, 2, 3, 4))
NAME_MSG = {"ok": False, "error": "invalid_rider_name", "message": "Type the rider's name."}
PHONE_MSG = {"ok": False, "error": "invalid_rider_phone", "message": "Type a 10-digit mobile number."}


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def user(uid, email):
    return f"insert into auth.users (id, email, email_confirmed_at, aud, role, instance_id) values ('{uid}', {email!r}, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


SETUP = [
    f"insert into kitchens (id, session_id, name, active, open, pin_codes) values ('{K1}', 's', 'Test Kitchen', true, true, array['110001'])",
    user(ADMIN, "boss@example.com"), user(EXISTING, "old.rider@example.com"), user(NOBODY, "nobody@example.com"),
    f"insert into admins (user_id) values ('{ADMIN}')",
]


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def q(v):
    return "null" if v is None else "'" + v.replace("'", "''") + "'"


def add(email, kind="rider", name=None, phone=None, kitchen=None, who=ADMIN, into="r"):
    k = f"'{kitchen}'" if kitchen else "null"
    return as_user(who, f"create temp table {into} as select admin_add_person({email!r}, '{kind}', {k}, {q(name)}, {q(phone)}) v")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RiderDetails(unittest.TestCase):
    def test_a_rider_with_a_login_gets_name_and_phone(self):
        r = run(*SETUP, "delete from riders", add("old.rider@example.com", name="  Amit Kumar ", phone="90000 00000"),
                f"select (select v from r) v, (select name from riders where user_id = '{EXISTING}') n, (select phone from riders where user_id = '{EXISTING}') p")
        self.assertEqual((r[-1]["n"], r[-1]["p"], r[-1]["v"]["invited"]), ("Amit Kumar", "9000000000", False), r)

    def test_a_rider_added_by_invite_then_claimed_has_them(self):
        r = run(*SETUP, add("amit@example.com", name="Amit Kumar", phone="9000000000"), user(NEWBIE, "amit@example.com"),
                f"select (select v from r) v, (select name from riders where user_id = '{NEWBIE}') n, (select phone from riders where user_id = '{NEWBIE}') p, (select rider_name from staff_invites) rn")
        self.assertEqual((r[-1]["n"], r[-1]["p"], r[-1]["v"]["invited"], r[-1]["rn"]), ("Amit Kumar", "9000000000", True, "Amit Kumar"), r)

    def test_no_name_is_refused_with_the_plain_message(self):
        for nm in (None, "", "   "):
            r = run(*SETUP, add("amit@example.com", name=nm, phone="9000000000"), "select (select v from r) v, (select count(*) from staff_invites) n")
            self.assertEqual((r[-1]["v"], r[-1]["n"]), (NAME_MSG, 0), (nm, r))

    def test_a_bad_mobile_is_refused(self):
        for ph in (None, "900000000", "5000000000", "90000abcde", "90000000001"):
            r = run(*SETUP, add("amit@example.com", name="Amit Kumar", phone=ph), "select (select v from r) v, (select count(*) from staff_invites) n")
            self.assertEqual((r[-1]["v"], r[-1]["n"]), (PHONE_MSG, 0), (ph, r))

    def test_a_name_with_digits_or_too_long_is_refused(self):
        for nm in ("Amit 2", "Amit Kumar9", "A" * 61):
            r = run(*SETUP, add("amit@example.com", name=nm, phone="9000000000"), "select (select v from r) v")
            self.assertEqual(r[-1]["v"], NAME_MSG, (nm, r))

    def test_a_name_of_60_with_a_dot_an_apostrophe_and_a_hyphen_is_accepted(self):
        for nm in ("A" * 60, "D'Souza-Rao Jr.", "राज कुमार"):
            r = run(*SETUP, add("amit@example.com", name=nm, phone="9000000000"), "select (select v from r) v, (select rider_name from staff_invites) rn")
            self.assertEqual((r[-1]["v"], r[-1]["rn"]), ({"ok": True, "invited": True}, nm), (nm, r))

    def test_a_kitchen_person_and_an_admin_are_added_as_today(self):
        r = run(*SETUP, add("cook@example.com", "kitchen", kitchen=K1, into="a"), add("boss2@example.com", "admin", into="b"),
                "select (select v from a) a, (select v from b) b, (select count(*) from staff_invites where rider_name is not null or rider_phone is not null) n")
        self.assertEqual((r[-1]["a"]["invited"], r[-1]["b"]["invited"], r[-1]["n"]), (True, True, 0), r)

    def test_a_non_admin_is_refused(self):
        self.assertIn("not_allowed", str(run(*SETUP, add("amit@example.com", name="Amit Kumar", phone="9000000000", who=NOBODY))))

    def test_an_existing_rider_row_gets_the_new_name_and_phone(self):
        r = run(*SETUP, "insert into riders (user_id, name, phone) values ('%s', 'Old Name', '9111111111') on conflict (user_id) do update set name = 'Old Name', phone = '9111111111'" % EXISTING,
                add("old.rider@example.com", name="New Name", phone="9000000000"),
                f"select name n, phone p, (select count(*) from riders where user_id = '{EXISTING}') c from riders where user_id = '{EXISTING}'")
        self.assertEqual((r[-1]["n"], r[-1]["p"], r[-1]["c"]), ("New Name", "9000000000", 1), r)

    def test_a_claim_keeps_an_existing_name_when_the_invite_has_none(self):
        r = run(*SETUP, "insert into staff_invites (email, kind) values ('amit@example.com', 'rider')", user(NEWBIE, "amit@example.com"),
                f"select name n from riders where user_id = '{NEWBIE}'")
        self.assertIsNone(r[-1]["n"], r)

    def test_the_check_refuses_a_bad_invite_row(self):
        for col, v in (("rider_phone", "5000000000"), ("rider_phone", "90000abcde"), ("rider_name", "''"), ("rider_name", "repeat('A', 61)")):
            val = v if v.startswith(("'", "repeat")) else f"'{v}'"
            self.assertIn("staff_invites_rider_details", str(run(*SETUP, f"insert into staff_invites (email, kind, {col}) values ('x@example.com', 'rider', {val})")), (col, v))

    def test_the_migration_runs_twice_in_one_transaction(self):
        self.assertTrue(MIG, "the migration file is missing")
        r = sql("begin; " + MIG + "; " + MIG + "; select count(*) n from pg_proc where proname = 'admin_add_person'; rollback;")
        self.assertEqual(r[-1]["n"], 1, r)

    def test_only_one_admin_add_person_exists_with_five_arguments(self):
        r = run("select count(*) n, max(pronargs) a from pg_proc where proname = 'admin_add_person'")
        self.assertEqual((r[-1]["n"], r[-1]["a"]), (1, 5), r)

    def test_the_signed_out_cannot_call_it(self):
        self.assertIn("permission denied", str(run("set local role anon", "select admin_add_person('a@example.com', 'rider', null, 'Amit Kumar', '9000000000')")))


if __name__ == "__main__":
    unittest.main()
