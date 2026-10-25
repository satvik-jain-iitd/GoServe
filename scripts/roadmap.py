#!/usr/bin/env python3
"""Story #239 (epic E21): the live roadmap page.

Reads the repo's epics, stories and open pull requests with `gh`, and writes docs/roadmap/index.html: Vision, Delivered,
Now, Next and a Board. Plain words: a story's roadmap text is the first sentence of its "## Business" section.
Run: python3 scripts/roadmap.py            (writes the page)
     python3 scripts/roadmap.py --print    (prints the page, writes nothing)
     python3 scripts/roadmap.py --deploy   (writes the page, then publishes it to the Cloudflare Pages project goserve-roadmap; story #247)
A launchd job (ops/launchd/com.goserve.roadmap.plist) runs it every 15 minutes.
"""
from __future__ import annotations   # /usr/bin/python3 under launchd may be 3.9
import html, json, os, re, shutil, subprocess, sys, tempfile
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "roadmap", "index.html")
REPO = "satvik-jain-iitd/GoServe"
DEFAULT_VAULT = os.path.expanduser("~/Desktop/Secrets/03_cloudflare.env")   # the owner's file (F207): CLOUDFLARE_ROADMAP_TOKEN and CLOUDFLARE_ACCOUNT_ID
WRANGLER = ["npx", "--yes", "wrangler@4.145.0"]   # pinned: it receives the Pages token
COLUMNS = ("To do", "Doing", "Review", "Done")
# Words a stranger does not need. The Board cards keep the story's own words (raw); every other section gets the plain swap.
PLAIN = [(re.compile(r"\bCI/CD\b"), "build and deploy"), (re.compile(r"\bPRs?\b"), "change"), (re.compile(r"\bCI\b"), "the checks"), (re.compile(r"\brpc\b", re.I), "server call"),
         (re.compile(r"\bmigrations?\b", re.I), "database change"), (re.compile(r"\be2e\b", re.I), "end-to-end test")]
ISSUE_QUERY = """query($after: String) { repository(owner: "satvik-jain-iitd", name: "GoServe") {
  issues(first: 100, after: $after, orderBy: {field: CREATED_AT, direction: ASC}) { pageInfo { hasNextPage endCursor }
    nodes { number title body state closedAt labels(first: 20) { nodes { name } } parent { number } milestone { title dueOn }
      timelineItems(first: 100, itemTypes: [LABELED_EVENT]) { nodes { ... on LabeledEvent { createdAt label { name } } } } } } } }"""


def gh(*args: str) -> str:
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def fetch_issues() -> list:
    """Every issue, with its labels as names and its parent issue (sub-issues), in one list."""
    out, after = [], None
    while True:
        page = json.loads(gh("api", "graphql", "-f", f"query={ISSUE_QUERY}", *(["-f", f"after={after}"] if after else [])))["data"]["repository"]["issues"]
        for n in page["nodes"]:
            doing = sorted(t["createdAt"] for t in n.pop("timelineItems")["nodes"] if t.get("label", {}).get("name") == "doing")
            out.append({**n, "labels": [l["name"] for l in n["labels"]["nodes"]], "doing_at": doing[0] if doing else None})
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
    m = re.search(r"Part of (?:epic )?(?:E\d+\s*)?\(?#(\d+)", issue.get("body") or "", re.I)
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


IST = timedelta(hours=5, minutes=30)
PRIO = {"P0": 0, "P1": 1, "P2": 2}


