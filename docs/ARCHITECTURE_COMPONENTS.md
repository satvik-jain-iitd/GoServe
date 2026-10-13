# GoServe — Architecture Components

**Date:** 11 Oct 2026 (first list). **Expanded per phase:** 13 Oct 2026.
**Plain English.** This file lists every part the system needs, phase by phase,
and what we must buy, sign up for, or get approved.

Source of this list: `docs/SOLUTION_ARCHITECTURE.md`, `docs/MVP0_SPEC.md`,
`docs/PRD.md`, `docs/JEV_INTEGRATION_PLAN.md`, ADR-001 to ADR-006, and
`docs/architecture/evolution.md` (the phase pictures).

---

## How to keep this file current

The per-phase expansion asked for in the first version is **done** (13 Oct 2026):
tables A to H have MVP0–MVP4 columns, new rows carry their start phase, the open
decision is closed, and procurement tables are below. The first "Prompt for Claude"
was removed because its job is finished.

From now on:
- When a phase starts, or a tool or an account changes, update that row and its evidence tag.
- Never delete a row. A dropped part stays, marked NOT USED with the reason.
- Keep secrets out of this file. Mark every claim VERIFIED, INFERRED or UNKNOWN.
- Options for parts we do not own yet live in `docs/research/options-*-2026-10.md`.

**Change log**
- 11 Oct 2026 — first flat list (tables A to H).
- 13 Oct 2026 — expanded to MVP0–MVP4; procurement tables; Supabase chosen (ADR-004).
- 13 Oct 2026 — updated from the owner Q&A: app URL, Jev key and cap, owned accounts, test devices, founder status.
- 13 Oct 2026 — MVP 0 phase gate passed: Supabase prod + dev, Cloudflare goserve-app, Vercel goserve-app-dev, UptimeRobot.
- 13 Oct 2026 — ADR-008: dev site on Vercel + Supabase `goserve-dev`; production on Cloudflare `goserve-app.pages.dev` + Supabase `goserve`.
- 13 Oct 2026 — accounts: GoServe services on klickbae8yt@gmail.com; development via the `klickbae8yt-star` GitHub account, review and merge by satvik-jain-iitd.
- 13 Oct 2026 — MVP 0 phase gate: Mumbai region, React + Vite + Capacitor, no custom backend, UptimeRobot, app/ folder (see `docs/architecture/phase-gate.md`).

---

## Legend

- **OWNED** — we already have it and it runs today.
- **FREE-ACCOUNT** — free tier, but an account must be created.
- **DECIDE** — one option must be chosen first.
- **PROCURE** — must be bought or registered.
- **APPROVAL** — outside gate, takes weeks (payment KYC, SMS, WhatsApp).
- **LATER** — not needed for MVP0 or MVP1.

Added for the phase columns:

- **USE** — used in this phase (with what changes).
- **FAKE** — shown on screen, but not real yet (demo only).
- **NOT USED** — on the list, but this phase does not need it. The reason is given once.
- **PAID** — a monthly cost starts in this phase.

Evidence tags: **VERIFIED** (checked on a vendor page or our own system, with date),
**INFERRED** (our reasoning), **UNKNOWN** (not checked yet).

Phases (see `docs/architecture/evolution.md`): **MVP0** investor demo (≤10 users),
**MVP1** pilot (1 kitchen, ≤1,000 users), **MVP2** one city (~10k users),
**MVP3** 1 lakh users, **MVP4** vision (not built now).

---

