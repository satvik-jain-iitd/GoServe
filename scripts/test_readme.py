# Story #246: README v3 names every app, the roadmap and the hand-over, and carries nothing stale.
# Run: python3 -m unittest scripts/test_readme.py
import os, re, unittest

README = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "README.md")).read()


class Readme(unittest.TestCase):
    def test_names_the_four_apps_by_their_live_address(self):
        for path in ("/customer/", "/kitchen/", "/rider/", "/admin/"):
            self.assertTrue(f"https://goserve-app.pages.dev{path}" in README, path)

    def test_says_what_is_built_for_each_person(self):
        for words in ("hand-over", "roadmap", "Cancelled", "Day and Night", "rider's name"):
            self.assertTrue(words in README, words)
        self.assertTrue("scripts/roadmap.py" in README)

    def test_carries_nothing_stale(self):
        for stale in ("CartScreen", "coming soon", "TODO", "goserve-app.pages.dev/ops/", "Track an order"):
            self.assertFalse(stale in README, stale)
        self.assertIsNone(re.search(r"\bslips?\b", README), "a customer says order, not slip (#242)")


if __name__ == "__main__":
    unittest.main()
