"""Story #329 (D.3, epic E26): the radar run for design reference sources.
Scenario: Given the sources found, when the radar rows are read, then each has a tier and a reason.
Run: python3 -m unittest docs/tests/test_design_radar.py   (no network)"""
import os, re, unittest

RADAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research", "repo-radar.md")
HEAD = "## 2026-10-27: design reference sources (story #329)"


class DesignRadar(unittest.TestCase):
    def setUp(self):
        text = open(RADAR, encoding="utf-8").read()
        self.assertIn(HEAD, text, "the radar section for #329 is missing")
        self.section = text.split(HEAD, 1)[1].split("\n## ", 1)[0]
        self.rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in self.section.splitlines() if l.startswith("| ") and not l.startswith("| Source") and not l.startswith("|---")]

    def test_the_run_is_recorded_with_its_command(self):
        self.assertIn("scout.py --need", self.section)
        self.assertRegex(self.section, r"Decision:")

    def test_every_source_has_a_tier_and_a_reason(self):
        self.assertGreaterEqual(len(self.rows), 6)
        for r in self.rows:
            self.assertGreaterEqual(len(r), 5, r)
            self.assertRegex(r[3], r"^(A|B|C|P|S)\b", f"{r[0]}: no tier")
            self.assertGreater(len(r[4]), 25, f"{r[0]}: no reason")


if __name__ == "__main__":
    unittest.main()
