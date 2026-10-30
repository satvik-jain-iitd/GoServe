#!/usr/bin/env python3
"""Plan v2, lifecycle step L10: a merged pull request closes the stories it names, with the time, and closes the epic when its last story closes.
GitHub closes issues by itself only when a PR merges into the default branch (main); ours merge into dev and documents.
Usage (from .github/workflows/story-close.yml): story_close.py <pr number>   (needs GH_TOKEN, reads the PR with `gh`)"""
from __future__ import annotations
import json, re, subprocess, sys
from datetime import datetime, timedelta, timezone

REPO = "satvik-jain-iitd/GoServe"
WORDS = re.compile(r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s*#(\d+)", re.I)
IST = timedelta(hours=5, minutes=30)


class NotFound(Exception):
    pass


def closing_issues(body: str) -> list:
    """Issue numbers named after a closing word, once each, in order."""
    out: list = []
    for n in (int(x) for x in WORDS.findall(body or "")):
        if n not in out:
            out.append(n)
    return out


def stamp(now: datetime) -> str:
    """`now` is naive India time."""
    return f"{now.day} {now.strftime('%b %H:%M')} IST"


def gh(*args: str) -> str:
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if r.returncode:
        if "404" in r.stderr or "Not Found" in r.stderr:
            raise NotFound()
        raise SystemExit("gh failed: " + " ".join(args)[:100] + "\n" + r.stderr[:300])
    return r.stdout


def run(pr: dict, gh_call, now: datetime) -> None:
    if not pr["merged"]:
        return
    base = f"repos/{REPO}/issues"
    for n in closing_issues(pr["body"]):
        issue = json.loads(gh_call("api", f"{base}/{n}"))
        if issue["state"] != "open":
            continue
        labels = {l["name"] for l in issue["labels"]}
        if "doing" in labels:
            gh_call("api", "-X", "DELETE", f"{base}/{n}/labels/doing")
        gh_call("api", "-X", "POST", f"{base}/{n}/comments", "-f", f"body=■ Closed {stamp(now)} by PR #{pr['number']}")
        gh_call("api", "-X", "PATCH", f"{base}/{n}", "-f", "state=closed", "-f", "state_reason=completed")
        try:
            parent = json.loads(gh_call("api", f"{base}/{n}/parent"))["number"]
        except NotFound:
            continue
        subs = json.loads(gh_call("api", f"{base}/{parent}/sub_issues?per_page=100"))
        if subs and all(s["state"] == "closed" for s in subs) and json.loads(gh_call("api", f"{base}/{parent}"))["state"] == "open":
            gh_call("api", "-X", "POST", f"{base}/{parent}/comments", "-f", f"body=■ Closed {stamp(now)}: every story is closed (last one #{n}, PR #{pr['number']})")
            gh_call("api", "-X", "PATCH", f"{base}/{parent}", "-f", "state=closed", "-f", "state_reason=completed")


def main(argv: list) -> int:
    num = int(argv[0])
    data = json.loads(gh("pr", "view", str(num), "--repo", REPO, "--json", "number,body,mergedAt,baseRefName"))
    pr = {"number": data["number"], "merged": bool(data.get("mergedAt")), "body": data.get("body") or "", "base": data["baseRefName"]}
    run(pr, gh, datetime.now(timezone.utc).replace(tzinfo=None) + IST)
    print(f"PR #{num}: merged={pr['merged']}, closing {closing_issues(pr['body']) if pr['merged'] else []}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
