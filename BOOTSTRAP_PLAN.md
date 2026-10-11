# GoServe — Bootstrap Plan

**Date:** 11 Oct 2026
**Status:** Awaiting owner approval. Nothing is executed until this is approved.

This file is the plan for one job: set up the GoServe repository the right way, using the process from the `shipquick_latest` repository as the source of truth. It covers the repo layout, the Git process, the issue tree, the test-driven workflow, CI/CD, and the exact steps I will run once you approve.

I write everything here in plain English so anyone can follow it.

---

## 1. Exact understanding (one paragraph)

You want one clean GitHub repository named **GoServe**, where all real work happens on a **`dev`** branch and nothing ever lands on **`main`** unless you merge it yourself. Inside the repo there is a **`knowledge/`** folder that holds a clone of your process repository, **`shipquick_latest`** — that clone is the rulebook (architecture, front-end, back-end, testing, TDD) we follow for all GoServe work. Work is driven only by GitHub issues: every **Epic is a feature**, every **user story is a sub-issue tagged to its correct Epic**, and every **test case is linked to the correct user story**, with the test file attached to that sub-issue. We follow **test-driven development from start to end** — failing test first, always. Before any feature is built we first create a **feature branch with a clear, self-explaining name**, and on it we write the business-level and product-level description, the acceptance criteria, and the docs. Code is pushed through those feature branches into `dev`, and you open every `dev` → `main` merge yourself; I raise the pull request, you merge. I never touch `main`. If something breaks, we roll back only the one feature branch, so a single bad change cannot damage the whole project. Everything has **proper comments, every assumption is written down, and every follow-up is noted**. The repo has **CI/CD, pre-commit hooks, and lint checks**, with best-in-class code quality. If the current process is missing any of these rules, I add the missing rules into the cloned knowledge instance.

---

## 2. What I found (verified facts)

I inspected the process repository through the GitHub API. These facts are checked, not guessed.

