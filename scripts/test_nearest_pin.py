# Story #987: nearest_pin(lat, lng) answers from our own table `pincodes` (GeoNames India), within 15 km, else null. Public read, nobody writes.
# Every check ends in ROLLBACK. The three migrations run inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_nearest_pin.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ["20261108140000_nearest_pin.sql", "20261108140100_pincodes_seed_1.sql", "20261108140200_pincodes_seed_2.sql"]
MIG = "" if os.environ.get("SKIP_MIG") else "; ".join(open(os.path.join(HERE, "..", "supabase", "migrations", n)).read() for n in NAMES)


def ask(*stmts):
    r = sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class NearestPin(unittest.TestCase):
    def test_s1_the_owners_test_point_gives_471001_from_our_table(self):
        self.assertEqual(ask("select nearest_pin(24.91, 79.59) as pin"), {"pin": "471001"})   # 1.7 km from the Chhatarpur centre

    def test_s2_a_point_with_its_own_centroid_gives_that_pin(self):
        self.assertEqual(ask("select nearest_pin(28.6333, 77.2167) as pin"), {"pin": "110001"})   # Connaught Place

    def test_s2b_where_many_pins_share_one_point_the_answer_is_always_the_same(self):
        # Delhi centroids are coarse (the file gives 110020 to 110029 one point), which is why the app asks the reverse lookup first and this only as the fallback
        a = ask("select nearest_pin(28.6488, 77.1726) as pin")
        self.assertEqual(a, ask("select nearest_pin(28.6488, 77.1726) as pin"))
        self.assertEqual(a, {"pin": "110020"})

    def test_s3_a_point_in_the_sea_gives_null(self):
        self.assertEqual(ask("select nearest_pin(10.0, 70.0) as pin"), {"pin": None})

    def test_s4_a_point_off_the_map_gives_null_not_an_error(self):
        self.assertEqual(ask("select nearest_pin(120, 300) as pin"), {"pin": None})

    def test_s5_the_table_is_public_read_and_nobody_writes_it(self):
        n = ask("set local role anon", "select count(*) > 10000 as big from pincodes")
        self.assertEqual(n, {"big": True})
        w = sql("begin; " + MIG + "; set local role authenticated; delete from pincodes where pin = '110001'; rollback;")
        self.assertIn("permission denied", str(w), w)

    def test_s6_a_search_of_the_table_is_indexed_and_quick(self):
        r = ask("explain select pin from pincodes where lat between 24.7 and 25.1 and lng between 79.4 and 79.8")
        self.assertIn("Index Cond", str(r), r)   # the last plan line is the index condition, not a table scan filter


if __name__ == "__main__":
    unittest.main()
