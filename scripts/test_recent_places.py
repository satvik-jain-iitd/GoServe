# Story 1530: the table recent_places ("Recently searched"). A customer reads and writes only his own rows, a signed-out caller reads nothing, the newest 10 are kept,
# and a row needs a point, a name and a 6 digit postal code. Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first;
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_recent_places.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261115110000_recent_places.sql")).read()
A, B = ("00000000-0000-0000-0000-0000000000b%d" % i for i in (1, 2))
ROW = "insert into recent_places (name, address, pin_code, lat, lng, house) values ('%s', '12B, green park', '110016', 28.56, 77.2, '12B')"   # what the app sends: no user_id


def run(*stmts):
    return sql("begin; " + (MIG + "; " if MIG else "") + "; ".join(stmts) + "; rollback;")


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RecentPlaces(unittest.TestCase):
    def test_s1_a_customer_adds_and_reads_his_own_recent(self):
        r = run(user(A), as_user(A, ROW % "green park"), as_user(A, "select name, pin_code, user_id = '%s' as mine from recent_places" % A))
        self.assertEqual(r, [{"name": "green park", "pin_code": "110016", "mine": True}])

    def test_s2_another_customer_cannot_read_change_or_delete_it(self):
        r = run(user(A), user(B), as_user(A, ROW % "green park"), as_user(B, "select count(*) as n from recent_places"))
        self.assertIn("'n': 0", str(r))
        r = run(user(A), user(B), as_user(A, ROW % "green park"), as_user(B, "update recent_places set name = 'taken'"), as_user(B, "delete from recent_places"), "select name from recent_places")
        self.assertEqual(r, [{"name": "green park"}])

    def test_s3_a_customer_cannot_add_a_row_for_another(self):
        r = str(run(user(A), user(B), as_user(B, "insert into recent_places (user_id, name, address, pin_code, lat, lng) values ('%s', 'x', 'y', '110016', 1, 1)" % A)))
        self.assertIn("row-level security", r)

    def test_s4_a_signed_out_caller_reads_nothing(self):
        r = str(run(user(A), as_user(A, ROW % "green park"), "set local role anon; select count(*) as n from recent_places"))
        self.assertTrue("permission denied" in r or "'n': 0" in r, r)

    def test_s5_the_newest_10_are_kept(self):
        adds = [as_user(A, "insert into recent_places (name, address, pin_code, lat, lng, used_at) values ('p%02d', 'a', '110016', 1, 1, now() + interval '%d minutes')" % (i, i)) for i in range(1, 13)]
        r = run(user(A), *adds, "select count(*) as n, min(name) as oldest, max(name) as newest from recent_places")
        self.assertEqual(r, [{"n": 10, "oldest": "p03", "newest": "p12"}])

    def test_s6_the_cap_is_per_customer(self):
        adds = [as_user(A, ROW % ("p%02d" % i)) for i in range(1, 12)]
        r = run(user(A), user(B), as_user(B, ROW % "mine"), *adds, "select count(*) as n from recent_places where user_id = '%s'" % B)
        self.assertEqual(r, [{"n": 1}])

    def test_s7_a_row_needs_a_point_a_name_and_a_postal_code(self):
        for bad in ("insert into recent_places (name, address, pin_code) values ('x', 'y', '110016')",
                    "insert into recent_places (name, address, pin_code, lat, lng) values (' ', 'y', '110016', 1, 1)",
                    "insert into recent_places (name, address, pin_code, lat, lng) values ('x', 'y', '1100', 1, 1)"):
            r = str(run(user(A), as_user(A, bad)))
            self.assertTrue("violates" in r, r)

    def test_s8_deleting_the_login_deletes_its_recents(self):
        r = run(user(A), as_user(A, ROW % "green park"), "delete from auth.users where id = '%s'" % A, "select count(*) as n from recent_places")
        self.assertEqual(r, [{"n": 0}])

    def test_s9_the_migration_is_safe_to_run_twice(self):
        r = run(MIG or "select 1", "select count(*) as n from pg_policies where tablename = 'recent_places'")
        self.assertEqual(r, [{"n": 1}])


if __name__ == "__main__":
    unittest.main()
