# Story 822: the screen lock. Each test is one scenario of the story's acceptance list.
import os, subprocess, tempfile, unittest, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_screen_change as c

GOOD = "Design board: O0-Welcome\nApproved: 31 Oct 2026\nRender: https://github.com/o/r/actions/runs/1\n"
PIC = "app/tests/e2e/screens-baseline/welcome.png"
SRC = "app/src/screens/OtpSheet.tsx"


class Check(unittest.TestCase):
    def test_s1_board_and_date_but_no_render_fails_and_says_the_line_to_add(self):
        ok, out = c.check("Design board: O0\nApproved: 31 Oct 2026\n", [SRC])
        self.assertFalse(ok)
        text = "\n".join(out)
        self.assertIn("Render: <link", text)
        self.assertNotIn("Design board: <", text)

    def test_s1b_a_placeholder_is_not_a_value(self):
        ok, out = c.check("Design board: <name>\nApproved: <date>\nRender: <link>\n", [SRC])
        self.assertFalse(ok)
        self.assertEqual(sum(1 for l in out if l.startswith("  ")), 3)

    def test_s2_a_changed_picture_with_no_row_fails_and_names_the_picture(self):
        ok, out = c.check(GOOD, [SRC, PIC])
        self.assertFalse(ok)
        self.assertIn("Screen changed: welcome.png | <the board", "\n".join(out))

    def test_s2b_a_half_filled_row_still_fails(self):
        ok, _ = c.check(GOOD + "Screen changed: welcome.png | O0 |\n", [SRC, PIC])
        self.assertFalse(ok)

    def test_s3_a_changed_picture_naming_board_and_story_passes(self):
        ok, out = c.check(GOOD + "Screen changed: welcome.png | O0-Welcome | #803\n", [SRC, PIC])
        self.assertTrue(ok, out)

    def test_s3b_a_row_for_another_picture_does_not_cover_this_one(self):
        ok, _ = c.check(GOOD + "Screen changed: menu.png | O1 | #803\n", [SRC, PIC])
        self.assertFalse(ok)

    def test_s6_a_logic_only_change_needs_the_render_and_nothing_more(self):
        ok, _ = c.check("Render: https://github.com/o/r/actions/runs/1\n", ["app/src/lib/otp.ts"])
        self.assertTrue(ok)
        ok, out = c.check("", ["app/src/lib/otp.ts"])
        self.assertFalse(ok)
        self.assertEqual([l.strip().split(":")[0] for l in out if l.startswith("  ")], ["Render"])

    def test_s6b_a_changed_picture_asks_for_the_board_even_from_a_logic_file(self):
        ok, out = c.check("Render: https://github.com/o/r/actions/runs/1\n", ["app/src/lib/otp.ts", PIC])
        self.assertFalse(ok)
        self.assertIn("Design board: <", "\n".join(out))

    def test_s6c_screens_ui_and_styles_ask_for_the_board(self):
        for path in ("app/src/screens/A.tsx", "app/src/ui/ui.css", "app/src/styles/tokens.css"):
            ok, _ = c.check("Render: https://github.com/o/r/actions/runs/1\n", [path])
            self.assertFalse(ok, path)

    def test_s8_a_picture_only_change_is_asked_and_names_the_picture(self):
        ok, out = c.check("", [PIC])
        self.assertFalse(ok)
        text = "\n".join(out)
        self.assertIn("welcome.png", text)
        self.assertIn("replaces accepted screen pictures", text)
        self.assertNotIn("changes app/src", text)

    def test_s8b_the_same_change_with_board_date_render_and_row_passes(self):
        ok, out = c.check(GOOD + "Screen changed: welcome.png | O0-Welcome | #803\n", [PIC])
        self.assertTrue(ok, out)

    def test_s4_tests_other_than_the_pictures_and_supabase_are_not_asked(self):
        for path in ("app/tests/unit/x.test.ts", "app/tests/e2e/screens.spec.ts", "supabase/functions/otp/index.ts"):
            ok, out = c.check("", [path])
            self.assertTrue(ok)
            self.assertIn("skipped", out[0])

    def test_s5_promotions_and_back_merges_are_skipped(self):
        for base, head in (("main", "dev"), ("dev", "main")):
            ok, out = c.check("", [SRC], base, head)
            self.assertTrue(ok)
            self.assertIn("skipped", out[0])

    def test_s7_the_failure_never_points_at_a_rule_file(self):
        _, out = c.check("", [SRC, PIC])
        self.assertNotIn("CLAUDE.md", "\n".join(out))
        self.assertNotIn(".md", "\n".join(out))


class Git(unittest.TestCase):
    """The same, through a real repository and the command line."""
    def repo(self, files):
        d = tempfile.mkdtemp()
        g = lambda *a: subprocess.run(["git", "-C", d, *a], check=True, capture_output=True, text=True)
        g("init", "-q", "-b", "dev"); g("config", "user.email", "t@t"); g("config", "user.name", "t")
        open(os.path.join(d, "README.md"), "w").write("x"); g("add", "."); g("commit", "-qm", "chore: base")
        g("checkout", "-qb", "feat/x")
        for p in files:
            os.makedirs(os.path.dirname(os.path.join(d, p)), exist_ok=True)
            open(os.path.join(d, p), "w").write("y")
        g("add", "."); g("commit", "-qm", "feat(app): x")
        return d

    def test_main_exit_codes(self):
        d = self.repo([SRC, PIC])
        body = os.path.join(d, "body.txt")
        open(body, "w").write(GOOD)
        self.assertEqual(c.main(["--body-file", body, "--base", "dev", "--repo", d]), 1)
        open(body, "w").write(GOOD + "Screen changed: welcome.png | O0 | #803\n")
        self.assertEqual(c.main(["--body-file", body, "--base", "dev", "--repo", d]), 0)

    def test_head_main_is_skipped(self):
        d = self.repo([SRC])
        body = os.path.join(d, "body.txt"); open(body, "w").write("")
        self.assertEqual(c.main(["--body-file", body, "--base", "dev", "--repo", d, "--head", "main"]), 0)


if __name__ == "__main__":
    unittest.main()