def india_now() -> datetime:
    """The page clock: India time as a naive datetime, whatever time zone the machine is in (a GitHub runner is UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None) + IST


def ist(stamp: str | None) -> datetime | None:
    """A GitHub UTC stamp as a naive India time."""
    return datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ") + IST if stamp else None


def needs_of(body: str) -> list:
    return [int(n) for n in re.findall(r"^Needs:\s*#(\d+)", body or "", re.M)]


def span(minutes: int | None) -> str:
    if minutes is None:
        return "no start time"
    d, rest = divmod(minutes, 1440)
    h, m = divmod(rest, 60)
    return " ".join(p for p in (f"{d} d" if d else "", f"{h} h" if h else "", f"{m} min" if m else "") if p) or "0 min"


def day_label(d: datetime) -> str:
    return f"{d.day} {d.strftime('%b')}"


def day_range(stories: list) -> str:
    days = sorted(s["closed"] for s in stories if s.get("closed"))
    return f" · {day_label(days[0])} to {day_label(days[-1])}" if days else ""


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
        closed, started = ist(i.get("closedAt")), ist(i.get("doing_at"))
        ms = i.get("milestone")
        labels = i.get("labels") or []
        stories.append({"number": i["number"], "title": i["title"], "epic": epic_of(i), "state": i["state"], "pr": pr, "column": column(i, pr),
                        "sentence": sentence, "raw": sentence or i["title"], "text": plain(sentence or i["title"]), "needs_words": not sentence,
                        "labels": labels, "prio": next((PRIO[l] for l in labels if l in PRIO), 9), "milestone": ms["title"] if ms else None,
                        "due": ms["dueOn"] if ms else "9999", "needs": needs_of(i.get("body")), "closed": closed, "started": started,
                        "cycle_min": int((closed - started).total_seconds() // 60) if closed and started else None})
    by_n = {s["number"]: s for s in stories}
    for s in stories:
        s["blocked_by"] = [n for n in s["needs"] if n in by_n and by_n[n]["state"] != "CLOSED"]
    live = [s for s in stories if s["state"] != "CLOSED" and "doing" not in s["labels"]]
    open_ = sorted((s for s in live if {"ready", "blocked"} & set(s["labels"])), key=lambda s: (s["due"], s["prio"], s["number"]))   # the plan's stories
    older = sorted((s for s in live if not {"ready", "blocked"} & set(s["labels"])), key=lambda s: s["number"])   # open work from before the plan
    days: dict = {}
    for s in sorted((s for s in stories if s["closed"]), key=lambda s: s["closed"], reverse=True):
        days.setdefault(s["closed"].strftime("%Y-%m-%d"), []).append(s)
    here = {"doing": [s for s in stories if s["state"] != "CLOSED" and "doing" in s["labels"]],
            "next": next((s for s in open_ if "ready" in s["labels"] and not s["blocked_by"]), None)}
    return {"timeline": [{"day": d, "stories": v} for d, v in days.items()], "next": open_, "older": older, "here": here, "epics": [{"number": e["number"], "title": plain(re.sub(r"^(Epic|Feature):?\s*(E\d+:?)?\s*", "", e["title"])), "state": e["state"],
                       "sentence": plain(first_sentence(section(e.get("body"), "Business"))), "stories": [s for s in stories if s["epic"] == e["number"]]} for e in epics],
            "stories": stories, "prs": prs}


def render(model: dict, vision: str, now: datetime) -> str:
    e = html.escape
    delivered = "".join(
        f'<details><summary><b>{e(ep["title"])}</b> <span class="mono">{len(ep["stories"])} done{e(day_range(ep["stories"]))}</span></summary>'
        f'<p>{e(plain(ep["sentence"]))}</p><ul>' + "".join(f'<li>{e(plain(s["text"]))}</li>' for s in ep["stories"]) + "</ul></details>"
        for ep in model["epics"] if ep["state"] == "CLOSED")
    in_progress = [s for s in model["stories"] if s["column"] in ("Doing", "Review")]
    now_rows = "".join(f'<li><b>{e(plain(s["text"]))}</b> <span class="mono">{e(s["column"].lower())}</span></li>' for s in in_progress) or "<li>Nothing is being built right now.</li>"
    def next_row(s):
        why = f' <span class="mono needs">blocked by {", ".join("#" + str(n) for n in s["blocked_by"])}</span>' if s["blocked_by"] else ' <span class="mono">ready</span>'
        return f'<li><b>{e(plain(s["text"]))}</b> <span class="mono">#{s["number"]} · {e(s["milestone"] or "no milestone")}{" · P" + str(s["prio"]) if s["prio"] < 9 else ""}</span>{why}</li>'
    next_rows = "".join(next_row(s) for s in model["next"]) or "<li>Nothing is queued.</li>"
    older_rows = "".join(f'<li>{e(plain(s["text"]))} <span class="mono">#{s["number"]}</span></li>' for s in model["older"])
    here = model["here"]
    doing_rows = "".join(f'<li><b>{e(plain(s["text"]))}</b> <span class="mono">#{s["number"]} · since {s["started"].strftime("%H:%M") if s["started"] else "?"}</span></li>' for s in here["doing"]) or "<li>Nothing is marked doing.</li>"
    nxt = here["next"]
    next_line = f'<p>Next to start: <b>{e(plain(nxt["text"]))}</b> <span class="mono">#{nxt["number"]}</span></p>' if nxt else "<p>No story is ready to start.</p>"
    timeline = "".join(
        f'<h3>{e(day_label(datetime.strptime(d["day"], "%Y-%m-%d")))}</h3><ul>' + "".join(
            f'<li>{e(plain(s["text"]))} <span class="mono">#{s["number"]} · {e(span(s["cycle_min"]))}</span></li>' for s in d["stories"]) + "</ul>"
        for d in model["timeline"]) or "<p>Nothing is closed yet.</p>"
    epic_name = {ep["number"]: ep["title"] for ep in model["epics"]}
    cards = {c: "".join(
        f'<div class="card" data-story="{s["number"]}"><span class="tag">{e(epic_name.get(s["epic"], "no epic"))}</span><p>{e(s["raw"])}</p>'
        f'<span class="mono">#{s["number"]}{" · PR #" + str(s["pr"]["number"]) if s["pr"] else ""}</span></div>'
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
<section id="here"><h2>You are here</h2><p class="mono">{now.strftime("%d %b %H:%M")} India time</p><ul>{doing_rows}</ul>{next_line}</section>
<section id="timeline"><h2>Timeline</h2>{timeline}</section>
<section id="now"><h2>Now</h2><ul>{now_rows}</ul></section>
<section id="next"><h2>Next</h2><ul>{next_rows}</ul></section>
<section id="older"><h2>Older open work</h2><details><summary>{len(model["older"])} stories from before the plan</summary><ul>{older_rows}</ul></details></section>
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


def deploy(page: str, vault: str, wrangler: list) -> tuple:
    """Publish only the page to the Pages project. The token comes from the vault file and goes to wrangler in its environment, never in its arguments.
    Returns (exit code, message); a missing variable is a loud failure that names it."""
    found = {}
    try:
        for line in open(vault).read().splitlines():
            k, _, v = line.partition("=")
            if k.strip() in ("CLOUDFLARE_ROADMAP_TOKEN", "CLOUDFLARE_ACCOUNT_ID") and v.strip():
                found[k.strip()] = v.strip()
    except OSError:
        pass
    missing = [k for k in ("CLOUDFLARE_ROADMAP_TOKEN", "CLOUDFLARE_ACCOUNT_ID") if k not in found]
    if missing:
        return 1, "not deployed: missing " + ", ".join(missing) + " in " + vault
    site = tempfile.mkdtemp(prefix="goserve-roadmap-")
    try:
        shutil.copy(page, os.path.join(site, "index.html"))
        env = dict(os.environ, CLOUDFLARE_API_TOKEN=found["CLOUDFLARE_ROADMAP_TOKEN"], CLOUDFLARE_ACCOUNT_ID=found["CLOUDFLARE_ACCOUNT_ID"])
        r = subprocess.run(wrangler + ["pages", "deploy", site, "--project-name=goserve-roadmap", "--branch=main"], env=env, capture_output=True, text=True, timeout=180)
        return r.returncode, ((r.stdout or "") + (r.stderr or "")).strip()[-600:]
    finally:
        shutil.rmtree(site, ignore_errors=True)


def main(argv: list) -> int:
    page = render(build(fetch_issues(), fetch_prs()), vision_text(), india_now())
    if "--print" in argv:
        sys.stdout.write(page)
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        f.write(page)
    print(f"wrote {os.path.relpath(OUT, ROOT)}")
    if "--deploy" in argv:
        code, msg = deploy(OUT, DEFAULT_VAULT, WRANGLER)
        print(("deployed: " if code == 0 else "DEPLOY FAILED: ") + msg, file=sys.stdout if code == 0 else sys.stderr)
        return code
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
