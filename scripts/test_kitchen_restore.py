"""F210: the sim check clears kitchen hours to run at any hour, and must put every kitchen back, even when the check crashes. Run: python3 scripts/test_kitchen_restore.py"""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kitchen_restore


class Restore(unittest.TestCase):
    def test_every_saved_kitchen_gets_its_open_flag_and_hours_back(self):
        saved = {"k1": {"open": False, "opens_at": "10:00:00", "closes_at": "22:00:00"}, "k2": {"open": True, "opens_at": None, "closes_at": None}}
        calls = []
        kitchen_restore.restore(lambda kid, body: calls.append((kid, body)), saved)
        self.assertEqual(sorted(calls), [("k1", {"open": False, "opens_at": "10:00:00", "closes_at": "22:00:00"}), ("k2", {"open": True, "opens_at": None, "closes_at": None})])

    def test_one_failing_patch_does_not_stop_the_others(self):
        saved = {"a": {"open": True, "opens_at": None, "closes_at": None}, "b": {"open": True, "opens_at": None, "closes_at": None}}
        done = []
        def patch(kid, body):
            if kid == "a": raise OSError("network")
            done.append(kid)
        kitchen_restore.restore(patch, saved)
        self.assertEqual(done, ["b"])

    def test_remember_keeps_the_first_state_only(self):
        saved = {}
        kitchen_restore.remember(saved, "k", {"open": False, "opens_at": "10:00:00", "closes_at": None})
        kitchen_restore.remember(saved, "k", {"open": True, "opens_at": None, "closes_at": None})   # the check opened it already
        self.assertEqual(saved["k"]["open"], False)


if __name__ == "__main__":
    unittest.main()
