# Story #196 (H13): the integrations research gives every need a pick, a cost, a date and tiered sources.
# Run: python3 -m unittest scripts/test_integrations_doc.py
import os, re, unittest

DOC = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs/research/integrations-2026-10.md")).read()
NEEDS = ["Payments gateway", "SMS code (OTP)", "Push", "Maps and address lookup", "Product analytics", "Uptime monitor"]


def rows():
    return [[c.strip() for c in l.strip().strip("|").split("|")] for l in DOC.splitlines() if l.startswith("|") and not l.startswith("|---")]


class Integrations(unittest.TestCase):
    def test_every_need_has_a_row(self):
        names = [r[0] for r in rows()]
        for n in NEEDS:
            self.assertTrue(any(x.startswith(n) for x in names), n)

    def test_every_row_has_pick_cost_date_tier_confidence_and_a_source_link(self):
        body = [r for r in rows() if any(r[0].startswith(n) for n in NEEDS)]
        self.assertEqual(len(body), len(NEEDS))
        for r in body:
            pick, cost, date, tier, conf, src = r[1], r[2], r[3], r[4], r[5], r[6]
            self.assertTrue(pick and cost, r[0])
            self.assertRegex(date, r"^2026-\d\d-\d\d$", r[0])
            self.assertRegex(tier, r"^[ABCSPK](, [ABCSPK])*$", r[0])
            self.assertTrue(0 <= float(conf) <= 1, r[0])
            self.assertRegex(src, r"https?://", r[0])

    def test_a_vendor_page_alone_never_settles_a_price(self):
        self.assertIn("Tier C", DOC)
        self.assertIn("what do they gain", DOC.lower())


if __name__ == "__main__":
    unittest.main()
