"""Build the five phase diagrams (MVP 0 to MVP 4) from one shared skeleton.

Why this file exists: every phase must keep the same boxes in the same places, so a reader
sees the system grow (wheel, cycle, motorcycle, car, plane) and only the contents change.
One skeleton (slots, boxes, arrows) is written once here; each phase only fills in the text
and marks each box as new, same, or later. Run it, then run the diagram gate:

  python3 docs/architecture/diagrams/build_phases.py
  node ~/.claude/skills/diagram-standards/render.mjs --theme docs/architecture/diagrams/theme.json \
       --out docs/architecture/diagrams --compare d1-mvp0,d2-mvp1,d3-mvp2,d4-mvp3,d5-mvp4 docs/architecture/diagrams/*.mmd

Colours come only from docs/design-tokens.md.
"""

from pathlib import Path

HERE = Path(__file__).parent

# Slots left to right. Each slot holds a few boxes (id, short role).
SLOTS = [
    ("S1", "1 · SCREENS", ["n1cust", "n1kit", "n1rider", "n1ops"], "slot"),
    ("S2", "2 · FRONT DOOR", ["n2host", "n2gate"], "slot"),
    ("S3", "3 · BRAIN", ["n3flow", "n3side"], "slotBrain"),
    ("S4", "4 · DECISION HELPER", ["n4rule", "n4ai"], "slotDecide"),
    ("S5", "5 · HOT MEMORY", ["n5db", "n5live"], "slot"),
    ("S6", "6 · ARCHIVE", ["n6arc"], "slotArchive"),
    ("S7", "7 · OUT TO PEOPLE", ["n7live", "n7msg"], "slot"),
    ("S8", "8 · LEARNING LOOP", ["n8log", "n8score", "n8imp"], "slotLearn"),
]

# The same arrows in every phase. (from, to, label). Loops are declared for the gate.
EDGES = [
    ("n1cust", "n2gate", "1 · customer taps"),
    ("n1kit", "n2gate", "kitchen taps"),
    ("n1rider", "n2gate", "rider taps"),
    ("n1ops", "n2gate", "ops checks"),
    ("n2gate", "n3flow", "2 · checked request"),
    ("n3flow", "n4rule", "3 · ask"),
    ("n4rule", "n4ai", "second opinion"),
    ("n4ai", "n5db", "4 · save decision"),
    ("n3flow", "n5db", "save order step"),
    ("n3flow", "n3side", "hand off"),
    ("n5db", "n5live", "change"),
    ("n5live", "n7live", "5 · push"),
    ("n3side", "n7msg", "alerts"),
    ("n5db", "n6arc", "nightly move"),
    ("n5db", "n8log", "logs"),
    ("n6arc", "n8score", "history"),
    ("n8log", "n8score", "measure"),
    ("n8score", "n8imp", "propose, test"),
]
LOOPS = [("n8score", "n4ai", "6 · approved settings, new model")]

SAME, NEW, LATER = "same", "new", "later"

