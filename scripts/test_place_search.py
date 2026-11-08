# Story #1027: the database half of place-search. place_search_take_slot() lets one call through a second in total; place_search_cache is for the service role only.
# Every check ends in ROLLBACK. The migration runs inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_place_search.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = migration_inside(["20261108160000_place_search.sql"], "select to_regclass('public.place_search_cache') is not null")   # empty once dev has it applied (the proof is the same)


def ask(*stmts):
    r = sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PlaceSearch(unittest.TestCase):
    def test_s1_the_first_call_gets_the_slot_and_the_next_in_the_same_second_does_not(self):
        r = ask("create temp table t (a boolean, b boolean)", "insert into t select place_search_take_slot(), place_search_take_slot()", "select a, b from t")
        self.assertEqual(r, {"a": True, "b": False})

    def test_s2_a_second_later_the_slot_is_free_again(self):
        r = ask("select place_search_take_slot()", "update settings set value = jsonb_build_object('at', clock_timestamp() - interval '2 seconds') where name = 'place_search_slot'", "select place_search_take_slot() as again")
        self.assertEqual(r, {"again": True})

    def test_s3_a_customer_cannot_take_the_slot_or_read_the_cache(self):
        w = sql("begin; " + MIG + "; set local role authenticated; select place_search_take_slot(); rollback;")
        self.assertIn("permission denied", str(w), w)
        w = sql("begin; " + MIG + "; set local role anon; select count(*) from place_search_cache; rollback;")
        self.assertIn("permission denied", str(w), w)

    def test_s4_the_cache_key_is_a_real_query_not_empty_or_huge(self):
        w = sql("begin; " + MIG + "; insert into place_search_cache (key, results) values ('ab', '[]'); rollback;")
        self.assertIn("violates check constraint", str(w), w)
        ok = ask("insert into place_search_cache (key, results) values ('green park', '[]')", "select count(*) as n from place_search_cache")
        self.assertEqual(ok, {"n": 1})


if __name__ == "__main__":
    unittest.main()