## A. Client / Frontend (one PWA)

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| PWA app (Next.js + TypeScript) | One codebase, role screens | Browser | DECIDE (stack ADR pending) | USE — React + Vite + TypeScript + Capacitor (ADR-006 accepted 13 Oct); code in `app/` | USE | USE | USE | USE — wrapped as native apps | INFERRED (ADR-006 proposed) |
| M3 design system + tokens | Look and feel | Browser | OWNED (tokens ready) | USE | USE | USE | USE | USE | VERIFIED (site/src/styles/tokens.css) |
| Web app manifest + service worker | Home-screen install | Browser | DECIDE | USE — install on Android, offline menu | USE | USE | USE | USE | INFERRED |
| Live client (SSE/WebSocket) | Status without refresh | Browser | DECIDE | USE — Supabase Realtime client | USE | USE — + rider location | USE — Pro limits | USE | VERIFIED (Supabase realtime limits page, 13 Oct) |
| Push client (Firebase Messaging SDK) | App push | Browser | FREE-ACCOUNT | NOT USED — on-screen only | USE — web push | USE | USE | USE | INFERRED |
| Geolocation capture | Rider live location | Browser | OWNED (browser API) | NOT USED — rider faked | NOT USED | USE — screen-on only (Wake Lock) | USE | USE — native background GPS | INFERRED (PWAs have no background location) |
| Maps / geocoding | Rider map, zone display | Browser | DECIDE | USE — drawn zone, free map tiles | USE | USE — road distance (see D) | USE | USE | INFERRED |
| Payment SDK (UPI/cards) | Checkout | Browser | LATER (MVP2) | FAKE — pay later | FAKE — pay later / cash | USE — Razorpay | USE | USE | INFERRED |
| Demo autopilot *(new, starts MVP0)* | Plays the full order story on the phone, even offline | Browser | — | USE | USE — demo mode only | USE — demo mode only | USE — demo mode only | USE | INFERRED |
| Split view + session space *(new, MVP0)* | Customer and kitchen on one phone; each demo session sees only its own orders | Browser + database | — | USE | NOT USED — real roles | NOT USED | NOT USED | NOT USED | INFERRED |
| Rider app wrapper (Play Store, TWA) *(new, MVP2)* | Keeps rider tracking alive on Android | Android | — | NOT USED | NOT USED | USE if riders lock screens | USE | USE — native app | INFERRED |
| Sample menu and photos *(new, MVP0)* | Delhi demo menu, 8–10 dishes | Supabase + free photos | — | USE — made by Claude (owner, 13 Oct) | NOT USED — real menu | NOT USED | NOT USED | NOT USED | VERIFIED (owner answer); photo licence in `docs/research/options-mvp0-mvp1-2026-10.md` |
| Logo *(new, MVP0)* | GoServe mark in the app | `design/` | — | USE — taken from the investor deck | USE | USE | USE | USE | VERIFIED (owner answer) |
| Test devices *(new, MVP0)* | Where we test before the founder demos | Laptop + phones | — | USE — Android emulation (Playwright) + owner's iPhone (Safari, Add to Home Screen) + final check on the founder's Android | USE | USE | USE | USE | VERIFIED (owner answer: only an iPhone at hand) |

## B. Edge / Delivery

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Static host | Doorway site | Cloudflare Pages | OWNED (live) | USE — site stays on project `goserve` (letsdwelo.in; project address goserve-arw.pages.dev); the app gets its own free project `goserve-app` (goserve-app.pages.dev) | USE | USE | USE | USE | VERIFIED (site live) |
| CDN + TLS | Free HTTPS, fast | Cloudflare | OWNED | USE | USE | USE | USE | USE | VERIFIED |
| Reverse proxy | Route API + live | nginx (Oracle) | OWNED | NOT USED for the app — front door is a Pages Function | NOT USED | NOT USED | NOT USED | revisit | INFERRED (ADR-004) |
| Tunnel | Public entry to Oracle | Cloudflare Tunnel | OWNED | USE — reaches n8n | USE | USE — side jobs only | USE | USE | VERIFIED (n8n.LinkRight.in live) |
| DNS + WAF | Domain, protection | Cloudflare | OWNED | USE | USE | USE | USE — + rate limit, bot check | USE | VERIFIED |
| Temporary domain | letsdwelo.in | Cloudflare | OWNED | NOT USED for the app — `goserve-app.pages.dev` instead (letsdwelo is another brand; `goserve.pages.dev` belongs to someone else) | site only | retire | retire | retire | INFERRED |
| Real brand domain + email | GoServe domain, hello@ | Registrar | PROCURE | NOT USED — pages.dev is fine for the demo | PROCURE | USE | USE | USE | UNKNOWN (price not checked) |
| API/PWA subdomains | app and api hostnames | DNS | DECIDE | NOT USED | USE — `app.` on the real domain | USE | USE | USE | INFERRED |
| Pages Function front door *(new, MVP0)* | `/api/*`: checks a token, limits spam, forwards to the brain | Cloudflare | — | USE — on `goserve-app`; free 100,000 requests a day | USE | USE | USE | USE | INFERRED |
| Health check page *(new, MVP0)* | One page that checks Supabase, n8n and Jev before a demo | Cloudflare | — | USE | USE | USE | USE | USE | INFERRED |

