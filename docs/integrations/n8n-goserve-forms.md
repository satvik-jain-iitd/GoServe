# GoServe forms to n8n

This page explains how the two website forms travel to us. It is the contract
between the site and n8n. Read it before you change either side.

## Endpoints

| Form | Page | Webhook |
|---|---|---|
| Pre-registration | `/pre-register` | `https://n8n.LinkRight.in/webhook/goserve-preregister` |
| Investor contact | `/investors` | `https://n8n.LinkRight.in/webhook/goserve-investor` |

Both accept `POST` with a JSON body. Both reply `{ "ok": true }` with HTTP 200
only after the full chain below runs. The site shows the thank-you message only
on a 200 reply.

## Payload the site sends

Pre-registration:

```json
{
  "name": "string",
  "email": "string",
  "phone": "string (may be empty)",
  "city": "string",
  "role": "customer | rider | kitchen partner | investor",
  "source": "goserve-site",
  "submittedAt": "ISO date string"
}
```

Investor contact:

```json
{
  "name": "string",
  "firm": "string",
  "email": "string",
  "message": "string (10+ chars)",
  "source": "goserve-site",
  "submittedAt": "ISO date string"
}
```

## The n8n chain

Each workflow has five nodes, laid left to right.

| # | Node | What it does |
|---|---|---|
| 1 | Webhook | Public POST endpoint. Bytes land under `json.body`. |
| 2 | Normalise (Set) | Lifts each field from `json.body` to the top level and stamps `receivedAt` in IST. `includeOtherFields` is off, so only clean fields move on. |
| 3 | Save (MongoDB) | Inserts one document into database `goserve`. |
| 4 | Alert (Telegram) | Sends the owner a message through @GoServeBot with every field. |
| 5 | Reply (Respond to Webhook) | Returns HTTP 200 `{ "ok": true }`. |

Telegram details:

- Bot: @GoServeBot.
- n8n credential: GoServeBot (type telegramApi), id `bBVpWzhaY0MCpoQ5`.
- Chat the alert goes to: `6802843941` (the owner).
- Secrets live in `~/Desktop/Secrets/04_integrations.env` as `GOSERVE_BOT_TOKEN`
  and `GOSERVE_TELEGRAM_CHAT_ID`.

Storage:

- Pre-registration → `goserve.preregistrations`.
- Investor contact → `goserve.investor_contacts`.

## Two pitfalls that caused the blank-message bug (issue #6)

Read these. Both are easy to repeat.

1. **The webhook body is nested.** The Webhook node exposes the payload at
   `json.body`, not at the top level. So `json.name` is empty; the real value is
   `json.body.name`. The Normalise step fixes this once, for all later nodes.

2. **Some nodes replace the item.** The MongoDB node passes only its own result
   (`{ _id, id }`) to the next node. So a Telegram node placed after it cannot
   read `json.name`; that value is gone. The fix is to read the field from the
   Normalise node directly:

   ```
   {{ $('2 · Normalise — keep the fields we need').item.json.name }}
   ```

   Use `$('<node name>').item.json.<field>` whenever a node sits after a node
   that rewrites the item.

## How to change a workflow

Edit `ops/n8n/build_goserve_workflows.py`, then run it:

```bash
python3 ops/n8n/build_goserve_workflows.py
```

It creates the tag and both workflows, updates them if they already exist, and
activates them. It reads the n8n API key, the GoServe bot token, and the owner
chat id from `~/Desktop/Secrets/04_integrations.env`.

## How to verify a change

1. POST a sample payload to the webhook and check for HTTP 200 and `{ "ok": true }`.
2. Open the latest execution and read the Alert node output. Every field must be
   filled in.
3. Confirm the document in the right `goserve` collection holds only the lead
   fields plus `receivedAt`.

## Open items

- F14: drag both workflows into the 🍔 GoServe tag in the n8n UI.
- F16: add MongoDB indexes on `email` and `receivedAt`.
