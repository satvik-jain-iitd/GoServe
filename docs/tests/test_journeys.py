"""Story #330 (D.4, epic E26): the Swish and Zepto Cafe journeys, step by step, next to GoServe.
Scenario: Given the study, when the table is read, then each step shows Swish, Zepto Cafe and GoServe side by side.
Run: python3 -m unittest docs/tests/test_journeys.py   (no network)"""
import os, re, unittest

DOC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research", "journeys-swish-zepto-2026-10.md")
RADAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research", "repo-radar.md")
TAG = re.compile(r"\((A|B|C|P|S|K)[^)]*,\s*(0(\.\d+)?|1(\.0+)?)[^)]*\)")


class Journeys(unittest.TestCase):
    def setUp(self):
        self.text = open(DOC, encoding="utf-8").read()
        self.rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in self.text.splitlines() if re.match(r"\| \d+ \|", l)]

    def test_at_least_eight_steps_with_swish_zepto_cafe_and_goserve_side_by_side(self):
        self.assertGreaterEqual(len(self.rows), 8)
        for r in self.rows:
            self.assertEqual(len(r), 5, r)
            self.assertTrue(all(c for c in r), r)

    def test_every_swish_and_zepto_cell_has_a_tier_and_a_confidence_or_says_unknown(self):
        for r in self.rows:
            for cell in (r[2], r[3]):
                self.assertTrue(TAG.search(cell) or cell.startswith("UNKNOWN"), f"step {r[0]}: {cell[:60]}")

    def test_goserve_cells_name_the_screen(self):
        for r in self.rows:
            self.assertRegex(r[4], r"`[^`]+`|screen|button", r)

    def test_gaps_and_how_to_close_them_are_written(self):
        self.assertIn("## Gaps", self.text)
        self.assertIn("## How to close the gaps", self.text)

    def test_the_radar_run_is_recorded(self):
        section = open(RADAR, encoding="utf-8").read().split("(story #330", 1)[1].split("\n## ", 1)[0]
        self.assertIn("scout.py --need", section)
        self.assertIn("Decision:", section)


if __name__ == "__main__":
    unittest.main()
