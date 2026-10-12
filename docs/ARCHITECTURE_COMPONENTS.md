# GoServe — Architecture Components

**Date:** 11 Oct 2026
**Plain English.** This file lists every part the system needs, as one flat list
today. Later, Claude expands it phase by phase.

Source of this list: `docs/SOLUTION_ARCHITECTURE.md`, `docs/MVP0_SPEC.md`,
`docs/PRD.md`, `docs/JEV_INTEGRATION_PLAN.md`, and ADR-001, ADR-002, ADR-003.

---

## Prompt for Claude (read this first)

Claude: read this document at the start of any architecture or procurement
session. This is only the first, basic version. Right now the tables below list
each component once, for the whole system. Your job in later stages is to expand
every table (A to H) into one column per phase — MVP0, MVP1, MVP2, MVP3, MVP4 —
so each row shows whether that component is needed in that phase, deferred, or
not used at all. Keep the same rows, the same A to H grouping, and the same
plain English. For each phase, add a short status and one line on what changes
in that phase (for example: "MVP0 faked, MVP1 real"). Never delete a row; if a
component appears later, append it and mark the phase it starts in. When you
expand it, keep secrets and tokens out of the file, and keep every claim marked
VERIFIED, INFERRED, or UNKNOWN.

---

## Legend

- **OWNED** — we already have it and it runs today.
- **FREE-ACCOUNT** — free tier, but an account must be created.
- **DECIDE** — one option must be chosen first.
- **PROCURE** — must be bought or registered.
- **APPROVAL** — outside gate, takes weeks (payment KYC, SMS, WhatsApp).
- **LATER** — not needed for MVP0 or MVP1.

---

## A. Client / Frontend (one PWA)

| Component | What it does | Runs on | Status |
|---|---|---|---|
| PWA app (Next.js + TypeScript) | One codebase, role screens | Browser | DECIDE (stack ADR pending) |
| M3 design system + tokens | Look and feel | Browser | OWNED (tokens ready) |
| Web app manifest + service worker | Home-screen install | Browser | DECIDE |
| Live client (SSE/WebSocket) | Status without refresh | Browser | DECIDE |
| Push client (Firebase Messaging SDK) | App push | Browser | FREE-ACCOUNT |
| Geolocation capture | Rider live location | Browser | OWNED (browser API) |
| Maps / geocoding | Rider map, zone display | Browser | DECIDE |
| Payment SDK (UPI/cards) | Checkout | Browser | LATER (MVP2) |

## B. Edge / Delivery

| Component | What it does | Runs on | Status |
|---|---|---|---|
| Static host | Doorway site | Cloudflare Pages | OWNED (live) |
| CDN + TLS | Free HTTPS, fast | Cloudflare | OWNED |
| Reverse proxy | Route API + live | nginx (Oracle) | OWNED |
| Tunnel | Public entry to Oracle | Cloudflare Tunnel | OWNED |
| DNS + WAF | Domain, protection | Cloudflare | OWNED |
| Temporary domain | letsdwelo.in | Cloudflare | OWNED |
| Real brand domain + email | GoServe domain, hello@ | Registrar | PROCURE |
| API/PWA subdomains | app and api hostnames | DNS | DECIDE |

## C. Backend / Application

| Component | What it does | Runs on | Status |
|---|---|---|---|
| API service (Hono, TS) | All logic, REST | Oracle (pm2) | DECIDE (stack ADR) |
| Order domain module | Event-driven core | Oracle | DECIDE |
| Event bus + job queue | Order events, retries | Oracle / Redis | DECIDE |
| Background workers | Dispatch, notify, timers | Oracle | DECIDE |
| Realtime gateway | SSE/WebSocket server | Oracle | DECIDE |
| Auth service (OTP + roles) | customer/kitchen/rider/ops/admin | Supabase Auth or self-host | DECIDE |
| Jev wrapper module | Only code calling OpenRouter | Oracle | DECIDE |
| Notification sender | SMS/WhatsApp/push/in-app | Oracle | DECIDE |
| Menu / catalogue service | Items, prices, photos | Oracle | DECIDE |
| Dispatch service | Rider assignment | Oracle | LATER (MVP1) |
| Inventory (light) service | Stock, low-stock | Oracle | LATER (MVP2) |
| Ops/reporting service | Dashboards, alerts | Oracle | LATER (MVP2) |
| Payment service | Idempotent charge, refund | Oracle | LATER (MVP2) |
| Scheduler/cron | Backups, reports | Oracle | FREE (cron) |
| Rate limiting / abuse guard | Protect API | Oracle/Redis | DECIDE |

