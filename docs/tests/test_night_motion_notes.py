"""Story #506 (E26): the Night lamp idea and the motion framework notes are in the repo, unchanged, and nothing is built from them yet.
Run: python3 -m unittest docs/tests/test_night_motion_notes.py   (no network)"""
import os, unittest

DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


class Notes(unittest.TestCase):
    def test_both_notes_exist_and_are_not_empty(self):
        for f in ("night-lamp.md", "motion-framework.md"):
            self.assertGreater(len(open(os.path.join(DOCS, "design", f), encoding="utf-8").read()), 1000, f)

    def test_the_night_lamp_idea_is_logged(self):
        self.assertIn("- ID225 ", open(os.path.join(DOCS, "ideas.md"), encoding="utf-8").read())


if __name__ == "__main__":
    unittest.main()
