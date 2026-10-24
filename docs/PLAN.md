# GoServe — Process Plan

**Plain English.** This file is the process for GoServe. It says how work runs on GitHub, with test-driven development, demos at every step, and a written journey.

This process is adapted from our rulebook, the cloned `shipquick_latest` repository in `knowledge/shipquick_latest/`. Where GoServe needs more than the rulebook, the extra rules are written here and in `CLAUDE.md`.

---

## 1. The fixed order of operations

1. Create the repo, branches, labels, and board.
2. Lay down the docs tree.
3. Create every Epic and every Story as a GitHub issue with its Gherkin. No code before this.
4. Log every idea to `docs/ideas.md`.
5. Create the issue tree, then start the first story, test-first. Nothing is built in one shot.

---

## 2. Branching and review

| Branch | Role | Who merges |
|---|---|---|
| `main` | Release-ready, **run-critical code only** (no docs). Protected. | Only the owner. |
| `dev` | Integration. All work lands here first. | The owner (`satvik-jain-iitd`), after review and green CI. |
| `feat/<issue-number>-<slug>` | One branch per story, cut from `dev`. Pushed by the development account (`klickbae8yt-star`). | The owner, back into `dev`. |

Rules:

- One feature branch per story. The name must say what the feature does.
- **Two accounts:** Claude works as the development account (`klickbae8yt-star`): it commits, pushes and opens every PR. `satvik-jain-iitd` reviews and merges every PR. Claude never merges.
- PR feat → dev: opened by the development account, self-reviewed with a checklist comment, CI green, then reviewed and merged by the owner.
- PR → main at each increment: **code only** (owner, 13 Oct 2026). The development account cuts `release/<name>` from `main`, takes only the run-critical paths from `dev`, and opens the PR with the demo notes. **The owner merges.** Never merge `dev` into `main` directly (that would bring the docs). `ops/ai/` (offline tools, for example the Laya data generator) is left out of every release: those tools stay on `dev`.

  ```bash
  git checkout -b release/<name> origin/main
  git checkout origin/dev -- site app scripts design/tokens.json design/brand ops .github .gitignore README.md
  git rm -rq --cached ops/ai 2>/dev/null; rm -rf ops/ai   # offline tools stay on dev
  git commit -m "chore: promote <what> to main"
  ```
