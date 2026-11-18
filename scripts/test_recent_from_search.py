# Story 1623 (owner, 19 Nov 2026): a tapped search result is my recent at once, with no postal code yet when Ola gave none (pin_code may be null when not confirmed).
# This tests recent_places.source ('ola' or 'own'), the helper recent_drop_ola() (the Ola loan's undo: one call deletes every row Ola gave us) and the check recent_places_confirmed_has_pin.
# Every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/goserve/goserve.env; set +a; python3 -m unittest scripts/test_recent_from_search.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG_PATH = os.path.join(HERE, "..", "supabase", "migrations", "20261119100000_recent_from_search.sql")
# The constraint reads recent_places.confirmed, added by story 1609's file. Dev may not have it yet, so the tests load that file first (as test_recent_unconfirmed.py does).
DEP_PATH = os.path.join(HERE, "..", "supabase", "migrations", "20261117130000_recent_unconfirmed.sql")
DEP = open(DEP_PATH).read()
MIG = "" if os.environ.get("SKIP_MIG") else DEP + "; " + open(MIG_PATH).read()
A, B = ("00000000-0000-0000-0000-0000000000d%d" % i for i in (1, 2))
UNCONFIRMED_NO_PIN = "insert into recent_places (name, address, lat, lng, confirmed) values ('green park', '12B, green park', 28.56, 77.2, false)"
CONFIRMED_NO_PIN = "insert into recent_places (name, address, lat, lng) values ('green park', '12B, green park', 28.56, 77.2)"


def ola(name):
    return f"insert into recent_places (name, address, pin_code, lat, lng, source) values ('{name}', '12B, {name}', '110016', 28.56, 77.2, 'ola')"


def own(name):
    return f"insert into recent_places (name, address, pin_code, lat, lng, source) values ('{name}', '12B, {name}', '110016', 28.56, 77.2, 'own')"


def legacy(name):   # a row written before this migration: no source
    return f"insert into recent_places (name, address, pin_code, lat, lng) values ('{name}', '12B, {name}', '110016', 28.56, 77.2)"


def run(*stmts):
    return sql("begin; " + (MIG + "; " if MIG else "") + "; ".join(stmts) + "; rollback;")


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RecentFromSearch(unittest.TestCase):
    def test_t1_a_not_confirmed_row_without_a_postal_code_is_kept(self):
        r = run(user(A), as_user(A, UNCONFIRMED_NO_PIN), as_user(A, "select count(*) as n from recent_places"))
        self.assertEqual(r, [{"n": 1}])

    def test_t2_a_confirmed_row_without_a_postal_code_is_refused_by_name(self):
        r = run(user(A), as_user(A, CONFIRMED_NO_PIN))
        self.assertIn("recent_places_confirmed_has_pin", str(r))

    def test_t3_the_ola_undo_deletes_only_the_ola_rows_and_returns_their_count(self):
        setup = [user(A), as_user(A, ola("ola one")), as_user(A, ola("ola two")), as_user(A, own("my own")), as_user(A, legacy("old"))]
        self.assertEqual(run(*setup, "select recent_drop_ola() as n"), [{"n": 2}])
        self.assertEqual(run(*setup, "select recent_drop_ola()", "select source from recent_places order by source nulls first"), [{"source": None}, {"source": "own"}])

    def test_t4_the_migration_file_runs_twice_without_error(self):
        text = open(MIG_PATH).read()
        r = sql("begin; " + DEP + "; " + text + "; " + text + "; rollback;")
        self.assertFalse(isinstance(r, dict) and "error" in r, r)

    def test_t5c_anon_and_authenticated_cannot_call_the_ola_undo(self):
        for role in ("anon", "authenticated"):
            r = sql(f"begin; {MIG}; set local role {role}; select recent_drop_ola(); rollback;")
            self.assertIn("permission denied", str(r), role)


if __name__ == "__main__":
    unittest.main()
