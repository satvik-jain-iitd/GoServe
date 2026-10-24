# Plan section E20 (from docs/mvp25/plan.md, 24 Oct 2026)

## E20 Pilot reporting on Telegram, platform health and cost, investor README (owner, 24 Oct, late)

**Context.** The owner accepted the breakpoint table (`reviewer-bundle/docs/product/pilot-breakpoints.md`) and asked for
automated reporting of those numbers against their thresholds on his Telegram, at the right frequency; platform
health and cost workflows ("check what exists, build what is missing"); and a README rewritten for tech investors.
Ideas ID142 to ID144. The pilot runs on the current UI, so this epic goes right after J3 and before H10 (the owner can
reorder). Stories H14, H15, H16. The coder ships; the reviewer wrote the design and reviews.

**What exists (VERIFIED 24 Oct, read-only).** `GS MAIN 90 Daily scorecard` (21:00 IST, dev ON, PROD off) calls `GS SUB 91
Scorecard numbers` (reads `run_log`, `decision_log`, last 24 h) and sends one Telegram message: runs, errors, time, Jev use,
cost. Code: `ops/n8n/order/build.js` (MAIN 90 and SUB 91 blocks), `ops/n8n/order/code/score_window.js`, `score_summary.js`,
`score_message.js`, tests `ops/n8n/order/scorecard.test.js` (CI runs `node --test "ops/n8n/order/*.test.js"`). `GS ERR 00
Alert` is ON for dev and prod (workflow failures to Telegram). `GS SUB 16 Health` asks Jev one question (the health page).
UptimeRobot: one monitor only, `n8n.linkright.in/healthz` (F42 done, F54 open: no app or site monitors). OpenRouter GoServe
key: hard cap $2, usage $0.0007, readable at `GET /api/v1/auth/key`. Sentry: deferred. Data for the pilot numbers:
`orders` (status incl. cancelled, `cancel_reason`, `rider_id`, `created_at`), `order_events` (event, actor, `created_at`:
placed, accepted, ... , `order.cancelled`) give accept latency, cook time and door time; `riders` holds one lat/lng row (no
history, so no location gaps yet); nothing records the customer's platform or a "call the kitchen" tap; `params` is the
versioned tunables table (rule 17 of the global manual); `feedback` rows exist.

