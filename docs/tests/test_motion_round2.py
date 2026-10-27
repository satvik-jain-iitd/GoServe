"""Story #511 (E26): the owner's round-2 motion feedback is on record.
Run: python3 -m unittest docs/tests/test_motion_round2.py   (no network)"""
import os, unittest

DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
read = lambda *p: open(os.path.join(DOCS, *p), encoding="utf-8").read()


class Round2(unittest.TestCase):
    def test_the_discussion_has_the_feedback(self):
        t = read("discussions", "2026-10-22.md")
        for w in ("stepped-taper zigzag is rejected", "up to 3.0 s", "once per day", "never at night", "flicker"):
            self.assertIn(w, t)

    def test_the_principle_and_the_five_ideas_are_there(self):
        self.assertIn("No animation spec or annotation inside a final design screen", read("owner-principles.md"))
        ideas = read("ideas.md")
        for i in range(268, 273):
            self.assertIn(f"- ID{i} ", ideas)


if __name__ == "__main__":
    unittest.main()
