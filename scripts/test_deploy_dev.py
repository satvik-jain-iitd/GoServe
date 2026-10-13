# Story #41, S1 and S2: dev deploy runs for app/ only. Run: python3 -m unittest scripts/test_deploy_dev.py
import os, re, unittest

WF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".github", "workflows", "deploy-dev.yml")


class DeployDev(unittest.TestCase):
    def setUp(self):
        self.text = open(WF).read()

    def test_s1_push_to_dev_deploys_to_vercel(self):
        self.assertRegex(self.text, r"branches: \[dev\]")
        for s in ("VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"):
            self.assertIn(f"secrets.{s}", self.text)
        self.assertRegex(self.text, r"vercel(@\S+)? deploy --prebuilt --prod")

    def test_s2_site_changes_never_trigger_it(self):
        m = re.search(r"paths:\n((?:\s+- .*\n)+)", self.text)
        self.assertIsNotNone(m, "deploy must have a paths filter")
        paths = m.group(1)
        self.assertIn("app/**", paths)
        self.assertIn("design/tokens.json", paths)  # the app build imports it
        self.assertRegex(self.text, r"vercel@\d+ deploy")  # major version pinned
        self.assertNotIn("site/", paths)


if __name__ == "__main__":
    unittest.main()
