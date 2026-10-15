# F71: clear_dev.py refuses any project but goserve-dev and does not delete without --apply.
# Run: python3 -m unittest scripts/test_clear_dev.py  (no token needed: both checks stop before any call)
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clear_dev


class ClearDev(unittest.TestCase):
    def test_refuses_another_project(self):
        with self.assertRaises(SystemExit) as e:
            clear_dev.main(["--apply", "--ref", "someprodref"])
        self.assertIn("not goserve-dev", str(e.exception))

    def test_dry_run_runs_only_a_count(self):
        seen = []
        clear_dev.sql = lambda ref, q: (seen.append(q), [{}])[1]
        clear_dev.main([])
        self.assertEqual(len(seen), 1)
        self.assertTrue(seen[0].startswith("select"))
        self.assertNotIn("delete", seen[0])

    def test_apply_deletes_children_before_orders_in_one_transaction(self):
        seen = []
        clear_dev.sql = lambda ref, q: (seen.append(q), [{}])[1]
        clear_dev.main(["--apply"])
        d = seen[1]
        self.assertTrue(d.startswith("begin;") and d.endswith("commit;"))
        self.assertLess(d.index("delete from order_events"), d.index("delete from orders"))


if __name__ == "__main__":
    unittest.main()
