# Assumptions

Every assumption we are working from, stated plainly. If an assumption turns out false, we fix the docs that depend on it.

| # | Assumption | Where it comes from | Status |
|---|---|---|---|
| A1 | Operations start in Delhi. The founder is based in Kota, but the pilot starts in Delhi (owner, 13 Oct 2026; replaces the earlier "Kota"). | Owner. | Confirmed |
| A2 | The first kitchen location in Delhi is not yet fixed. | Owner has not given it. | Open |
| A3 | Month-1 order volume is unknown. We design for Year-1 headroom of up to ~5,000 orders per kitchen per day. | Owner + benchmarks. | Open |
| A4 | We build a PWA first, not a native app. | Owner. | Confirmed |
| A5 | The front-end uses Material Design 3. | Owner + rulebook. | Confirmed |
| A6 | Jev is reached only through OpenRouter, with three models. | Owner. | Confirmed |
| A7 | Payment is faked in MVP 0. Real payment needs KYC and is deferred. | Our plan. | Open |
| A8 | SMS and WhatsApp notifications are faked until DLT and WhatsApp Business approvals arrive. | Our plan. | Open |
| A9 | The final stack (PWA + backend + database) is not yet approved. | Owner wants a separate discussion. | Open |
| A10 | The backend for MVP 0 is n8n, on the Oracle server. | Our plan. | Open |
| A11 | GitHub account for the repo is `satvik-jain-iitd`. | Owner. | Confirmed |
| A12 | The `knowledge/` rulebook is a Git submodule pinned to the `dev` branch of `shipquick_latest`. | Owner. | Confirmed |
| A13 | The investor doorway site is hosted on Cloudflare Pages, project `goserve`. | Our plan (ADR-001). | Confirmed |
| A14 | The doorway site is built with Astro; the product PWA stack stays separate. | Our plan (ADR-002). | Confirmed |
| A15 | The site is served on `letsdwelo.in` and `www.letsdwelo.in` as a temporary home. | Owner (ADR-003). | Confirmed |
| A16 | The site forms post to n8n, which saves to MongoDB and sends a Telegram alert. Postgres is not available yet. | Our plan. | Open |
| A17 | The GoServe GitHub repo is public for now, so free hosted CI and branch protection work. | Owner. | Confirmed |
| A13 | The investor doorway site is hosted on Cloudflare Pages, project `goserve`. | This plan, ADR-001. | Confirmed |
| A14 | `letsdwelo.in` and `www.letsdwelo.in` are a temporary home for the site; the final domain is not chosen. | Owner, ADR-003. | Confirmed |
| A15 | The GoServe repo is public for now, so the free CI checks and branch protection can be used. | Owner. | Confirmed |
| A16 | Site form submissions are stored in the MongoDB database `goserve`, then alerted by Telegram. | This plan. | Verified |
| A18 | 1 lakh users means about 5,300 orders a day: about 40% order in a month, about 4 orders each. Peak hour is about 15% of the day. | Our estimate (`docs/architecture/evolution.md`). To test with the order simulator. | Open |
| A19 | Each order makes about 10 events and about 3 screens watch it; about 6.5 KB per order with its events. | Our estimate. | Open |
| A20 | The Oracle server is ARM (Ampere), 4 vCPU, 24 GB RAM, 200 GB disk, no GPU, and sometimes goes down. | Owner (13 Oct). ARM not yet confirmed. | Open |
| A21 | The founder demos alone on an Android phone. | Owner (13 Oct). | Confirmed |
| A22 | GoServe accounts (Supabase, Cloudflare) stay in the owner's personal accounts for now. | Owner (13 Oct). | Confirmed |
| A23 | Jev's answers are the owner's output and may train Laya. | Owner (13 Oct). | Confirmed |
| A24 | MVP 0 back end: n8n is the logic, Supabase holds data and live updates (supersedes A10 and A16 for the product app). | Owner (13 Oct), ADR-004. | Confirmed |
| A25 | The enterprise architecture folder has no concrete privacy rules, so we use out-of-the-box controls. | Read in full, 13 Oct. | Confirmed |
