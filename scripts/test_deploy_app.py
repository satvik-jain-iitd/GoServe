# Story #42, S1 and S2: prod deploy runs for app/ on main and leaves the investor site alone.
# Run: python3 -m unittest scripts/test_deploy_app.py
import os, re, unittest

WF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".github", "workflows")
read = lambda n: open(os.path.join(WF, n)).read()


class DeployApp(unittest.TestCase):
    def setUp(self):
        self.text = read("deploy-app.yml")

    def test_s1_app_on_main_publishes_to_goserve_app(self):
        self.assertRegex(self.text, r"branches: \[main\]")
        m = re.search(r"paths:\n((?:\s+- .*\n)+)", self.text)
        self.assertIsNotNone(m, "deploy must have a paths filter")
        self.assertIn("app/**", m.group(1))
        self.assertIn("design/tokens.json", m.group(1))
        self.assertIn("--project-name=goserve-app", self.text)
        self.assertNotRegex(self.text, r"--project-name=goserve(?!-app)")
        for s in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
            self.assertIn(f"secrets.{s}", self.text)

    def test_s2_site_deploy_is_untouched(self):
        site = read("deploy.yml")
        self.assertIn("--project-name=goserve --branch=main", site)
        self.assertNotIn("app/", site)
        self.assertNotIn("site/", re.search(r"paths:\n((?:\s+- .*\n)+)", self.text).group(1))

    def test_release_list_carries_the_app_and_its_guard(self):
        root = os.path.join(WF, "..", "..")
        plan = open(os.path.join(root, "docs", "PLAN.md")).read()
        line = next(l for l in plan.splitlines() if "git checkout origin/dev --" in l)
        for path in ("site", "app", "scripts"):
            self.assertRegex(line, rf"\b{path}\b")
        self.assertIn("`app/`, `scripts/`", open(os.path.join(root, "CLAUDE.md")).read())


if __name__ == "__main__":
    unittest.main()
