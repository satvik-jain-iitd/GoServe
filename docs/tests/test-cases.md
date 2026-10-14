# Test cases

Every test, with its story and scenario. Story #16 = architecture evolution page.

| Test | Story | Scenario | Kind | File | Result |
|---|---|---|---|---|---|
| Diagram gate: crossings, arrows through boxes, backward arrows, labels, overlaps, text outside boxes, colours, font, PNG size | #16 | S1 | Automatic | `~/.claude/skills/diagram-standards/render.mjs`, report `docs/architecture/diagrams/gate-report.json` | Pass (7 of 7) |
| Gate catches a bad draft (red first) | #16 | S1 | Automatic | naive draft (in the PR) | Fails as expected: 1 backward arrow, 3 unlabelled arrows, 1 colour outside the palette |
| Gate counts crossings right (K3,3 graph, 2 layers = 9) | #16 | S1 | Automatic | sanity check (in the PR) | 9 crossings reported |
| Phase pictures keep the same slots, rows and order | #16 | S2 | Automatic | `--compare` in the gate | Pass |
| Components list keeps every first row, has MVP0–MVP4 columns, evidence tags, procurement tables | #16 | S3 | Manual review | `docs/ARCHITECTURE_COMPONENTS.md` | Pass |
| MVP0 spec, PRD, solution doc and ADR-004 name the same MVP 0 back end | #16 | S4 | Manual review | those files | Pass |
| Home, pre-register and footer name Delhi as the first city | #18 | S1 | End-to-end | `site/tests/e2e/site.spec.ts` (first city) | Pass |
| No page says Kota | #18 | S1 | End-to-end | `site/tests/e2e/site.spec.ts` (first city) | Pass |
| palette.ts, tokens.css and the diagram theme match design/tokens.json | #18 | S2 | Unit | `site/tests/unit/tokens.test.ts` | Pass |
| Components file has no "Prompt for Claude" and keeps every first row (138 → 145 table lines) | #20 | S1 | Automatic (grep) | `docs/ARCHITECTURE_COMPONENTS.md` | Pass |
| Every non-owned part has researched options with tier, confidence and a recommendation | #20 | S2 | Manual review | `docs/research/options-*-2026-10.md` | Pass |
| MVP 0 readiness table marks each dependency | #20 | S3 | Manual review | `docs/architecture/mvp0-build-design.md` | Pass |
| Full ops research saved with tiers and sources (both parts) | #22 | S1 | Manual review | `docs/research/operations-tech-deep-2026-10.md` | Pass |
| ADR-006, ADR-007 and the components file match the MVP 0 Q&A | #22 | S2 | Manual review | those files | Pass |
| CLAUDE.md and PLAN.md point to the phase gate | #22 | S3 | Automatic (grep "phase-gate") | `CLAUDE.md`, `docs/PLAN.md` | Pass |
| Manifest is installable: name, standalone, start url | #39 | S1 | Unit | `app/tests/unit/manifest.test.ts` | Pass |
| Manifest has 192 and 512 icons on disk, token colours only | #39 | S1 | Unit | `app/tests/unit/manifest.test.ts` | Pass |
| App opens, links the manifest, registers a service worker | #39 | S1 | End-to-end | `app/tests/e2e/app.spec.ts` | Pass |
| App tokens.css has every core, supporting and status colour from tokens.json | #39 | S2 | Unit | `app/tests/unit/tokens.test.ts` | Pass |
| tokens.css has no colour outside tokens.json | #39 | S2 | Unit | `app/tests/unit/tokens.test.ts` | Pass |
| Manifest colours come from tokens.json; index.html theme-color matches; Apple touch icon linked | #39 | S1 | Unit | `app/tests/unit/manifest.test.ts` | Pass |
| App shell loads offline after the first visit | #39 | S1 | End-to-end | `app/tests/e2e/app.spec.ts` | Pass |

