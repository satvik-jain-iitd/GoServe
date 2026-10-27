#!/usr/bin/env python3
"""Story #484: what happened to order X? Read-only. Usage: order_trace.py <order id prefix> [prod|dev]
Prints the order's own events (db) and every order_trace line (app, sw, n8n, sim) in time order. Secrets come from ~/Desktop/Secrets and are never printed."""
import json, os, sys, urllib.request


def timeline(events, trace):
    rows = [(e.get("created_at") or "", "db", e.get("event") or "?", "", e.get("actor") or "") for e in events]
    for t in trace:
        d = t.get("detail") or {}
        rows.append((t.get("at") or "", t.get("actor") or "?", t.get("event") or "?", " ".join(x for x in (t.get("result"), d.get("host"), d.get("text")) if x), ""))
    return [f"{at[11:19]} {actor:<4} {event} {extra}".rstrip() + (f" ({who})" if who else "") for at, actor, event, extra, who in sorted(rows)]


def vault(file, key):
    for line in open(os.path.expanduser(f"~/Desktop/Secrets/{file}")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()


def main():
    prefix, env = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "prod")
    e = env.upper()
    url, key = vault("02_databases.env", f"SUPABASE_GOSERVE_{e}_URL"), vault("02_databases.env", f"SUPABASE_GOSERVE_{e}_SERVICE_ROLE_KEY")

    def get(path):
        req = urllib.request.Request(f"{url}/rest/v1/{path}", headers={"apikey": key, "Authorization": f"Bearer {key}", "User-Agent": "goserve-order-trace"})
        return json.load(urllib.request.urlopen(req))

    orders = [o for o in get("orders?select=id,status,created_at,session_id&order=created_at.desc&limit=100") if o["id"].startswith(prefix)]
    if not orders:
        sys.exit("order not found")
    o = orders[0]
    print(f"order {o['id'][:8]} status={o['status']} created={o['created_at']}")
    subs = get(f"push_subscriptions?session_id=eq.{o['session_id']}&select=endpoint,created_at")
    print(f"push subscriptions: {len(subs)} " + ", ".join(s["endpoint"].split('/')[2] for s in subs))
    for line in timeline(get(f"order_events?order_id=eq.{o['id']}&select=event,actor,created_at"), get(f"order_trace?order_id=eq.{o['id']}&select=at,actor,event,result,detail")):
        print(line)


if __name__ == "__main__":
    main()