## C. Backend / Application

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| API service (Hono, TS) | All logic, REST | Oracle (pm2) | DECIDE (stack ADR) | NOT USED — n8n is the brain (ADR-007: no custom server in MVP 0–2) | NOT USED | NOT USED — Supabase functions take the hot path | NOT USED | revisit as an order service | INFERRED (ADR-004) |
| Order domain module | Event-driven core | Oracle | DECIDE | USE — n8n SUB 11 and 12 | USE | USE — Supabase functions | USE | USE — order service | INFERRED |
| Event bus + job queue | Order events, retries | Oracle / Redis | DECIDE | NOT USED — Supabase events table + Realtime | NOT USED | NOT USED | NOT USED | USE — real queue | INFERRED |
| Background workers | Dispatch, notify, timers | Oracle | DECIDE | USE — n8n | USE | USE — n8n side jobs | USE | USE — workers | INFERRED |
| Realtime gateway | SSE/WebSocket server | Oracle | DECIDE | NOT USED — Supabase Realtime | NOT USED | NOT USED | NOT USED | revisit | VERIFIED (Supabase realtime limits, 13 Oct) |
| Auth service (OTP + roles) | customer/kitchen/rider/ops/admin | Supabase Auth or self-host | DECIDE | FAKE — role picker | USE — Supabase Auth, Google + email | USE — + phone OTP after DLT | USE | USE | VERIFIED (Supabase free plan includes auth, 13 Oct) |
| Jev wrapper module | Only code calling OpenRouter | Oracle | DECIDE | USE — n8n SUB 13 Decide | USE | USE — + Laya quietly | USE — Laya first, Jev backup | USE | INFERRED |
| Notification sender | SMS/WhatsApp/push/in-app | Oracle | DECIDE | USE — on screen + Telegram to owner | USE — email + web push | USE — + WhatsApp/SMS | USE | USE | INFERRED |
| Menu / catalogue service | Items, prices, photos | Oracle | DECIDE | USE — Supabase table, seeded | USE | USE — menu admin | USE | USE | INFERRED |
| Dispatch service | Rider assignment | Oracle | LATER (MVP1) | USE — rule + Jev shown | USE | USE — + road distance | USE — Laya | USE | INFERRED |
| Inventory (light) service | Stock, low-stock | Oracle | LATER (MVP2) | NOT USED | NOT USED | USE | USE | USE | INFERRED |
| Ops/reporting service | Dashboards, alerts | Oracle | LATER (MVP2) | USE — ops screen + metrics panel | USE | USE | USE — reports from Mongo | USE — warehouse | INFERRED |
| Payment service | Idempotent charge, refund | Oracle | LATER (MVP2) | NOT USED | NOT USED | USE — Razorpay webhook on Supabase, unique key | USE | USE | INFERRED |
| Scheduler/cron | Backups, reports | Oracle | FREE (cron) | USE — n8n schedule | USE — + nightly archive | USE | USE | USE | INFERRED |
| Rate limiting / abuse guard | Protect API | Oracle/Redis | DECIDE | USE — in the Pages Function | USE | USE | USE — Cloudflare rules | USE | INFERRED |
| n8n workflow set *(new, MVP0)* | `GS MAIN 01`, `GS SUB 11–14`, `GS MAIN 90` | Oracle | — | USE | USE — + archive, proposal | USE — side jobs only | USE | revisit | INFERRED |
| PII scrub *(new, MVP0)* | Removes names, phones, addresses before logs or models | n8n / Supabase | — | USE | USE | USE | USE | USE | INFERRED |
| Order simulator *(new, MVP1)* | Makes realistic orders, riders and delays; also the load test | Laptop / Oracle | — | NOT USED | USE | USE | USE — 2× peak test | USE | INFERRED |

