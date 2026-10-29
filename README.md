# GoServe

**Hot meals from our own kitchen. At your door in 25 to 35 minutes. Cash at the door.**

GoServe runs the kitchen, picks the rider, and carries the plate a short way. One pin code at a time. The first kitchen is live in Delhi.

This repository holds everything: the four apps (one codebase), the order workflows, the decision models, the design language, a roadmap page built from the issues, and every plan, test and decision we made. Nothing is hidden. Read it in ten minutes.

---

## Why this is different

**We run the kitchen, so we own the minutes.**
A marketplace sells other people's food and cannot promise the time. We cook one plate a day per meal slot, in our kitchen, a short way from the door. Short trips keep food hot. The promise stays small enough to be true.

**One codebase. Four apps. A web link today, an Android app by 2 November.**
Customer, kitchen, rider and admin run on one React codebase as a web app. A new city is a row in a table, not a new build. The same code ships as an Android APK anyone can download and install, due Sunday 2 November 2026 ([how](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/research/android-apk-2026-10.md)).

**The system decides. People cook and ride.**
Which kitchen, which rider, when to start cooking, which order is about to be late. Small, fast decision models answer in milliseconds for a fraction of a cent ([Jev, the five decisions](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ai/JEV_D1_D5_CONTRACT.md)). Every decision is logged. From those logs we fine-tune [Laya](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ai/LAYA_PLAN.md), an open 395M-parameter decision model, so the cost per decision goes to zero as orders grow.

**A phone number and a code. Or Google. No card. No app to install.**
A customer opens the app, signs in with a phone number and a code (a fixed test code for now, until an SMS provider is set up) or with Google, says where the food goes, and orders. Cash at the door today; payments after the food licence.

**Built lean, built fast, built in the open.**
Free tiers, one small server, a two-person loop: a founder and AI coding agents, with every line reviewed by a second agent and merged by a human. Fourteen days from the first brief to a live system with 292 logged steps, 19 architecture decisions and 585 tests ([the trace](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/process-trace.md)).

---

## See it live

