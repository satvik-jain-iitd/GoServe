# Story #1029: search_places(q) answers from our own pincodes table (GeoNames place names), by pin prefix or name prefix, service role only.
# Every check ends in ROLLBACK. The three migrations run inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_search_places.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ["20261108170000_search_places.sql", "20261108170100_pincode_names_seed_1.sql", "20261108170200_pincode_names_seed_2.sql"]
MIG = migration_inside(NAMES, "select to_regprocedure('public.search_places(text)') is not null")   # empty once dev has it applied (the proof is the same)


def search(q):
    r = sql("begin; " + MIG + f"; select coalesce(jsonb_agg(to_jsonb(s)), '[]') as rows from search_places('{q}') s; rollback;")
    assert isinstance(r, list), r
    return r[-1]["rows"]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class SearchPlaces(unittest.TestCase):
    def test_s1_the_start_of_a_name_finds_the_place(self):
        rows = search("chhatar")
        self.assertTrue(any(r["pin"] == "471001" and r["place"] == "Chhatarpur" for r in rows), rows)

    def test_s2_a_word_inside_a_name_finds_it_too(self):
        rows = search("kailash")
        self.assertTrue(rows and all("kailash" in r["place"].lower() for r in rows), rows)

    def test_s3_the_start_of_a_pin_finds_pins_and_a_full_pin_comes_first(self):
        rows = search("4710")
        self.assertTrue(rows and all(r["pin"].startswith("4710") for r in rows), rows)
        self.assertEqual(search("471001")[0]["pin"], "471001")

    def test_s4_a_name_that_starts_with_the_words_beats_one_that_only_contains_them(self):
        rows = search("connaught")
        self.assertTrue(rows[0]["place"].lower().startswith("connaught"), rows)

    def test_s5_no_match_is_an_empty_list_and_a_short_or_wild_query_finds_nothing(self):
        self.assertEqual(search("zzzzzz"), [])
        self.assertEqual(search("ch"), [])
        self.assertEqual(search("%%%"), [])

    def test_s6_at_most_fifty_candidates_each_with_a_place(self):
        rows = search("new")
        self.assertLessEqual(len(rows), 50)   # story 1031: 50 (was 20)
        self.assertTrue(rows and all(r["place"] and r["lat"] is not None for r in rows), rows)

    def test_s7_a_customer_cannot_call_it(self):
        w = sql("begin; " + MIG + "; set local role authenticated; select * from search_places('chhatar'); rollback;")
        self.assertIn("permission denied", str(w), w)

    def test_s8_every_pin_has_a_place_name_after_the_seed(self):
        r = sql("begin; " + MIG + "; select count(*) filter (where place is null) as missing, count(*) as total from pincodes; rollback;")[-1]
        self.assertEqual(r["missing"], 0, r)
        self.assertGreater(r["total"], 10000)


if __name__ == "__main__":
    unittest.main()
