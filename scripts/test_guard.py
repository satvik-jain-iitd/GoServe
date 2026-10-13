# Story #40, scenario S2: bad commits are blocked. Run: python3 -m unittest scripts/test_guard.py
import os, re, tempfile, unittest
import guard


def write(d, name, text, size=None):
    p = os.path.join(d, name)
    with open(p, "w") as f:
        f.write(text if size is None else "x" * size)
    return p


class Guard(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()

    def test_clean_file_passes(self):
        self.assertEqual(guard.check_files([write(self.d, "a.md", "# Hi\n\n```py\nx\n```\n")]), [])

    def test_secret_is_blocked(self):
        p = write(self.d, "a.ts", 'const k = "sk-or-v1-' + "a" * 40 + '";\n')
        self.assertTrue(any("secret" in e for e in guard.check_files([p])))
        p = write(self.d, "b.txt", "-----BEGIN " + "PRIVATE KEY-----\n")
        self.assertTrue(any("secret" in e for e in guard.check_files([p])))
        # one sample per remaining pattern; built from parts so this file stays clean
        for sample in ["sk-" + "ant-" + "a" * 30, "ghp" + "_" + "a" * 36, "github" + "_pat_" + "a" * 40,
                       "AK" + "IA" + "A" * 16, "sk" + "_live_" + "a" * 24,
                       "ey" + "J" + "a" * 20 + ".ey" + "J" + "a" * 20 + "." + "a" * 12]:
            p = write(self.d, "c.txt", sample + "\n")
            self.assertTrue(any("secret" in e for e in guard.check_files([p])), sample[:8])

    def test_big_file_is_blocked(self):
        p = write(self.d, "big.bin", "", size=600 * 1024)
        self.assertTrue(any("500KB" in e for e in guard.check_files([p])))

    def test_merge_marker_is_blocked(self):
        p = write(self.d, "a.md", "a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> x\n")
        self.assertTrue(any("merge marker" in e for e in guard.check_files([p])))

    def test_unclosed_code_block_is_blocked(self):
        p = write(self.d, "a.md", "# Hi\n\n```py\nx = 1\n")
        self.assertTrue(any("code block" in e for e in guard.check_files([p])))

    def test_commit_messages(self):
        for ok in ["feat(app): add cart", "fix: stop crash", "docs: update plan (#57)", "chore(ci): pin node"]:
            self.assertIsNone(guard.check_message(ok), ok)
        for bad in ["updated stuff", "Feat: caps", "feat:no space", "feat: " + "x" * 80, ""]:
            self.assertIsNotNone(guard.check_message(bad), bad)

    def test_guard_passes_on_itself(self):
        here = os.path.dirname(os.path.abspath(__file__))
        files = [os.path.join(here, f) for f in os.listdir(here) if f.endswith(".py")]
        self.assertEqual(guard.check_files(files), [])

    def test_commit_guidelines_match_regex(self):
        doc = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "COMMIT_GUIDELINES.md")).read()
        types = re.search(r"- Types: (.*)\.", doc).group(1).replace("`", "").split(", ")
        for t in types:
            self.assertIsNone(guard.check_message(t + ": x"), t)
        self.assertIsNotNone(guard.check_message("nope: x"))
        self.assertEqual(set(types), set(guard.MESSAGE.pattern.split("(")[1].split(")")[0].split("|")))

    def test_pr_size(self):
        self.assertIsNone(guard.check_count(50))
        self.assertIsNotNone(guard.check_count(51))


if __name__ == "__main__":
    unittest.main()
