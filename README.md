# GoServe

**Fresh food at your door in under 15 minutes.**
GoServe is a food-delivery service with its own kitchens. The first pilot city is **Delhi**.

This repository holds the GoServe website, the product app (one PWA for customer, kitchen, rider and ops), the order workflows, the design language, and all plans and records.

---

## Quick links

Everything of importance, one line each. Docs live on the `dev` branch, so every doc link points there.

### Live things

| Link | What it is |
|---|---|
| [Customer app](https://goserve-app.pages.dev/customer/) | The production app a tester installs on a phone: menu, order, tracker, "Was it delivered?", Feedback button |
| [Kitchen screen](https://goserve-app.pages.dev/kitchen/) | Production: accept, start, mark ready; hand the food over |
| [Rider app](https://goserve-app.pages.dev/rider/) | Production: pick up, arriving, delivered (for a real rider; in the UAT the customer confirms instead) |
| [Ops console](https://goserve-app.pages.dev/ops/) | Production: every order live, the rider suggestion from Jev, the run and decision logs, Autopilot and Reset |
| [Dev app](https://goserve-app-dev.vercel.app/customer/) | The test system (same app, dev database and dev workflows); every PR to `dev` redeploys it |
| [Investor site](https://letsdwelo.in) | The public doorway for investors; on a borrowed domain for now (ADR-003) |
| [UAT guide](https://claude.ai/artifact/X4LpfbRkk7AGEq3tvf3hj3) | The tester's page: install on iPhone or Android, the first order, your own test, and the owner's console |
| [n8n](https://n8n.linkright.in) | The automation server that runs the order API (GS workflows, dev and prod) and the daily scorecard |
| [Supabase dev](https://supabase.com/dashboard/project/tmxyizmkpwwfyazvrfhw) | The dev database: orders, events, decisions, run log, feedback |
| [Supabase prod](https://supabase.com/dashboard/project/vpuumnslnionplrxmqlf) | The production database (same tables); changed only on the owner's yes |
| Telegram `GoServeBot` | Sends the owner every feedback report, every workflow error (ERR 00) and the 21:00 scorecard |
| Google Drive "GoServe UAT" | The folder (account `Klickbae8yt@gmail.com`) where tester screenshots land, one subfolder per env |

### GitHub

| Link | What it is |
|---|---|
| [Issues](https://github.com/satvik-jain-iitd/GoServe/issues) | Every piece of work: an epic is a feature, a story is a sub-issue under it |
| [Epic #93 UAT v2](https://github.com/satvik-jain-iitd/GoServe/issues/93) | The current epic: feedback button, delivered by hand, UAT numbers |
| [Pull requests](https://github.com/satvik-jain-iitd/GoServe/pulls) | `feat → dev` per story, `release → main` per demo increment; every PR carries a block for the reviewer |
| [Actions](https://github.com/satvik-jain-iitd/GoServe/actions) | CI (Site, App, Guard) and the deploys: dev app on Vercel, prod app and site on Cloudflare Pages |

### How we work

| Link | What it is |
|---|---|
| [`CLAUDE.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/CLAUDE.md) | The project rules every session follows (branches, two accounts, TDD, what `main` may hold) |
| [`docs/PLAN.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/PLAN.md) | The process: epics, stories, Definition of Ready and Done, releases |
| [`docs/ISSUE_PROTOCOL.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ISSUE_PROTOCOL.md) | How an issue is written: business line, product line, acceptance criteria |
| [`COMMIT_GUIDELINES.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/COMMIT_GUIDELINES.md) | Commit message rules (Conventional Commits, English, short) |
| [`docs/release-checklist.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/release-checklist.md) | The steps before `main` moves: prod database, prod workflows, keys, smoke checks |
| [`docs/architecture/phase-gate.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/architecture/phase-gate.md) | The question list run with the owner before any MVP phase starts |

### The record

| Link | What it is |
|---|---|
| [`docs/process-trace.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/process-trace.md) | One row per step, who did it, what came out; read first in every session |
| [`docs/LEARNINGS.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/LEARNINGS.md) | One row per lesson or mistake, so it is not repeated |
| [`docs/follow-ups.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/follow-ups.md) | Every open follow-up (F rows) with an owner and a status |
| [`docs/ideas.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ideas.md) | Every idea the owner stated, with status open, taken or dropped |
| [`docs/assumptions.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/assumptions.md) | Every assumption we build on, written down so nothing stays tacit |
| [`docs/decisions/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/decisions) | ADRs, one file per decision that changed architecture or scope (ADR-001 to ADR-015) |
| [`docs/discussions/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/discussions) | Bullets from every owner message that changed direction, by date |
| [`docs/tests/test-cases.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/tests/test-cases.md) | Every test with its story, scenario, kind and result, including the live rows on dev and prod |
| [`docs/pr-reviews/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/pr-reviews) | The review notebook: one teaching chapter per PR, plus concepts, mental model and open questions |

### What we build

| Link | What it is |
|---|---|
| [`docs/product/PRD.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/product/PRD.md) | The product requirements: who, what, why |
| [`docs/product/MVP0_SPEC.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/product/MVP0_SPEC.md) | The first demo build: four screens, one order book, live updates |
| [`docs/product/founder-checklist.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/product/founder-checklist.md) | What the owner checks by hand before a demo |
| [`docs/architecture/evolution.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/architecture/evolution.md) | How the system grows from a demo to 1 lakh users, phase by phase, with pictures |
| [`docs/architecture/mvp0-build-design.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/architecture/mvp0-build-design.md) | How MVP 0 is built: PWA, Supabase, n8n order API |
| [`docs/ARCHITECTURE_COMPONENTS.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ARCHITECTURE_COMPONENTS.md) | Every system part per phase, with its account, cost and status |
| [`docs/integrations/n8n-order-workflows.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/integrations/n8n-order-workflows.md) | The registry of the GS workflows (MAIN 01, SUB 11 to 18, SUB 91, MAIN 90, ERR 00), their inputs and ids |
| [`docs/ai/JEV_D1_D5_CONTRACT.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ai/JEV_D1_D5_CONTRACT.md) | The five decisions Jev may make (D1 rider pick is built), what each call must log |
| [`docs/ai/LAYA_PLAN.md`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/docs/ai/LAYA_PLAN.md) | The plan to train Laya, our own decision model, from the logged decisions |
| [`docs/research/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/docs/research) | Findings with source tiers and confidence scores (hosting, free tiers, Laya, operations) |
| [`design/tokens.json`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/design/tokens.json) | The one source of truth for colours, font, spacing and corners; `design/README.md` explains it |

### Code and tools

| Link | What it is |
|---|---|
| [`app/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/app) | The PWA (React, Vite, TypeScript); `app/README.md` says how to run it; `app/supabase/migrations/` holds the schema |
| [`ops/n8n/order/build.js`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/ops/n8n/order/build.js) | Builds every GS workflow from code; `deploy.js` pushes them to n8n; `verify_live.js` proves the live copies match |
| [`scripts/live_check.py`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/scripts/live_check.py) | Runs one real order through the dev API and reads the rows back |
| [`scripts/clear_dev.py`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/scripts/clear_dev.py) | Empties the dev tables after a test day (dev only, never prod) |
| [`scripts/release_db.py`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/scripts/release_db.py) | Applies the migrations to the prod database, after a name check and the owner's yes |
| [`scripts/guard.py`](https://github.com/satvik-jain-iitd/GoServe/blob/dev/scripts/guard.py) | The pre-commit and CI guard: no secrets, no big files, no merge markers, no tool caches, PR size |
| [`.github/workflows/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/.github/workflows) | CI and the three deploys (site, dev app, prod app) |
| [`site/`](https://github.com/satvik-jain-iitd/GoServe/tree/dev/site) | The investor website (Astro) |

---

## What is in here

| Folder | What it is |
|---|---|
| `app/` | The product app: one installable PWA for customer, kitchen, rider and ops, with the database migrations |
| `ops/` | The n8n workflows as code: the order API, the feedback path, the daily scorecard, the error alert |
| `scripts/` | Guard, live checks, dev clean-up, prod release helpers |
| `site/` | The public website (investor doorway): built with Astro, live on Cloudflare Pages |
| `design/` | The GoServe design language: colour tokens (`tokens.json`) and brand files (logo, app icon) |
| `docs/` | Plans, decisions, research and the build journey — **on the `dev` branch** |

The `main` branch carries the code that runs. The `dev` branch carries everything, including all documentation.

## The product in one picture

People tap on their phones. One order book records every step. Every screen updates live.

- **Customer app:** browse the menu, order, track, confirm delivery, give feedback.
- **Kitchen screen:** accept, cook, mark ready.
- **Rider app:** pick up, deliver, confirm.
- **Ops dashboard:** every order, live, with the rider suggestion and the logs.

How the system grows from a demo to 1 lakh users, phase by phase, is drawn in `docs/architecture/evolution.md` on the `dev` branch.

## Run it locally

You need Node.js 22.

```bash
cd app
npm ci
npm run dev          # local app at http://localhost:5173
npm run verify       # type check, unit tests, build
npm run test:e2e     # end-to-end tests against the production build

cd site
npm ci
npm run dev          # local site at http://localhost:4321
npm run test:unit    # unit tests
npm run test:e2e     # end-to-end and accessibility tests
npm run build        # production build into site/dist

node --test "ops/n8n/order/*.test.js"   # workflow tests
```

## How we work

1. Every piece of work starts as a GitHub issue: an **epic** (a feature) with **stories** under it.
2. Each story gets its own branch `feat/<issue>-<short-name>`, cut from `dev`.
3. Tests come first. A pull request needs green checks (lint, types, unit, end-to-end, build).
4. **Two accounts:** development (commits, branches, pull requests) happens through `klickbae8yt-star`.
   Every review and every merge is done by `satvik-jain-iitd`.
5. `feat → dev` for each story; a release branch cut from `main` takes only the run-critical paths from `dev` when a working increment is ready.
6. Before each product phase starts, we run a phase gate: we check every account, key and approval that phase needs.
7. Every handoff between teammates ends with one short block (`To <role>, from <role>, re <ref>:`); the owner relays it unchanged.

## Design rules (short)

- Background cream `#E4E6D9`, text ink green `#263528`, actions deep green `#45654E`.
- Lime and warm yellow are small pops only.
- Never a raw colour in product code: use the token from `design/tokens.json`.

## Status

- Website: live.
- Product app: MVP 0 live on production (`goserve-app.pages.dev`) since 15 Oct 2026; order API on n8n, dev and prod.
- UAT v2 (feedback button, delivered by hand) built and on dev; the release to production is next.

## Contact

Open an issue in this repository.
