# Assumptions

Every assumption we are working from, stated plainly. If an assumption turns out false, we fix the docs that depend on it.

| # | Assumption | Where it comes from | Status |
|---|---|---|---|
| A1 | Operations start in Kota. | Owner. | Confirmed |
| A2 | The first kitchen location in Kota is not yet fixed. | Owner has not given it. | Open |
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