# Phase content: box id -> (tool, one-line benefit, state)
PHASES = {
    "d1-mvp0": {
        "title": "MVP 0 · WHEEL — investor demo · ≤10 demo users · ~50 orders · ~$0 a month · proves: order on the kitchen screen in under 2 s",
        "boxes": {
            "n1cust": ("Customer app (PWA)", "role picker, demo autopilot", NEW),
            "n1kit": ("Kitchen screen", "split view on one phone", NEW),
            "n1rider": ("Rider steps", "buttons, faked for the demo", NEW),
            "n1ops": ("Ops screen", "AI suggestion + live metrics", NEW),
            "n2host": ("Cloudflare Pages", "free, fast, business use OK", NEW),
            "n2gate": ("Pages Function", "token check, rate limit", NEW),
            "n3flow": ("n8n order flows", "place order, change status, decide", NEW),
            "n3side": ("n8n side jobs", "Telegram alert, daily scorecard", NEW),
            "n4rule": ("Rules", "oldest first, fewest trips, map check", NEW),
            "n4ai": ("Jev (OpenRouter)", "shown as 'AI suggests'", NEW),
            "n5db": ("Supabase Postgres", "orders, events, decision log", NEW),
            "n5live": ("Supabase Realtime", "push, no refresh", NEW),
            "n6arc": ("Archive", "not needed yet", LATER),
            "n7live": ("Screens update live", "all four, under 2 s", NEW),
            "n7msg": ("Telegram to owner", "demo alerts only", NEW),
            "n8log": ("Run + decision logs", "every decision kept", NEW),
            "n8score": ("Daily scorecard", "numbers to Telegram", NEW),
            "n8imp": ("Improve", "waits for real data", LATER),
        },
    },
    "d2-mvp1": {
        "title": "MVP 1 · CYCLE — pilot · 1 kitchen · 100 to 1,000 users · up to 100 orders a day · ~$0 a month · proves: no lost or double orders",
        "boxes": {
            "n1cust": ("Customer app", "Google or email login", NEW),
            "n1kit": ("Kitchen screen", "real kitchen staff", SAME),
            "n1rider": ("Rider steps", "still simple buttons", SAME),
            "n1ops": ("Ops screen", "change the rider by hand", NEW),
            "n2host": ("Cloudflare Pages", "same", SAME),
            "n2gate": ("Pages Function", "same", SAME),
            "n3flow": ("n8n order flows", "now on Supabase data", SAME),
            "n3side": ("n8n side jobs", "+ nightly archive job", NEW),
            "n4rule": ("Rules", "still decide", SAME),
            "n4ai": ("Jev, logged", "outcome labels start", NEW),
            "n5db": ("Supabase Postgres", "safety rules per role and kitchen", NEW),
            "n5live": ("Supabase Realtime", "same", SAME),
            "n6arc": ("MongoDB on Oracle", "cheap, big history", NEW),
            "n7live": ("Screens update live", "same", SAME),
            "n7msg": ("Email + web push", "free", NEW),
            "n8log": ("Logs + outcomes", "late or on time, per order", NEW),
            "n8score": ("Daily scorecard", "same", SAME),
            "n8imp": ("Weekly proposal", "owner says yes first", NEW),
        },
    },
    "d3-mvp2": {
        "title": "MVP 2 · MOTORCYCLE — one city · 1 to 3 kitchens · ~10,000 users · ~500 orders a day · proves: orders keep flowing even if our server is down",
        "boxes": {
            "n1cust": ("Customer app", "+ pay with Razorpay", NEW),
            "n1kit": ("Kitchen screen", "same", SAME),
            "n1rider": ("Rider app", "live GPS, Play Store wrapper", NEW),
            "n1ops": ("Ops screen", "same", SAME),
            "n2host": ("Cloudflare Pages", "same", SAME),
            "n2gate": ("Pages Function", "same", SAME),
            "n3flow": ("Supabase functions", "hot path, all or nothing", NEW),
            "n3side": ("n8n side jobs only", "alerts, archive, reports", NEW),
            "n4rule": ("Rules + road distance", "maps (OSRM) for one city", NEW),
            "n4ai": ("Jev live + Laya v1", "Laya tested quietly", NEW),
            "n5db": ("Supabase Postgres", "same", SAME),
            "n5live": ("Supabase Realtime", "+ rider location", NEW),
            "n6arc": ("MongoDB on Oracle", "same", SAME),
            "n7live": ("Screens update live", "same", SAME),
            "n7msg": ("WhatsApp / SMS", "key steps only", NEW),
            "n8log": ("Logs + outcomes", "same", SAME),
            "n8score": ("Daily scorecard", "rule vs Jev vs Laya", NEW),
            "n8imp": ("Replay test", "every change tested first", NEW),
        },
    },
    "d4-mvp3": {
        "title": "MVP 3 · CAR — 1 lakh users · 5 to 10 kitchens · ~5,300 orders a day · ~$25+ a month · proves: 2x peak load, under 1 s, zero errors",
        "boxes": {
            "n1cust": ("Customer app", "same", SAME),
            "n1kit": ("Kitchen screen", "many kitchens", SAME),
            "n1rider": ("Rider app", "same", SAME),
            "n1ops": ("Ops screen", "all kitchens", SAME),
            "n2host": ("Cloudflare Pages", "same", SAME),
            "n2gate": ("Cloudflare guard", "rate limit, bot check", NEW),
            "n3flow": ("Supabase functions", "same", SAME),
            "n3side": ("n8n side jobs", "same", SAME),
            "n4rule": ("Rules", "always the backup", SAME),
            "n4ai": ("Laya live (our model)", "$0, Jev only as backup", NEW),
            "n5db": ("Supabase Pro", "500+ live screens, backups", NEW),
            "n5live": ("Realtime (Pro)", "more live screens", NEW),
            "n6arc": ("MongoDB + indexes", "reports read from here", NEW),
            "n7live": ("Screens update live", "same", SAME),
            "n7msg": ("WhatsApp / SMS", "same", SAME),
            "n8log": ("Logs + outcomes", "same", SAME),
            "n8score": ("Scorecard", "+ weekly Laya retrain", NEW),
            "n8imp": ("Auto-improve", "hard limits, rollback", NEW),
        },
    },
    "d5-mvp4": {
        "title": "MVP 4 · PLANE — vision, not built now · beyond 1 lakh users · many cities",
        "boxes": {
            "n1cust": ("Native apps", "same code, wrapped", NEW),
            "n1kit": ("Kitchen screen", "same", SAME),
            "n1rider": ("Native rider app", "background GPS", NEW),
            "n1ops": ("Ops + founder copilot", "ask questions in plain words", NEW),
            "n2host": ("Cloudflare", "same", SAME),
            "n2gate": ("Cloudflare guard", "same", SAME),
            "n3flow": ("Order service + event queue", "many cities", NEW),
            "n3side": ("Workers", "same jobs, more scale", NEW),
            "n4rule": ("Rules", "same", SAME),
            "n4ai": ("Laya per city", "trained on our data", NEW),
            "n5db": ("Regional databases", "close to each city", NEW),
            "n5live": ("Realtime", "same", SAME),
            "n6arc": ("Data warehouse", "all history, reports", NEW),
            "n7live": ("Screens update live", "same", SAME),
            "n7msg": ("WhatsApp / SMS", "same", SAME),
            "n8log": ("Logs + outcomes", "same", SAME),
            "n8score": ("Scorecard", "per city", NEW),
            "n8imp": ("Auto-improve", "per city", NEW),
        },
    },
}