| Guard: clean file passes; secret, file over 500KB, merge marker, unclosed code block are blocked | #40 | S2 | Unit | `scripts/test_guard.py` | Pass |
| Guard: Conventional Commit subjects accepted, bad ones rejected; PR over 50 files rejected | #40 | S2 | Unit | `scripts/test_guard.py` | Pass |
| Every PR runs lint, type check, unit, e2e and build for app/ | #40 | S1 | CI | `.github/workflows/ci.yml` job `app` | Pending first PR run |
| Push to dev with `app/**` deploys to Vercel with the three repo secrets | #41 | S1 | Unit (workflow check) | `scripts/test_deploy_dev.py` | Partly: workflow check passes; URL row below is pending |
| Deploy paths contain `app/**` and never `site/` | #41 | S2 | Unit (workflow check) | `scripts/test_deploy_dev.py` | Pass |
| Dev URL returns 200 and the app is installable | #41 | S1 | Manual after first deploy | `goserve-app-dev` URL | Pending first deploy |
| App on main publishes to Pages project `goserve-app` with Cloudflare secrets, paths `app/**` and `design/tokens.json` | #42 | S1 | Unit (workflow check) | `scripts/test_deploy_app.py` | Pass |
| `deploy.yml` (project `goserve`) is unchanged and app deploy never watches `site/` | #42 | S2 | Unit (workflow check) | `scripts/test_deploy_app.py` | Pass |
| `goserve-app.pages.dev` returns 200 (today 522) | #42 | S1 | Manual after the first release PR to main | `goserve-app.pages.dev` | Pending first release |
| The 7 tables exist and each has `kitchen_id` and `session_id` (kitchens has `session_id`) | #43 | S1 | Integration (goserve-dev) | `scripts/test_schema.py` | Pass (local only; CI skips, no token) |
| Order status can only move one step forward; skip and back are rejected, the legal path works | #43 | S2 | Integration (goserve-dev) | `scripts/test_schema.py` | Pass (local only; CI skips, no token) |
| The same client order key sent twice leaves one order row | #43 | S3 | Integration (goserve-dev) | `scripts/test_schema.py` | Pass (local only; CI skips, no token) |
| Two anonymous sessions: A sees only A's orders | #44 | S1 | Integration (goserve-dev) | `app/tests/integration/supabase.test.ts` | Pass (local only; CI skips, no keys) |
| The anon key cannot insert an order | #44 | S1 | Integration (goserve-dev) | `app/tests/integration/supabase.test.ts` | Pass (local only; CI skips, no keys) |
| A subscribed client gets a new order within 2 seconds of the insert | #44 | S2 | Integration (goserve-dev) | `app/tests/integration/supabase.test.ts` | Pass (local only; CI skips, no keys) |
| Menu has 8 to 10 dishes, each with a photo link and credit | #44 | S3 | Integration (goserve-dev) | `app/tests/integration/supabase.test.ts` | Pass (local only; CI skips, no keys) |
| Right token passes; wrong, missing or unset token fails; unknown action is bad | #45 | S1 | Unit (Code node) | `ops/n8n/order/order.test.js` | Pass |
| Place order: good input becomes a database call; bad input gets 400; answers map to 201, 200, 400 | #45 | S1 | Unit (Code node) | `ops/n8n/order/order.test.js` | Pass |
| Place order writes the order and one `order.placed` event; a retry returns the same order; price comes from the menu | #45 | S1 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| Bad dish, quantity or address is refused by the database | #45 | S1 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| Accepted, preparing, ready each write an event; an illegal step errors and writes nothing; another session cannot change the order | #45 | S2 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| Illegal step maps to 409 and unknown order to 404; database text is never returned | #45 | S2 | Unit (Code node) | `ops/n8n/order/order.test.js` | Pass |
| Kill switch on: SUB 11 and SUB 12 refuse with 503 and a clear message | #45 | S3 | Unit (Code node) | `ops/n8n/order/order.test.js` | Pass |
| MAIN calls the SUBs by id with the fields their triggers declare; order is Config, token, kill switch, route; refusals never reach the database | #45 | S1 S2 S3 | Unit (wiring) | `ops/n8n/order/order.test.js` | Pass |
| Canvas layout of all workflows: no overlap, 200 px gaps, text band, flow left to right, no link through a box or a node | #45 | S1 S2 S3 | Unit (layout) | `ops/n8n/order/order.test.js` | Pass |
| The webhook returns 401, 201, 200, 409, 503 for real calls on n8n | #45 | S1 S2 S3 | Live (after deploy and the owner's yes) | `gs-order` webhook | Pending deploy |
| The alert message escapes HTML and names the workflow, node, error and execution; every order workflow reports to ERR 00 | #45 | S1 S2 S3 | Unit | `ops/n8n/order/order.test.js` | Pass |
| Deploy script touches only the six GS workflows, never activates or deletes | #45 | S1 | Unit | `ops/n8n/order/order.test.js` | Pass |
| Even if the order functions are granted to `authenticated` by mistake, row level security blocks the write | #45 | S1 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| A session can place 20 orders; a retry of an existing key still works at the cap; the 21st is refused; other sessions are not affected | #46 | S1 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| Cap maps to 429 with a short message | #46 | S1 | Unit (Code node) | `ops/n8n/order/order.test.js` | Pass |
| Rule picks the free rider with fewest trips, then shortest distance, else none | #46 | S1 | Unit (Code node) | `ops/n8n/order/decide.test.js` | Pass |
| Jev request: pinned model, temperature 0, 32 tokens, allowed choices, no names or addresses | #46 | S1 | Unit (Code node) | `ops/n8n/order/decide.test.js` | Pass |
| One row records the rule pick, the Jev pick with confidence and the pick used; the rule decides even when Jev disagrees | #46 | S1 | Unit (Code node) | `ops/n8n/order/decide.test.js` | Pass |
| Jev error, bad reply, low confidence, over cost cap or off: the rule decision goes through and the row says why | #46 | S2 | Unit (Code node) | `ops/n8n/order/decide.test.js` | Pass |
| A decision is returned only if its row was stored; a database failure gives 502 without raw text | #46 | S1 | Unit (Code node) | `ops/n8n/order/decide.test.js` | Pass |
| SUB 14 builds the run row (time, settings version, cost, error) and refuses bad input; MAIN 01 logs every routed run after answering | #46 | S3 | Unit (Code node and wiring) | `ops/n8n/order/decide.test.js` | Pass |
| Decision and run rows in the shape the workflows write are accepted by the database | #46 | S1 S3 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| Real Jev answer for a ready order and three riders, with a confidence, in one `decision_log` row; Jev down leaves the rule pick | #46 | S1 S2 | Live (after the OpenRouter credential, deploy and the owner's yes) | `gs-order` webhook | Pending deploy |
| Cart: add, change quantity, remove at 0, cap 20, lines in menu order, total is the sum; money shown in rupees | #48 | S1 | Unit | `app/tests/unit/cart.test.ts` | Pass |
| Menu: fresh load keeps a copy; network failure uses the copy; no network and no copy says so; a broken copy or an empty answer never replaces a good copy | #48 | S2 | Unit | `app/tests/unit/menu.test.ts` | Pass |
| Place order posts action, session, key, ids and quantities (no price) with the demo token; refusals show the server message; network failure and odd answers give plain messages | #48 | S1 | Unit | `app/tests/unit/orders.test.ts` | Pass |
| Order path: add 2 dishes, bill total is right, place order, order sent with token and key, "Order placed" shown (network answered by the test) | #48 | S1 | End-to-end | `app/tests/e2e/customer.spec.ts` | Pass |
| Address is required; quantity buttons change the bill; a refused order shows the reason and the retry uses the same key | #48 | S1 | End-to-end | `app/tests/e2e/customer.spec.ts` | Pass |
| Menu shows with the network off after one load; with no copy the screen says the menu is not available | #48 | S2 | End-to-end | `app/tests/e2e/customer.spec.ts` | Pass |
| The dev build gets VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ORDER_URL and VITE_DEMO_TOKEN from secrets | #48 | S1 | Unit (workflow check) | `scripts/test_deploy_dev.py` | Pass |
| A real order from the dev URL is saved in Supabase (order row and `order.placed` event) | #48 | S1 | Live (after the owner says activate) | `goserve-app-dev.vercel.app` | Pending activation |
| Menu on the founder's Android phone installs and works offline | #48 | S2 | Manual | founder's phone | Pending |
| Kitchen: Accept, Start, Ready are the three kitchen steps; no button after Ready; newest order first; an older copy that arrives late is ignored; the order number is the first 8 characters | #49 | S1 S2 | Unit | `app/tests/unit/kitchen.test.ts` | Pass |
| Status change posts the status action with the actor and the token; a refusal shows the server reason; a network failure gives a plain message | #49 | S2 | Unit | `app/tests/unit/orders.test.ts` | Pass |
| A new order reaches the kitchen list within 2 seconds of the call returning, and its next step arrives too; the list holds only this session's orders | #49 | S1 | Integration (goserve-dev) | `app/tests/integration/kitchen.test.ts` | Pass (local only; CI skips, no keys) |
| A new order appears on the kitchen screen without a refresh; orders already placed show on open; a rider-taken order leaves the list | #49 | S1 | End-to-end (live socket answered by the test) | `app/tests/e2e/kitchen.spec.ts` | Pass |
| Accept, Start, Ready send the next step as the kitchen; a live update moves the card; a refused tap shows the reason and keeps the button | #49 | S2 | End-to-end | `app/tests/e2e/kitchen.spec.ts` | Pass |
| With the workflows on, tapping Accept, Start, Ready on a real order moves it and adds three events | #49 | S2 | Live (after the owner says activate) | `goserve-app-dev.vercel.app` | Pending activation |
| Owner phone check of the dev URL (stories #48 and #49). Steps: 1) open https://goserve-app-dev.vercel.app on the phone and wait for 10 dishes; 2) Add to Home Screen and open it from the icon; 3) switch on airplane mode, close the app, open it again: the menu shows with "Showing the saved menu"; 4) switch airplane mode off, add 2 dishes, type an address, Review bill, check the total; 5) tap Kitchen and Customer: the cart stays; 6) after "activate": place the order, open Kitchen, tap Accept, Start, Ready | #48 #49 | S1 S2 | Manual | founder's phone | Pending |
| `rider_event` writes `order.arriving` without changing the status; refused when not on the road, when repeated, for other events, for another session; the phone keys cannot call it | #50 | S1 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| SUB 15 turns arriving into a database call, refuses bad input (400) and the kill switch (503); a wrong state or a repeat gives 409; MAIN 01 routes `event` to SUB 15; layout is clean | #50 | S1 | Unit (Code node, wiring, layout) | `ops/n8n/order/event.test.js` | Pass |
| Rider actions: Pick up for ready, Arriving and Delivered on the road, none otherwise; rider list holds ready and on-the-road orders; `addEvent` posts the event action | #50 | S1 | Unit | `app/tests/unit/kitchen.test.ts`, `app/tests/unit/orders.test.ts` | Pass |
| Customer tracker: six steps in order with done, current and to come; ends at Delivered; one label map for kitchen and customer | #50 | S2 | Unit | `app/tests/unit/kitchen.test.ts` | Pass |
| Rider taps send pick up, arriving and delivered as the rider; a live order appears on the rider list; a refused tap shows the reason | #50 | S1 | End-to-end | `app/tests/e2e/rider.spec.ts` | Pass |
| The customer sees every step live without a refresh and it ends at Delivered | #50 | S2 | End-to-end (live socket answered by the test) | `app/tests/e2e/rider.spec.ts` | Pass |
| A real order walks placed, accepted, cooking, ready, on the way, delivered with six events plus arriving, and the customer tracker follows it live | #50 | S1 S2 | Live (after deploy of SUB 15, MAIN 01 update and the owner's activate) | `goserve-app-dev.vercel.app` | Pending activation |
| Arriving that was already sent (the rider page was reloaded) is shown as done, with no error | #50 | S1 | End-to-end | `app/tests/e2e/rider.spec.ts` | Pass |
| An unknown event answers 'Unknown event.'; the MAIN 01 receive note names all four actions | #50 | S1 | Unit | `ops/n8n/order/event.test.js` | Pass |
| After Arriving the order can still be delivered, with events in order | #50 | S1 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| A device reads its own session and any it joined by link; joining a missing session is refused; reset clears only that session (orders, events, decisions), works for a joined device, refuses a stranger; events stay frozen outside reset; the phone keys can call join and reset, the bare key cannot | #52 | S2 S3 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| A joined device gets the first device's new order within 2 seconds, sees it by read, and a reset sends delete events and empties both | #52 | S2 S3 | Integration (goserve-dev, live) | `app/tests/integration/supabase.test.ts` | Pass (local only) |
| Join link is read from `?join=`, the joined session wins over the own one, the share link is built from the address, reset calls `reset_session` and gives a plain message on failure | #52 | S2 S3 | Unit | `app/tests/unit/session.test.ts` | Pass |
| Split view shows customer and kitchen side by side and a placed order appears in the kitchen pane | #52 | S1 | End-to-end | `app/tests/e2e/split.spec.ts` | Pass |
| A second device opens the link, joins, reads the joined session and its kitchen tap names the order's session; the share link carries this device's session | #52 | S2 | End-to-end | `app/tests/e2e/split.spec.ts` | Pass |
| Reset asks first, clears on yes, keeps on no, returns the customer to the menu; a delete event from the other device empties this screen | #52 | S3 | End-to-end | `app/tests/e2e/split.spec.ts` | Pass |
| `clear_dev.py` refuses any project but goserve-dev, runs only counts without `--apply`, deletes children before orders in one transaction | #52 | S3 | Unit | `scripts/test_clear_dev.py` | Pass |
| Two real devices: customer phone places an order, kitchen device (opened from the copied link) sees it, both clear on Reset | #52 | S1 S2 S3 | Live (owner phone check, after activate) | `goserve-app-dev.vercel.app` | Pending activation |
| A device reads decisions and runs of its own and joined sessions only; the bare anon key reads none | #51 | S1 S2 | Integration (goserve-dev) | `scripts/test_order_rpc.py` | Pass (local only; CI skips, no token) |
| The suggestion line says what the AI suggests and whether the rule agrees, the rule pick when it disagrees, when the AI was too unsure, why there was no suggestion, and when no rider is free; helpers for time and median; the three demo riders | #51 | S1 S2 | Unit | `app/tests/unit/ops.test.ts` | Pass |
| `askDecision` posts the decide action with riders, returns the decision, shows a refusal as a plain message and distrusts an answer with no decision | #51 | S1 | Unit | `app/tests/unit/orders.test.ts` | Pass |
| A ready order gets one decision call and shows the line; an order that already has a decision is not asked again; an order that is not ready is not listed; a refused call shows the reason once and does not loop | #51 | S1 | End-to-end | `app/tests/e2e/ops.spec.ts` | Pass |
| The metrics panel shows order-to-screen time, decision time and runs today, and says so when there is nothing yet | #51 | S2 | End-to-end | `app/tests/e2e/ops.spec.ts` | Pass |
| A ready order on the dev URL shows "AI suggests rider R2 (nn%)." with "The rule agrees." or "The rule picked R2." (the real model may pick R1) from a real Jev call, and the panel shows real numbers; the browser can read the `content-range` header of the run count | #51 | S1 S2 | Live (after the owner says activate) | `goserve-app-dev.vercel.app` | Pending activation |
| After the other device resets, the customer tracker goes back to the menu | #52 | S3 | End-to-end | `app/tests/e2e/split.spec.ts` | Pass |
| `/health` checks Supabase (one menu row), n8n and Jev: OK with times, FAIL with a plain note, n8n failures say why (wrong token, kill switch, workflow not active, no answer, unexpected answer) and Jev is then "not checked" | #54 | S1 | Unit | `app/tests/unit/health.test.ts` | Pass |
| The page shows all green, shows one failing part with its reason while the others keep theirs, shows a wrong token, and Run again checks again | #54 | S1 | End-to-end | `app/tests/e2e/health.spec.ts` | Pass |
| SUB 16 asks Jev one tiny question (pinned model, 3 s), reports OK, error, bad reply or off as a 200 answer, writes nothing, is called only by MAIN 01; MAIN 01 routes `health` to it and logs the call; layout is clean | #54 | S1 | Unit (Code node, wiring, layout) | `ops/n8n/order/health.test.js` | Pass |
| The dev deploy sends unknown paths such as `/health` to the app after the files | #54 | S1 | Unit | `scripts/test_deploy_dev.py` | Pass |
| `/health` on the dev URL shows OK for Supabase, n8n and Jev with real times, and FAIL with the right note when the kill switch is on or Jev is off | #54 | S1 | Live (after deploy of SUB 16, MAIN 01 update and the owner's activate) | `goserve-app-dev.vercel.app/health` | Pending activation |
| Next step from each status: kitchen to ready, then rider pick up, arriving once, delivered; nothing after Delivered; sample order, sample decision (AI suggests R2, rule agrees) | #53 | S1 S2 | Unit | `app/tests/unit/autopilot.test.ts` | Pass |
| In airplane mode Autopilot plays the whole story from local data under an Offline demo banner and sends nothing; the kitchen, ops and customer screens follow it; tapping again leaves the demo | #53 | S1 | End-to-end (browser offline switch) | `app/tests/e2e/autopilot.spec.ts` | Pass |
| Online, Autopilot sends six steps as the kitchen and the rider and stops; with no order it says to place one; tapping again stops it | #53 | S2 | End-to-end | `app/tests/e2e/autopilot.spec.ts` | Pass |
| If the server cannot be reached (a failed call, or an unreadable order list with no order) Autopilot falls back to the offline story | #53 | S1 | End-to-end | `app/tests/e2e/autopilot.spec.ts` | Pass |
| Owner phone check: installed app on the Android, airplane mode on, tap Autopilot, watch Delivered; then online, place an order, tap Autopilot, watch the six steps reach the kitchen screen of the second device | #53 | S1 S2 | Live (owner phone, with #56) | installed app | Pending |
| The scorecard covers the last 24 hours (a 23:00 row is in the next card); numbers are counted right (runs, errors, health apart, time, cost, decisions, Jev used and agreed); an empty day, a full page and a database failure give a clear message | #47 | S1 | Unit (Code nodes) | `ops/n8n/order/scorecard.test.js` | Pass |
| MAIN 90 runs on a schedule at 21:00 India time with Config, kill switch, window, SUB 91, message and Telegram; SUB 91 only reads, is called only by MAIN 90; the message goes to the owner chat as plain text; layout is clean | #47 | S1 | Unit (wiring, layout) | `ops/n8n/order/scorecard.test.js` | Pass |
| The two reads of SUB 91 work on goserve-dev with the service key (answer 200) | #47 | S1 | Manual read-only check, 14 Oct 2026 | the same URLs as SUB 91 | Pass (0 rows: dev was cleaned) |
| After "push kar do" and "activate", the owner gets one Telegram message at 21:00 (or on Execute workflow) with runs, errors and cost that match the dev rows | #47 | S1 | Live (after the owner's activate) | `GS MAIN 90 Daily scorecard` | Pending activation |
| The window fix: the card covers the last 24 hours, a row written at 23:00 India time lands in the next card, the head names the hours, an empty day and a cut page say so | #47 | S1 | Unit (Code nodes) | `ops/n8n/order/scorecard.test.js` | Pass |
| After "push kar do" (14 Oct 2026): ten GS workflows are on n8n, all inactive; the live copy of each has the same nodes, node parameters (Code source, URLs, credential ids), positions and links as the build, and the layout checks are clean (parameters added 15 Oct 2026, built with the real deploy-time values: all ten the same) | #45 #46 #47 #50 #54 | deploy | Manual read-back (`node ops/n8n/order/verify_live.js`: GET each workflow, compare with `build()`) | SUB 16 `waOKwiTQNQWh96EW`, SUB 91 `ZOWAGbJv5hR1MDAe`, MAIN 90 `odx6zXlMhMh74JLw`; updated: ERR 00, SUB 11 to 15, MAIN 01 | Pass |
| `release_db.py` takes the prod address from the vault name, refuses goserve-dev, lists the migrations in order, only reads in a dry run, refuses a database that has tables, applies every file in order then switches anonymous sign-in on then checks, and stops with a message when a check fails | #78 | S1 | Unit (no network) | `scripts/test_release_db.py` | Pass |
| Dry run on the real prod project (read only): 0 tables, anonymous sign-in OFF, plan = seven files | #78 | S1 | Manual read-only, 15 Oct 2026 | `python3 scripts/release_db.py` | Pass |
| The prod build gets its four `VITE_*` keys from `PROD_VITE_*` secrets, never the dev ones | #78 | S2 | Unit | `scripts/test_deploy_app.py` | Pass |
| After the owner's yes: prod has 10 dishes, 8 tables, 6 security rules and anonymous sign-in on | #78 | S1 | Live (after the owner's yes for `--apply`) | `python3 scripts/release_db.py --apply` | Pending |
| After the release PR: `goserve-app.pages.dev` answers 200 with the menu and `/health` | #78 | S2 | Live (after the Pages project, the prod secrets and the release merge) | `goserve-app.pages.dev` | Pending |
| A prod order reaches the prod kitchen screen | #78 | S3 | Live (after the prod workflow copy and "activate") | `goserve-app.pages.dev` | Pending |
| `release_db.py` reads the project name and refuses a name that does not say GoServe, or says dev, in a dry run and in an apply, before it writes anything; the real prod project answers "GoServe" | #78 | S1 | Unit and manual read-only (15 Oct 2026) | `scripts/test_release_db.py` | Pass |