## D. Data

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Postgres (source of truth) | Orders, events, money | Supabase OR Oracle | **DECIDE** | USE — Supabase (decided, ADR-004) | USE | USE | PAID — Supabase Pro | USE — regional | VERIFIED (Supabase free: 500 MB, 13 Oct) |
| Connection pooler | Many connections | Supabase (built-in) OR pgbouncer | DECIDE | USE — Supabase built-in | USE | USE | USE | USE | INFERRED |
| Redis (cache + queue) | Events, retries, limits | Upstash OR local Oracle | FREE-ACCOUNT | NOT USED | NOT USED | NOT USED | NOT USED | revisit | INFERRED (ponytail: not needed) |
| MongoDB | Lead capture (n8n) | Oracle | OWNED | USE — leads only | USE — + archive | USE | USE — + indexes, reports | USE — warehouse feed | VERIFIED (leads saved, 11 Oct) |
| Object storage | Photos, backups | Oracle disk OR Cloudflare R2 | OWNED | USE — a few menu photos | USE | USE | USE | USE | INFERRED |
| Nightly backups | Postgres dumps | Oracle (+R2) | DECIDE | NOT USED — demo data | USE — export to Mongo/Oracle | USE | USE — Pro daily backups | USE | VERIFIED (Supabase free has no backups, 13 Oct) |
| Jev decision log store | Audit + future training | Postgres | DECIDE | USE — `decision_log` table | USE — + outcome labels | USE | USE | USE | INFERRED |
| `params`, `run_log` tables *(new, MVP0)* | Versioned settings; one row per workflow run | Supabase | — | USE | USE | USE | USE | USE | INFERRED |
| Database step rules *(new, MVP0)* | The database rejects an illegal order step | Supabase | — | USE | USE | USE | USE | USE | INFERRED |
| Row-level security *(new, MVP1)* | Each role and kitchen sees only its own rows | Supabase | — | NOT USED — session space only | USE | USE | USE | USE | INFERRED |
| Supabase keep-alive *(new, MVP0)* | Stops the free project from pausing | GitHub Actions | — | USE | USE | USE | NOT USED — Pro never pauses | NOT USED | VERIFIED (free projects pause after 1 week idle, 13 Oct) |
| Archive job *(new, MVP1)* | Moves old orders and logs to Mongo nightly | n8n | — | NOT USED | USE | USE | USE | USE | INFERRED |
| Dedicated Mongo user *(new, MVP1)* | Access to the `goserve` database only | Oracle | — | NOT USED | USE | USE | USE | USE | INFERRED |
| Road distance (OSRM, one city) *(new, MVP2)* | Real road distance and time | Oracle (or paid API) | — | NOT USED — straight line × 1.3 | NOT USED | DECIDE — by measurement | USE | USE | INFERRED |
| Map tiles (OpenFreeMap + MapLibre) *(new, MVP0)* | Free map pictures | Browser | — | USE | USE | USE | USE | USE | UNKNOWN (terms not checked) |

## E. Automation / Integrations (MVP0 path, already working)

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| n8n | MVP0 backend + lead forms | Oracle | OWNED (live) | USE — the brain | USE | USE — side jobs only | USE | revisit | VERIFIED (live) |
| n8n webhooks | Form/order endpoints | Oracle | OWNED (live) | USE — behind the front door | USE | USE | USE | USE | VERIFIED |
| Telegram bot @GoServeBot | Instant alerts | Telegram | OWNED (live) | USE — alerts + scorecard | USE — + thumbs for labels | USE | USE | USE | VERIFIED (live alert, 11 Oct) |
| OpenRouter account + key | Jev + free models | SaaS | OWNED | USE — GoServe-only key `GOSERVE_OPENROUTER_KEY`, hard cap $2 (checked: limit 2, used 0, 13 Oct) | USE | USE | USE — backup only | NOT USED if Laya wins | VERIFIED |
| Free LLM pool (improver) *(new, MVP1)* | Weekly proposal from the scorecard numbers | SaaS (free) | — | NOT USED | USE — owner says yes | USE | USE — inside hard limits | USE | INFERRED |

