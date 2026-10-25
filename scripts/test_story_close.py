"""Story R4 (plan v2, L10): a merged pull request closes its stories with the time, and the epic when its last story closes.
Run: python3 scripts/test_story_close.py   (no network: a fake `gh` answers)"""
import json, os, re, sys, unittest
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import story_close

WF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".github", "workflows")
NOW = datetime(2026, 10, 26, 14, 5)   # India time, as the script passes it


class FakeGh:
    """issues: {n: {"state", "labels": [..], "parent": n or None, "subs": [n..]}}. Records every write as (verb, number, detail)."""
    def __init__(self, issues):
        self.issues, self.writes = issues, []

    def __call__(self, *args):
        a = list(args)
        path = next(x for x in a if x.startswith("repos/"))
        m = re.match(r"repos/[^/]+/[^/]+/issues/(\d+)(/parent|/sub_issues.*|/comments|/labels/doing)?$", path)
        n, tail = int(m.group(1)), m.group(2) or ""
        method = a[a.index("-X") + 1] if "-X" in a else "GET"
        if method == "GET" and tail == "":
            i = self.issues[n]
            return json.dumps({"number": n, "state": i["state"], "labels": [{"name": l} for l in i["labels"]]})
        if method == "GET" and tail == "/parent":
            p = self.issues[n]["parent"]
            if p is None: raise story_close.NotFound()
            return json.dumps({"number": p})
        if method == "GET" and tail.startswith("/sub_issues"):
            return json.dumps([{"number": s, "state": self.issues[s]["state"]} for s in self.issues[n]["subs"]])
        if method == "POST" and tail == "/comments":
            self.writes.append(("comment", n, next(x.split("=", 1)[1] for x in a if x.startswith("body="))))
        elif method == "PATCH":
            self.issues[n]["state"] = "closed"; self.writes.append(("close", n, ""))
        elif method == "DELETE":
            self.writes.append(("unlabel", n, "doing"))
        return "{}"


def pr(body, merged=True, number=77, base="dev"):
    return {"number": number, "merged": merged, "body": body, "base": base}


class StoryClose(unittest.TestCase):
    def issues(self):
        return {5: {"state": "open", "labels": ["story", "doing"], "parent": 1, "subs": []},
                6: {"state": "open", "labels": ["story"], "parent": 1, "subs": []},
                7: {"state": "open", "labels": ["story"], "parent": 1, "subs": []},
                1: {"state": "open", "labels": ["epic"], "parent": None, "subs": [5, 6, 7]}}

    def test_the_closing_words_are_found(self):
        self.assertEqual(story_close.closing_issues("Closes #5, fixes #6.\nResolved: #7 and see #8"), [5, 6, 7])
        self.assertEqual(story_close.closing_issues("Part of #5. Not closing words."), [])
        self.assertEqual(story_close.closing_issues("closes #5 closes #5"), [5])

    def test_the_time_is_india_time(self):
        self.assertEqual(story_close.stamp(NOW), "26 Oct 14:05 IST")

    def test_a_merged_pr_closes_its_story_with_a_comment_and_removes_doing(self):
        g = FakeGh(self.issues())
        story_close.run(pr("Closes #5"), g, NOW)
        self.assertIn(("unlabel", 5, "doing"), g.writes)
        self.assertIn(("comment", 5, "■ Closed 26 Oct 14:05 IST by PR #77"), g.writes)
        self.assertIn(("close", 5, ""), g.writes)
        self.assertEqual([w for w in g.writes if w[1] == 6], [])

    def test_a_pr_closed_without_merge_changes_nothing(self):
        g = FakeGh(self.issues())
        story_close.run(pr("Closes #5", merged=False), g, NOW)
        self.assertEqual(g.writes, [])

    def test_a_story_that_is_already_closed_is_left_alone(self):
        i = self.issues(); i[5]["state"] = "closed"
        g = FakeGh(i)
        story_close.run(pr("Closes #5"), g, NOW)
        self.assertEqual([w for w in g.writes if w[1] == 5], [])

    def test_the_epic_closes_only_when_its_last_story_closes(self):
        i = self.issues(); i[6]["state"] = "closed"; i[7]["state"] = "closed"
        g = FakeGh(i)
        story_close.run(pr("Closes #5"), g, NOW)
        self.assertIn(("close", 1, ""), g.writes)
        self.assertTrue(any(w[0] == "comment" and w[1] == 1 and "every story is closed" in w[2] for w in g.writes))
        g2 = FakeGh(self.issues())
        story_close.run(pr("Closes #5"), g2, NOW)
        self.assertEqual([w for w in g2.writes if w[1] == 1], [])   # 6 and 7 are still open

    def test_a_pr_without_closing_words_changes_nothing(self):
        g = FakeGh(self.issues())
        story_close.run(pr("Part of #5"), g, NOW)
        self.assertEqual(g.writes, [])


class Workflows(unittest.TestCase):
    def read(self, name):
        return open(os.path.join(WF, name)).read()

    def test_story_close_runs_on_a_merged_pr_into_the_three_code_and_doc_branches(self):
        t = self.read("story-close.yml")
        self.assertRegex(t, r"pull_request:\s*\n\s*types:\s*\[closed\]")
        self.assertRegex(t, r"branches:\s*\[dev, staging, documents\]")
        self.assertIn("github.event.pull_request.merged == true", t)
        self.assertIn("scripts/story_close.py", t)
        self.assertRegex(t, r"permissions:\s*\n\s*issues:\s*write")
        self.assertNotIn("contents: write", t)

    def test_roadmap_runs_every_15_minutes_and_on_issue_and_pr_events_and_deploys_to_the_pages_project(self):
        t = self.read("roadmap.yml")
        self.assertIn("cron: \"*/15 * * * *\"", t)
        for ev in ("issues:", "pull_request:", "workflow_dispatch:"):
            self.assertIn(ev, t)
        self.assertIn("scripts/roadmap.py", t)
        self.assertIn("pages project create goserve-roadmap", t)   # created when missing
        self.assertIn("pages deploy site --project-name=goserve-roadmap --branch=main", t)
        self.assertIn("${{ secrets.CLOUDFLARE_API_TOKEN }}", t)
        self.assertRegex(t, r"uses: cloudflare/wrangler-action@[0-9a-f]{40} # v3")   # the action receives the token: pinned to a commit
        self.assertRegex(t, r"permissions:\s*\n\s*contents: read\s*\n\s*issues: read\s*\n\s*pull-requests: read")
        self.assertRegex(t, r"concurrency:\s*\n\s*group: roadmap")

    def test_only_index_html_is_deployed(self):
        t = self.read("roadmap.yml")
        self.assertRegex(t, r"mkdir -p site\s*\n\s*cp docs/roadmap/index\.html site/index\.html")


if __name__ == "__main__":
    unittest.main()
