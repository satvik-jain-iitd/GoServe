# GoServe order workflows (n8n)

This page is the contract for the order workflows. It also holds the workflow registry for GoServe orders.
Build code: `ops/n8n/order/build.js`. Tests: `node --test ops/n8n/order/`.

## Registry

| Workflow | Kind | Job | Called by | Status |
|---|---|---|---|---|
| GS ERR 00 Alert | ERR | Sends a Telegram message to the owner when an order workflow fails. | n8n (error workflow of the three below) | Built, not deployed |
| GS MAIN 01 Order API | MAIN | The phone's webhook. Checks the token and the kill switch, then calls a SUB. | The phone (`POST /webhook/gs-order`) | Built, not deployed |
| GS SUB 11 Place order | SUB | Checks the input, calls the database function `place_order`. | MAIN 01 | Built, not deployed |
| GS SUB 12 Change status | SUB | Checks the input, calls the database function `change_status`. | MAIN 01 | Built, not deployed |

Planned next (build design section 6): SUB 13 Decide, SUB 14 Write logs, MAIN 90 Daily scorecard.
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

Steps (assumption A41): `placed, accepted, preparing, ready, out_for_delivery, delivered`, one step forward at a time.
Actors: `customer, kitchen, rider, ops`.

## The answer

JSON `{ ok, error?, message?, created?, order? }` with an HTTP code:

| Code | When |
|---|---|
| 201 | Order placed (new). |
| 200 | Status changed, or a retry of the same `client_order_key` (the existing order comes back, nothing new is written). |
| 400 | Missing or bad input, unknown dish, bad quantity, unknown status, unknown action. |
| 401 | Missing or wrong demo token. |
| 404 | No such order in this session. |
| 409 | Illegal step (skipped or backward). Nothing is written. |
| 503 | Kill switch is on. Nothing is written. |
| 502 | The database failed. The phone sees a short message, never database text. |

## Contract of each SUB

SUB 11 input: `session_id` string, `client_order_key` string, `items` array, `address` string, `kill_switch` boolean, `supabase_url` string.
SUB 12 input: `session_id` string, `order_id` string, `to_status` string, `actor` string, `kill_switch` boolean, `supabase_url` string.
Output of both: `{ ok, status_code, error?, message?, created?, order? }`.
A SUB writes only through the database function. If the kill switch is on or the input is bad, it returns the refusal and calls nothing.
Only MAIN 01 may call a SUB (`callerPolicy: workflowsFromAList`).

## Settings and secrets

- Config keys (MAIN 01): `kill_switch`, `demo_token`, `supabase_url`. The token and the url are put in at deploy time from the vault. They are never in the repo.
- Credential: `GoServe Supabase dev` (n8n type Custom Auth, headers `apikey` and `Authorization: Bearer`, value = the dev service role key). Created on 14 Oct 2026 after the owner's yes (id `RTkKn0GxhfOBQtGT`, limited to the dev Supabase host).
- Events written: `order.placed`, `order.accepted`, `order.preparing`, `order.ready`, `order.picked_up` (status `out_for_delivery`), `order.delivered`.

## Not built yet

Activation (needs the owner's yes), rate limit, production copy of the workflows. See follow-ups F65 and F66.

## Deploy

`node ops/n8n/order/deploy.js` shows the plan and writes nothing. `--apply` creates the missing workflows (inactive) and puts the content in: ERR 00, SUB 11, SUB 12, MAIN 01. It never activates or deletes. The demo token is made on the first apply and saved in the vault.