| Link | What it is |
|---|---|
| [Customer app](https://goserve-app.pages.dev/customer/) | Type a pin code, see the menu, order, follow the order to the door. Day and Night look |
| [Kitchen app](https://goserve-app.pages.dev/kitchen/) | New, Cooking, Today: tickets, the open switch, the dishes, the evening cash hand-over. Staff accounts only |
| [Rider app](https://goserve-app.pages.dev/rider/) | Delivery, Today, Me: one delivery at a time, the day's cash, hand it over at the kitchen |
| [Admin app](https://goserve-app.pages.dev/admin/) | Live and Done orders, every kitchen with its staff and menu, riders, the day's numbers |
| Roadmap page | Built every 15 minutes from the issues by `scripts/roadmap.py`: Vision, Delivered, Now, Next, Board. A public address follows ([#247](https://github.com/satvik-jain-iitd/GoServe/issues/247)) |
| [Dev app](https://goserve-app-dev.vercel.app/customer/) | The test system; every pull request redeploys it |
| [Website](https://letsdwelo.in) | For customers and investors (on a borrowed domain for now, [ADR-003](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/decisions)) |
| Design system "GoServe Ink" | Tokens, components, Day and Night. Private link; ask the founder |
| Journey canvases | Every screen of all four apps, approved one by one. Private link; ask the founder |
| [n8n](https://n8n.linkright.in) | The automation server: order API, dispatch, push, the daily Telegram scorecard |
| Telegram `GoServeBot` | Sends the founder every error, every feedback report and the daily pilot card |

---

## What already works

- **For a customer.** Sign in with a phone number and a code, or with Google; say where the food goes (your location or by hand); the menu opens at once every time after. Add dishes, see the bill, place the order. The order page updates on its own: placed, accepted, cooking, ready, on the way, delivered, with the rider's name and a Call button. Cash at the door; tap Yes when the food is in hand. Your orders, newest first. Day and Night look. No app store.
- **For a cook.** Sign in with the kitchen's Google account. New tickets to accept, Cooking tickets to start and mark ready, the open switch, the dishes with Sold out and Back in stock. A ready ticket names the rider who is coming and the minutes away. A ticket the customer cancels after cooking started shows Cancelled for a minute, so nobody keeps cooking. Today: the day's cash and one Confirm hand-over per rider.
- **For a rider.** Online or offline, one delivery at a time: pick up, on the way, arriving, delivered. Today lists the deliveries and the cash in hand; the day ends at the kitchen's closing time, so a 23:30 delivery does not vanish at midnight. Once the kitchen confirms the hand-over, both screens show the same number.
- **For the admin.** Every order live, one tap to the order with its calls, timeline and a cancel with a reason. The city: every kitchen with its hours, pin codes, staff and menu, add a kitchen or a person, remove one. The riders, online or off. The day's numbers per kitchen. A 30-second poll keeps it fresh.
- **Behind it.** Supabase (Postgres, row level security, 69 migrations), n8n workflows for the order API and dispatch, web push, a Telegram bot for errors, feedback and the daily pilot card, the decision models, and 585 tests that run on every pull request.

## Where we are today

- One kitchen live in Delhi. A few pin codes. Cash at the door. 25 to 35 minutes.
- The pilot runs against a written table of breakpoints ([pilot-breakpoints.md](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/product/pilot-breakpoints.md)): orders a day, missed tickets, on-time share, rider load, radius, cash, iPhone share. A Telegram card reads the day's numbers against the lines every evening.
- Order counts and on-time rates go public here when the pilot has numbers worth reading. We do not publish projections.

## What comes next

1. **An Android app by Sunday 2 November 2026.** One APK anyone can download, install and use, every feature and integration working, tested on a phone. The rider's location keeps flowing with the screen off.
2. **Zero running cost.** Laya, our own fine-tuned decision model, answers every decision on our own small box; Jev's paid calls go to zero.
3. **Ten kitchens in Delhi.** A synthetic city already proves the dispatch at scale on real infrastructure.
4. **Maps.** Real distance and ETA, address check, nearest kitchen by the customer's point.
5. **Payments.** UPI and cards after the food licence. Cash stays.
6. **Second city.** Same code, same kitchen playbook, a new row in the table.

The plan for the Android app and zero running cost: [`docs/mvp3/plan.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/mvp3/plan.md). The earlier plan, with root causes, stories and verification: [`docs/mvp25/plan.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/mvp25/plan.md).

---

## How we build

- **Test first.** Every story starts with a failing test named after its scenario. [All tests](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/tests/test-cases.md), including the live rows on dev and prod.
- **Two accounts.** One writes code and opens pull requests. A different one reviews and merges. No one merges their own work.
- **Every decision is a record.** [ADRs](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/decisions), [assumptions](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/assumptions.md), [follow-ups](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/follow-ups.md), [ideas](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ideas.md), [lessons](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/LEARNINGS.md), [discussions](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/discussions).
- **Everything improves itself.** Tunables live in a versioned table, every run writes a log row, a scorecard goes out daily, changes come as proposals with a replay test ([the rule](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/PLAN.md)).
- **Research with sources.** Every claim in [`docs/research/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/research) carries a tier and a confidence score.

## The record

| Link | What it is |
|---|---|
| [`docs/process-trace.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/process-trace.md) | One row per step since day one |
| [`docs/pr-reviews/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/pr-reviews) | The review notebook: one teaching chapter per pull request |
| [Issues](https://github.com/satvik-jain-iitd/GoServe/issues) | Every piece of work: an epic is a feature, a story is a sub-issue |
| [Pull requests](https://github.com/satvik-jain-iitd/GoServe/pulls) | `feat → dev` per story, `release → main` per increment, every one with a block for the reviewer |
| [Actions](https://github.com/satvik-jain-iitd/GoServe/actions) | CI and deploys |

## What we build

| Link | What it is |
|---|---|
| [`docs/product/PRD.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/product/PRD.md) | The product requirements |
| [`docs/architecture/evolution.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/architecture/evolution.md) | How the system grows from one kitchen to a lakh of users, phase by phase |
| [`docs/ARCHITECTURE_COMPONENTS.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ARCHITECTURE_COMPONENTS.md) | Every part of the system, its account, cost and status |
| [`docs/integrations/n8n-order-workflows.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/integrations/n8n-order-workflows.md) | The registry of every workflow |
| [`docs/ai/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/ai) | Jev contracts, the Laya plan, cost control |
| [`design/tokens.json`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/design/tokens.json) | Colours, type, spacing and corners, one source of truth |

## How we work

| Link | What it is |
|---|---|
| [`CLAUDE.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/CLAUDE.md) | The rules every session follows |
| [`docs/PLAN.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/PLAN.md) | The process: epics, stories, Definition of Ready and Done, releases |
| [`docs/ISSUE_PROTOCOL.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ISSUE_PROTOCOL.md) | How an issue is written |
| [`COMMIT_GUIDELINES.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/COMMIT_GUIDELINES.md) | Commit rules |
| [`docs/release-checklist.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/release-checklist.md) | What happens before `main` moves |
| [`docs/architecture/phase-gate.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/architecture/phase-gate.md) | The questions asked before any phase starts |

---

**Talk to us:** [hello@letsdwelo.in](mailto:hello@letsdwelo.in) · [For investors](https://letsdwelo.in/investors)
