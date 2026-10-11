"""Build or update the two GoServe n8n workflows from code.

Why this file exists: the workflows are created by script, not by hand, so they
stay reproducible and reviewable. Run it after any change to the flow.

What it creates:
  - Tag "🍔 GoServe".
  - Workflow "GoServe — Pre-Registration Capture".
  - Workflow "GoServe — Investor Contact".

How to run:
  python3 ops/n8n/build_goserve_workflows.py

It reads the n8n API key, the GoServe bot token, and the owner chat id from
~/Desktop/Secrets/04_integrations.env (keys N8N_API_KEY, GOSERVE_BOT_TOKEN,
GOSERVE_TELEGRAM_CHAT_ID). It talks to https://n8n.LinkRight.in.

Note: the public n8n API marks workflow "tags" as read-only, so the tag is
created here but the two workflows must be dragged into the tag in the n8n UI
(follow-up F14). The internal REST endpoint returns 404 for our API key.

See docs/integrations/n8n-goserve-forms.md for the field contract and the
history of the blank-message bug (issue #6).
"""

import json, os, re, urllib.request, urllib.error

SEC = "/Users/satvikjain/Desktop/Secrets"
BASE = "https://n8n.LinkRight.in/api/v1"

env = open(os.path.join(SEC, "04_integrations.env")).read()
KEY = re.search(r"^N8N_API_KEY=(\S+)", env, re.M).group(1)
CHAT = re.search(r"^GOSERVE_TELEGRAM_CHAT_ID=(\S+)", env, re.M).group(1)

TELEGRAM_CRED = {"id": "bBVpWzhaY0MCpoQ5", "name": "GoServeBot"}
MONGO_CRED = {"id": "ZId1p3cgYHjx3EM3", "name": "MongoDB account"}


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("X-N8N-API-KEY", KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "curl/8.7.1")
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"_error": e.code, "_body": e.read().decode()[:400]}


def node(nid, name, ntype, tv, pos, params, notes, creds=None, extra=None):
    n = {
        "id": nid,
        "name": name,
        "type": ntype,
        "typeVersion": tv,
        "position": pos,
        "parameters": params,
        "notes": notes,
        "notesInFlow": True,
    }
    if creds:
        n["credentials"] = creds
    if extra:
        n.update(extra)
    return n


def chain(*names):
    conns = {}
    for a, b in zip(names, names[1:]):
        conns[a] = {"main": [[{"node": b, "type": "main", "index": 0}]]}
    return conns


def webhook_params(path, note):
    return {"httpMethod": "POST", "path": path, "responseMode": "responseNode", "options": {}}


