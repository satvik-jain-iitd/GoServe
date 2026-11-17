# Story 1609 (owner, 17 Nov 2026): a tapped search result is the customer's own recent at once, marked not confirmed; Confirm on the map updates that row.
# This tests the column recent_places.confirmed and the helper recent_drop_unconfirmed() (the loan's undo: one call deletes every row never confirmed).
# Every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_recent_unconfirmed.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261117130000_recent_unconfirmed.sql")).read()
A, B = ("00000000-0000-0000-0000-0000000000c%d" % i for i in (1, 2))
TAPPED = "insert into recent_places (name, address, pin_code, lat, lng, confirmed) values ('green park', '12B, green park', '110016', 28.56, 77.2, false)"
CONFIRMED = "insert into recent_places (name, address, pin_code, lat, lng) values ('green park', '12B, green park', '110016', 28.56, 77.2)"


def run(*stmts):
    return sql("begin; " + (MIG + "; " if MIG else "") + "; ".join(stmts) + "; rollback;")


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RecentUnconfirmed(unittest.TestCase):
    def test_u1_a_tapped_recent_is_stored_not_confirmed(self):
        r = run(user(A), as_user(A, TAPPED), as_user(A, "select name, confirmed from recent_places"))
        self.assertEqual(r, [{"name": "green park", "confirmed": False}])

    def test_u2_a_row_without_the_mark_is_confirmed(self):   # existing rows and Confirm on the map
        r = run(user(A), as_user(A, CONFIRMED), as_user(A, "select confirmed from recent_places"))
        self.assertEqual(r, [{"confirmed": True}])

    def test_u3_another_customer_cannot_read_a_tapped_recent(self):
        r = run(user(A), user(B), as_user(A, TAPPED), as_user(B, "select count(*) as n from recent_places"))
        self.assertIn("'n': 0", str(r))

    def test_u4_deleting_the_login_removes_a_tapped_recent(self):   # Delete my account: the cascade on auth.users
        r = run(user(A), as_user(A, TAPPED), f"delete from auth.users where id = '{A}'", "select count(*) as n from recent_places")
        self.assertIn("'n': 0", str(r))

    def test_u5_the_undo_deletes_only_the_never_confirmed_rows(self):   # run by the owner's side (no login): the helper is not granted to authenticated
        self.assertEqual(run(user(A), as_user(A, TAPPED), as_user(A, CONFIRMED), "select recent_drop_unconfirmed() as n"), [{"n": 1}])
        self.assertEqual(run(user(A), as_user(A, TAPPED), as_user(A, CONFIRMED), "select recent_drop_unconfirmed()", "select confirmed from recent_places"), [{"confirmed": True}])

if __name__ == "__main__":
    unittest.main()
