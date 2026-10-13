# Story #40, scenario S2: bad commits are blocked. Run: python3 -m unittest scripts/test_guard.py
import os, tempfile, unittest
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
        p = write(self.d, "b.txt", "-----BEGIN PRIVATE KEY-----\n")
        self.assertTrue(any("secret" in e for e in guard.check_files([p])))

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

    def test_pr_size(self):
        self.assertIsNone(guard.check_count(50))
        self.assertIsNotNone(guard.check_count(51))


if __name__ == "__main__":
    unittest.main()
