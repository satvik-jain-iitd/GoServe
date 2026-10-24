#!/usr/bin/env python3
"""Story #239 (epic E21): the live roadmap page.

Reads the repo's epics, stories and open pull requests with `gh`, and writes docs/roadmap/index.html: Vision, Delivered,
Now, Next and a Board. Plain words: a story's roadmap text is the first sentence of its "## Business" section.
Run: python3 scripts/roadmap.py            (writes the page)
     python3 scripts/roadmap.py --print    (prints the page, writes nothing)
A launchd job (ops/launchd/com.goserve.roadmap.plist) runs it every 15 minutes.
"""
from __future__ import annotations   # /usr/bin/python3 under launchd may be 3.9
import html, json, os, re, subprocess, sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "roadmap", "index.html")
REPO = "satvik-jain-iitd/GoServe"
COLUMNS = ("To do", "Doing", "Review", "Done")
# Words a stranger does not need. Only the Board cards may use them; everywhere else they are swapped for plain ones.
PLAIN = [(re.compile(r"\bPRs?\b"), "change"), (re.compile(r"\bCI\b"), "the checks"), (re.compile(r"\brpc\b", re.I), "server call"),
         (re.compile(r"\bmigrations?\b", re.I), "database change"), (re.compile(r"\be2e\b", re.I), "end-to-end test")]
ISSUE_QUERY = """query($after: String) { repository(owner: "satvik-jain-iitd", name: "GoServe") {
  issues(first: 100, after: $after, orderBy: {field: CREATED_AT, direction: ASC}) { pageInfo { hasNextPage endCursor }
    nodes { number title body state closedAt labels(first: 10) { nodes { name } } parent { number } } } } }"""


def gh(*args: str) -> str:
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def fetch_issues() -> list:
    """Every issue, with its labels as names and its parent issue (sub-issues), in one list."""
    out, after = [], None
    while True:
        page = json.loads(gh("api", "graphql", "-f", f"query={ISSUE_QUERY}", *(["-f", f"after={after}"] if after else [])))["data"]["repository"]["issues"]
        for n in page["nodes"]:
            out.append({**n, "labels": [l["name"] for l in n["labels"]["nodes"]]})
        if not page["pageInfo"]["hasNextPage"]:
            return out
        after = page["pageInfo"]["endCursor"]


def fetch_prs() -> list:
    rows = json.loads(gh("pr", "list", "--repo", REPO, "--state", "open", "--limit", "100", "--json", "number,title,headRefName,isDraft,statusCheckRollup"))
    return [{**r, "checks": [{"conclusion": c.get("conclusion") or c.get("state")} for c in r.get("statusCheckRollup") or []]} for r in rows]


def section(body: str, name: str) -> str:
    m = re.search(rf"^##\s+{name}\s*\n(.*?)(?=^##\s|\Z)", body or "", re.S | re.M)
    return m.group(1).strip() if m else ""


def first_sentence(text: str) -> str:
    text = re.sub(r"^[-*]\s+", "", text.strip().splitlines()[0]) if text.strip() else ""
    m = re.match(r"(.+?[.!?])(\s|$)", text)
    return (m.group(1) if m else text).strip()


def epic_of(issue: dict) -> int | None:
    if issue.get("parent"):
        return issue["parent"]["number"]
    m = re.search(r"Part of (?:epic )?(?:E\d+\s*)?\(?#(\d+)", issue.get("body") or "")
    return int(m.group(1)) if m else None


def pr_for(story: dict, prs: list) -> dict | None:
    n = story["number"]
    for pr in prs:
        if re.search(rf"\(#{n}\)", pr["title"]) or re.match(rf"feat/{n}-", pr["headRefName"] or ""):
            return pr
    return None


def column(story: dict, pr: dict | None) -> str:
    if story["state"] == "CLOSED":
        return "Done"
    if not pr:
        return "To do"
    green = pr["checks"] and all((c.get("conclusion") or "").upper() == "SUCCESS" for c in pr["checks"])
    return "Review" if green and not pr.get("isDraft") else "Doing"


def plain(text: str) -> str:
    for pat, word in PLAIN:
        text = pat.sub(word, text)
    return text


def build(issues: list, prs: list) -> dict:
    """The page's data: epics in number order, each story with its epic, column, sentence and pull request."""
    epics = sorted((i for i in issues if "epic" in i["labels"]), key=lambda i: i["number"])
    stories = []
    for i in sorted((i for i in issues if "story" in i["labels"]), key=lambda i: i["number"]):
        pr = pr_for(i, prs)
        sentence = first_sentence(section(i.get("body"), "Business"))
        stories.append({"number": i["number"], "title": i["title"], "epic": epic_of(i), "state": i["state"], "pr": pr, "column": column(i, pr),
                        "sentence": sentence, "text": plain(sentence or i["title"]), "needs_words": not sentence})
    return {"epics": [{"number": e["number"], "title": plain(re.sub(r"^Epic:?\s*E\d+:?\s*", "", e["title"])), "state": e["state"],
                       "sentence": plain(first_sentence(section(e.get("body"), "Business"))), "stories": [s for s in stories if s["epic"] == e["number"]]} for e in epics],
            "stories": stories, "prs": prs}