def build_preregister():
    nodes = [
        node("wh-prereg", "1 · Webhook — new pre-registration",
             "n8n-nodes-base.webhook", 2, [-40, 0],
             webhook_params("goserve-preregister", ""),
             "Public POST endpoint. URL: /webhook/goserve-preregister. "
             "The website form sends name, email, phone, city, role, source, submittedAt. "
             "Responds only AFTER the nodes below run (responseMode = respondToWebhook)."),
        node("norm-prereg", "2 · Normalise — keep the fields we need",
             "n8n-nodes-base.set", 3.4, [180, 0],
             {"mode": "manual", "includeOtherFields": False,
              "assignments": {"assignments": [
                  {"id": "n1", "name": "name", "value": "={{ $json.body.name }}", "type": "string"},
                  {"id": "n2", "name": "email", "value": "={{ $json.body.email }}", "type": "string"},
                  {"id": "n3", "name": "phone", "value": "={{ $json.body.phone }}", "type": "string"},
                  {"id": "n4", "name": "city", "value": "={{ $json.body.city }}", "type": "string"},
                  {"id": "n5", "name": "role", "value": "={{ $json.body.role }}", "type": "string"},
                  {"id": "n6", "name": "source", "value": "={{ $json.body.source }}", "type": "string"},
                  {"id": "n7", "name": "submittedAt", "value": "={{ $json.body.submittedAt }}", "type": "string"},
                  {"id": "n8", "name": "receivedAt", "value": "={{ $now.setZone('Asia/Kolkata').toISO() }}", "type": "string"}]},
              "options": {}},
             "The webhook puts the payload under json.body. This step lifts each form field "
             "to the top level and stamps receivedAt, so later nodes read json.name and so on. "
             "includeOtherFields is off, so only clean fields are saved and alerted."),
        node("store-prereg", "3 · Save — MongoDB goserve.preregistrations",
             "n8n-nodes-base.mongoDb", 1.2, [400, 0],
             {"operation": "insert", "collection": "preregistrations", "database": "goserve", "options": {}},
             "Inserts one document per submission into the goserve database. "
             "If the database is unreachable this step is skipped (continue on error) so the form still works.",
             creds={"mongoDb": MONGO_CRED}, extra={"onError": "continueRegularOutput"}),
        node("notify-prereg", "4 · Alert — Telegram to owner",
             "n8n-nodes-base.telegram", 1.1, [620, 0],
             {"resource": "message", "operation": "sendMessage", "chatId": CHAT,
              "text": ("=🍔 New GoServe pre-registration\n\n"
                       "Name: {{ $('2 · Normalise — keep the fields we need').item.json.name }}\n"
                       "Email: {{ $('2 · Normalise — keep the fields we need').item.json.email }}\n"
                       "Phone: {{ $('2 · Normalise — keep the fields we need').item.json.phone || '—' }}\n"
                       "City: {{ $('2 · Normalise — keep the fields we need').item.json.city }}\n"
                       "Role: {{ $('2 · Normalise — keep the fields we need').item.json.role }}\n"
                       "Source: {{ $('2 · Normalise — keep the fields we need').item.json.source }}\n"
                       "Received: {{ $('2 · Normalise — keep the fields we need').item.json.receivedAt }}"),
              "additionalFields": {}},
             "Sends an instant message to the owner's Telegram so every lead is seen at once. "
             "It reads the values from the Normalise node, because the Save node only passes its own "
             "result onward.",
             creds={"telegramApi": TELEGRAM_CRED}),
        node("resp-prereg", "5 · Reply — success to the visitor",
             "n8n-nodes-base.respondToWebhook", 1.1, [840, 0],
             {"respondWith": "json", "responseBody": "={{ { ok: true } }}", "options": {}},
             "Returns HTTP 200 with {ok:true}. The website shows the thank-you message only when this fires."),
    ]
    return {"name": "GoServe — Pre-Registration Capture",
            "nodes": nodes,
            "connections": chain("1 · Webhook — new pre-registration",
                                 "2 · Normalise — keep the fields we need",
                                 "3 · Save — MongoDB goserve.preregistrations",
                                 "4 · Alert — Telegram to owner",
                                 "5 · Reply — success to the visitor"),
            "settings": {"executionOrder": "v1",
                         "saveDataSuccessExecution": "all",
                         "saveDataErrorExecution": "all"},
            "staticData": None}


