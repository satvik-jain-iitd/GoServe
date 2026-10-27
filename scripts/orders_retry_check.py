#!/usr/bin/env python3
"""Story #537: prove on the DEV project, through the deployed `orders` function, that a retry with a known key returns the existing order after the dish sold out.
Run: python3 scripts/orders_retry_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* from ~/Desktop/Secrets/02_databases.env)
It makes a guest, a test kitchen and a dish, places an order, sells the dish out, sends the same key again, then a NEW key. It deletes everything it made."""
import json, os, re, sys, urllib.error, urllib.request, uuid

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = open(os.path.expanduser("~/Desktop/Secrets/02_databases.env")).read()
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY")


def call(method, path, body=None, key=ANON, bearer=None):
    req = urllib.request.Request(URL + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + (bearer or key), "Content-Type": "application/json", "User-Agent": "goserve-check", "Prefer": "return=minimal"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw[:300]


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


kitchen, dish, user = str(uuid.uuid4()), str(uuid.uuid4()), None
ok = []
try:
    s, a = call("POST", "/auth/v1/signup", {}); user, token = a["user"]["id"], a["access_token"]
    call("POST", "/rest/v1/kitchens", {"id": kitchen, "name": "Retry check", "pin_codes": ["119995"], "open": True, "active": True, "opens_at": "00:00:00", "closes_at": "23:59:59"}, SERVICE)
    call("POST", "/rest/v1/menu_items", {"id": dish, "kitchen_id": kitchen, "name": "Check thali", "price_paise": 16000, "available": True}, SERVICE)
    body = {"kitchen_id": kitchen, "lines": [{"menu_item_id": dish, "qty": 1, "option_ids": []}], "address": {"pin_code": "119995", "text": "Flat 4, retry check"},
            "idempotency_key": "retry-check-0001", "expected_to_pay_paise": 16000}
    order = lambda b: call("POST", "/functions/v1/orders", b, key=ANON, bearer=token)
    s1, o1 = order(body)
    ok.append(check("the first call places the order (201, created)", s1 == 201 and o1.get("created") is True, f"{s1} {str(o1)[:120]}"))
    call("PATCH", f"/rest/v1/menu_items?id=eq.{dish}", {"available": False}, SERVICE)
    s2, o2 = order(body)
    ok.append(check("the same key after the dish sold out returns the same order, created false", s2 == 200 and o2.get("created") is False and o2["order"]["id"] == o1["order"]["id"], f"{s2} {str(o2)[:120]}"))
    s3, o3 = order({**body, "idempotency_key": "retry-check-0002"})
    ok.append(check("a NEW key for the sold out dish is refused as before (422 sold_out)", s3 == 422 and o3.get("error") == "sold_out", f"{s3} {str(o3)[:100]}"))
finally:
    if user:
        call("DELETE", f"/rest/v1/orders?session_id=eq.{user}", None, SERVICE)
    call("DELETE", f"/rest/v1/menu_items?id=eq.{dish}", None, SERVICE)
    call("DELETE", f"/rest/v1/kitchens?id=eq.{kitchen}", None, SERVICE)
    if user:
        call("DELETE", f"/auth/v1/admin/users/{user}", None, SERVICE)
print("PASS" if ok and all(ok) else "FAIL")
sys.exit(0 if ok and all(ok) else 1)
