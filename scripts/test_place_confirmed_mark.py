# Story 1529: the mark "this customer has confirmed a place once" (customers.place_confirmed_at). A customer reads and sets only his own mark; a signed-out caller reads nothing.
# Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first; SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_place_confirmed_mark.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261115100000_place_confirmed_mark.sql")).read()
A, B = ("00000000-0000-0000-0000-0000000000a%d" % i for i in (1, 2))
MARK = "insert into customers (user_id, place_confirmed_at) values ('%s', now()) on conflict (user_id) do update set place_confirmed_at = excluded.place_confirmed_at"   # what the app sends (an upsert)


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PlaceConfirmedMark(unittest.TestCase):
    def test_s1_a_new_customer_has_no_mark(self):
        r = run(user(A), as_user(A, "insert into customers (user_id, pin_code) values ('%s', '110016')" % A), as_user(A, "select place_confirmed_at is null as none from customers"))
        self.assertEqual(r, [{"none": True}])

    def test_s2_a_customer_sets_and_reads_his_own_mark(self):
        r = run(user(A), as_user(A, MARK % A), as_user(A, "select place_confirmed_at is not null as marked from customers"))
        self.assertEqual(r, [{"marked": True}])

    def test_s3_the_mark_is_kept_when_the_other_details_change(self):
        r = run(user(A), as_user(A, MARK % A), as_user(A, "update customers set pin_code = '110017'"), as_user(A, "select place_confirmed_at is not null as marked, pin_code from customers"))
        self.assertEqual(r, [{"marked": True, "pin_code": "110017"}])

    def test_s4_another_customer_cannot_read_or_set_it(self):
        r = run(user(A), user(B), as_user(A, MARK % A), as_user(B, "select count(*) as n from customers"))
        self.assertIn("'n': 0", str(r))
        r = run(user(A), user(B), as_user(A, "insert into customers (user_id) values ('%s')" % A), as_user(B, "update customers set place_confirmed_at = now()"), "select count(*) as n from customers where place_confirmed_at is not null")
        self.assertIn("'n': 0", str(r))
        r = str(run(user(A), user(B), as_user(B, MARK % A)))
        self.assertIn("row-level security", r)

    def test_s5_a_signed_out_caller_reads_nothing(self):
        r = str(run(user(A), as_user(A, MARK % A), "set local role anon; select count(*) as n from customers"))
        self.assertTrue("permission denied" in r or "'n': 0" in r, r)

    def test_s6_the_migration_is_safe_to_run_twice(self):
        r = run(MIG or "select 1", "select count(*) as n from information_schema.columns where table_name = 'customers' and column_name = 'place_confirmed_at'")
        self.assertEqual(r, [{"n": 1}])


if __name__ == "__main__":
    unittest.main()
