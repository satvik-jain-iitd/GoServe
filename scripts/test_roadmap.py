# Story #239 (epic E21): the roadmap renderer. A fixture of issues and PRs goes in; one HTML page comes out.
# Run: python3 -m unittest scripts/test_roadmap.py  (no token, no network: the fixture replaces gh)
import os, re, sys, unittest
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import roadmap

STORY = "Part of epic E1 (#1).\n\n## Business\nA cook sees a cancelled ticket for a minute. The PR adds a stamp.\n\n## Product\n- rpc and migration words here."
ISSUES = [
    {"number": 1, "title": "Epic E1: Kitchen app", "body": "## Business\nThe cook has one screen.", "state": "CLOSED", "labels": ["epic"], "closedAt": "2026-10-20T10:00:00Z", "parent": None},
    {"number": 2, "title": "Epic E2: Cash", "body": "## Business\nCash adds up.", "state": "OPEN", "labels": ["epic"], "closedAt": None, "parent": None},
    {"number": 10, "title": "Story: cancelled ticket", "body": STORY, "state": "CLOSED", "labels": ["story"], "closedAt": "2026-10-21T10:00:00Z", "parent": None},
    {"number": 11, "title": "Story: cash day", "body": "Part of epic E2 (#2).\n\n## Business\nThe rider's cash adds up at the end of the night.", "state": "OPEN", "labels": ["story"], "closedAt": None, "parent": None},
    {"number": 12, "title": "Story: hand-over", "body": "## Business\nThe kitchen confirms the rider's cash.", "state": "OPEN", "labels": ["story"], "closedAt": None, "parent": {"number": 2}},
    {"number": 13, "title": "Story: no words yet", "body": "Part of epic E2 (#2).\n\nJust a title.", "state": "OPEN", "labels": ["story"], "closedAt": None, "parent": None},
    {"number": 99, "title": "A bug, not a story", "body": "", "state": "OPEN", "labels": ["bug"], "closedAt": None, "parent": None},
]
PRS = [
    {"number": 50, "title": "feat(app): cash day (#11)", "headRefName": "feat/11-cash-day", "isDraft": False, "checks": [{"conclusion": "SUCCESS"}, {"conclusion": "SUCCESS"}]},
    {"number": 51, "title": "feat(app): hand-over", "headRefName": "feat/12-handover", "isDraft": False, "checks": [{"conclusion": "FAILURE"}]},
]
JARGON = re.compile(r"\b(PR|CI|rpc|migration|e2e)\b")


class Roadmap(unittest.TestCase):
    def setUp(self):
        self.model = roadmap.build(ISSUES, PRS)
        self.html = roadmap.render(self.model, "Hot meals at your door.", datetime(2026, 10, 25, 9, 5))

    def test_every_open_story_is_on_the_board_once(self):
        board = self.html.split('id="board"')[1]
        for n in (11, 12, 13):
            self.assertEqual(board.count(f'data-story="{n}"'), 1, n)
        self.assertNotIn('data-story="99"', self.html)   # a bug is not a story

    def test_columns_follow_the_pull_requests(self):
        cols = {s["number"]: s["column"] for s in self.model["stories"]}
        self.assertEqual(cols, {10: "Done", 11: "Review", 12: "Doing", 13: "To do"})   # green checks = Review, red = Doing, no PR = To do

    def test_closed_epic_is_under_delivered_with_its_story_sentence(self):
        delivered = self.html.split('id="delivered"')[1].split('id="now"')[0]
        self.assertIn("Kitchen app", delivered)
        self.assertIn("A cook sees a cancelled ticket for a minute.", delivered)   # the first sentence only
        self.assertNotIn("The PR adds a stamp", delivered)
        self.assertNotIn("Cash", delivered.split("</details>")[0])   # the open epic is not delivered

    def test_the_epic_comes_from_the_parent_link_or_the_part_of_line(self):
        epics = {s["number"]: s["epic"] for s in self.model["stories"]}
        self.assertEqual(epics, {10: 1, 11: 2, 12: 2, 13: 2})

    def test_no_jargon_outside_the_board_and_a_count_of_stories_without_words(self):
        outside = self.html.split('id="board"')[0]
        self.assertEqual(JARGON.findall(outside), [])
        self.assertIn("1 story still needs plain words", self.html)
        self.assertIn("Story: no words yet", self.html)   # the title stands in

    def test_now_lists_the_open_pull_requests_and_the_page_says_when(self):
        now = self.html.split('id="now"')[1].split('id="next"')[0]
        self.assertIn("The rider&#x27;s cash adds up at the end of the night.", now)   # the plain sentence, not the title
        self.assertIn("The kitchen confirms the rider&#x27;s cash.", now)
        self.assertIn("review", now)
        self.assertIn("doing", now)
        self.assertIn("updated 09:05", self.html)
        self.assertIn('http-equiv="refresh" content="300"', self.html)


if __name__ == "__main__":
    unittest.main()
