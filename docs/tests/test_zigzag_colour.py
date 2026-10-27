"""Story (E26): the owner's rule that the light zigzag colour #bfcfb4 is deliberate is on record, with the learning in five parts.
Run: python3 -m unittest docs/tests/test_zigzag_colour.py   (no network)"""
import os, unittest

DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
read = lambda *p: open(os.path.join(DOCS, *p), encoding="utf-8").read()


class ZigzagColour(unittest.TestCase):
    def test_the_discussion_says_do_not_darken_it(self):
        self.assertIn("the light zigzag colour #bfcfb4 is deliberate; do not darken it", read("discussions", "2026-10-22.md"))

    def test_the_learning_has_all_five_parts(self):
        row = next(l for l in read("LEARNINGS.md").splitlines() if "#bfcfb4" in l)
        for part in ("Situation:", "Root cause:", "Fix:", "Applies when:", "Does not apply to:"):
            self.assertIn(part, row)


if __name__ == "__main__":
    unittest.main()
