"""Story A4 (#151): the scale check's rules. No network."""
import unittest
from city_check import build_sql, summary, passed


class CityCheck(unittest.TestCase):
    def test_sql_builds_the_city_in_one_transaction_that_is_rolled_back(self):
        q = build_sql(10, 20, 100)
        self.assertTrue(q.strip().startswith("begin;"))
        self.assertTrue(q.strip().endswith("rollback;"))
        self.assertIn("generate_series(1, 10)", q)
        self.assertIn("generate_series(1, 20)", q)
        self.assertIn("generate_series(1, 100)", q)
        self.assertEqual(q.count("place_order("), 2)   # every order is sent twice

    def test_dispatch_is_only_in_the_sql_when_asked(self):
        self.assertNotIn("assign_rider", build_sql(10, 20, 100))
        q = build_sql(10, 20, 100, dispatch=True)
        self.assertIn("dispatch_candidates", q)
        self.assertIn("assign_rider", q)

    def test_the_line_names_every_count(self):
        row = {"orders": 100, "lost": 0, "duplicates": 0, "wrong_kitchen": 0, "unassigned": 100}
        self.assertEqual(summary(row), "orders=100 lost=0 duplicates=0 wrong_kitchen=0 unassigned=100")

    def test_it_passes_only_with_no_loss_no_duplicate_and_no_wrong_kitchen(self):
        good = {"orders": 100, "lost": 0, "duplicates": 0, "wrong_kitchen": 0, "unassigned": 0}
        self.assertTrue(passed(good, need_riders=True))
        self.assertTrue(passed({**good, "unassigned": 100}, need_riders=False))   # before dispatch (layer A5) nobody is assigned yet
        self.assertFalse(passed({**good, "unassigned": 100}, need_riders=True))
        for bad in ({"lost": 1}, {"duplicates": 1}, {"wrong_kitchen": 1}):
            self.assertFalse(passed({**good, **bad}, need_riders=False))


if __name__ == "__main__":
    unittest.main()
