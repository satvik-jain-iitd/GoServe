# Story 835: the dev deploy must not depend on whatever "latest" Supabase CLI is that day, and a non-interactive run must be allowed to confirm a multi-function deploy.
# Scenario: Given the Backend workflow, then the CLI version is pinned (not latest) and the deploy command carries --yes.
import os, re, unittest

WF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".github", "workflows", "backend.yml")


class BackendWorkflow(unittest.TestCase):
    def setUp(self):
        with open(WF, encoding="utf-8") as f:
            self.text = f.read()

    def test_s1_the_supabase_cli_version_is_pinned_not_latest(self):
        m = re.search(r"supabase/setup-cli@v1\s+with:\s+version:\s*([^\s#]+)", self.text)
        self.assertIsNotNone(m, "setup-cli step with a version not found")
        self.assertNotEqual(m.group(1).lower(), "latest")
        self.assertRegex(m.group(1), r"^\d+\.\d+\.\d+$")

    def test_s2_the_deploy_may_confirm_without_a_terminal(self):
        line = next(l for l in self.text.splitlines() if "supabase functions deploy" in l)
        self.assertIn("--yes", line)


if __name__ == "__main__":
    unittest.main()
