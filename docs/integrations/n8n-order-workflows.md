# GoServe order, decision and log workflows (n8n)

This page is the contract for the order workflows. It also holds the workflow registry for GoServe orders.
Build code: `ops/n8n/order/build.js`. Tests: `node --test "ops/n8n/order/*.test.js"`.

## Registry

| Workflow | Kind | Job | Called by | Status |
|---|---|---|---|---|
| GS ERR 00 Alert | ERR | Sends a Telegram message to the owner when an order workflow fails. | n8n (error workflow of the three below) | Deployed 14 Oct 2026, inactive (id `H9dl1O5HenAQ3sRm`) |
| GS SUB 13 Decide | SUB | Picks a rider by the rule, asks Jev for a suggestion, writes one `decision_log` row. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `4Qb0pB031ky91IKK`) |
| GS SUB 15 Add event | SUB | Writes the rider's `order.arriving` event through `rider_event`; the status stays. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `pH12pWtoV0R2CtjE`) |
| GS SUB 16 Health | SUB | Asks Jev one tiny question and says if it answered and how fast. Writes nothing. | MAIN 01 | Built, not deployed (story #54) |
| GS MAIN 90 Daily scorecard | MAIN | Once a day at 21:00 India time: one Telegram message to the owner with runs, errors, time, decisions, Jev use and cost. | Schedule | Built, not deployed (story #47) |
| GS SUB 91 Scorecard numbers | SUB | Reads today's `run_log` and `decision_log` rows and counts them. Writes nothing. | MAIN 90 | Built, not deployed (story #47) |
| GS SUB 14 Write logs | SUB | Writes one `run_log` row. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `RqjujaDaJSz0rSz7`) |
| GS MAIN 01 Order API | MAIN | The phone's webhook. Checks the token and the kill switch, then calls a SUB. | The phone (`POST /webhook/gs-order`) | Deployed 14 Oct 2026, updated the same day with the event route, inactive (id `B0MaX7Sa6PaTVf81`) |
| GS SUB 11 Place order | SUB | Checks the input, calls the database function `place_order`. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `l5yCWExn5hQMqzNN`) |
| GS SUB 12 Change status | SUB | Checks the input, calls the database function `change_status`. | MAIN 01 | Deployed 14 Oct 2026, inactive (id `Pjn0CvyYwcKJUXhw`) |

Planned next (build design section 6): MAIN 90 Daily scorecard.
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

The answer carries `decision`: the rule pick, Jev's pick with confidence (or why Jev was not used: `jev_off`, `jev_error`, `jev_bad_reply`, `jev_low_confidence`, `cost_cap`), and the pick used. **In MVP 0 the rule always decides; Jev only advises.** The rule: the free rider with the fewest trips, then the shortest distance, else `none` (contract D1). Jev gets ids, free flag, distance and trips only, never names or addresses. Jev limits: pinned `typesafe/jev-1.13`, temperature 0, 32 tokens, 900 ms, accepted at confidence 0.70 or more, ignored over the per-call cost cap (Config `jev_cost_cap`).

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
SUB 15 input: `session_id`, `order_id`, `event`, `actor`, `kill_switch`, `supabase_url`. Output: `{ ok, status_code, order?, error?, message? }`. It writes only one `order_events` row, through `rider_event`.
SUB 16 input: `jev_enabled`, `jev_model`. Output: `{ ok, status_code, jev: { ok, status, ms }, cost }`. It writes nothing.
SUB 14 input: `session_id`, `kitchen_id`, `workflow`, `params_version`, `duration_ms`, `cost`, `error`, `supabase_url`. Output: `{ ok, status_code }`. It writes only one `run_log` row.
The Jev call is the one node that continues on error: Jev is advice, so a Jev failure never stops the rule decision. Every write node fails closed.
A SUB writes only through the database function. If the kill switch is on or the input is bad, it returns the refusal and calls nothing.
Only MAIN 01 may call a SUB (`callerPolicy: workflowsFromAList`).

## Daily scorecard (story #47)

GS MAIN 90 runs at 21:00 India time (workflow timezone `Asia/Kolkata`). Its Config holds `kill_switch`, `chat_id` (the owner chat, put in at deploy time from the vault) and `supabase_url`. With the kill switch on it sends nothing. It works out the start of the day in India time, calls SUB 91, formats one plain-text message and sends it with the `GoServeBot` credential.

SUB 91 input: `since` (ISO time), `supabase_url`. It reads at most 1000 rows from each table, with the `GoServe Supabase dev` credential, and returns `{ ok, status_code, summary }`. A database failure is a 502 with a short message; the owner then gets a message that says the numbers could not be read.

The message is made of pairs, so one number cannot be gamed alone: runs with errors, time per run with the slowest run, decisions with Jev use and agreement, cost with cost per decision. Health checks (`...: health` rows, session `unknown`) are counted apart and are not in the runs, but their small cost is in "Cost of all calls" (the per-decision figure uses the decide runs only). "Jev advice used" means Jev answered in shape, at confidence 0.70 or more and under the cost cap (`jev_status` is `ok`); a low-confidence or over-cap answer was asked for but not used. The read takes the newest 1000 rows of each table.

Two different Telegram messages mean two different things: "I could not read today's numbers" comes from the scorecard itself (the database refused), while a message from GS ERR 00 means the workflow itself fell over.

```text
GoServe scorecard, 2026-10-14
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
