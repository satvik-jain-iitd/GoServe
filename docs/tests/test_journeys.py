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

    def test_the_owners_swish_capture_fills_step_2_with_a_screen_tier(self):
        # Story #509: the owner's own phone, 27 Oct 2026 (Tier S for the screen).
        cap = os.path.join(os.path.dirname(DOC), "captures", "swish-unserviceable-2026-10-27.png")
        self.assertTrue(os.path.getsize(cap) > 10_000)
        step2 = next(r for r in self.rows if r[0] == "2")
        self.assertRegex(step2[2], r"\(S, 0\.\d+")
        self.assertIn("Coming soon to your neighbourhood", step2[2])

    def test_the_pin_screen_radar_is_recorded(self):
        radar = open(RADAR, encoding="utf-8").read().split("(story #508", 1)[1].split("\n## ", 1)[0]
        self.assertIn("scout.py --need", radar)
        self.assertIn("Nominatim", radar)
        self.assertIn("Decision:", radar)

    def test_gaps_and_how_to_close_them_are_written(self):
        self.assertIn("## Gaps", self.text)
        self.assertIn("## How to close the gaps", self.text)

    def test_the_radar_run_is_recorded(self):
        section = open(RADAR, encoding="utf-8").read().split("(story #330", 1)[1].split("\n## ", 1)[0]
        self.assertIn("scout.py --need", section)
        self.assertIn("Decision:", section)


if __name__ == "__main__":
    unittest.main()