def build_investor():
    nodes = [
        node("wh-inv", "1 · Webhook — new investor enquiry",
             "n8n-nodes-base.webhook", 2, [-40, 0],
             webhook_params("goserve-investor", ""),
             "Public POST endpoint. URL: /webhook/goserve-investor. "
             "The website form sends name, firm, email, message, source, submittedAt."),
        node("norm-inv", "2 · Normalise — keep the fields we need",
             "n8n-nodes-base.set", 3.4, [180, 0],
             {"mode": "manual", "includeOtherFields": False,
              "assignments": {"assignments": [
                  {"id": "n1", "name": "name", "value": "={{ $json.body.name }}", "type": "string"},
                  {"id": "n2", "name": "firm", "value": "={{ $json.body.firm }}", "type": "string"},
                  {"id": "n3", "name": "email", "value": "={{ $json.body.email }}", "type": "string"},
                  {"id": "n4", "name": "message", "value": "={{ $json.body.message }}", "type": "string"},
                  {"id": "n5", "name": "source", "value": "={{ $json.body.source }}", "type": "string"},
                  {"id": "n6", "name": "submittedAt", "value": "={{ $json.body.submittedAt }}", "type": "string"},
                  {"id": "n7", "name": "receivedAt", "value": "={{ $now.setZone('Asia/Kolkata').toISO() }}", "type": "string"}]},
              "options": {}},
             "The webhook puts the payload under json.body. This step lifts each field to the "
             "top level and stamps receivedAt. includeOtherFields is off, so only clean fields "
             "are saved and alerted."),
        node("store-inv", "3 · Save — MongoDB goserve.investor_contacts",
             "n8n-nodes-base.mongoDb", 1.2, [400, 0],
             {"operation": "insert", "collection": "investor_contacts", "database": "goserve", "options": {}},
             "Inserts one document per enquiry. Skipped on error so the form still works.",
             creds={"mongoDb": MONGO_CRED}, extra={"onError": "continueRegularOutput"}),
        node("notify-inv", "4 · Alert — Telegram to owner",
             "n8n-nodes-base.telegram", 1.1, [620, 0],
             {"resource": "message", "operation": "sendMessage", "chatId": CHAT,
              "text": ("=🍔 New GoServe investor enquiry\n\n"
                       "Name: {{ $('2 · Normalise — keep the fields we need').item.json.name }}\n"
                       "Firm: {{ $('2 · Normalise — keep the fields we need').item.json.firm }}\n"
                       "Email: {{ $('2 · Normalise — keep the fields we need').item.json.email }}\n"
                       "Message: {{ $('2 · Normalise — keep the fields we need').item.json.message }}\n"
                       "Source: {{ $('2 · Normalise — keep the fields we need').item.json.source }}\n"
                       "Received: {{ $('2 · Normalise — keep the fields we need').item.json.receivedAt }}"),
              "additionalFields": {}},
             "Sends an instant message to the owner's Telegram. It reads the values from the "
             "Normalise node, because the Save node only passes its own result onward.",
             creds={"telegramApi": TELEGRAM_CRED}),
        node("resp-inv", "5 · Reply — success to the visitor",
             "n8n-nodes-base.respondToWebhook", 1.1, [840, 0],
             {"respondWith": "json", "responseBody": "={{ { ok: true } }}", "options": {}},
             "Returns HTTP 200 with {ok:true} so the site shows the confirmation."),
    ]
    return {"name": "GoServe — Investor Contact",
            "nodes": nodes,
            "connections": chain("1 · Webhook — new investor enquiry",
                                 "2 · Normalise — keep the fields we need",
                                 "3 · Save — MongoDB goserve.investor_contacts",
                                 "4 · Alert — Telegram to owner",
                                 "5 · Reply — success to the visitor"),
            "settings": {"executionOrder": "v1",
                         "saveDataSuccessExecution": "all",
                         "saveDataErrorExecution": "all"},
            "staticData": None}


# 1) tag
existing = api("GET", "/tags?limit=100")
tag_id = None
for t in existing.get("data", []):
    if t.get("name") == "🍔 GoServe":
        tag_id = t["id"]
if not tag_id:
    res = api("POST", "/tags", {"name": "🍔 GoServe"})
    tag_id = (res.get("data") or res).get("id") if isinstance(res, dict) else None
print("tag 🍔 GoServe id =", tag_id)

# 2) workflows (reuse if present)
existing_wf = api("GET", "/workflows?limit=100")
by_name = {w["name"]: w for w in existing_wf.get("data", [])}

created = []
for builder in (build_preregister, build_investor):
    wf = builder()
    if wf["name"] in by_name:
        wid = by_name[wf["name"]]["id"]
        res = api("PUT", "/workflows/" + wid, wf)
        print("updated:", wf["name"], "id=", wid, "->", "ok" if res.get("id") else (str(res.get("_error")) + " " + str(res.get("_body"))))
        created.append((wf["name"], wid))
    else:
        res = api("POST", "/workflows", wf)
        wid = res.get("id")
        print("created:", wf["name"], "id=", wid, "->", "ok" if wid else (str(res.get("_error")) + " " + str(res.get("_body"))))
        if wid:
            created.append((wf["name"], wid))

# 3) attach the tag via the internal REST endpoint (public API marks tags read-only)
for name, wid in created:
    res = api("PATCH", "/../rest/workflows/" + wid, {"tags": [{"id": tag_id}]})
    print("tag-attach:", name, "->", res.get("data", {}).get("tags", res))

# 4) activate
for name, wid in created:
    res = api("POST", f"/workflows/{wid}/activate")
    print("activate:", name, "->", res.get("active", res.get("_error")))
