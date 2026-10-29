#!/usr/bin/env python3
"""Story #558 (layer 2 of #339): prove on the DEV project that a returning customer signs in with their number and the orders of a new guest session move over.
Run: python3 scripts/otp_returning_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* and SUPABASE_ACCESS_TOKEN from ~/Desktop/Secrets/goserve/goserve.env (SUPABASE_ACCESS_TOKEN from 02_databases.env))
It sets a TEST OTP in the dev Auth config for one hour (Management API: external_phone_enabled, sms_test_otp, sms_test_otp_valid_until), then:
  1. a guest A links a test phone (the first-visit path of layer 1); 2. a new guest B places an order; 3. B's person signs in with Supabase's own phone OTP and
  holds A's session; 4. claim_guest_orders_v2(B, A) moves the order; 5. A's own token reads that order. It deletes everything it made.
The dev Auth config keeps phone sign-in on afterwards (no SMS provider is set, only the test number works)."""
import vault as gsvault
import datetime, json, os, re, sys, urllib.error, urllib.request, uuid

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = gsvault.read("02_databases.env")
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE, MGMT = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY"), get("SUPABASE_ACCESS_TOKEN")
REF = "tmxyizmkpwwfyazvrfhw"
PHONE, E164, CODE = "919999900124", "+919999900124", "123456"


def call(method, path, body=None, key=ANON, bearer=None, base=None, extra=None):
    req = urllib.request.Request((base or URL) + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + (bearer or key), "Content-Type": "application/json", "User-Agent": "goserve-check", **(extra or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


until = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
s, cfg = call("PATCH", f"/v1/projects/{REF}/config/auth", {"external_phone_enabled": True, "sms_test_otp": f"{PHONE}={CODE}", "sms_test_otp_valid_until": until}, key=MGMT, base="https://api.supabase.com")
ok = [check("the dev Auth config takes a test OTP", s == 200 and isinstance(cfg, dict) and cfg.get("sms_test_otp") == f"{PHONE}={CODE}", f"{s}")]
users, kitchen, order = [], str(uuid.uuid4()), str(uuid.uuid4())
try:
    s, a = call("POST", "/auth/v1/signup", {}); users.append(a["user"]["id"])
    call("PUT", f"/auth/v1/admin/users/{users[0]}", {"phone": PHONE, "phone_confirm": True}, SERVICE)
    s, b = call("POST", "/auth/v1/signup", {}); users.append(b["user"]["id"])
    call("POST", "/rest/v1/kitchens", {"id": kitchen, "name": "Returning check", "pin_codes": ["119998"]}, SERVICE, extra={"Prefer": "return=minimal"})
    s, _ = call("POST", "/rest/v1/orders", {"id": order, "kitchen_id": kitchen, "session_id": users[1], "client_order_key": "returning-check", "items": [], "total_paise": 100, "address": "x"}, SERVICE, extra={"Prefer": "return=minimal"})
    ok.append(check("a new guest placed an order", s in (200, 201), f"{s}"))
    s, o = call("POST", "/auth/v1/otp", {"phone": E164})
    s2, v = call("POST", "/auth/v1/verify", {"phone": E164, "token": CODE, "type": "sms"})
    signed = s2 == 200 and isinstance(v, dict) and v["user"]["id"] == users[0] and v["user"]["is_anonymous"] is False
    ok.append(check("signing in with the number and the test code gives the old account's session", signed, f"otp {s}, verify {s2}"))
    s, m = call("POST", "/rest/v1/rpc/claim_guest_orders_v2", {"p_from": users[1], "p_to": users[0]}, SERVICE)
    ok.append(check("the guest's order is moved to the old account", s == 200 and m.get("ok") is True and m.get("orders") == 1, f"{s} {m}"))
    if signed:
        s, rows = call("GET", f"/rest/v1/orders?id=eq.{order}&select=session_id", ANON, bearer=v["access_token"])
        ok.append(check("the old account's own token reads that order", s == 200 and rows == [{"session_id": users[0]}], f"{s}"))
finally:
    call("DELETE", f"/rest/v1/orders?id=eq.{order}", key=SERVICE)
    call("DELETE", f"/rest/v1/kitchens?id=eq.{kitchen}", key=SERVICE)
    for u in users:
        call("DELETE", f"/auth/v1/admin/users/{u}", key=SERVICE)
print("PASS" if all(ok) else "FAIL")
sys.exit(0 if all(ok) else 1)
