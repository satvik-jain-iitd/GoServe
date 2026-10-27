#!/usr/bin/env python3
"""Story #354: prove on the DEV project, through the deployed `orders` function, that a delivered order is rated once, with food and rider scores stored.
Run: python3 scripts/ratings_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* from ~/Desktop/Secrets/02_databases.env)
It makes a guest, a test kitchen, a dish and a rider, places an order, tries to rate it too early, walks it to delivered, rates it, rates it again, and reads the stored row.
It deletes everything it made."""
import json, os, re, sys, urllib.error, urllib.request, uuid

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = open(os.path.expanduser("~/Desktop/Secrets/02_databases.env")).read()
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE, MGMT = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY"), get("SUPABASE_ACCESS_TOKEN")
REF = "tmxyizmkpwwfyazvrfhw"


def call(method, path, body=None, key=ANON, bearer=None):
    req = urllib.request.Request(URL + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + (bearer or key), "Content-Type": "application/json", "User-Agent": "goserve-check", "Prefer": "return=representation"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw[:300]


def wipe(kitchen_id):
    """Delete a test kitchen's orders the way the demo reset does: the events are append-only, so the reset switch is on for this one transaction."""
    k = f"'{kitchen_id}'"
    q = ("begin; select set_config('goserve.reset', 'on', true); "
         f"delete from order_events where order_id in (select id from orders where kitchen_id = {k}); delete from order_trace where order_id in (select id from orders where kitchen_id = {k}); "
         f"delete from decision_log where order_id in (select id from orders where kitchen_id = {k}); delete from orders where kitchen_id = {k}; commit;")
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query", data=json.dumps({"query": q}).encode(),
                                 headers={"Authorization": "Bearer " + MGMT, "Content-Type": "application/json", "User-Agent": "goserve-check"})
    urllib.request.urlopen(req, timeout=60).read()


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


kitchen, dish, users = str(uuid.uuid4()), str(uuid.uuid4()), []
ok = []
try:
    s, a = call("POST", "/auth/v1/signup", {}); guest, token = a["user"]["id"], a["access_token"]; users.append(guest)
    s, r = call("POST", "/auth/v1/signup", {}); rider = r["user"]["id"]; users.append(rider)
    call("POST", "/rest/v1/kitchens", {"id": kitchen, "name": "Rating check", "pin_codes": ["119994"], "open": True, "active": True, "opens_at": "00:00:00", "closes_at": "23:59:59"}, SERVICE)
    call("POST", "/rest/v1/menu_items", {"id": dish, "kitchen_id": kitchen, "name": "Check thali", "price_paise": 16000, "available": True}, SERVICE)
    call("POST", "/rest/v1/riders", {"user_id": rider, "name": "Check rider"}, SERVICE)
    s, o = call("POST", "/functions/v1/orders", {"kitchen_id": kitchen, "lines": [{"menu_item_id": dish, "qty": 1, "option_ids": []}], "address": {"pin_code": "119994", "text": "Flat 4, rating check"},
                                              "idempotency_key": "rating-check-0001", "expected_to_pay_paise": 16000}, bearer=token)
    order = o["order"]["id"]
    rate = lambda b: call("POST", f"/functions/v1/orders/{order}/rating", b, bearer=token)
    s, e = rate({"food_score": 5, "rider_score": 4})
    ok.append(check("rating a placed order is refused (409 not_delivered)", s == 409 and e.get("error") == "not_delivered", f"{s} {str(e)[:100]}"))
    for st in ("accepted", "preparing", "ready"):
        call("PATCH", f"/rest/v1/orders?id=eq.{order}", {"status": st}, SERVICE)
    call("PATCH", f"/rest/v1/orders?id=eq.{order}", {"rider_id": rider}, SERVICE)
    for st in ("out_for_delivery", "delivered"):
        call("PATCH", f"/rest/v1/orders?id=eq.{order}", {"status": st}, SERVICE)
    s, e = rate({"food_score": 5, "rider_score": 4, "comment": "Hot and on time"})
    ok.append(check("a delivered order is rated (200)", s == 200 and e.get("ok") is True, f"{s} {str(e)[:100]}"))
    s, row = call("GET", f"/rest/v1/order_ratings?order_id=eq.{order}&select=food_score,rider_score,comment", None, SERVICE)
    ok.append(check("food and rider scores are stored", s == 200 and row == [{"food_score": 5, "rider_score": 4, "comment": "Hot and on time"}], f"{s} {row}"))
    s, e = rate({"food_score": 1})
    ok.append(check("a second rating is refused (409 already_rated)", s == 409 and e.get("error") == "already_rated", f"{s} {str(e)[:100]}"))
finally:
    wipe(kitchen)
    call("DELETE", f"/rest/v1/riders?user_id=in.({','.join(users)})", None, SERVICE)
    call("DELETE", f"/rest/v1/menu_items?id=eq.{dish}", None, SERVICE)
    call("DELETE", f"/rest/v1/kitchens?id=eq.{kitchen}", None, SERVICE)
    for u in users:
        call("DELETE", f"/auth/v1/admin/users/{u}", None, SERVICE)
print("PASS" if ok and all(ok) else "FAIL")
sys.exit(0 if ok and all(ok) else 1)
