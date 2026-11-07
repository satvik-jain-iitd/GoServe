# Story #928: migration_drift.py names every merged migration whose proof object is missing on the project. No network: the present set is injected.
# Run: python3 -m unittest scripts/test_migration_drift.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import migration_drift as d
import prod_backend_v2 as p

V1, V2 = p.load("app/supabase/migrations"), p.load("supabase/migrations")
ALL = {m for _, m in V1 + V2 if m}
KITCHEN_REMOVE = "20261104130000_kitchen_remove.sql"


class Drift(unittest.TestCase):
    def test_s1_a_project_with_everything_has_no_drift(self):
        self.assertEqual(d.missing(ALL, V1, V2), [])

    def test_s2_one_migration_not_applied_is_named_by_file(self):
        marker = dict(V2)[KITCHEN_REMOVE]
        self.assertEqual(marker, "function:kitchen_remove_v2/1")
        self.assertEqual(d.missing(ALL - {marker}, V1, V2), [KITCHEN_REMOVE])

    def test_s3_a_file_with_no_marker_is_not_reported(self):
        self.assertIn(None, [m for _, m in V1 + V2] + [None])   # drop-only files (0054) have no marker and cannot be proved
        self.assertEqual(d.missing(ALL, V1 + [("0099_drop_only.sql", None)], V2), [])

    def test_s3b_a_file_whose_function_later_changed_its_arguments_is_not_a_false_alarm(self):
        self.assertEqual(d.missing(ALL - {"function:sim_clear_all/0"}, V1, V2), [])

    def test_s4_the_report_exits_non_zero_and_prints_the_file(self):
        out = d.report([KITCHEN_REMOVE])
        self.assertEqual(out[0], 1)
        self.assertIn(KITCHEN_REMOVE, out[1])
        self.assertEqual(d.report([])[0], 0)


if __name__ == "__main__":
    unittest.main()
