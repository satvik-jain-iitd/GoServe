# GoServe — Project Rules

Read first: `docs/PLAN.md` (the process), `docs/process-trace.md`, and `docs/LEARNINGS.md`.

Standing rules, every session:

1. First action: read `docs/process-trace.md` and `docs/LEARNINGS.md`. Last action before "done": append this session's steps to the trace (one row each: date, step, actor, what, artifact, owner contact asked / volunteered / reviewed), and add one row to `docs/LEARNINGS.md` for every learning or mistake.
2. Every owner message that changes direction gets bullets in `docs/discussions/<START_DATE>.md`.
3. Every idea the owner states is logged at once to `docs/ideas.md`, with status (open / taken / dropped).
4. Work only from GitHub issues. An **Epic is a feature** (issue labelled `epic`). A **user story is a sub-issue** (issue labelled `story`) attached to its correct Epic. Branch `feat/<issue>-<slug>` from `dev`. PR feat → dev (self-review checklist, CI green, Claude merges). PR dev → main at each demo increment; **the owner merges main**. Never push directly to `main`.
5. TDD: failing test first, named after the Gherkin scenario, failure pasted in the PR. Each test is linked to its correct user story. The test file is attached to that story's sub-issue. Every test is listed in `docs/tests/test-cases.md`.
6. Ponytail: only the code the story needs. Nothing speculative.
7. Definition of Ready before a story starts; Definition of Done before it closes (see `docs/PLAN.md`).
8. Decisions that change architecture or scope get `docs/decisions/ADR-NNN.md` in the same PR.
9. PWA first. One codebase for customer, kitchen, rider, and ops. Backend does the work. Final stack is fixed by its own ADR.
10. Every assumption goes in `docs/assumptions.md`. Every follow-up goes in `docs/follow-ups.md`. Nothing stays tacit.
11. Before building any feature: create its feature branch first, then write the business-level description, the product-level description, the acceptance criteria, and the docs on that branch.
12. Commits follow `COMMIT_GUIDELINES.md` (Conventional Commits, English, short). PRs stay small: max 50 files. CI must be green before merge.
13. Pre-commit runs on every commit: no secrets, no files over 500KB, no merge markers, markdown code blocks closed, commit message checked.
14. Rollback: if a change breaks something, roll back or fix only the feature branch that caused it. Never touch unrelated branches.
15. No secrets in code. Secrets live in `~/Desktop/Secrets/` and in GitHub Actions secrets. Never commit a `.env`, key, or token.