def render(model: dict, vision: str, now: datetime) -> str:
    e = html.escape
    delivered = "".join(
        f'<details><summary><b>{e(ep["title"])}</b> <span class="mono">{len(ep["stories"])} done</span></summary>'
        f'<p>{e(plain(ep["sentence"]))}</p><ul>' + "".join(f'<li>{e(plain(s["text"]))}</li>' for s in ep["stories"]) + "</ul></details>"
        for ep in model["epics"] if ep["state"] == "CLOSED")
    in_progress = [s for s in model["stories"] if s["column"] in ("Doing", "Review")]
    now_rows = "".join(f'<li><b>{e(plain(s["text"]))}</b> <span class="mono">{e(s["column"].lower())}</span></li>' for s in in_progress) or "<li>Nothing is being built right now.</li>"
    next_rows = "".join(
        f'<li><b>{e(ep["title"])}</b><ul>' + "".join(f'<li>{e(plain(s["text"]))}</li>' for s in ep["stories"] if s["column"] == "To do") + "</ul></li>"
        for ep in model["epics"] if any(s["column"] == "To do" for s in ep["stories"])) or "<li>Nothing is queued.</li>"
    epic_name = {ep["number"]: ep["title"] for ep in model["epics"]}
    cards = {c: "".join(
        f'<div class="card" data-story="{s["number"]}"><span class="tag">{e(epic_name.get(s["epic"], "no epic"))}</span><p>{e(s["text"])}</p>'
        f'<span class="mono">#{s["number"]}{" · change #" + str(s["pr"]["number"]) if s["pr"] else ""}</span></div>'
        for s in model["stories"] if s["column"] == c) for c in COLUMNS}
    board = "".join(f'<section class="col"><h3>{c} <span class="mono">{sum(1 for s in model["stories"] if s["column"] == c)}</span></h3>{cards[c]}</section>' for c in COLUMNS)
    needs = sum(1 for s in model["stories"] if s["needs_words"])
    done = sum(1 for s in model["stories"] if s["column"] == "Done")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="300"><title>GoServe roadmap</title>
<style>
:root {{ --cream:#E4E6D9; --paper:#F7F3EF; --ink:#263528; --green:#45654E; --sage:#BFCFB4; --lime:#C8D888; --yellow:#FFDE59; --muted:#46524A; --error:#B3261E; }}
body {{ margin:0; background:var(--cream); color:var(--ink); font:17px/1.5 -apple-system, "Anek Latin", system-ui, sans-serif; }}
main {{ max-width:960px; margin:0 auto; padding:24px 16px 64px; }}
h1 {{ font-size:34px; margin:0 0 4px; }} h2 {{ font-size:24px; margin:40px 0 12px; border-bottom:2px solid var(--green); padding-bottom:4px; }} h3 {{ font-size:16px; margin:0 0 8px; }}
.mono {{ font-family: "DM Mono", ui-monospace, monospace; font-size:13px; color:var(--muted); }}
.vision {{ background:var(--paper); border-radius:6px; padding:16px 20px; font-size:20px; }}
details {{ background:var(--paper); border-radius:6px; padding:10px 16px; margin:8px 0; }} summary {{ cursor:pointer; }}
ul {{ padding-left:20px; }} li {{ margin:4px 0; }}
.board {{ display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; }} @media (max-width:720px) {{ .board {{ grid-template-columns:1fr 1fr; }} }}
.col {{ background:var(--sage); border-radius:6px; padding:10px; min-height:80px; }}
.card {{ background:var(--paper); border-radius:6px; padding:10px 12px; margin:8px 0; font-size:15px; }} .card p {{ margin:6px 0; }}
.tag {{ display:inline-block; background:var(--lime); border-radius:999px; padding:1px 10px; font-size:12px; }}
footer {{ margin-top:40px; }} .needs {{ color:var(--error); }}
</style></head><body><main>
<h1>GoServe roadmap</h1><p class="mono">updated {now.strftime("%H:%M")} · {done} of {len(model["stories"])} stories done</p>
<section id="vision"><h2>Vision</h2><div class="vision">{e(vision)}</div></section>
<section id="delivered"><h2>Delivered</h2>{delivered or "<p>Nothing finished yet.</p>"}</section>
<section id="now"><h2>Now</h2><ul>{now_rows}</ul></section>
<section id="next"><h2>Next</h2><ul>{next_rows}</ul></section>
<section id="board"><h2>Board</h2><div class="board">{board}</div></section>
<footer class="mono">{f'<span class="needs">{needs} {"story" if needs == 1 else "stories"} still need{"s" if needs == 1 else ""} plain words</span> · ' if needs else ""}made by scripts/roadmap.py from the GitHub issues and pull requests</footer>
</main></body></html>
"""


def vision_text() -> str:
    """The vision in plain words: docs/roadmap/vision.md if it exists, else the first bold line and paragraph of README.md."""
    own = os.path.join(ROOT, "docs", "roadmap", "vision.md")
    if os.path.exists(own):
        return open(own).read().strip()
    lines = [l.strip() for l in open(os.path.join(ROOT, "README.md")).read().splitlines() if l.strip() and not l.startswith("#")]
    return " ".join(l.strip("*") for l in lines[:2])


def main(argv: list) -> int:
    page = render(build(fetch_issues(), fetch_prs()), vision_text(), datetime.now())
    if "--print" in argv:
        sys.stdout.write(page)
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        f.write(page)
    print(f"wrote {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