- I never push directly to `main`.
- **One stack at a time** (owner, 22 Oct 2026, `CLAUDE.md` rule 19): one PR or one `gh stack` chain open in the whole repo. Dependent work is a layer on top, not a loose PR. Review and merge bottom up; GitHub rebases the rest. Review changes are commits on the same layer, then `gh stack sync`. **Merge the bottom layer; the coder then runs `gh pr edit <n> --base dev` on the next layer and tells the owner "base is dev"; only then the owner merges it. The owner merges a layer only when the PR page shows base dev. A layer merged into a base that was already merged is lost (#228 on 24 Oct, #233 on 25 Oct 2026).**
- PR template: issue link, what changed, scenarios covered, test output pasted, demo, decisions made (ADR link), ideas noted.

---

## 3. Test-driven development (strict)

For every story:

1. Write the failing test first, named after the scenario.
2. Run it. See it fail. Paste the failure in the PR.
3. Write the least code that passes.
4. Refactor. Run again.

Rules:

- Deterministic logic gets unit tests. UI and flows get end-to-end tests.
- Every test is listed in `docs/tests/test-cases.md` with its story and scenario id.
- Each test file is attached to its story's sub-issue.
- No story starts before its Definition of Ready. No story closes before its Definition of Done.

---

## 4. The issue tree

- **Epic = feature.** A GitHub issue labelled `epic`. One per MVP area.
- **Story = sub-issue.** A GitHub issue labelled `story`, attached to its correct Epic.
- **Test = linked to its story.** The test file lives in the repo and is linked in the story's sub-issue, plus a row in `docs/tests/test-cases.md`.
- Board columns: Backlog, Doing, Review, Done.
- Every story carries: persona, the feature request it serves, Gherkin scenarios, Definition of Ready checklist, and the ponytail note.

---

## 5. Docs that move with the code

| File / folder | Job |
|---|---|
| `docs/PLAN.md` | This process. |
| `docs/process-trace.md` | One row per step. Read first every session, append before done. |
| `docs/LEARNINGS.md` | Every learning and mistake, one per row. Read it with the process trace. |
| `docs/ARCHITECTURE_COMPONENTS.md` | Every system part, one flat list now, to expand per phase later. |
| `docs/discussions/YYYY-MM-DD.md` | Bullet points per conversation. The "why". |
| `docs/decisions/ADR-NNN.md` | Every architecture or scope decision. |
| `docs/demos/D<n>.md` | What each increment shows and how to run it. |
| `docs/journal/YYYY-MM-DD.md` | Session notes: decided, surprised, dropped, measured. |
| `docs/ideas.md` | Every idea, dated, one line, with status. |
| `docs/assumptions.md` | Every assumption, stated plainly. |
| `docs/follow-ups.md` | Every follow-up, so nothing is lost. |
| `docs/tests/test-cases.md` | Every test with its story and scenario id. |
| `docs/research/` | Findings with tiers and confidence. |
| `docs/architecture/phase-gate.md` | The infrastructure Q&A and setup step before every MVP phase, with its log. |
| `design/` | The design language: `tokens.json` (source of truth) and how to reuse it. |
| `docs/architecture/` | Phase pictures, MVP 0 build design, diagram sources and gate report. |
| `docs/product/` | PRD, MVP 0 spec, investor site plan, founder checklist. |
| `docs/ai/` | Jev and Laya plans and the Jev contract. |
| `docs/archive/` | Finished history (bootstrap plan, self-prompt). Not maintained. |
| `docs/README.md` | One-page map of all docs. |

---

## 6. Definition of Ready (a story may start only when all are true)

1. The story is a GitHub issue linked to its Epic, with Gherkin scenarios copied in.
2. Every scenario is testable: a unit test, an end-to-end test, or a named manual acceptance row.
3. The persona and the feature request it serves are named in the issue.
4. Dependencies are listed and available.
5. The ponytail check is written in the issue: what is deliberately not being built.
6. The owner has seen the issue.

If any item is missing, the story goes back to the Backlog and the issue is fixed first.

---

## 7. Definition of Done (story)

1. Tests written first and green.
2. Scenarios mapped to tests, or to a named manual row.
3. Docs updated in the same PR.
4. Ponytail review: nothing speculative added.
5. The issue is closed by the PR.
6. A journal entry is written.

---

## 7b. Definition of Ready (increment / MVP phase)

1. The phase gate in `docs/architecture/phase-gate.md` has passed for this phase, and its log row is written.

---

## 8. Definition of Done (increment)

1. All its stories are done.
2. `docs/demos/D<n>.md` is written.
3. A `dev → main` PR is opened with the demo.
4. The owner has seen the demo and merged.

---

## 9. CI, CD, hooks, and quality

These are the additions GoServe makes on top of the rulebook.

### 9.1 CI (`ci.yml`), on every push and PR to `dev`

1. Pre-commit checks: no secrets, no files over 500KB, no merge markers, markdown blocks closed.
2. Commit message check (Conventional Commits).
3. PR size check (max 50 files).
4. Lint, typecheck, test, and build jobs are added once the stack ADR is accepted.

### 9.2 Pre-commit hooks

- `.pre-commit-config.yaml` runs on every commit.
- No secrets, no files over 500KB, no merge markers, markdown code blocks closed.
- Commit message checked against `COMMIT_GUIDELINES.md`.

### 9.3 Quality bar

1. Obvious code needs no comment. Non-obvious code gets a short comment explaining why.
2. Every module has a one-paragraph header comment: what it does, what it assumes.
3. No hardcoded colors. Use Material Design 3 design tokens.
4. Every assumption and every follow-up is written down.

---

## 10. Process trace and the playbook

- `docs/process-trace.md` is appended on every step. One row each, same columns, numbered on from the last row.
- Standing rule for every future session: first action is to read the trace; last action before "done" is to append the session's steps to it.
- The trace marks owner contact as **asked**, **volunteered**, or **reviewed**.
- `PLAYBOOK.md` is the final lesson file, written at the end of the project.