## F. AI / Models

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Jev via OpenRouter | Dispatch/ETA/cook decisions | SaaS | OWNED key (pay-per-use) | USE — shown as "AI suggests" | USE — logged with results | USE — live where it wins | USE — backup | NOT USED if Laya wins | VERIFIED (key owned) |
| Free/local models (Ollama) | Small jobs, future swap | Oracle | OWNED | NOT USED | NOT USED | USE — menu text, support sorting | USE | USE | INFERRED |
| Laya training *(new, MVP2)* | Fine-tune our decision model | Kaggle / Colab (free GPU), private Hugging Face repo | — | NOT USED | NOT USED — collect labels | USE — v1 | USE — weekly retrain | USE — per city | VERIFIED (notebook exists, 13 Oct); time UNKNOWN on our data |
| Laya serving *(new, MVP2)* | Answers decisions on our server | Oracle (`laya-serve`) | — | NOT USED | NOT USED | USE — quiet test | USE — live | USE | UNKNOWN (ARM CPU speed not measured) |

## G. Ops / DevOps / Quality

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| GitHub repo (public) | Code, issues, PRs | GitHub | OWNED | USE | USE | USE | USE | USE | VERIFIED |
| CI/CD | Test + Pages deploy | GitHub Actions | OWNED | USE — + app jobs | USE | USE | USE | USE | VERIFIED |
| Secrets store | Keys, tokens | GitHub + local folder | OWNED | USE | USE | USE | USE | USE | VERIFIED |
| Monitoring / error alerts | Catch failures | Sentry free OR n8n | PROCURE/decide | USE — n8n error workflow to Telegram | USE — + Sentry free | USE | USE | USE | INFERRED |
| Uptime checks | Ping site/API | Cloudflare / UptimeRobot | FREE-ACCOUNT | USE — UptimeRobot free (owner signs up, saves `UPTIMEROBOT_API_KEY`; Claude adds monitors + Telegram alert) | FREE-ACCOUNT | USE | USE | USE | INFERRED |
| Load testing | Year-1 scale test | k6 / Artillery | FREE (local) | NOT USED | USE — simulator | USE | USE — 2× peak | USE | INFERRED |
| Branch protection | Guard main/dev | GitHub | OWNED | USE | USE | USE | USE | USE | VERIFIED |
| Diagram gate *(new, MVP0)* | Checks architecture pictures (crossings, colours, overlaps) | Laptop | — | USE | USE | USE | USE | USE | VERIFIED (`docs/architecture/diagrams/gate-report.json`) |

## H. Accounts / Approvals / Outside gates

