# Phase gate — run this before every MVP phase

**Owner rule (13 Oct 2026):** before moving to any MVP phase (MVP 0, 1, 2, 3, 4), we stop and check the
infrastructure with the owner. Nothing in the next phase is built until this gate passes.

## The steps

1. **Read** the next phase's column in `docs/ARCHITECTURE_COMPONENTS.md`. List every row that is not ready
   (anything other than OWNED or ready to USE).
2. **Ask** the owner, with the AskUserQuestion tool, one decision per question:
   - What do you already have? (accounts, keys, approvals)
   - For each missing part: 2–4 options with a recommendation and one line on why.
   - Teach in plain words (a kirana-store example) when something is new to the owner.
3. **Research** any part where the owner has nothing, using the web-research rules (tier, confidence, sources),
   and save it in `docs/research/`.
4. **Set up / procure** each item: accounts, projects, keys (only in `~/Desktop/Secrets/`), approvals started.
   Every account creation, paid step or deletion needs an explicit owner yes.
5. **Record** the result: update `ARCHITECTURE_COMPONENTS.md` (status + evidence), the phase's readiness table,
   the procurement tables, `docs/follow-ups.md` and `docs/assumptions.md`.
6. **Pass** only when every MUST item for the phase is ready, or the owner has deferred it in writing.

## MUST items by phase (from the components file)

| Phase | MUST be ready before building |
|---|---|
| MVP 0 | Supabase project (Mumbai), Cloudflare Pages project `goserve-app`, n8n access + GoServe folder + registry, Jev key with cap, Telegram alert bot, uptime monitor, sample menu, logo/icon, PWA stack decided |
| MVP 1 | Domain + email sender, Google OAuth client, web push keys, Sentry, Mongo archive user, privacy/terms/refund pages, Attio/Zoho Books (ops) accounts, DLT and FSSAI started |
| MVP 2 | Razorpay KYC done, WhatsApp Business verified, SMS DLT templates, maps provider, Laya serving test on the box, Play Store account if riders need it, payouts (RazorpayX) |
| MVP 3 | Supabase Pro decision, Cloudflare guard rules, load-test results at 2× peak, legal opinion on gig-worker rules |
| MVP 4 | Decided at MVP 3 |

## Gate log

| Phase | Date | Items checked | Decisions | Open items | Passed? |
|---|---|---|---|---|---|
| MVP 0 | 2026-10-13 | Supabase, Cloudflare, Jev, n8n, uptime, menu, logo, PWA stack, backend, test devices | Mumbai region; `app/` in this repo; wrangler creates `goserve-app`; UptimeRobot free; Jev live ($2 cap); GoServe n8n folder + registry; React + Vite + Capacitor; no custom backend (ADR-007) | Owner: `SUPABASE_ACCESS_TOKEN`, `UPTIMEROBOT_API_KEY`. Claude: create Supabase project, Pages project, monitors | Not yet (2 owner actions) |
