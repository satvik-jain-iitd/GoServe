"""Story #252: the screen-off ping gap. Run: python3 scripts/test_rider_gap.py"""
import unittest
from rider_gap import max_gap, verdict

T = lambda *s: [f"2026-10-25T10:{m:02d}:{sec:02d}+00:00" for m, sec in s]


class Gap(unittest.TestCase):
    def test_the_longest_wait_between_two_pings_in_seconds(self):
        self.assertEqual(max_gap(T((0, 0), (0, 30), (1, 5), (1, 35))), 35)

    def test_order_does_not_matter(self):
        self.assertEqual(max_gap(T((1, 35), (0, 0), (0, 30))), 65)

    def test_fewer_than_two_pings_has_no_gap(self):
        self.assertIsNone(max_gap([]))
        self.assertIsNone(max_gap(T((0, 0))))

    def test_the_verdict_uses_the_60_second_line_of_the_story(self):
        self.assertEqual(verdict(59), "PASS")
        self.assertEqual(verdict(60), "PASS")
        self.assertEqual(verdict(61), "FAIL")
        self.assertEqual(verdict(None), "FAIL")   # no pings at all is a failure, not a pass


if __name__ == "__main__":
    unittest.main()