| Component | What it does | Owner | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Server | Runs API/DB/workers | Oracle (4 vCPU) | OWNED | USE — n8n | USE — + archive | USE — side jobs, Laya | USE | USE | VERIFIED |
| Cloudflare account + token | Host, DNS, tunnel | Owner | OWNED | USE | USE | USE | USE | USE | VERIFIED |
| Firebase project (FCM) | App push | Owner | FREE-ACCOUNT | NOT USED | FREE-ACCOUNT | USE | USE | USE | INFERRED |
| Supabase project | DB + Auth + Realtime (if chosen) | Owner | FREE-ACCOUNT | FREE-ACCOUNT — new project "goserve" in **Mumbai (ap-south-1)**; owner says one old project is paused and `sync.linkright.in` is live; check with the access token, then create | USE | USE | PAID — Pro | USE | VERIFIED (limit rule, 13 Oct) |
| Upstash Redis | Cache/queue | Owner | FREE-ACCOUNT | NOT USED | NOT USED | NOT USED | NOT USED | revisit | INFERRED |
| Payment gateway + KYC | Real money | Bank/gateway | **APPROVAL** | NOT USED | APPROVAL — Razorpay account OWNED (owner, 13 Oct); KYC not started | USE | USE | USE | INFERRED (lead time weeks) |
| SMS sender / DLT (India) | OTP + updates | Telecom | **APPROVAL** | NOT USED | APPROVAL — start | USE | USE | USE | INFERRED |
| WhatsApp Business Cloud API | Order updates | Meta | **APPROVAL** | NOT USED | APPROVAL — start | USE | USE | USE | INFERRED |
| Real domain + business email | Brand + hello@ | Registrar | PROCURE | NOT USED | PROCURE | USE | USE | USE | UNKNOWN (price) |
| Maps API (optional) | Geocoding | Google/Mapbox | PROCURE/decide | NOT USED | NOT USED | DECIDE — vs OSRM | USE if chosen | USE | UNKNOWN |
| GST / business entity | Payment + WhatsApp onboarding | Legal | Business | NOT USED | OWNED — company and GST exist (owner, 13 Oct); used for KYC | USE | USE | USE | INFERRED |
| FSSAI licence *(new, MVP1)* | Food business licence, needed for payments | Founder | — | NOT USED | APPROVAL — not started (owner, 13 Oct); see `docs/founder-checklist.md` | USE | USE | USE | INFERRED |
| Privacy, terms and refund pages *(new, MVP1)* | Needed for payment KYC and user trust | Owner | — | NOT USED | USE | USE | USE | USE | INFERRED |
| Consent notice (DPDP) *(new, MVP1)* | Tells users what we keep and why | Owner | — | NOT USED — demo data | USE | USE — + delete on request | USE | USE | UNKNOWN (DPDP Rules dates to verify) |
| Play Store developer account *(new, MVP2)* | Publish the rider app wrapper | Founder | — | NOT USED | NOT USED | PROCURE if TWA needed | USE | USE | UNKNOWN (fee not checked today) |
| Hugging Face account (private repo) *(new, MVP2)* | Store our Laya model | Owner | — | NOT USED | NOT USED | FREE-ACCOUNT | USE | USE | INFERRED |
| GitHub development account `klickbae8yt-star` *(new, MVP0)* | Every commit, push and PR; `satvik-jain-iitd` reviews and merges | Owner | — | ✅ Write access; logged in to `gh` (browser login) | USE | USE | USE | USE | VERIFIED (owner, 13 Oct) |
| Vercel account *(new row, owned)* | **Dev site host** (from `dev`), with the Supabase integration (ADR-008) | Owner (new account on klickbae8yt@gmail.com) | — | USE — dev site `goserve-app-dev` + Supabase `goserve-dev`; Hobby terms risk noted in ADR-008 | NOT USED | NOT USED | NOT USED | revisit only if we move to Next.js and pay for Pro | VERIFIED (Vercel fair-use page, 13 Oct) |
| Google Cloud account *(new row, owned)* | Google login (OAuth), Firebase push | Owner | — | NOT USED | USE — OAuth client + Firebase | USE | USE | USE | VERIFIED (owner answer) |
| Supabase account access token *(new, MVP0)* | Lets Claude create and manage the GoServe projects | Owner (new Supabase account on klickbae8yt@gmail.com) | — | ✅ saved; projects `GoServe` (prod) and `goserve-dev` created in Mumbai | USE | USE | USE | USE | VERIFIED (owner answer) |

## I. Operations tools (added 13 Oct 2026, starts MVP1)

Tools that run the business, not the product. Options and sources: `docs/research/options-operations-tools-2026-10.md`.

