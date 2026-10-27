"""Story #488 (E25): the Supabase health research names a real source, a tier and a confidence for every number, and names each gap.
Scenario: Given the research file, when its table is read, then no number is missing a tier or a confidence, and egress is a named gap.
Run: python3 -m unittest docs/tests/test_health_research.py   (no network)"""
import os, re, unittest

DOC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research", "supabase-health-2026-10.md")
RADAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research", "repo-radar.md")


class HealthResearch(unittest.TestCase):
    def setUp(self):
        self.text = open(DOC, encoding="utf-8").read()
        self.rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in self.text.splitlines() if l.startswith("| ") and not l.startswith("| Number") and not l.startswith("|---")]

    def test_every_number_has_a_tier_and_a_confidence_between_0_and_1(self):
        self.assertGreaterEqual(len(self.rows), 7)
        for r in self.rows:
            self.assertRegex(r[3], r"^(A|B|C|P|S|K)\b", f"{r[0]}: no tier")
            self.assertTrue(0 <= float(re.search(r"\d\.\d+|\d", r[4]).group()) <= 1, f"{r[0]}: confidence")

    def test_egress_is_a_named_gap_and_only_a_proxy_is_offered(self):
        egress = next(r for r in self.rows if r[0] == "Egress")
        self.assertIn("Gap", egress[5])
        self.assertIn("proxy", egress[5].lower())

    def test_the_radar_run_is_recorded(self):
        section = open(RADAR, encoding="utf-8").read().split("(story #488", 1)[1].split("\n## ", 1)[0]
        self.assertIn("scout.py --need", section)
        self.assertIn("Decision:", section)


if __name__ == "__main__":
    unittest.main()
