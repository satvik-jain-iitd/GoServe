"""Story #503: the bare address is the story page. The old redirect to /customer/ is gone, the app deploy never touches site/ or letsdwelo.in,
and the story page runs no script but the theme switch.
Run: python3 scripts/test_story_page.py"""
import re, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class StoryPage(unittest.TestCase):
    def test_the_root_is_not_redirected_to_the_customer_app(self):
        lines = [l for l in (ROOT / "app/public/_redirects").read_text().splitlines() if l.strip() and not l.startswith("#")]
        self.assertEqual([l for l in lines if l.split()[0] == "/"], [])

    def test_the_four_doors_are_in_the_page(self):
        html = (ROOT / "app/story.html").read_text()
        for door in ("/customer/", "/kitchen/", "/rider/", "/admin/"):
            self.assertIn(f'href="{door}"', html)

    def test_the_page_has_no_external_script_and_one_inline_theme_switch(self):
        html = (ROOT / "app/story.html").read_text()
        self.assertEqual(re.findall(r"<script[^>]*\ssrc=", html), [])
        self.assertEqual(len(re.findall(r"<script>", html)), 1)

    def test_the_app_deploy_does_not_touch_the_investor_site(self):
        wf = "\n".join(re.sub(r"\s#.*$|^\s*#.*$", "", l) for l in (ROOT / ".github/workflows/deploy-app.yml").read_text().splitlines())   # comments out
        self.assertNotIn("site/", wf)
        self.assertNotIn("letsdwelo", wf)
        self.assertIn("--project-name=goserve-app", wf)


if __name__ == "__main__":
    unittest.main()