- The process repo is **`satvik-jain-iitd/shipquick_latest`** (public, default branch `main`). Your message said "shipwik_latest"; the real name is `shipquick_latest`.
- It has **54 files**. Its purpose: a starter kit for web apps using **Material Design 3 (M3)**.
- It already contains a written process. The key file is **`docs/PLAN.md`** (Part D: Process). Rules also live in **`CLAUDE.md`** (10 standing rules).
- The process already defines: branch model `main` / `dev` / `feat/<issue>-<slug>`, TDD (failing test first), issues with Gherkin, idea logging, discussion logs, process trace, ADRs, demos, journal, Definition of Ready, and Definition of Done.
- Its CI file (`ci.yml`) runs **`pytest`** on push and PR to `dev`, on **macOS + Python 3.12**. That is the wrong shape for GoServe, which is a JavaScript/TypeScript PWA. We adapt it, we do not copy it.
- The repo also has an `architecture/architecture-portal/` folder with prescriptive ADRs (Database, Event Brokers, API Integration, AI/ML, Observability, Build vs Buy, Front-End & Mobile). Useful as reference.
- Local reality: the folder **`/Users/satvikjain/Downloads/GoServe`** is **not yet a Git repo**. It holds `docs/` (our planning docs) and two PDFs (the SOW and the founder's deck).

---

## 3. The process we follow (from shipquick_latest)

These are the rules we inherit. I restate them so we agree before building.

### 3.1 Branches

| Branch | Role | Who merges |
|---|---|---|
| `main` | Release-ready. Protected. | **Only the owner.** |
| `dev` | Integration. All work lands here first. | Claude, after CI is green. |
| `feat/<issue-number>-<slug>` | One branch per story. Cut from `dev`. | Claude, back into `dev`. |

Rules:
1. One feature branch per story.
2. Branch names describe the feature, so anyone can see what it does.
3. PR goes `feat → dev`. I self-review, CI must be green, then I merge into `dev`.
4. PR goes `dev → main` only at a demo point. **I open it, you merge it. I never merge to `main`.**
5. I never push directly to `main`.

### 3.2 Issues (the work tree)

- **Epic = feature.** A GitHub issue labelled `epic`.
- **User story = sub-issue.** A GitHub issue labelled `story`, attached to its correct Epic as a sub-issue.
- **Test case = linked to the story.** Each story has its tests written first. The test file is attached to that story's sub-issue. The story issue links to its test file and to the matching row in the test-cases doc.
- Every issue carries: persona, the feature request it serves, its Gherkin scenarios, its Definition of Ready checklist, and the ponytail note (what we deliberately do not build).

### 3.3 Test-driven development (strict)

For every story:
1. Write the failing test first. Name it after the Gherkin scenario.
2. Run it. See it fail. Save the failure output.
3. Write the least code that makes it pass.
4. Refactor. Run again.
5. Paste the failing-test proof into the PR.

No story starts before its Definition of Ready is true. No story closes before its Definition of Done is true.

### 3.4 Docs that move with the code

| File / folder | Job |
|---|---|
| `docs/PLAN.md` | The plan and process. |
| `docs/process-trace.md` | One row per step. Read first every session, append before done. |
| `docs/discussions/YYYY-MM-DD.md` | Bullet points per conversation. The "why". |
| `docs/decisions/ADR-NNN.md` | Every architecture or scope decision. |
| `docs/demos/D<n>.md` | What each increment shows and how to run it. |
| `docs/journal/YYYY-MM-DD.md` | Session notes: decided, surprised, dropped, measured. |
| `docs/ideas.md` | Every idea, dated, one line, with status. |
| `docs/tests/test-cases.md` | Every test with its story and scenario id. |
| `docs/assumptions.md` | Every assumption, stated plainly. **(added by us)** |
| `docs/follow-ups.md` | Every follow-up, so nothing is lost. **(added by us)** |

---

## 4. Target repository structure

```
GoServe/
├── README.md                 # what this project is
├── CLAUDE.md                 # standing rules (from shipquick + our additions)
├── PLAYBOOK.md               # final lesson file (later)
├── IDEA.md                   # the venture idea (from the deck + PRD)
├── BOOTSTRAP_PLAN.md         # this file
├── knowledge/                # the rulebook (clone of shipquick_latest)
│   ├── SOURCE.md             # upstream URL + commit SHA we cloned
│   └── shipquick_latest/     # the clone
├── docs/
│   ├── PLAN.md
│   ├── architecture.md
│   ├── design-tokens.md      # GoServe brand values, M3 tokens
│   ├── process-trace.md
│   ├── ideas.md
│   ├── assumptions.md        # added
│   ├── follow-ups.md         # added
│   ├── PRD.md                # our product requirements
│   ├── MVP0_SPEC.md
│   ├── SOLUTION_ARCHITECTURE.md
│   ├── JEV_INTEGRATION_PLAN.md
│   ├── JEV_D1_D5_CONTRACT.md
│   ├── discussions/
│   ├── decisions/
│   ├── demos/
│   ├── journal/
│   ├── research/
│   ├── success/
│   └── tests/
│       └── test-cases.md
├── web/                      # the PWA (Next.js + TypeScript + Material Design 3)
├── api/                      # the backend (Hono + TypeScript) — MVP 1 onward
├── n8n/                      # MVP 0 workflows (exported JSON) — MVP 0 only
├── .github/
│   └── workflows/
│       └── ci.yml            # adapted for Node/TypeScript
├── .husky/                   # pre-commit hooks
├── .eslintrc / eslint.config.js
├── .prettierrc
├── commitlint.config.js
└── .gitignore
```

Notes:
- `knowledge/shipquick_latest/` is a clone, as you asked. To keep the GoServe history clean, the cleanest method is to clone it and keep it as a **vendored snapshot** (remove its inner `.git`) and record the upstream commit SHA in `knowledge/SOURCE.md`. The alternative is a **Git submodule**. This is an open decision (section 9).
- The two PDFs (SOW and deck) stay out of the repo body or move to `docs/reference/`, because large binaries in Git are a bad habit. This is an open decision.

---

## 5. Tech stack (from our solutioning doc)

| Layer | Choice | Why |
|---|---|---|
| PWA | Next.js + TypeScript + `@material/web` (M3) | One codebase, installable, matches your PWA-first decision. |
| Backend | Hono + TypeScript, Postgres | Light, fast, runs on our Oracle server. |
| Realtime | Server-Sent Events (SSE), WebSocket later | Live status with no refresh. |
| MVP 0 backend | n8n workflows | Fast demo, same API paths as the real backend. |
| Decisions | Jev via OpenRouter | Our differentiator, behind one wrapper. |
| Tests | Vitest (unit), Playwright (PWA e2e) | TDD-friendly, fast. |
| Lint / format | ESLint + Prettier | Code quality. |
| Hooks | Husky + lint-staged + commitlint | Stop bad commits before they land. |
| CI | GitHub Actions (Node) | Adapted from the shipquick CI. |

---

## 6. Issue tree we will create

We create the whole tree as GitHub issues **before any code**. Shape:

- **Epic 1: MVP 0 — Clickable Demo** (`epic`)
  - Story: PWA shell and menu (`story`)
  - Story: Cart and bill (`story`)
  - Story: Place-order backend on n8n (`story`)
  - Story: Kitchen display live updates (`story`)
  - Story: Customer live status (`story`)
- **Epic 2: MVP 1 — Golden Path** (`epic`)
  - Story: Login with OTP (`story`)
  - Story: Order stored in Postgres (`story`)
  - Story: Jev D1 assign rider (`story`)
  - Story: Jev D2 ETA (`story`)
  - Story: Jev D3 next cook (`story`)
  - Story: Jev D4 late risk (`story`)
  - Story: Jev D5 zone check (`story`)
  - Story: Rider flow, live tracking (`story`)
- **Epic 3: MVP 2 — Pilot Ready** (`epic`)
- **Epic 4: MVP 3 — Intelligence Layer** (`epic`)
- **Epic 5: MVP 4 — Scale Hardened** (`epic`)

Every story:
1. Is a sub-issue of its correct Epic.
2. Has its Gherkin scenarios.
3. Has its test file attached and linked.
4. Has a Definition of Ready checklist.
5. Has a ponytail note.

Each test file lives at `docs/tests/<story-id>-<slug>.md` or as the real test file path, and is linked in the story issue.

---

## 7. CI/CD, hooks, and quality (the additions you asked for)

The shipquick CI runs `pytest`. GoServe is TypeScript, so we build our own:

### 7.1 CI (`ci.yml`), runs on push and PR to `dev`
1. Install dependencies.
2. `lint` — ESLint, must be clean.
3. `typecheck` — TypeScript, must be clean.
4. `test` — Vitest with coverage, must pass.
5. `build` — the PWA must build.
6. Fail the PR if any step is red.

### 7.2 Pre-commit hooks (Husky + lint-staged)
1. On commit: run Prettier and ESLint on changed files only.
2. Block the commit if lint fails.
3. `commitlint` enforces Conventional Commits (for example `feat(web): add cart total`).

### 7.3 Quality bar
1. Every function that is not obvious has a short comment explaining **why**, not what.
2. Every module has a one-paragraph header comment: what it does, what it assumes.
3. No hardcoded colors; use M3 design tokens.
4. No secrets in code; secrets live in `~/Desktop/Secrets/` and in GitHub Actions secrets.
5. Every assumption goes to `docs/assumptions.md`.
6. Every follow-up goes to `docs/follow-ups.md`.

---

## 8. Exact steps I will run (once you approve)

Numbered, in order. Each step ends with a checkpoint.

1. **Decide open questions** (section 9) — small, quick.
2. **Create the GitHub repo** `GoServe` under `satvik-jain-iitd` with the visibility we agree on.
3. **Set up the local repo** at the permanent path we agree on (`~/Documents/GoServe` recommended). Run `git init`, add the remote.
4. **Create `dev` from `main`**, and protect `main` (no direct pushes, PR required).
5. **Clone `shipquick_latest` into `knowledge/`** and write `knowledge/SOURCE.md` with the commit SHA.
6. **Lay down the structure** (section 4): folders, `CLAUDE.md`, `docs/PLAN.md`, `docs/process-trace.md`, `docs/ideas.md`, `docs/assumptions.md`, `docs/follow-ups.md`, empty-but-tracked folders with `.gitkeep`.
7. **Migrate our existing planning docs** (`PRD.md`, `MVP0_SPEC.md`, `SOLUTION_ARCHITECTURE.md`, `JEV_*`, `research/`, `roadmap.png`, `diagrams.html`) into `docs/`.
8. **Add the missing rules** to `knowledge/shipquick_latest/CLAUDE.md` and to root `CLAUDE.md` (the additions in section 7 and the sub-issue/test-linkage rules).
9. **Write CI, hooks, lint, and format configs** (section 7).
10. **Create the issue tree** (section 6) with labels `epic` / `story`, a board (Backlog / Doing / Review / Done), and correct sub-issue links.
11. **Write the first ADRs** (`ADR-001` M3 adoption, `ADR-002` repo and branch model, `ADR-003` tech stack).
12. **Open the first PR**: `feat/bootstrap` → `dev`. Self-review + CI green + merge to `dev`.
13. **Open the increment PR**: `dev` → `main`, with demo notes. **You merge this one.**
14. **Append every step to `docs/process-trace.md`** and write the first journal and discussion entries.

After step 13, the repo is bootstrapped and we begin the first real story (MVP 0), test-first.

---

## 9. Open questions (need your call before I execute)

1. **Repo visibility:** private (recommended, it is a real venture) or public?
2. **Permanent home:** create the repo at `~/Documents/GoServe` (recommended, per your storage rule) or keep it at `~/Downloads/GoServe`?
3. **`knowledge/` method:** vendored snapshot (clone with `.git` removed, recommended) or Git submodule?
4. **PDFs:** keep them out of the repo (recommended) or place them in `docs/reference/`?
5. **Tech stack confirm:** Next.js + Hono + Postgres for MVP 1, n8n for MVP 0 — agreed?
6. **GitHub account:** use `satvik-jain-iitd` (the active account) — agreed?

---

## 10. Process gaps I am adding (your ask)

The shipquick process is strong, but these are missing or too weak for GoServe. I will add them to the cloned knowledge instance and to our root rules:

1. **Sub-issue hierarchy.** Epics are features; stories are sub-issues tagged to the correct Epic.
2. **Test linkage.** Each test case links to the correct user story, and the test file is attached to that story's sub-issue.
3. **CI beyond pytest.** Node lint, typecheck, test, build for a TypeScript PWA.
4. **Pre-commit hooks, a linter, and a formatter.** Husky, lint-staged, ESLint, Prettier, commitlint.
5. **Feature-branch rollback.** A written rule: to fix a bad change, roll back or fix only that feature branch.
6. **Assumptions log.** `docs/assumptions.md` so nothing is tacit.
7. **Follow-ups log.** `docs/follow-ups.md` so nothing is lost.
8. **Feature-first docs.** Before building a feature, its business and product description plus acceptance criteria are written on its feature branch.

---

## 11. Definition of done for this bootstrap

The bootstrap is done when:

1. The `GoServe` repo exists and `main` is protected.
2. `dev` exists and all work flows through it.
3. `knowledge/shipquick_latest/` exists with a recorded source SHA.
4. The full structure in section 4 exists.
5. CI, hooks, lint, and format configs exist and pass on an empty project.
6. The issue tree exists, with correct Epic → Story → Test links.
7. `docs/process-trace.md`, the first journal entry, and the first discussion entry exist.
8. The first `feat → dev` PR is merged, and the first `dev → main` PR is open and waiting for you.
