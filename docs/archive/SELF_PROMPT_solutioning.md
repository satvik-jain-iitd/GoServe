# Self-Prompt — Solutioning Document + Jev Plan (v3)

Written 11 Oct 2026. Updated after Satvik's inputs. This is the plan I will follow. It is not the output.

## Goal

Produce two documents in `/Users/satvikjain/Downloads/GoServe/docs`:

1. `SOLUTION_ARCHITECTURE.md` — the solutioning document for the whole system, start to end.
2. `JEV_INTEGRATION_PLAN.md` — where and how we use Jev, decision by decision.

Plus one viewable file: `diagrams.html` (opens in any browser, no install).

## New inputs from Satvik (11 Oct 2026)

- The AI-build-time idea now lives in his Obsidian vault as **ID049** (`~/Desktop/SecondBrain/Ideas`) and in `docs/ideas.md`. It is a side project (`ai-project-health-tracker`). We do NOT build it with GoServe now. Later we may apply it to GoServe's roadmap.
- He wants the whole build to assume **AI writes the code**, so the project health tracker's calibration loop decides our MVPs (log: complexity guess, reasoning tokens, edit loops, pass/fail, then a fitted range with a confidence gate).
- We have a real **Oracle server** (SSH verified this session, key `oracle_rotate`). He wants it used.
- He runs **n8n** (pm2 + Cloudflare tunnel) and wants it considered as the fast no-code backend for the clickable demo.
- Secrets: I used only the SSH key path. No other secrets touched.

## Environment facts (measured this session — 11 Oct 2026)

Oracle server `linkright-server` (opc@80.225.198.184):
- Compute: 4 vCPU, 22 GB RAM (about 7 GB free), 5 GB swap.
- Disk: 183 GB total, 66 GB free.
- Running services: MongoDB (`mongod`), PostgreSQL, `ollama` + one loaded model, `nginx`, `cloudflared` tunnel, `fail2ban`, docker (no containers running).
- n8n runs under **pm2** at `/home/opc/.npm-global/bin/n8n`. Tooling present: `n8n_compiler.py`, `n8n_test_runner.py`, `n8n_observability.py`, `n8n-snapshots`, `n8n.out`, `n8n_toolkit_complete.tar.gz`.
- Local LLMs (Ollama): gemma3:1b, gemma3:4b, qwen2.5:3b, qwen2.5-coder:3b, phi4-mini, lfm2.5-2.6b, lfm2.5 variants, nomic-embed-text, snowflake-arctic-embed2.
- Other projects on the box (not ours): dhandha, lifeos, miraya, linkright, brain, free-llm-pool, referral-automation, bhavna-stt, backups (20 GB), bench.

Implications:
- We already have **free Postgres + MongoDB + n8n + local models** on the box. The "free tier" worry shrinks. We can self-host the backend on Oracle.
- n8n can build the **MVP 0 clickable demo** fast, as Satvik asked.
- The scalable stack (Postgres source of truth + event bus + Hono API) can also run here later, or migrate to a managed cloud with no code change if we keep the no-rewrite rules.

## Steps

1. **Research Jev (TypeSafe AI) for real.** API shape: endpoints, input, output, how we give it a list of choices, how confidence returns, latency, price, rate limits, error handling. Sources: typesafe.ai docs and API console, launch blog, LangChain guide, OpenRouter listing. Use `agent-browser`. Tag sources by tier.
2. **Assess n8n for the demo.** Check the running n8n instance (pm2, tunnel) and what the n8n operator skill can create. Decide which part of MVP 0 n8n powers (order webhook to events, status updates to UI).
3. **Confirm resource limits.** Oracle Postgres/Mongo free capacity, free tiers for Cloudflare/Upstash/FCM, and whether we even need them (check: can n8n + Postgres on Oracle cover MVP 0 and MVP 1?).
4. **Write the decision catalogue.** For every Jev decision, list: what it is, inputs, allowed choices, fallback rule if confidence is low or Jev fails, confidence threshold, where it runs, failure mode. Candidates: rider assignment, ETA, next order to cook, late-order risk, zone/service check, abuse/fraud flag, offer choice, reorder nudge, support triage, copilot routing.
5. **Write `JEV_INTEGRATION_PLAN.md`:** what Jev is and is not (plain words); the one hard rule (behind one small module, never in the payment path); decision catalogue table; interface contract (state in, decision + confidence out); guardrails; decision logging for later training; Year-1 cost estimate; day-1 vs later decisions; how to swap Jev for our own tuned model with no app change.
6. **Write `SOLUTION_ARCHITECTURE.md`:** system context; containers/services (PWA, API, workers, DB, queue, realtime, decision engine, notifications, storage); event flow (order's life); user journeys (customer, kitchen, rider, ops); data model sketch; non-functional needs (5,000 orders/kitchen/day, latency, uptime); no-rewrite rules (portable, event-driven, idempotent); free-cost map; how n8n fits MVP 0 and what replaces it from MVP 1 on.
7. **Render diagrams:** Mermaid in markdown + a self-contained `diagrams.html` (Mermaid from CDN) so it opens in any browser.
8. **Verify:** open `diagrams.html` in `agent-browser`, screenshot each diagram, confirm renders with no error. Check markdown links.
9. **Track it:** add tasks under bd epic `yt-is8`; close when done.

## Deliverables

- `docs/ai/JEV_INTEGRATION_PLAN.md`
- `docs/architecture/SOLUTION_ARCHITECTURE.md`
- `docs/architecture/diagrams.html`
- (already done) `docs/architecture/roadmap.png`, `docs/ideas.md`, Obsidian idea ID049

## Definition of done

- Both docs read clean in Grade-5 English.
- Every diagram opens and renders in a real browser (verified by screenshot).
- The Jev plan names each decision, its fallback, and its cost.
- The architecture covers start (customer tap) to end (delivered, then analytics).
- The n8n-vs-real-backend line is clear and not a surprise rewrite.

## What I will not do

- No production code.
- No paid services.
- No other secrets folders without asking first (SSH key already used as directed).

## Confirmed facts (added 11 Oct, from Satvik + verified this session)

- **Jev is reached ONLY through OpenRouter.** No direct TypeSafe API. Three models exist:
  - `typesafe/jev-router` — the smart entry. Picks the best Jev model and reasoning effort per request. 1M context. Price dynamic.
  - `typesafe/jev-latest` — alias that always routes to the newest Jev family model. Good for experiments.
  - `typesafe/jev-1.13` — the pinned stable model. Input $0.042/M tokens, output $0, 64K context, released 18 Sep 2026. Takes Form/JSON input (a "null question" returns the probability a condition holds). This is our default for production decisions.
- **n8n URL:** https://n8n.LinkRight.in (verified live, HTTP 200, behind Cloudflare). Runs on the Oracle box under pm2.
- Plan rule from Satvik: planning first, building later. "Execute" here means produce planning documents, NOT start coding.

## Open items

- n8n login method + which workflows already exist (needed only when we plan MVP 0 demo more deeply).
- Access to 04_integrations.env (n8n API token) — ask Satvik before using.