| Component | What it does | Runs on | First status | MVP0 | MVP1 | MVP2 | MVP3 | MVP4 | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Relationship CRM *(new, MVP1)* | Investors, kitchen partners, B2B leads | Attio | — | NOT USED | FREE-ACCOUNT — Attio Free (3 seats) | USE — Free, or Plus if more than 3 people | PAID — Attio Plus | USE | VERIFIED (attio.com/pricing, 13 Oct) |
| Support desk *(new, MVP1)* | Every complaint gets a number and an owner | WhatsApp + sheet, then Zoho Desk or Chatwoot | — | NOT USED | USE — WhatsApp Business app + a sheet | FREE-ACCOUNT — Zoho Desk Free or Chatwoot | PAID — Zoho Desk Standard | USE | VERIFIED (zoho.com/desk/pricing, 13 Oct) |
| Kitchen stock and purchase *(new, MVP1)* | Stock per kitchen, reorder, cost per plate | Sheet, then Odoo | — | NOT USED | USE — sheet or NocoDB | FREE-ACCOUNT — Odoo One App Free (Inventory) | PAID — Odoo Standard | USE | VERIFIED (odoo.com/pricing-plan, 13 Oct) |
| Accounts and GST *(new, MVP1)* | Invoices and GST reports | Zoho Books | — | NOT USED | FREE-ACCOUNT — Zoho Books Free (up to ₹25 lakh a year) + a CA | PAID — Standard ₹749/mo | PAID — Professional ₹1,499/mo | USE | VERIFIED (zoho.com/in/books/pricing, 13 Oct) |
| Payroll and attendance *(new, MVP1)* | Staff and rider pay | Zoho Payroll, then greytHR | — | NOT USED | FREE-ACCOUNT — Zoho Payroll Free (up to 10 people) | PAID — Zoho Payroll or greytHR | PAID — greytHR Growth | USE | VERIFIED (vendor pages, 13 Oct; Zoho Payroll conf 0.7) |
| Dashboards (BI) *(new, MVP1)* | Numbers for the founder and ops | Metabase on Oracle | — | NOT USED | USE — self-host | USE | USE, or Metabase Cloud | USE | VERIFIED (metabase.com, 13 Oct) |
| Team email and docs *(new, MVP1)* | hello@ and team mail on our domain | Google Workspace or Zoho Mail Free | — | NOT USED | PAID — Workspace Starter ₹270 per user (or Zoho Mail Free) | PAID | PAID | USE | VERIFIED (Workspace India pricing, 13 Oct) |

Rough monthly cost of these tools (excludes GST and WhatsApp messages; conf 0.6): MVP1 ≈ ₹540, MVP2 ≈ ₹4,600, MVP3 ≈ ₹30,000–40,000.

---

## Open decision (blocks procurement)

Two docs disagree, and there is no stack ADR yet:

- `docs/PRD.md` section 7: **Supabase** for Postgres + Auth + Realtime (fastest
  start, free 500 MB).
- `docs/SOLUTION_ARCHITECTURE.md`: **self-hosted Postgres on Oracle** plus own
  auth and WebSocket (fewer vendors, nothing to procure).

This one choice decides which free accounts to sign up for.

**Resolved, 13 Oct 2026 (ADR-004):** Supabase. n8n on Oracle is the brain for MVP 0
and 1. The Oracle server is kept out of the order hot path from MVP 2, because it
sometimes goes down. The product PWA stack is proposed in ADR-006.

---

## Procurement by phase

Who acts: **owner** (builder) or **founder** (business). Dates assume MVP 0 on 18 Oct 2026.

### MVP 0 — investor demo

| Item | Type | Why we need it | Lead time | Cost | Who acts | Start by | Evidence |
|---|---|---|---|---|---|---|---|
| Supabase project "goserve" | FREE-ACCOUNT | Orders, events, logs, live updates | Minutes | $0 | Owner | 14 Oct | VERIFIED (free plan, 13 Oct) |
| Cloudflare Pages project `goserve-app` | FREE-ACCOUNT (owned account) | Host the PWA and the front door at goserve-app.pages.dev | Minutes | $0 (no card on the free plan) | Owner | 14 Oct | VERIFIED (Cloudflare Pages and Workers docs, 13 Oct) |
| GoServe OpenRouter key | OWNED | AI suggestion on the ops screen | Done | Hard cap $2 | Owner | Done 13 Oct | VERIFIED (key limit read: 2) |
| Supabase account access token | Owner action | Check projects; create "goserve" | Minutes | $0 | Owner | 14 Oct | VERIFIED (owner will create it) |
| GitHub Actions keep-alive | OWNED | Stop the free project from pausing | Minutes | $0 | Owner | 18 Oct | INFERRED |

### MVP 1 — pilot

