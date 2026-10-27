"""Story #327 (D.1, epic E26): the Apple HIG notes cover every topic, each with a link, a tier and a confidence.
Scenario: Given the guidelines, when the notes are read, then they cover hierarchy, layout, type, motion, haptics, Live Activities, widgets and accessibility, with links.
Run: python3 -m unittest docs/tests/test_design_notes.py   (no network)"""
import os, re, unittest

NOTES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "design", "research-2026-10.md")
TOPICS = ["Hierarchy", "Layout", "Type", "Motion", "Haptics", "Live Activities", "Widgets", "Accessibility"]


class DesignNotes(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(NOTES), "docs/design/research-2026-10.md does not exist")
        self.text = open(NOTES, encoding="utf-8").read()

    def section(self, topic):
        m = re.search(rf"^## {re.escape(topic)}\n(.*?)(?=^## |\Z)", self.text, re.S | re.M)
        self.assertIsNotNone(m, f"no section '## {topic}'")
        return m.group(1)

    def test_every_topic_has_a_section_with_an_apple_link_a_tier_and_a_confidence(self):
        for t in TOPICS:
            s = self.section(t)
            self.assertRegex(s, r"https://developer\.apple\.com/design/human-interface-guidelines/\S+", f"{t}: no link")
            self.assertRegex(s, r"Tier A", f"{t}: no tier")
            self.assertRegex(s, r"[Cc]onfidence 0\.\d", f"{t}: no confidence")

    def test_the_notes_say_when_they_were_read_and_how(self):
        self.assertRegex(self.text, r"\*\*Read:\*\* \d{1,2} Oct 2026")
        self.assertIn("tutorials/data/design/human-interface-guidelines", self.text)   # the page text comes from Apple's own data files; the web pages are scripts


if __name__ == "__main__":
    unittest.main()
