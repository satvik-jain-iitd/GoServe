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
| A26 | **Wrong (13 Oct, deploy log):** `goserve.pages.dev` is not ours; our site project is `goserve-arw.pages.dev` + `letsdwelo.in`. The app project will be `goserve-app` (real address from its first deploy; may get a suffix). Old text: The app lives at `goserve-app.pages.dev`; `goserve.pages.dev` and `letsdwelo.in` are the investor site. | Owner Q&A, 13 Oct. Checked (HTTP 200 on goserve.pages.dev). | Confirmed |
| A27 | Jev spend for GoServe is capped at $2 by a GoServe-only OpenRouter key. | Owner, 13 Oct. Key limit read: 2. | Verified |
| A28 | The owner already has: a Razorpay account (KYC not done), a company with GST, a Google Cloud account, a Vercel account (not used). | Owner Q&A, 13 Oct. | Confirmed |
| A29 | The founder has not started FSSAI, the Delhi kitchen, DLT or WhatsApp Business. | Owner Q&A, 13 Oct. | Confirmed |
| A30 | Testing before the founder demo: Android emulation on the laptop + the owner's iPhone; the founder's Android for the final check. | Owner Q&A, 13 Oct. | Confirmed |
| A31 | Volume guesses for costs: 4 map calls and 3 WhatsApp messages per order, ₹300 average order. | Research, 13 Oct. To test. | Open |
| A32 | Frontend is React + Vite + TypeScript + Capacitor; no custom backend server in MVP 0–2. | Owner, 13 Oct (ADR-006, ADR-007). | Confirmed |
| A33 | Supabase project region is Mumbai (ap-south-1). | Owner, 13 Oct. | Confirmed |
| A34 | We build dispatch, the rider app, the kitchen screen and referral/loyalty; we buy payouts, KYC checks and call masking. | Research (operations-tech-deep), 13 Oct. To confirm with the owner. | Open |
| A35 | GoServe accounts move to the owner's development identity `klickbae8yt@gmail.com`: new Supabase, Vercel and UptimeRobot accounts; GitHub dev account `klickbae8yt-star`. Supersedes A22 for new services. | Owner, 13 Oct. | Confirmed |
| A36 | Claude commits, pushes and opens PRs only as the development account; `satvik-jain-iitd` reviews and merges every PR. | Owner, 13 Oct. | Confirmed |
| A37 | `main` holds only run-critical code (site, design tokens and brand files, ops scripts, CI/deploy, README). All documentation lives on `dev`. | Owner, 13 Oct. | Confirmed |
| A38 | `letsdwelo.in` belongs to the Dropshipping project (Dwelo). It is a temporary home for the GoServe investor site only; no changes unless the owner asks; it moves to a GoServe domain later. | Owner, 13 Oct. | Confirmed |
| A39 | The app's address is **`goserve-app.pages.dev`** (project created 13 Oct, no suffix). letsdwelo.in stays the investor site only. | Owner, 13 Oct. | Confirmed |
| A40 | Dev site on Vercel (from `dev`) with Supabase `goserve-dev`; production on Cloudflare `goserve-app.pages.dev` (from `main`) with Supabase `goserve`. | Owner, 13 Oct (ADR-008). | Confirmed |
| A41 | MVP 0 order steps are `placed, accepted, preparing, ready, out_for_delivery, delivered`, one step forward at a time. No cancel yet. Rider assigned and arriving are events in `order_events`, not statuses. | Agent, story #43, 14 Oct. | Confirmed (owner, 14 Oct 2026) |
| A42 | In MVP 0 the rule decides the rider and Jev only advises (build design: shown, not trusted). Riders come in the request (3 seeded demo riders); there is no riders table yet, so the free flag and distance are the phone's word: fine for one demo device, not for a pilot (trust boundary, F68 e). Accept Jev at confidence 0.70 or more (contract D1). A Jev call over $0.001 is ignored. A session may place at most 20 orders. | Agent, story #46, 14 Oct. | Confirmed (owner, 14 Oct 2026) |
| A43 | The bill for MVP 0 is the item total: no tax line and free delivery, because the server total (`place_order`) is the item sum. The dish detail screen is skipped: dishes are added from the menu list. The address is one free-text box. | Agent, story #48, 14 Oct. | Confirmed (owner, 14 Oct 2026) |
| A44 | The kitchen screen is a tab in the same app. It shows only the orders of this browser's session (ADR-010), so two devices need the link of story #52 (A46) to share one session. After Ready the kitchen has no button: the rider steps are story #50. Anyone with the demo token can send a kitchen tap (the actor is the phone's word, ADR-009); a kitchen login is MVP 1. An update that arrives in the first second after the live subscription can be missed; opening the Kitchen tab first covers it. | Agent, story #49, 14 Oct. | Confirmed (owner, 14 Oct 2026) |
| A45 | The rider screen is a third tab. The rider's buttons are: Pick up (status `out_for_delivery`), Arriving (an event, once), Delivered. The customer tracker shows the six statuses, so Arriving is in the events but the customer sees 'On the way' until Delivered. A rider is not assigned in MVP 0 and the `order.rider_assigned` event is not written (F72). | Agent, story #50, 14 Oct. | Confirmed (owner, 14 Oct 2026) |
| A46 | The 18 Oct demo runs on two devices (owner, 14 Oct). The second device opens a link `?join=<session id>` and reads that session. The id is a random uuid, so the link is the key (F74 b). Reset clears the session's orders, events and decisions for both devices, after a yes tap; `run_log` stays. The phone may call only these two database functions (`join_session`, `reset_session`); every order write still goes through n8n (ADR-009, ADR-011). | Agent, story #52, 14 Oct. | Open: owner to confirm |
| A47 | The ops screen is a fifth tab. When an order is Ready and has no decision row, the screen asks `decide` once with three fixed demo riders (R1 free 1800 m 3 trips, R2 free 900 m 1 trip, R3 busy), so the rule picks R2. It shows one line from the `decision_log` row. The metrics are: "Order to this screen" (median of orders that arrived live, device clock against server `created_at`), "Decision time" (the latest `decide` call in `run_log`) and "Runs today" (`run_log` rows of this session since midnight). No charts. | Agent, story #51, 14 Oct. | Open: owner to confirm |
| A48 | The health page is `/health` in the same app, open to anyone with the link (it shows only OK or FAIL, times and short notes, no keys). Supabase is checked by reading one menu row with the anon key. n8n and Jev are checked by one `health` call to the order webhook with the demo token: a 200 answer means the workflow is on, the token is right and the kill switch is off; the answer also says if Jev replied to one tiny question (about $0.00002 per page open or Run again). The call is logged in `run_log` and counts in "runs today". Alerting stays with UptimeRobot (F54). | Agent, story #54, 14 Oct. | Open: owner to confirm |
| A49 | Autopilot is one button in the demo bar. In airplane mode (the phone says it is offline) it plays the order story from local sample data: one sample order goes Placed, Accepted, Cooking, Ready, On the way, Arriving, Delivered, every 2 seconds, on the customer, kitchen, rider and ops screens, under an "Offline demo" banner. Nothing is sent. The ops numbers are marked as samples. Online, it moves the newest open order of this session by itself (the kitchen steps, then the rider steps) with real calls, so each step is saved, and it stops after Delivered. With no open order online it says "Place an order first." If the server cannot be reached (a call fails with no network, or the order list cannot be read), it switches to the offline story. Tapping it again stops it and clears the sample order. | Agent, story #53, 14 Oct. | Open: owner to confirm |