| Item | Type | Why we need it | Lead time | Cost | Who acts | Start by | Evidence |
|---|---|---|---|---|---|---|---|
| GoServe domain + email | PROCURE | Brand, login emails, trust | Days | UNKNOWN | Founder | 20 Oct | UNKNOWN |
| Google OAuth client | FREE-ACCOUNT | Google login | 1 day | $0 | Owner | MVP 1 start | INFERRED |
| Email sender for OTP (custom SMTP) | FREE-ACCOUNT | Supabase's default mail is rate-limited | 1 day | $0 at pilot size | Owner | MVP 1 start | UNKNOWN (provider limits not checked) |
| Firebase project (web push) | FREE-ACCOUNT | Push to installed apps | Minutes | $0 | Owner | MVP 1 start | INFERRED |
| FSSAI licence | APPROVAL | Needed for payments and a food business | Weeks | see `docs/founder-checklist.md` | Founder | **Now** (not started) | INFERRED |
| Razorpay KYC | APPROVAL | Real payments in MVP 2 (account already OWNED) | Weeks | Per-transaction fee | Founder | **Now** (not started) | VERIFIED (owner: account exists) |
| SMS DLT registration | APPROVAL | Phone OTP and SMS updates | Weeks | Per-SMS | Founder | 1 Nov | INFERRED |
| WhatsApp Business (Meta) | APPROVAL | Order updates on WhatsApp | Weeks | Per-message | Founder | 1 Nov | INFERRED |
| Privacy, terms, refund pages | Write | Needed for KYC | Days | $0 | Owner | 25 Oct | INFERRED |
| Dedicated Mongo user | Setup (owner yes) | Least access for GoServe | Minutes | $0 | Owner | MVP 1 start | INFERRED |

### MVP 2 — one city

| Item | Type | Why we need it | Lead time | Cost | Who acts | Start by | Evidence |
|---|---|---|---|---|---|---|---|
| Play Store developer account | PROCURE | Rider app wrapper, if riders lock screens | Days | UNKNOWN (one-time) | Founder | MVP 2 start | UNKNOWN |
| Road distance: OSRM or a paid maps API | DECIDE | Real distance and time | Days | $0 (self-host) or per call | Owner | MVP 2 start | UNKNOWN |
| Hugging Face account (private model) | FREE-ACCOUNT | Store the Laya model | Minutes | $0 | Owner | MVP 2 start | INFERRED |
| WhatsApp / SMS messages | PAID | Key order steps | — | Per message | Founder | MVP 2 start | UNKNOWN |

### MVP 3 — 1 lakh users

| Item | Type | Why we need it | Lead time | Cost | Who acts | Start by | Evidence |
|---|---|---|---|---|---|---|---|
| Supabase Pro | PAID | More than 200 live screens and 2M messages a month; backups; no pausing | Minutes | about $25 a month (check before buying) | Owner | When the trigger below fires | UNKNOWN (price not re-checked today) |
| Cloudflare rate-limit and bot rules | FREE or PAID | Protect the system at scale | Minutes | UNKNOWN | Owner | MVP 3 start | UNKNOWN |

### Start-now list (long lead times)

1. **FSSAI licence** — founder. Needed before payments.
2. **Razorpay KYC** — founder. Needs the business entity and policy pages.
3. **SMS DLT registration** — founder. Needed for phone OTP.
4. **WhatsApp Business approval** — founder.
5. **GoServe domain** — founder. Then move the site off letsdwelo.in.

### Monthly cost by phase (estimate)

| Phase | Expected monthly cost | Paid lines | Trigger that makes a paid line necessary |
|---|---|---|---|
| MVP 0 | ~$0 | none (Jev a few cents) | — |
| MVP 1 | ~$0 + domain | domain (yearly) | — |
| MVP 2 | small | WhatsApp/SMS per message; maybe a maps API | Customers need updates outside the app |
| MVP 3 | ~$25 + messages | Supabase Pro | Live screens near 150 at once, or messages near 1.5M a month, or 500 MB database |
| MVP 4 | more | per city | — |

Jev at 1 lakh users would be about $10–20 a month (INFERRED from $0.042 per million input tokens, VERIFIED on the OpenRouter listing in `docs/JEV_INTEGRATION_PLAN.md`). Laya removes it.

---

## Procurement summary (first version, kept as history)

- **Buy/register:** real brand domain and business email. Maps API only if we
  show a map (the spec allows skipping it with a drawn zone polygon).
- **Free account:** Firebase (FCM), Supabase (if chosen), Upstash (if chosen),
  a monitoring tool.
- **Approval, start day 1, takes weeks:** payment gateway KYC, SMS/DLT, WhatsApp
  Business.
- **Decide before procuring:** Supabase versus self-hosted on Oracle.
