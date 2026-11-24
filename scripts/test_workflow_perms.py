# Workflow hardening (#944): every workflow has top-level read-only permissions, no github.base_ref inside a run: block, NUL-safe xargs.
# Plain text checks, no DB token needed. Run: python3 -m unittest scripts/test_workflow_perms.py
import glob, os, re, unittest

WF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".github", "workflows")
FILES = sorted(glob.glob(os.path.join(WF, "*.yml")))


def text(p):
    return open(p).read()


class WorkflowPerms(unittest.TestCase):
    def test_top_level_permissions(self):
        for p in FILES:
            self.assertRegex(text(p), r"(?m)^permissions:", os.path.basename(p))

    def test_no_base_ref_inline_in_run(self):
        lines = text(os.path.join(WF, "ci.yml")).splitlines()
        in_run, indent = False, 0
        for i, l in enumerate(lines, 1):
            m = re.match(r"^(\s*)(- )?run:\s*(.*)$", l)
            if m:
                in_run = True
                indent = len(m.group(1)) + (2 if m.group(2) else 0)
            elif in_run and l.strip() and len(l) - len(l.lstrip()) <= indent:
                in_run = False
            if in_run:
                self.assertNotIn("github.base_ref", l, f"ci.yml:{i}")

    def test_xargs_nul_safe(self):
        for p in FILES:
            for l in text(p).splitlines():
                if "xargs" in l and "git diff" in l:
                    self.assertIn("xargs -0", l, p)
                    self.assertIn("-z", l, p)


if __name__ == "__main__":
    unittest.main()
