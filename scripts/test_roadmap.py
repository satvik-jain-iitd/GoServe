# Story #239 (epic E21): the roadmap renderer. A fixture of issues and PRs goes in; one HTML page comes out.
# Run: python3 -m unittest scripts/test_roadmap.py  (no token, no network: the fixture replaces gh)
import os, re, sys, unittest
from datetime import datetime, timedelta
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


# ---- Story #247: the deploy step. A fake wrangler replaces the real one; no network, no token. ----
import stat, tempfile


class Deploy(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.page = os.path.join(self.d, "index.html")
        open(self.page, "w").write("<html>updated 09:05</html>")
        self.log = os.path.join(self.d, "wrangler.log")
        self.fake = os.path.join(self.d, "fake-wrangler")
        # records its arguments, the two Cloudflare variables, and the file names in the folder it was asked to deploy
        open(self.fake, "w").write('#!/bin/sh\necho "ARGS $*" > "%s"\necho "TOKEN $CLOUDFLARE_API_TOKEN ACCOUNT $CLOUDFLARE_ACCOUNT_ID" >> "%s"\nls "$3" >> "%s"\n' % (self.log, self.log, self.log))
        os.chmod(self.fake, os.stat(self.fake).st_mode | stat.S_IEXEC)
        self.vault = os.path.join(self.d, "03_cloudflare.env")

    def test_the_token_and_account_come_from_the_vault_file_and_only_the_page_is_deployed(self):
        open(self.vault, "w").write("CLOUDFLARE_ROADMAP_TOKEN=tok123\nCLOUDFLARE_ACCOUNT_ID=acc456\nOTHER=x\n")
        code, msg = roadmap.deploy(self.page, self.vault, [self.fake])
        self.assertEqual(code, 0, msg)
        log = open(self.log).read()
        self.assertRegex(log, r"ARGS pages deploy \S+ --project-name=goserve-roadmap --branch=main")
        self.assertIn("TOKEN tok123 ACCOUNT acc456", log)
        self.assertEqual(log.strip().splitlines()[-1], "index.html")   # nothing else (README, scripts) goes public
        self.assertNotIn("tok123", log.splitlines()[0])   # the token is in the environment, never in the arguments

    def test_a_missing_token_names_the_variable_and_deploys_nothing(self):
        open(self.vault, "w").write("CLOUDFLARE_ACCOUNT_ID=acc456\n")
        code, msg = roadmap.deploy(self.page, self.vault, [self.fake])
        self.assertNotEqual(code, 0)
        self.assertIn("CLOUDFLARE_ROADMAP_TOKEN", msg)
        self.assertFalse(os.path.exists(self.log))

    def test_a_missing_vault_file_is_the_same_loud_failure(self):
        code, msg = roadmap.deploy(self.page, os.path.join(self.d, "nope.env"), [self.fake])
        self.assertNotEqual(code, 0)
        self.assertIn("CLOUDFLARE_ROADMAP_TOKEN", msg)
        self.assertIn("CLOUDFLARE_ACCOUNT_ID", msg)

    def test_a_failing_wrangler_fails_loud(self):
        open(self.vault, "w").write("CLOUDFLARE_ROADMAP_TOKEN=t\nCLOUDFLARE_ACCOUNT_ID=a\n")
        open(self.fake, "w").write("#!/bin/sh\necho boom >&2\nexit 3\n")
        code, msg = roadmap.deploy(self.page, self.vault, [self.fake])
        self.assertEqual(code, 3)
        self.assertIn("boom", msg)

    def test_the_page_is_written_even_when_the_deploy_fails(self):
        out = os.path.join(self.d, "out", "index.html")
        old = (roadmap.OUT, roadmap.fetch_issues, roadmap.fetch_prs, roadmap.vision_text, roadmap.DEFAULT_VAULT)
        try:
            roadmap.OUT, roadmap.fetch_issues, roadmap.fetch_prs, roadmap.vision_text = out, lambda: ISSUES, lambda: PRS, lambda: "v"
            roadmap.DEFAULT_VAULT = os.path.join(self.d, "missing.env")
            self.assertNotEqual(roadmap.main(["--deploy"]), 0)
            self.assertTrue(os.path.exists(out))
        finally:
            roadmap.OUT, roadmap.fetch_issues, roadmap.fetch_prs, roadmap.vision_text, roadmap.DEFAULT_VAULT = old


# ---- Story R4 (plan v2): roadmap v2. Timeline by close day, start and cycle time, You are here, Next order, Delivered date range. ----
def issue(n, title, state="OPEN", labels=("story",), closed=None, doing=None, ms=None, body=None, parent=None):
    return {"number": n, "title": title, "body": body or f"Part of epic E9 (#9).\n\n## Business\n{title} works.", "state": state, "labels": list(labels),
            "closedAt": closed, "doing_at": doing, "milestone": ms, "parent": parent}
M1 = {"title": "M1 MVP2", "dueOn": "2026-10-27T18:29:00Z"}
M2 = {"title": "M2 Design", "dueOn": "2026-10-28T18:29:00Z"}
V2 = [
    issue(9, "Epic E9: Plan v2", labels=("epic",), body="## Business\nOne plan."),
    issue(20, "Story A done early", "CLOSED", closed="2026-10-24T20:00:00Z", doing="2026-10-24T18:00:00Z", ms=M1),     # IST 25 Oct 01:30, took 2 h
    issue(21, "Story B done late", "CLOSED", closed="2026-10-25T06:00:00Z", doing="2026-10-25T05:15:00Z", ms=M1),     # IST 25 Oct 11:30, took 45 min
    issue(22, "Story C done no start", "CLOSED", closed="2026-10-23T06:00:00Z", ms=M1),                              # no doing label ever
    issue(23, "Story D in progress", labels=("story", "doing", "P0"), doing="2026-10-26T04:00:00Z", ms=M1),
    issue(24, "Story E ready p1", labels=("story", "ready", "P1"), ms=M1),
    issue(25, "Story F ready p0 later milestone", labels=("story", "ready", "P0"), ms=M2),
    issue(26, "Story G ready p0 first", labels=("story", "ready", "P0"), ms=M1),
    issue(40, "Story old open, no plan labels", ms=M1),
    issue(27, "Story H blocked", labels=("story", "blocked", "P0"), ms=M1, body="Part of epic E9 (#9).\n\n## Business\nH works.\n\n## Needs\nNeeds: #23\nNeeds: #26"),
]
NOW = datetime(2026, 10, 26, 11, 0)   # IST, naive like the page clock


class RoadmapV2(unittest.TestCase):
    def setUp(self):
        self.model = roadmap.build(V2, [])
        self.html = roadmap.render(self.model, "Vision.", NOW)

    def test_the_timeline_groups_closed_stories_by_india_close_day_newest_first(self):
        days = [(d["day"], [s["number"] for s in d["stories"]]) for d in self.model["timeline"]]
        self.assertEqual(days, [("2026-10-25", [21, 20]), ("2026-10-23", [22])])   # 20 closed at 01:30 IST on the 25th, not the 24th UTC
        tl = self.html.split('id="timeline"')[1].split("</section>")[0]
        self.assertLess(tl.index("25 Oct"), tl.index("23 Oct"))

    def test_start_is_the_first_doing_label_and_cycle_time_is_close_minus_start(self):
        by = {s["number"]: s for s in self.model["stories"]}
        self.assertEqual((by[20]["cycle_min"], by[21]["cycle_min"], by[22]["cycle_min"]), (120, 45, None))
        tl = self.html.split('id="timeline"')[1].split("</section>")[0]
        self.assertIn("2 h", tl)
        self.assertIn("45 min", tl)
        self.assertIn("no start time", tl)   # honest: the story was never marked doing

    def test_you_are_here_shows_now_the_story_in_progress_and_the_next_ready_story(self):
        here = self.model["here"]
        self.assertEqual([s["number"] for s in here["doing"]], [23])
        self.assertEqual(here["next"]["number"], 26)   # P0 in the earliest milestone, then lowest number
        h = self.html.split('id="here"')[1].split("</section>")[0]
        self.assertIn("11:00", h)
        self.assertIn("Story D in progress", h)
        self.assertIn("since 09:30", h)   # 04:00 UTC is 09:30 IST
        self.assertIn("Story G ready p0 first", h)

    def test_next_is_sorted_by_milestone_then_priority_then_number_and_marks_blocked(self):
        order = [s["number"] for s in self.model["next"]]
        self.assertEqual(order, [26, 27, 24, 25])   # M1 first: P0 (26, 27) then P1 (24); M2 last. Doing and done stories are not in Next.
        nx = self.html.split('id="next"')[1].split("</section>")[0]
        self.assertIn("blocked by #23, #26", nx)

    def test_stories_without_a_ready_or_blocked_label_are_older_work_and_stay_out_of_next(self):
        self.assertNotIn(40, [s["number"] for s in self.model["next"]])
        self.assertEqual([s["number"] for s in self.model["older"]], [40])
        self.assertIn("Story old open, no plan labels", self.html.split('id="older"')[1])

    def test_needs_lines_become_numbers(self):
        by = {s["number"]: s for s in self.model["stories"]}
        self.assertEqual(by[27]["needs"], [23, 26])
        self.assertEqual(by[26]["needs"], [])

    def test_delivered_epics_show_their_date_range(self):
        issues = V2 + [issue(30, "Epic E8: Old", "CLOSED", labels=("epic",), closed="2026-10-25T07:00:00Z", body="## Business\nOld work."),
                       issue(31, "Story old one", "CLOSED", closed="2026-10-21T08:00:00Z", parent={"number": 30}),
                       issue(32, "Story old two", "CLOSED", closed="2026-10-25T07:00:00Z", parent={"number": 30})]
        html = roadmap.render(roadmap.build(issues, []), "v", NOW)
        d = html.split('id="delivered"')[1].split('id="here"')[0]
        self.assertIn("21 Oct to 25 Oct", d)
        self.assertNotIn("<details open", d)   # collapsed


class IndiaClock(unittest.TestCase):
    def test_the_page_clock_is_india_time_even_when_the_machine_runs_in_utc(self):
        # A GitHub runner has no India time zone: the page must still say India time (review of #436).
        import io, time, contextlib
        old_tz = os.environ.get("TZ")
        os.environ["TZ"] = "UTC"; time.tzset()
        saved = (roadmap.fetch_issues, roadmap.fetch_prs, roadmap.vision_text)
        try:
            roadmap.fetch_issues, roadmap.fetch_prs, roadmap.vision_text = lambda: [], lambda: [], lambda: "v"
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                roadmap.main(["--print"])
            from datetime import timezone
            want = {(datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=5, minutes=30) + timedelta(minutes=k)).strftime("%H:%M") for k in (-1, 0, 1)}
            self.assertTrue(any(f"updated {w}" in buf.getvalue() for w in want), buf.getvalue()[buf.getvalue().index("updated"):][:30])
        finally:
            roadmap.fetch_issues, roadmap.fetch_prs, roadmap.vision_text = saved
            if old_tz is None: os.environ.pop("TZ", None)
            else: os.environ["TZ"] = old_tz
            time.tzset()


if __name__ == "__main__":
    unittest.main()