**Frequency (reviewer's call, asked by the owner).** Three rhythms, one bot (`GoServeBot`), one chat (the owner):
1. **Instant, during open hours (11:00 to 22:30 IST), every 5 minutes:** the second bell. A placed order not accepted in
   3 minutes; a ready order with no rider for 5 minutes; a kitchen app with no staff read for 30 minutes while open. One
   message per event, never repeated for the same order (a `notified` mark in `order_events`). To the owner now; to the
   kitchen owner's Telegram once the cook joins the bot (`/start`, chat id saved by an admin row).
2. **Daily at 22:15 IST (after the kitchen closes at 22:00):** the pilot day card, the three numbers read every day plus
   the rest of the day's table, each against its breakpoint with a mark: `OK`, `WATCH` (within 20% of the line), `OVER`.
   Replaces the 21:00 scorecard time; the system block (runs, errors, cost) stays at the bottom of the same message.
3. **Weekly, Monday 09:00 IST:** the full breakpoint table for the last 7 days with the week before beside it, plus the
   platform health and cost block. **Monthly, the 1st at 09:00:** the same with a 30-day window and the month's cost
   against the phase estimate (~$0 for MVP 2). One workflow, two schedule triggers, Config picks the window.
Daily is right for the operational three (missed tickets, on-time, location gaps): they change by the day and the fix is
same-day. Weekly is right for the rest (radius, cash, refusals, iPhone share, lost sessions, calls): one day is too few
orders to read. Monthly is right for cost: free tiers bill monthly.

- **H14 Pilot report and watch** (n8n + one migration, `ops/n8n/order/build.js` and `code/`, registry
  `docs/integrations/n8n-order-workflows.md`):
  - Migration 0024 `pilot_numbers`: `rider_pings(user_id, at, lat, lng)` written by the rider app's 30 s location send
    through a new RPC `rider_ping` (keeps `riders.lat/lng` as today, adds the history; 30-day retention by a daily delete in
    the same report run); `orders.client_platform text` (`ios`, `android`, `other`, set by the app from the user agent at
    place); a `customer.call` row in `order_events` when the Tracker's Call button is tapped; `cancel_reason`
    `refused_at_door` from the rider's "Not delivered" path; `params` rows `pilot_breakpoints` v1 (the table's numbers:
    `orders_day 30, tickets_hour 10, missed_day 1, deliveries_rider_hour 4, radius_km 3.5, on_time_pct 80, gap_min 5,
    gap_share 0.2, cash_rider 8000, refused_pct 8, ios_share 0.33, lost_week 2, calls_share 0.2, realtime 200`) read by
    Config at run time (rule 17: a change is a new version, one-step rollback); a SQL function `pilot_numbers(since, until)`
    (security definer, admin or service role) that returns the day's numbers in one row, so SUB 91 does one read.
  - `GS SUB 91 Scorecard numbers`: one more read (`rpc/pilot_numbers`), `score_summary.js` merges it; `score_message.js`
    formats the pilot block first (three daily numbers, then the rest), each line `name: value / breakpoint · OK|WATCH|OVER`;
    the system block after. Window code unchanged except the hour (22:15). Tests red first in `scorecard.test.js`.
  - New `GS MAIN 92 Pilot watch` (schedule every 5 min, Config with `open_from`, `open_to`, `accept_min 3`, `rider_min 5`,
    `chat_id`, `kitchen_chat_id`, kill switch) → new `GS SUB 93 Watch numbers` (one RPC `pilot_watch()` returns the orders
    over the lines, not yet notified) → Format → Telegram → RPC marks `watch.notified` events. Fail closed; `errorWorkflow`
    ERR 00; `callerPolicy` list. Deployed inactive; the owner's "activate" turns the schedule on (rule A2.8).
  - New `GS MAIN 93 Weekly and monthly report` (two schedule triggers: Monday 09:00, the 1st 09:00) → SUB 91 with a 7 or
    30 day window (SUB 91 takes `since` and `until`; the daily card passes 24 h) → `GS SUB 94 Health and cost numbers` →
    Format → Telegram. Both PROD twins deployed inactive by `deploy.js`, as today.
  - Rider app: `rider_ping` call beside the existing location write; customer app: `client_platform` at place and the
    `customer.call` event; rider "Not delivered" sets the reason. e2e: one row each in the existing specs (helpers already
    fake `riders` and `orders`).