CLASSES = """\
  classDef new fill:#CFD998,stroke:#263528,stroke-width:3px,color:#263528
  classDef same fill:#FFFFFF,stroke:#45654E,stroke-width:1px,color:#263528
  classDef later fill:#F7F3EF,stroke:#706F70,stroke-width:2px,stroke-dasharray:6 4,color:#263528
  classDef head fill:#F7F3EF,stroke:#F7F3EF,color:#263528
  classDef slot fill:#F7F3EF,stroke:#BFCFB4,stroke-width:2px,color:#263528
  classDef slotBrain fill:#F7F3EF,stroke:#45654E,stroke-width:3px,color:#263528
  classDef slotDecide fill:#F7F3EF,stroke:#FFDE59,stroke-width:4px,color:#263528
  classDef slotArchive fill:#F7F3EF,stroke:#966E3A,stroke-width:3px,color:#263528
  classDef slotLearn fill:#F7F3EF,stroke:#7F9743,stroke-width:3px,color:#263528
"""


def label(tool, line, state):
    tag = "NEW · " if state == NEW else ("LATER · " if state == LATER else "")
    return f'"<b>{tag}{tool}</b><br/>{line}"'


def build(name, phase):
    out = ["---", f'title: "{phase["title"]}"', "---", "flowchart TB",
           f"  %% {name}. Generated by build_phases.py from one shared skeleton. Do not edit by hand."]
    for f, t, _ in LOOPS:
        out.append(f"  %% gate:loop {f}->{t}")
    for sid, title, boxes, _ in SLOTS:
        # Box titles are header boxes inside the slot, so no arrow can run across a title.
        out.append(f'  subgraph {sid}[" "]')
        out.append(f'    h{sid}["<b>{title}</b>"]')
        for b in boxes:
            out.append(f"    {b}[{label(*phase['boxes'][b])}]")
        out.append("  end")
    for sid, _, boxes, _ in SLOTS:
        out.append(f"  h{sid} ~~~ {' & '.join(boxes)}")
    for f, t, lab in EDGES:
        out.append(f'  {f} -->|"{lab}"| {t}')
    for f, t, lab in LOOPS:  # dotted: the learning loop sends improvements back up
        out.append(f'  {f} -.->|"{lab}"| {t}')
    out.append(CLASSES.rstrip("\n"))
    for state in (NEW, SAME, LATER):
        ids = [b for b, v in phase["boxes"].items() if v[2] == state]
        if ids:
            out.append(f"  class {','.join(ids)} {state}")
    out.append(f"  class {','.join('h' + sid for sid, *_ in SLOTS)} head")
    for sid, _, _, cls in SLOTS:
        out.append(f"  class {sid} {cls}")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    all_ids = [b for _, _, boxes, _ in SLOTS for b in boxes]
    for name, phase in PHASES.items():
        missing = set(all_ids) ^ set(phase["boxes"])
        assert not missing, f"{name}: boxes differ from the skeleton: {missing}"
        (HERE / f"{name}.mmd").write_text(build(name, phase))
        print(f"wrote {name}.mmd")
