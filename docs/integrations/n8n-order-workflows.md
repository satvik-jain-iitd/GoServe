# GoServe order, decision and log workflows (n8n)

This page is the contract for the order workflows. It also holds the workflow registry for GoServe orders.
Build code: `ops/n8n/order/build.js`. Tests: `node --test "ops/n8n/order/*.test.js"`.

## Registry

| Workflow | Kind | Job | Called by | Status |
|---|---|---|---|---|
| GS ERR 00 Alert | ERR | Sends a Telegram message to the owner when an order workflow fails. | n8n (error workflow of the three below) | Deployed 14 Oct 2026, inactive (id `H9dl1O5HenAQ3sRm`) |
| GS SUB 13 Decide | SUB | Reads the engine (`params` global/decision_engine, Rules if unreadable), picks a rider by the rule, asks Jev only when the engine is Jev, writes one `decision_log` row that names the engine. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `4Qb0pB031ky91IKK`) |
| GS SUB 19 Assign rider | SUB | Saves the rider on a ready order through `assign_rider` and writes `order.assigned`. | SUB 22 | Built 23 Oct 2026 (A5), not deployed |
| GS SUB 20 Push | SUB | A text-less web push to every subscription of the customer (VAPID, ES256 through the JWT node and the credential "GoServe VAPID"); forgets endpoints that answer 404 or 410. | MAIN 01 (not waited for) | Built 23 Oct 2026 (A7), not deployed |
| GS SUB 21 Dispatch riders | SUB | Reads the online riders (distance, trips today, free) through `dispatch_candidates`. Writes nothing. | SUB 22 | Built 23 Oct 2026 (A5), not deployed |
| GS SUB 22 Dispatch | SUB | A ready order: SUB 21 riders, SUB 13 decide, SUB 19 assign. No rider means Stop and Error, so GS ERR 00 tells the owner. | MAIN 01 | Built 23 Oct 2026 (A5), not deployed |
| GS SUB 15 Add event | SUB | Writes the rider's `order.arriving` event through `rider_event`; the status stays. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `pH12pWtoV0R2CtjE`) |
| GS SUB 16 Health | SUB | Asks Jev one tiny question and says if it answered and how fast. Writes nothing. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `waOKwiTQNQWh96EW`) |
| GS MAIN 90 Daily scorecard | MAIN | Once a day at 22:15 India time (H14): the pilot day card for the last 24 hours (three daily numbers first, then the rest, each against its breakpoint as OK, WATCH or OVER), then runs, errors, time, decisions, Jev use and cost. After sending it deletes ping history older than 30 days (`pilot_prune`). | Schedule | Deployed 14 Oct 2026, inactive (id `odx6zXlMhMh74JLw`) |
| GS SUB 91 Scorecard numbers | SUB | Reads the `run_log` and `decision_log` rows of a window and the `pilot_numbers` answer. Writes nothing. | MAIN 90, MAIN 93 | Deployed 14 Oct 2026, inactive (id `ZOWAGbJv5hR1MDAe`) |
| GS SUB 93 Watch numbers | SUB | Reads `pilot_watch`: placed orders not accepted in 3 minutes and ready orders with no rider for 5 minutes, not yet told. Writes nothing. | MAIN 92 | Built 24 Oct 2026 (H14, #204); dev deploy inactive until "activate" |
| GS MAIN 92 Pilot watch | MAIN | Every 5 minutes, only 11:00 to 22:30 India time: one Telegram message per order over a line (the kitchen's own chat also gets late tickets once `kitchen_chat_id` is set), then the orders are marked told (`pilot_watch_mark`) so each is sent once. If a send fails nothing is marked. Config holds the kill switch and the time lines. | Schedule | Built 24 Oct 2026 (H14, #204); dev deploy inactive until "activate" |
| GS MAIN 93 Weekly and monthly report | MAIN | Monday 09:00: the table for the last 7 days beside the 7 days before. The 1st of the month 09:00: the same for 30 days. One Telegram message. It ends with the platform health and cost block from SUB 94 (H15). | Schedule | Built 24 Oct 2026 (H14, #204); dev deploy inactive until "activate" |
| GS SUB 94 Health and cost numbers | SUB | Four soft reads for the weekly and monthly report: OpenRouter spend (`/api/v1/auth/key`) against the $2 cap, `health_numbers` (database size against 500 MB, connections, row counts, oldest rows), failed n8n runs in the window (credential "GoServe n8n API", the owner makes it), UptimeRobot monitors with 7-day uptime. A failed read prints "could not read"; the rest go on. Writes nothing. | MAIN 93 | Built 24 Oct 2026 (H15, #205); dev deploy inactive until "activate" |
| GS SUB 17 Feedback | SUB | Saves a tester's report from the Feedback button in `feedback`, puts the screenshot in Google Drive and sends the owner one Telegram message. | MAIN 01 | Built 15 Oct 2026 (story S-B, #94); deploy to dev after "push kar do", prod copy inactive |
| GS SUB 18 Feedback side effects | SUB | Puts the screenshot in Google Drive, links the file to the row and sends the owner one Telegram message. | SUB 17 (not waited for) | Built 15 Oct 2026 (F90); dev id `Qm0DJH1kjt0xyKgZ`, active |
| GS SUB 14 Write logs | SUB | Writes one `run_log` row. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `RqjujaDaJSz0rSz7`) |
| GS MAIN 01 Order API | MAIN | The phone's webhook. Checks the token and the kill switch, then calls a SUB. | The phone (`POST /webhook/gs-order`) | Deployed 14 Oct 2026, updated the same day with the event and health routes, inactive (id `B0MaX7Sa6PaTVf81`) |
| GS MAIN 30 Simulator | MAIN | The synthetic city's webhook (`POST /webhook/gs-sim`, header `x-gs-sim-token`, its own token `GOSERVE_SIM_TOKEN`). Body `action` seed or reset; seed may carry kitchens, riders, dishes_per_kitchen, seed, open_pct, online_pct. Config holds the kill switch and the token. Called by the admin Simulator tab (H7, `app/src/screens/AdminSim.tsx` through `lib/sim.ts`, env `VITE_SIM_URL` and `VITE_SIM_TOKEN`), never the database directly. | Admin tab (H7) | Built 25 Oct 2026 (H5, #188); dev deploy inactive until "activate"; prod after "yes sim prod" |
| GS MAIN 32 Decision engine | MAIN | The admin app's webhook (`POST /webhook/gs-engine`, prod `gs-engine-prod`). Header `Authorization: Bearer <the admin's own sign-in token>`; body `{action:"get"}` or `{action:"set", engine:"rules"|"jev"|"laya"}`. Config holds the kill switch, the database address and the public anon key; no demo, simulator or admin token. 401 without a token, 503 on the kill switch, 400 on an unknown action. | Admin app, Numbers tab (Decisions block) | Built 25 Oct 2026 (#263); dev deploy inactive until "push kar do" |
| GS SUB 32 Engine call | SUB | Forwards the caller's token and the anon key to `get_decision_engine` or `set_decision_engine` (migration 0031). The database decides who is an admin (`is_admin()`); a non-admin gets 403, Laya gets 409 (not deployed), a new engine writes a `params` version with the admin's email. | MAIN 32 | Built 25 Oct 2026 (#263); dev deploy inactive |
| GS SUB 30 Simulator write | SUB | Clamps the numbers (1 to 50 kitchens, 1 to 200 riders, 1 to 12 dishes; 0 to 2000 m a step) and runs `sim_seed`, `sim_reset` (0028), `sim_tick`, `sim_enable` (0029) or `sim_status` (0030). Only rows marked `synthetic` are written or deleted. Returns the counts. | MAIN 30, MAIN 31 | Built 25 Oct 2026 (H5 #188, H6 #189, H7 #190); dev deploy inactive |
| GS MAIN 31 Simulator tick | MAIN | Every minute: Config, kill switch, then SUB 30 with action tick. `sim_tick` does nothing while the params row `sim_enabled` is off; on, every synthetic online rider walks 100 to 300 m (tethered to the nearest synthetic kitchen past 1 km), 2 % of synthetic kitchens flip open or closed (11:00 to 23:00 only), 5 % of synthetic dishes flip sold out, 2 % of synthetic riders flip online or offline. Successful runs are not saved (review of #259). | Schedule | Built 25 Oct 2026 (H6, #189); dev deploy inactive until "activate" |
| GS SUB 11 Place order | SUB | Checks the input, calls the database function `place_order`. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `l5yCWExn5hQMqzNN`) |
| GS SUB 12 Change status | SUB | Checks the input, calls the database function `change_status`. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `Pjn0CvyYwcKJUXhw`) |

The older website workflows (`GoServe — Pre-Registration Capture`, `GoServe — Investor Contact`) are described in `n8n-goserve-forms.md`.

## Why the database does the work

`place_order` and `change_status` are database functions (migration `0003_order_functions.sql`). Each one writes the order and its event in one transaction, so there is never an order without its event. The price comes from the menu, never from the phone. n8n checks the token and the kill switch, and shapes the answer. Only the service role may call the functions.

## The phone's call

`POST https://n8n.linkright.in/webhook/gs-order` with header `x-gs-token: <demo token>` and a JSON body.

Place an order:

```json
{ "action": "place", "session_id": "<anonymous user id>", "client_order_key": "<made by the phone>",
  "items": [{ "menu_item_id": "<uuid>", "qty": 2 }], "address": "Flat 4, Delhi" }
```

Confirm delivery (the customer's Yes, story S-C): `{ "action": "confirm", "session_id": "...", "order_id": "..." }`. MAIN 01 calls SUB 12 as the customer with `to_status: confirm`; SUB 12 then calls the database function `confirm_delivery` instead of `change_status`. A ready order goes out for delivery and is delivered (as the customer), `orders.paid_by` becomes `cash`, and the events `order.picked_up`, `order.delivered`, `order.confirmed` are written. An order the rider already delivered only gets the cash and `order.confirmed`. A repeat answers 200 with `already_done: true`. A kitchen tap on the same step twice answers 409 `already_done`. An order that is not ready yet answers 409 `illegal_step`. Every answer also carries `confirm_after_ready_min` (3) and `confirm_after_place_min` (8) from the MAIN 01 Config, so the phone knows when to ask.

Change status:

```json
{ "action": "status", "session_id": "<anonymous user id>", "order_id": "<uuid>",
  "to_status": "accepted", "actor": "kitchen" }
```

Decide which rider (story #46):

```json
{ "action": "decide", "session_id": "<anonymous user id>", "order_id": "<uuid>",
  "riders": [{ "id": "r1", "free": true, "distance_m": 1200, "trips_done": 2 }] }
```

The answer carries `decision`: the rule pick, Jev's pick with confidence (or why Jev was not used: `jev_off`, `jev_error`, `jev_bad_reply`, `jev_low_confidence`, `cost_cap`), and the pick used. **In MVP 0 the rule always decides; Jev only advises.** The rule: the free rider with the fewest trips, then the shortest distance, else `none` (contract D1). Jev gets ids, free flag, distance and trips only, never names or addresses. Jev limits: pinned `typesafe/jev-1.13` on OpenRouter's decisions endpoint (`/api/alpha/decisions`, a choice question), 900 ms, accepted at confidence 0.70 or more, ignored over the per-call cost cap (Config `jev_cost_cap`).

Health check (story #54):

```json
{ "action": "health" }
```

The answer is `{ ok: true, jev: { ok, status, ms } }`. `status` is `ok`, `jev_off`, `jev_error` or `jev_bad_reply`. A Jev failure is still a 200 answer: the health page shows it as FAIL. It writes no order data. It costs about $0.00002 for the one Jev call, and MAIN 01 logs it in `run_log` like any other call. That row has `session_id` = `unknown` (the health call carries no session), so it is not in any session's "runs today", and the scorecard tells it apart by the workflow name `GS MAIN 01 Order API: health`.

Rider arriving (story #50):

```json
{ "action": "event", "session_id": "<anonymous user id>", "order_id": "<uuid>", "event": "order.arriving", "actor": "rider" }
```

It writes one event and leaves the status as `out_for_delivery`. Allowed only in that status, and once per order: a repeat gets 409 `already_done`. Any other event name is refused with 400. The rider's other steps are normal status changes: `out_for_delivery` (event `order.picked_up`) and `delivered`.

Steps (assumption A41): `placed, accepted, preparing, ready, out_for_delivery, delivered`, one step forward at a time.
Actors: `customer, kitchen, rider, ops`.

## The answer

JSON `{ ok, error?, message?, created?, order? }` with an HTTP code:

| Code | When |
|---|---|
| 201 | Order placed (new). |
| 200 | Status changed, or a retry of the same `client_order_key` (the existing order comes back, nothing new is written). |
| 429 | The session already has 20 orders (the brake before activation). Reset starts a new session. |
| 400 | Missing or bad input, unknown dish, bad quantity, unknown status, unknown action. |
| 401 | Missing or wrong demo token. |
| 404 | No such order in this session. |
| 409 | Illegal step (skipped or backward). Nothing is written. |
| 503 | Kill switch is on. Nothing is written. |
| 502 | The database failed. The phone sees a short message, never database text. |

## Run log

After MAIN 01 has answered a routed call (place, status, decide, event, health), it calls SUB 14, which writes one `run_log` row: workflow, time taken, settings version (`params_version` in Config), cost (Jev cost for a decision) and error. Calls refused at the gate (401, 503, bad action) are in the n8n execution list, not in `run_log`.

## Contract of each SUB

SUB 11 input: `session_id` string, `client_order_key` string, `items` array, `address` string, `kill_switch` boolean, `supabase_url` string.
SUB 12 input: `session_id` string, `order_id` string, `to_status` string, `actor` string, `kill_switch` boolean, `supabase_url` string.
Output of both: `{ ok, status_code, error?, message?, created?, order? }`.

SUB 13 input: `session_id`, `kitchen_id`, `order_id`, `riders` (1 to 10, unique ids), `params_version`, `jev_enabled`, `jev_model`, `jev_cost_cap`, `kill_switch`, `supabase_url`. Output: `{ ok, status_code, decision?, cost?, error?, message? }`. It writes only one `decision_log` row.
SUB 19 input: `order_id`, `rider_id`, `kill_switch`, `supabase_url`. Output: `{ ok, status_code, order?, error?, message? }`; 409 `not_ready` or `rider_not_available`. It writes the rider on the order and one `order.assigned` event.
SUB 20 input: `session_id`, `status`, `vapid_public_key`, `vapid_subject`, `kill_switch`, `supabase_url`. Output: `{ ok, status_code, error? }`; any status other than placed, ready or delivered answers `not_pushed` (200, nothing sent). It writes nothing except forgetting a gone subscription. MAIN 01 calls it after the answer, for a new order (`created`), a ready order or a delivered order, and never for a repeated Yes.
SUB 21 input: `order_id`, `kill_switch`, `supabase_url`. Output: `{ ok, status_code, riders? }` (each `{ id, free, distance_m, trips_done }`, nearest first, at most ten). It writes nothing.
SUB 22 input: `session_id`, `kitchen_id`, `order_id`, `params_version`, `jev_enabled`, `jev_model`, `jev_cost_cap`, `kill_switch`, `supabase_url`. MAIN 01 calls it after it has answered a status change to `ready`. It ends in SUB 19, or fails on purpose when no rider is online or the rule picks none.
SUB 15 input: `session_id`, `order_id`, `event`, `actor`, `kill_switch`, `supabase_url`. Output: `{ ok, status_code, order?, error?, message? }`. It writes only one `order_events` row, through `rider_event`.
SUB 16 input: `jev_enabled`, `jev_model`. Output: `{ ok, status_code, jev: { ok, status, ms }, cost }`. It writes nothing.
SUB 14 input: `session_id`, `kitchen_id`, `workflow`, `params_version`, `duration_ms`, `cost`, `error`, `supabase_url`. Output: `{ ok, status_code }`. It writes only one `run_log` row.
SUB 17 input: `session_id`, `kitchen_id`, `role`, `screen`, `order_id` (empty if none), `doing`, `text`, `context` (object), `image_b64` (empty if none), `kill_switch`, `supabase_url`, `drive_folder_id`, `chat_id`, `env`. Output: `{ ok, status_code: 201, id }` or a refusal (400, 503, 502). The one write is the `feedback` row, and it fails closed: if the database refuses, nothing else happens. After the row is saved, SUB 17 starts SUB 18 without waiting (`waitForSubWorkflow: false`) and answers at once, so the phone waits about 1 to 3 seconds, not the 5 seconds of the Drive upload. SUB 18 input: `id`, `row`, `image_b64`, `has_image`, `drive_ready`, `drive_folder_id`, `chat_id`, `env`, `supabase_url`. Its Drive upload, the link back to the row and the Telegram message continue on error, so a side effect never undoes a saved report. Only SUB 17 may call SUB 18. The Drive folder id comes from the Config node (`drive_folder_id`); if it is not set, the screenshot is not kept and the Telegram message says so.
The Jev call is the one node that continues on error: Jev is advice, so a Jev failure never stops the rule decision. Every write node fails closed.
A SUB writes only through the database function. If the kill switch is on or the input is bad, it returns the refusal and calls nothing.
Only MAIN 01 may call a SUB (`callerPolicy: workflowsFromAList`).

## The PROD copy (story #78, 15 Oct 2026)

Nine more workflows, the same code and canvas, named with `PROD` at the end, deployed **inactive** by `node ops/n8n/order/deploy.js --env prod --apply`. They share nothing with dev except the one alert workflow (GS ERR 00) and the Jev credential: the prod set has its own address (`SUPABASE_GOSERVE_PROD_URL`), its own credential `GoServe Supabase prod` (id `A8f6jLIcNKE5UDxE`, n8n Custom Auth, host-limited to the prod Supabase host), its own demo token (`GOSERVE_PROD_DEMO_TOKEN` in the vault) and its own webhook path `POST /webhook/gs-order-prod`.

| Workflow | Id |
|---|---|
| GS SUB 11 Place order PROD | `Tc0P8KJ9Bvhb9k2g` |
| GS SUB 12 Change status PROD | `iIc3DLu42UYpBEv4` |
| GS SUB 13 Decide PROD | `3GtSWAMVcOzYXlJs` |
| GS SUB 14 Write logs PROD | `WpYOETtn7F9qz1rM` |
| GS SUB 15 Add event PROD | `Y73A4NHIzQ3Q6EIL` |
| GS SUB 16 Health PROD | `v8G786W0HQuOxpA1` |
| GS SUB 91 Scorecard numbers PROD | `i6MABpuUTPoP1Lo6` |
| GS MAIN 01 Order API PROD | `2WJNspPzlcBmpK8W` |
| GS MAIN 90 Daily scorecard PROD | `qGuaCxJVmNPtARSp` |

`node ops/n8n/order/verify_live.js --env prod` compares them with the build. To activate them, the owner says "activate" (sub-workflows first, then the two MAINs, as for dev). MAIN 90 PROD would send a second daily message, so activate it only when the owner wants a prod card. The prod app build uses `PROD_VITE_ORDER_URL` = `https://n8n.linkright.in/webhook/gs-order-prod`.

Before the owner activates the prod set, run `node ops/n8n/order/verify_live.js --env prod` once.

**Deploy means live.** For a workflow that is already active, `deploy.js --apply` changes the live copy at once (it never activates or deactivates anything by itself). "Push kar do" therefore means "live now" for an active workflow.

## Activation (15 Oct 2026)

This n8n version will not publish a workflow whose sub-workflows are not published ("Cannot publish workflow: Node ... references workflow ... which is not published"). So "activate" means all ten, in this order: ERR 00, SUB 11 to 16, SUB 91, then MAIN 01 and MAIN 90. An earlier review reply that said sub-workflows need not be active was wrong. `node ops/n8n/order/verify_live.js` prints the active flag of each.

## Daily scorecard (story #47)

GS MAIN 90 runs at 21:00 India time (workflow timezone `Asia/Kolkata`). Its Config holds `kill_switch`, `chat_id` (the owner chat, put in at deploy time from the vault) and `supabase_url`. With the kill switch on it sends nothing. It works out the last 24 hours (so a row is in some card at whatever hour it was written), calls SUB 91, formats one plain-text message and sends it with the `GoServeBot` credential.

SUB 91 input: `since` (ISO time), `supabase_url`. It reads at most 1000 rows from each table, with the `GoServe Supabase dev` credential, and returns `{ ok, status_code, summary }`. A database failure is a 502 with a short message; the owner then gets a message that says the numbers could not be read. A full page is marked "latest 1000 runs only".

The message is made of pairs, so one number cannot be gamed alone: runs with errors, time per run with the slowest run, decisions with Jev use and agreement, cost with cost per decision. Health checks (`...: health` rows, session `unknown`) are counted apart and are not in the runs, but their small cost is in "Cost of all calls" (the per-decision figure uses the decide runs only). "Jev advice used" means Jev answered in shape, at confidence 0.70 or more and under the cost cap (`jev_status` is `ok`); a low-confidence or over-cap answer was asked for but not used. The read takes the newest 1000 rows of each table.

Two different Telegram messages mean two different things: "I could not read the numbers" comes from the scorecard itself (the database refused), while a message from GS ERR 00 means the workflow itself fell over.

```text
GoServe scorecard, last 24 hours (to 2026-10-14 21:00 India time)
Runs: 4, errors: 1 (25%)
Time per run: 425 ms on average, 900 ms at most
Decisions: 3. Jev advice used: 2, agreed with the rule: 1
Cost of all calls: $0.00010 (about $0.00003 per decision)
Health checks: 1
```

## Settings and secrets

- Config keys (MAIN 01): `kill_switch`, `demo_token`, `supabase_url`. The token and the url are put in at deploy time from the vault. They are never in the repo.
- Credential `GoServe OpenRouter` (n8n type Header Auth, `Authorization: Bearer <GoServe OpenRouter key, cap $2 set on the OpenRouter dashboard>`, limited to openrouter.ai): created 14 Oct 2026 after the owner's yes (id `RbmXO7HF5ydZLS5M`).
- Credential: `GoServe Supabase dev` (n8n type Custom Auth, headers `apikey` and `Authorization: Bearer`, value = the dev service role key). Created on 14 Oct 2026 after the owner's yes (id `RTkKn0GxhfOBQtGT`, limited to the dev Supabase host).
- Events written: `order.placed`, `order.accepted`, `order.preparing`, `order.ready`, `order.picked_up` (status `out_for_delivery`), `order.delivered`.

## Not built yet

Activation (needs the owner's yes), rate limit, production copy of the workflows. See follow-ups F65 and F66.

## Deploy

`node ops/n8n/order/deploy.js` shows the plan and writes nothing. `--apply` creates the missing workflows (inactive) and puts the content in: ERR 00, SUB 11, 12, 13, 14, 15, 16, 91, then MAIN 01 and MAIN 90. It refuses until both credentials exist. It never activates or deletes. The demo token is made on the first apply and saved in the vault.
