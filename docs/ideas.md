# Ideas Log

Every idea from the owner or from Claude, dated, one line, with status (open / taken / dropped).

- ID001 (2026-10-11, open): AI Project Health Tracker. A calibration loop that learns the true size of a task from complexity guess, reasoning tokens, edit loops, and pass/fail, then predicts rework probability. Side project. Full note: `docs/ideas.md`.
- ID002 (2026-10-11, open): Use n8n as the no-code backend for the MVP 0 clickable demo, so the demo ships in days.
- ID003 (2026-10-11, open): Jev decisions behind one wrapper, with a plain fallback rule for every decision. Keeps the system safe and swappable.
- ID004 (2026-10-13, taken): Meta-workflows. Workflows log their own runs and improve their own settings from feedback (Capture, Measure, Propose, Test, Promote). In the plan: `docs/architecture/evolution.md`. Second Brain ID067.
- ID005 (2026-10-13, taken): Replace Jev with a fine-tuned Laya model trained on our own decisions. Plan: `docs/ai/LAYA_PLAN.md`. Second Brain ID068.
- ID006 (2026-10-13, open): LinkedIn post on the Laya founder story. Second Brain ID069.
- ID007 (2026-10-13, taken): Spread the load across free tiers: n8n brain, Supabase hot data, Mongo archive, Cloudflare app. Second Brain ID070.
- ID008 (2026-10-13, taken): Demo autopilot on the founder's phone, so the pitch cannot fail. Second Brain ID071.
- ID009 (2026-10-13, dropped for orders): n8n Data tables as the MVP 0 database. Dropped because they have no transactions and are shared with other projects (ADR-004).
- ID010 (2026-10-13, open): Use free-tier ops software (Odoo, Attio, agentic CRMs) to run operations instead of building ops tools. Research: docs/research/options-operations-tools-2026-10.md. Second Brain ID072.
- ID011 (2026-10-13, taken): Phase gate before every MVP phase (infra Q&A, research, setup, record). Rule: docs/architecture/phase-gate.md, CLAUDE.md rule 16. Second Brain ID073.
- ID012 (2026-10-14, taken): PR review skill: Fable analyses, a Haiku subagent writes the prose. Strong brain, cheap pen. Done in tpm-pr-review (references/analysis-brief.md). Second Brain ID084.
- ID013 (2026-10-14, taken): PR review skill critical-path first: post questions + coder handoff right after analysis, approve at once when nothing must change, notebook written in the background, one paste-block per handoff so reviewer, writer and coder never idle. Done in tpm-pr-review. Second Brain ID085.
- ID093 (2026-10-15, taken): Customer, kitchen, rider and ops as separate installable PWAs that work on one device and on different devices, one device first. Story #83, ADR-013. Second Brain ID093.
- ID094 (2026-10-22, open): Anti-slop design skills picked by evidence, then a side-by-side test on the same brief. Research in `docs/research/design-skills-2026-10.md`.
- ID095 (2026-10-22, open): Jev mode `live | stub | off` and a budget guard for automated tests. `docs/research/jev-cost-control-2026-10.md`.
- ID096 (2026-10-22, open): Regression suite with stable `data-testid` ids that grows with every story.
- ID097 (2026-10-22, open): APK built by GitHub Actions and sent to Telegram, only if the Chrome install fails.
- ID098 (2026-10-22, open): Founder review message listing who reviews what. Draft in `docs/product/founder-review-message.md`.
- ID099 (2026-10-22, open): the app must keep its state after a refresh (owner UAT feedback). F102 a.
- ID100 (2026-10-24, open): owner, during the #220 review: make rules so CI failures stop eating review time; fix it permanently, not per PR. Finding: no git hooks are installed although rule 13 says pre-commit runs; the Guard runs first in CI (subjects over 72 chars failed #66, #71, #220). Proposal: mirror the CI Guard in a commit-msg and pre-push hook plus one `make check`; a CI failure becomes a local check the same day, never only a learning row.
