"""Story #328 (D.2, epic E26): every Apple topic of the HIG notes has an Android equivalent in the Material 3 and Live Updates notes.
Scenario: Given the Material 3 notes, when each Apple rule is listed, then it has an Android equivalent.
Run: python3 -m unittest docs/tests/test_android_notes.py   (no network)"""
import os, re, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
APPLE = os.path.join(HERE, "..", "design", "research-2026-10.md")
ANDROID = os.path.join(HERE, "..", "design", "research-android-2026-10.md")


class AndroidNotes(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(ANDROID), "docs/design/research-android-2026-10.md does not exist")
        self.text = open(ANDROID, encoding="utf-8").read()
        apple = open(APPLE, encoding="utf-8").read()
        self.topics = re.findall(r"^## (Hierarchy|Layout|Type|Motion|Haptics|Live Activities|Widgets|Accessibility)$", apple, re.M)

    def test_the_apple_topics_are_all_found(self):
        self.assertEqual(len(self.topics), 8)

    def test_every_apple_topic_has_a_row_with_an_android_rule_a_link_and_a_confidence(self):
        for t in self.topics:
            row = next((l for l in self.text.splitlines() if l.startswith(f"| {t} |")), None)
            self.assertIsNotNone(row, f"no row for {t}")
            cells = [c.strip() for c in row.strip("|").split("|")]
            self.assertGreaterEqual(len(cells), 5, row)
            self.assertTrue(cells[2], f"{t}: empty Android equivalent")
            self.assertRegex(cells[3], r"https://(developer\.android\.com|m3\.material\.io)/\S+", f"{t}: no link")
            self.assertRegex(cells[4], r"^0\.\d", f"{t}: no confidence")

    def test_what_was_not_read_is_listed_as_a_gap_and_the_notes_say_how_they_were_read(self):
        self.assertIn("## Gaps", self.text)
        self.assertRegex(self.text, r"\*\*Read:\*\* \d{1,2} Oct 2026")


if __name__ == "__main__":
    unittest.main()
