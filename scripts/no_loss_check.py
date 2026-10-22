#!/usr/bin/env python3
"""S-M2 (#118): proof that no order is lost or doubled, on goserve-dev through the n8n webhook.
20 orders. Each `place` is sent twice with the same client_order_key; for 5 of them the first send is cut right after the request leaves (the answer is never read).
Then every order goes placed, accepted, preparing, ready, and each step is sent twice. Then it counts the rows.
It WRITES to goserve-dev (one anonymous user, 20 orders, their events). Dev only. Clean up with scripts/clear_dev.py.
Run: python3 scripts/no_loss_check.py   Prints: orders=20 duplicates=0 chains_ok=20 lost=0"""
import json, os, re, socket, ssl, sys, time, urllib.error, urllib.request, uuid
from urllib.parse import urlparse

CHAIN = ["order.placed", "order.accepted", "order.preparing", "order.ready"]


def verify(orders: list, events: list, sent: int) -> dict:
    """orders: rows of this session. events: rows in id order. sent: how many different orders we tried to place."""
    keys = [o["client_order_key"] for o in orders]
    by: dict = {}
    for e in events:
        by.setdefault(e["order_id"], []).append(e["event"])
    return {"orders": len(orders), "duplicates": len(keys) - len(set(keys)),
            "chains_ok": sum(1 for o in orders if by.get(o["id"]) == CHAIN), "lost": max(0, sent - len(set(keys)))}


def vault(f, k):
    return re.search(r"^" + k + r"=(\S+)", open(os.path.expanduser("~/Desktop/Secrets/" + f)).read(), re.M).group(1)


def main() -> int:
    URL = "https://n8n.linkright.in/webhook/gs-order"
    TOKEN = vault("04_integrations.env", "GOSERVE_DEMO_TOKEN")
    SB = vault("02_databases.env", "SUPABASE_GOSERVE_DEV_URL")
    SK = vault("02_databases.env", "SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY")
    ANON = vault("02_databases.env", "SUPABASE_GOSERVE_DEV_ANON_KEY")

    def post(body):
        req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"content-type": "application/json", "x-gs-token": TOKEN, "User-Agent": "curl/8.7.1"})
        try:
            r = urllib.request.urlopen(req, timeout=30)
            return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")

    def post_and_cut(body):
        """Send the request, then close the socket without reading the answer (the phone lost the network after sending)."""
        u = urlparse(URL)
        data = json.dumps(body).encode()
        raw = (f"POST {u.path} HTTP/1.1\r\nHost: {u.netloc}\r\nContent-Type: application/json\r\nx-gs-token: {TOKEN}\r\nUser-Agent: curl/8.7.1\r\n"
               f"Content-Length: {len(data)}\r\nConnection: close\r\n\r\n").encode() + data
        with socket.create_connection((u.netloc, 443), timeout=15) as s, ssl.create_default_context().wrap_socket(s, server_hostname=u.netloc) as t:
            t.sendall(raw)
        time.sleep(1.5)   # let the server finish the order it already received

    sess = json.load(urllib.request.urlopen(urllib.request.Request(SB + "/auth/v1/signup", data=b"{}", headers={"apikey": ANON, "content-type": "application/json"})))
    sid = sess["user"]["id"]
    menu = json.load(urllib.request.urlopen(urllib.request.Request(SB + "/rest/v1/menu_items?select=id&limit=2", headers={"apikey": ANON})))
    codes = []
    for i in range(20):
        body = {"action": "place", "session_id": sid, "client_order_key": f"noloss-{uuid.uuid4().hex}", "items": [{"menu_item_id": menu[i % 2]["id"], "qty": 1}], "address": "Flat 4, Green Park, Delhi"}
        if i < 5:
            post_and_cut(body)
        codes.append(post(body)[0])   # the retry, or the first send, answers 201 or 200
        codes.append(post(body)[0])   # the second copy always answers 200 (already there)
    print("place answers", sorted(set(codes)))
    rows = json.load(urllib.request.urlopen(urllib.request.Request(SB + f"/rest/v1/orders?select=id&session_id=eq.{sid}", headers={"apikey": SK, "Authorization": "Bearer " + SK})))
    for o in rows:
        for to in ("accepted", "preparing", "ready"):
            first = post({"action": "status", "session_id": sid, "order_id": o["id"], "to_status": to, "actor": "kitchen"})[0]
            again = post({"action": "status", "session_id": sid, "order_id": o["id"], "to_status": to, "actor": "kitchen"})[0]
            if first != 200 or again != 409:
                print("STEP", to, "first", first, "again", again, "(want 200 then 409)")
    time.sleep(2)
    get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request(SB + "/rest/v1/" + p, headers={"apikey": SK, "Authorization": "Bearer " + SK})))
    res = verify(get(f"orders?select=id,client_order_key&session_id=eq.{sid}"), get(f"order_events?select=order_id,event&session_id=eq.{sid}&order=id"), sent=20)
    print("orders=%(orders)d duplicates=%(duplicates)d chains_ok=%(chains_ok)d lost=%(lost)d" % res, "session", sid)
    return 0 if res == {"orders": 20, "duplicates": 0, "chains_ok": 20, "lost": 0} else 1


if __name__ == "__main__":
    sys.exit(main())