## D. Data

| Component | What it does | Runs on | Status |
|---|---|---|---|
| Postgres (source of truth) | Orders, events, money | Supabase OR Oracle | **DECIDE** |
| Connection pooler | Many connections | Supabase (built-in) OR pgbouncer | DECIDE |
| Redis (cache + queue) | Events, retries, limits | Upstash OR local Oracle | FREE-ACCOUNT |
| MongoDB | Lead capture (n8n) | Oracle | OWNED |
| Object storage | Photos, backups | Oracle disk OR Cloudflare R2 | OWNED |
| Nightly backups | Postgres dumps | Oracle (+R2) | DECIDE |
| Jev decision log store | Audit + future training | Postgres | DECIDE |

## E. Automation / Integrations (MVP0 path, already working)

| Component | What it does | Runs on | Status |
|---|---|---|---|
| n8n | MVP0 backend + lead forms | Oracle | OWNED (live) |
| n8n webhooks | Form/order endpoints | Oracle | OWNED (live) |
| Telegram bot @GoServeBot | Instant alerts | Telegram | OWNED (live) |
| OpenRouter account + key | Jev + free models | SaaS | OWNED |

## F. AI / Models

| Component | What it does | Runs on | Status |
|---|---|---|---|
| Jev via OpenRouter | Dispatch/ETA/cook decisions | SaaS | OWNED key (pay-per-use) |
| Free/local models (Ollama) | Small jobs, future swap | Oracle | OWNED |

## G. Ops / DevOps / Quality

| Component | What it does | Runs on | Status |
|---|---|---|---|
| GitHub repo (public) | Code, issues, PRs | GitHub | OWNED |
| CI/CD | Test + Pages deploy | GitHub Actions | OWNED |
| Secrets store | Keys, tokens | GitHub + local folder | OWNED |
| Monitoring / error alerts | Catch failures | Sentry free OR n8n | PROCURE/decide |
| Uptime checks | Ping site/API | Cloudflare / UptimeRobot | FREE-ACCOUNT |
| Load testing | Year-1 scale test | k6 / Artillery | FREE (local) |
| Branch protection | Guard main/dev | GitHub | OWNED |

## H. Accounts / Approvals / Outside gates

| Component | What it does | Owner | Status |
|---|---|---|---|
| Server | Runs API/DB/workers | Oracle (4 vCPU) | OWNED |
| Cloudflare account + token | Host, DNS, tunnel | Owner | OWNED |
| Firebase project (FCM) | App push | Owner | FREE-ACCOUNT |
| Supabase project | DB + Auth + Realtime (if chosen) | Owner | FREE-ACCOUNT |
| Upstash Redis | Cache/queue | Owner | FREE-ACCOUNT |
| Payment gateway + KYC | Real money | Bank/gateway | **APPROVAL** |
| SMS sender / DLT (India) | OTP + updates | Telecom | **APPROVAL** |
| WhatsApp Business Cloud API | Order updates | Meta | **APPROVAL** |
| Real domain + business email | Brand + hello@ | Registrar | PROCURE |
| Maps API (optional) | Geocoding | Google/Mapbox | PROCURE/decide |
| GST / business entity | Payment + WhatsApp onboarding | Legal | Business |

---

## Open decision (blocks procurement)

Two docs disagree, and there is no stack ADR yet:

- `docs/PRD.md` section 7: **Supabase** for Postgres + Auth + Realtime (fastest
  start, free 500 MB).
- `docs/SOLUTION_ARCHITECTURE.md`: **self-hosted Postgres on Oracle** plus own
  auth and WebSocket (fewer vendors, nothing to procure).

This one choice decides which free accounts to sign up for.

## Procurement summary (only what must be got)

- **Buy/register:** real brand domain and business email. Maps API only if we
  show a map (the spec allows skipping it with a drawn zone polygon).
- **Free account:** Firebase (FCM), Supabase (if chosen), Upstash (if chosen),
  a monitoring tool.
- **Approval, start day 1, takes weeks:** payment gateway KYC, SMS/DLT, WhatsApp
  Business.
- **Decide before procuring:** Supabase versus self-hosted on Oracle.
