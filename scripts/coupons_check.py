#!/usr/bin/env python3
"""Story #346: prove on the DEV project, through the deployed functions, that a quote with several valid coupons applies the best one and returns the list,
and that GET /coupons lists the valid ones only.
Run: python3 scripts/coupons_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* and SUPABASE_ACCESS_TOKEN from ~/Desktop/Secrets/goserve/goserve.env (SUPABASE_ACCESS_TOKEN from 02_databases.env))
It makes a test kitchen, one dish and four coupons (three valid, one switched off), asks POST /quote with no code and with a typed code, and GET /coupons. It deletes everything it made."""
import vault as gsvault
import json, os, re, sys, urllib.error, urllib.request, uuid

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = gsvault.read("02_databases.env")
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE, MGMT = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY"), get("SUPABASE_ACCESS_TOKEN")
REF = "tmxyizmkpwwfyazvrfhw"


def call(method, path, body=None, key=ANON, base=None):
    req = urllib.request.Request((base or URL) + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "goserve-check", "Prefer": "return=minimal"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw[:300]


def sql(q):
    s, r = call("POST", f"/v1/projects/{REF}/database/query", {"query": q}, key=MGMT, base="https://api.supabase.com")
    return r if s in (200, 201) else {"error": r}


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


kitchen, dish = str(uuid.uuid4()), str(uuid.uuid4())
codes = ["CHK-FLAT50", "CHK-FLAT40", "CHK-PCT10", "CHK-OFF"]
ok = []
try:
    call("POST", "/rest/v1/kitchens", {"id": kitchen, "name": "Coupons check", "pin_codes": ["119996"]}, SERVICE)
    call("POST", "/rest/v1/menu_items", {"id": dish, "kitchen_id": kitchen, "name": "Check thali", "price_paise": 16000, "available": True}, SERVICE)
    sql("insert into coupons (code, title, kind, amount_paise, percent, cap_paise, ends_at, active) values "
        "('CHK-FLAT50', 'Rs 50 off', 'flat', 5000, 0, 0, now() + interval '1 hour', true), ('CHK-FLAT40', 'Rs 40 off', 'flat', 4000, 0, 0, now() + interval '1 hour', true), "
        "('CHK-PCT10', '10% off', 'percent', 0, 10, 3000, now() + interval '1 hour', true), ('CHK-OFF', 'Switched off', 'flat', 9000, 0, 0, now() + interval '1 hour', false)")
    body = {"kitchen_id": kitchen, "lines": [{"menu_item_id": dish, "qty": 2}], "address": {"pin_code": "119996"}}
    s, q = call("POST", "/functions/v1/quote", body)
    offers = [o["code"] for o in q.get("offers", [])] if isinstance(q, dict) else []
    ok.append(check("no code: the best coupon is applied", s == 200 and q.get("coupon", {}).get("code") == "CHK-FLAT50" and q.get("discount_paise") == 5000 and q.get("to_pay_paise") == 27000, f"{s} {str(q)[:140]}"))
    ok.append(check("no code: the list is returned, best first, the switched-off one is not in it", [c for c in offers if c.startswith("CHK-")] == ["CHK-FLAT50", "CHK-FLAT40", "CHK-PCT10"], str(offers)))
    s, q = call("POST", "/functions/v1/quote", {**body, "coupon_code": "chk-flat40"})
    ok.append(check("a typed code (any case) is applied even though another saves more", s == 200 and q.get("coupon", {}).get("code") == "CHK-FLAT40" and q.get("discount_paise") == 4000, f"{s}"))
    s, q = call("POST", "/functions/v1/quote", {**body, "coupon_code": "CHK-OFF"})
    ok.append(check("a switched-off code is refused", s == 422 and q.get("error") == "coupon_invalid", f"{s} {str(q)[:100]}"))
    s, c = call("GET", "/functions/v1/coupons")
    listed = [x["code"] for x in c.get("coupons", [])] if isinstance(c, dict) else []
    ok.append(check("GET /coupons lists the valid ones only", s == 200 and {"CHK-FLAT50", "CHK-FLAT40", "CHK-PCT10"} <= set(listed) and "CHK-OFF" not in listed, f"{s} {listed}"))
finally:
    sql("delete from coupons where code like 'CHK-%'")
    call("DELETE", f"/rest/v1/menu_items?id=eq.{dish}", None, SERVICE)
    call("DELETE", f"/rest/v1/kitchens?id=eq.{kitchen}", None, SERVICE)
print("PASS" if ok and all(ok) else "FAIL")
sys.exit(0 if ok and all(ok) else 1)