- **H15 Platform health and cost** (`GS SUB 94 Health and cost numbers`, UptimeRobot, no new accounts):
  - SUB 94 reads, each with its own fail-soft line (a failed read prints "could not read", never fails the report):
    OpenRouter `GET /api/v1/auth/key` (usage vs the $2 cap; WATCH at 50%, OVER at 80%); Supabase SQL function
    `health_numbers()` (database size vs 500 MB free, rows in `orders`, `run_log`, `rider_pings`, `order_events`, oldest
    row, `pg_stat_activity` count as a connections proxy); n8n API `GET /executions?status=error&limit=100` for the window
    (errors by workflow); UptimeRobot `getMonitors` (each monitor's status and 7-day uptime ratio). Cloudflare Pages and
    the Oracle box are not read (free, flat); a monthly manual line stays in the components doc.
  - UptimeRobot monitors added by script (`ops/health/uptimerobot.py`, read-plan then `--apply` after the owner's yes):
    `goserve-app.pages.dev/customer/`, `/kitchen/`, `/rider/`, `/admin/`, `goserve-app-dev.vercel.app/customer/`,
    `letsdwelo.in`, and the n8n health route `POST /webhook/gs-order` with `{action: "health"}` if UptimeRobot's keyword
    monitor can send a body (else the `healthz` monitor stays the only n8n one). Telegram alert contact is set by the owner
    in the UptimeRobot UI (F54), one line of help in the reply.
  - Cost caps as params: `cost_caps` v1 (`openrouter_usd 2, supabase_mb 500, n8n_errors_day 5`). The weekly and monthly
    messages print each against its cap with OK, WATCH, OVER. Sentry stays deferred (ERR 00 covers workflow errors; the app
    has no error tracker: a follow-up row, not this story).
  - Components doc rows (monitoring, uptime, cost) updated with VERIFIED evidence.
- **H16 README v2 for tech investors** (`README.md` on `dev`, then the release to `main`; `main` holds README by rule 17):
  the reviewer drafts the full text in `reviewer-bundle/docs/README-v2.md`, the coder copies it in. Shape, grade 5, every
  claim true today: (1) one line: GoServe runs its own kitchens and delivers hot meals in 25 to 35 minutes, cash at the door,
  Delhi pilot live; (2) "Why this is different", five short blocks: we run the kitchen so we own the minutes; one codebase,
  four apps, no app store needed; the system decides (Jev decision models, our own Laya model trained from our logs, zero
  text hallucination); zero login; built lean on free tiers with a two-person loop and AI-written, human-reviewed code;
  (3) "See it live" links: customer, kitchen, rider, admin, dev, investor site, the design system and the four journey
  canvases (marked private, the owner shares on request); (4) "Where we are today": pilot facts, no invented numbers, the
  breakpoint table link, the daily Telegram card as proof of discipline; (5) "What comes next": ten kitchens, maps,
  payments, second city, native apps (links to the plan, native-later, roadmap); (6) "How we build": TDD, two GitHub
  accounts, every decision an ADR, the process trace, the review notebook (links as today); (7) every existing link kept,
  regrouped; "under 15 minutes" and "one tap to pay" removed everywhere in the README. Investor FOMO comes from real
  speed of shipping (the trace shows 240+ steps in two weeks) and real AI depth (Jev, Laya), not from adjectives.
- **H17 PostHog product analytics** (owner, 24 Oct: "set it up properly, like a PostHog specialist, plan first; CLI, MCP or
  API key, whichever is easy"). Nothing exists today: no key in the vault, no analytics in `app/`, the components doc lists
  "PostHog free or Plausible, after the pilot starts" (E19). Log idea ID145 at execution.
  - **Account and tooling.** The owner makes a free PostHog Cloud project (region US by default; EU if he prefers data in
    the EU; India has no region), saves `POSTHOG_PROJECT_TOKEN` (public, write-only, ships in the app bundle as
    `VITE_POSTHOG_KEY`) and `POSTHOG_PERSONAL_API_KEY` (private, vault and GitHub secret only) in `04_integrations.env`.
    Easiest path: the **REST API with the personal key** from one spec file, applied by a script, so the setup is
    reproducible and reviewable (`ops/analytics/posthog_spec.json` + `ops/analytics/posthog_apply.py`: plan mode prints the
    diff, `--apply` creates or updates actions, insights and the dashboard; idempotent by name). The PostHog MCP server is a
    fine second tool for reading insights in a session; the CLI is for source maps and is not needed in the pilot.
  - **Identity (zero login, ADR-016).** `distinct_id` = the device session id for customers (the same id the orders carry,
    so PostHog and Supabase join on it); staff = the Google user id; `person_profiles: "identified_only"`. Person
    properties set once: `role`, `pin_code`, `kitchen_id` (staff), `theme`, `installed` (standalone display mode). Never a
    name, phone or address in any event (DPDP hygiene and no PII in a third party). Autocapture **off**, explicit events
    only (clean data, far under the free 1M events a month). Session replay **on for the customer app only**, 20% sample,
    all inputs masked, off for staff apps. Feature flags not used yet. Demo mode and e2e send nothing (`VITE_POSTHOG_KEY`
    empty in tests; the helper mocks `*.posthog.com` to be safe).
  - **Event taxonomy** (`object_action`, snake_case, one wrapper `app/src/lib/analytics.ts` with `track(name, props)`,
    `identify(id, props)`, `pageview(screen)`; every event carries `app` (customer, kitchen, rider, admin), `screen`,
    `theme`, `env`):
    - Customer: `app_opened` (installed, platform from `$os`), `pin_submitted` (pin, served), `menu_viewed` (kitchen_id,
      open), `thali_switched` (veg or non_veg), `veg_only_toggled`, `dish_viewed`, `item_added` (item_id, qty, price_paise,
      from: hero or list), `item_removed`, `bill_viewed` (items, total_paise), `details_saved`, `order_placed` (order_id,
      total_paise, items_count, kitchen_id, pin, platform) **the conversion**, `order_failed` (reason code),
      `tracker_viewed` (status), `call_kitchen_tapped`, `delivery_confirmed` (answer: yes or not_yet), `feedback_sent`
      (kind, has_image), `push_permission` (granted or denied), `theme_changed`, `install_prompt` (shown or accepted).
    - Kitchen: `gate_not_staff_seen`, `ticket_accepted` (order_id, latency_s), `cooking_started`, `ticket_ready`
      (cook_s), `kitchen_open_toggled` (open), `dish_soldout_toggled`, `tab_switched` (new, cooking, kitchen).
    - Rider: `rider_online_toggled`, `job_received` (order_id, distance_m), `pickup_confirmed`, `delivered_tapped`
      (door_s), `not_delivered_tapped` (reason), `cash_handover_marked`. No per-ping event (30 s pings stay in Supabase).
    - Admin: `kitchen_added`, `person_added` (kind), `order_cancelled` (reason), `call_tapped` (who: customer, kitchen,
      rider), `simulator_action` (later).
    - Server side from n8n (HTTP node to `/capture` with the project token from Config, fire and forget, in SUB 14 Write
      logs so every run already passes there): `order_status_changed` (from, to, actor, seconds_since_placed),
      `dispatch_decided` (candidates, jev_used, agrees, ms, cost), `push_sent` (kind, delivered), `watch_alert_sent`
      (kind). Server events carry the order's session id as `distinct_id`, so funnels join client and server.
  - **Spec file contents** (what the script creates): actions `Order placed`, `Order delivered`, `Ticket accepted late`
    (latency_s > 120); insights: funnel pin → menu → item_added → bill → order_placed (per platform), funnel order_placed
    → delivered with median time, trend orders per day, trend on-time share (`door_s` ≤ 2100), trend missed tickets
    (`Ticket accepted late`), platform share pie (`$os`), weekly retention of ordering customers (answers "lost sessions"
    from the other side), trend `call_kitchen_tapped` per order, trend errors (`order_failed` by reason); one dashboard
    "GoServe pilot" with those eleven tiles in the breakpoint table's order; the Telegram day card (H14) links to it.
  - **Guard rails.** Events are listed in `docs/product/analytics-events.md` (one row each: name, who fires it, props,
    why it exists); a unit test fails when `track(` is called with a name not in that list; no event ships without its
    row. Cost line in the weekly health card: events this month vs 1,000,000 and replays vs 5,000 (free tier numbers
    checked on PostHog's pricing page at execution; conf 0.7 today).
- Order inside E20: H14 (watch first, then the day card), H15, H16, H17. Each a layer in the stack after J3 (rule 19).

**Verification.**
- H14: `node --test "ops/n8n/order/*.test.js"` red then green (window at 22:15, breakpoint marks OK/WATCH/OVER on fixture
  numbers, the watch picks only un-notified orders, the message never has a `{{`); `check_city_model.py dev` rows for
  `pilot_numbers`, `pilot_watch`, `rider_ping`, the platform column and the call event; a dry run on dev: seed six dev
  orders with timestamps (one late accept, one refused, one iPhone) and read the dev card the owner receives at 22:15 or on
  the TEST hook; the watch fires once for the late order and not again. Prod twins inactive until "activate".
- H15: `ops/health/uptimerobot.py` plan shows the six monitors, `--apply` after the yes, `getMonitors` lists them; SUB 94
  dry run prints OpenRouter usage, database size and the error count; a Monday card on dev.
- H16: the README reads at grade 5 (`grade.py` 7.0 or under on the prose), every link answers 200 (a link check in the PR),
  no number on it that a doc does not back.
- H17: `posthog_apply.py` plan shows the actions, insights and dashboard; `--apply` after the keys exist; the dashboard
  lists eleven tiles; the events test is red for an unlisted name and green after the row; one dev order from the phone
  shows the funnel pin → order_placed → delivered on the dashboard within a minute; e2e run sends zero PostHog calls.

