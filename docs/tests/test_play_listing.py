"""Story #254 (epic E22): the Play closed-test runbook and the listing assets exist and have the sizes Google asks for.
Run: python3 -m unittest docs/tests/test_play_listing.py   (no network)"""
import os, re, struct, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
RUNBOOK = ROOT / "docs" / "ops" / "play-closed-test.md"
PLAY = ROOT / "design" / "play"


def png_size(p):
    with open(p, "rb") as f:
        head = f.read(24)
    assert head[:8] == b"\x89PNG\r\n\x1a\n", f"{p} is not a PNG"
    return struct.unpack(">II", head[16:24])


class PlayListing(unittest.TestCase):
    def test_the_runbook_has_every_step_the_owner_needs(self):
        self.assertTrue(RUNBOOK.exists(), "docs/ops/play-closed-test.md does not exist")
        text = RUNBOOK.read_text()
        for must in ("in.goserve.customer", "Data safety", "Content rating", "App access", "123456", "Closed testing", "App signing key",
                     "assetlinks.json", ".aab", "https://goserve-app.pages.dev/privacy/"):
            self.assertIn(must, text)

    def test_the_second_fingerprint_step_says_where_in_the_console_and_where_in_the_repo(self):
        text = RUNBOOK.read_text()
        self.assertRegex(text, r"Test and release.*App signing", "the exact console place")
        self.assertIn("app/public/.well-known/assetlinks.json", text)

    def test_the_listing_texts_fit_the_play_limits(self):
        short = (PLAY / "short-description.txt").read_text().strip()
        full = (PLAY / "full-description.txt").read_text().strip()
        title = (PLAY / "title.txt").read_text().strip()
        self.assertLessEqual(len(title), 30)
        self.assertLessEqual(len(short), 80)
        self.assertLessEqual(len(full), 4000)
        self.assertGreater(len(full), 200)

    def test_the_feature_graphic_is_1024_by_500(self):
        self.assertEqual(png_size(PLAY / "feature-graphic.png"), (1024, 500))

    def test_four_phone_screenshots_are_1080_by_1920_and_under_8_mb_and_500_kb(self):
        shots = sorted(PLAY.glob("screenshot-*.png"))
        self.assertEqual([s.name for s in shots], ["screenshot-1-menu.png", "screenshot-2-bill.png", "screenshot-3-tracker.png", "screenshot-4-story.png"])
        for s in shots:
            self.assertEqual(png_size(s), (1080, 1920), s.name)
            self.assertLess(s.stat().st_size, 500 * 1024, f"{s.name} is over the 500 KB repo limit")

    def test_the_data_safety_table_matches_the_app_and_names_the_deletion_link(self):   # story #771
        text = RUNBOOK.read_text()
        self.assertIn("https://goserve-app.pages.dev/privacy/#delete", text)
        for row in ("| App activity, app interactions |", "| App info and performance, diagnostics |"):
            line = next(l for l in text.splitlines() if l.startswith(row))
            for must in ("Collected, optional", "app functions", "Not shared", "feedback"):
                self.assertIn(must.lower(), line.lower(), row)


if __name__ == "__main__":
    unittest.main()
