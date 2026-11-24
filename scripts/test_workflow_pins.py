# Workflow pins (#944): third-party actions are pinned to a 40-hex commit SHA, and the vercel CLI to an exact version.
# Plain text checks, no DB token needed. Run: python3 -m unittest scripts/test_workflow_pins.py
import glob, os, re, unittest

WF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".github", "workflows")
FILES = sorted(glob.glob(os.path.join(WF, "*.yml")))


class WorkflowPins(unittest.TestCase):
    def test_actions_pinned_to_sha(self):
        for p in FILES:
            for n, l in enumerate(open(p).read().splitlines(), 1):
                m = re.search(r"^\s*(?:- )?uses:\s*(\S+)", l)
                if m and not m.group(1).startswith("./"):
                    self.assertRegex(m.group(1), r"@[0-9a-f]{40}$", f"{os.path.basename(p)}:{n}")

    def test_vercel_exact_version(self):
        t = open(os.path.join(WF, "deploy-dev.yml")).read()
        self.assertRegex(t, r"vercel@\d+\.\d+\.\d+ ")


if __name__ == "__main__":
    unittest.main()
