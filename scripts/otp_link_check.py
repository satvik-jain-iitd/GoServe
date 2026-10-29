#!/usr/bin/env python3
"""Story #339: prove on the DEV project that the verify step's link keeps the user. Run: python3 scripts/otp_link_check.py dev
Reads SUPABASE_GOSERVE_DEV_* from ~/Desktop/Secrets/goserve/goserve.env (SUPABASE_ACCESS_TOKEN from 02_databases.env). It makes two anonymous users, links a test phone to the first with the Auth admin API
(the call the otp function makes), and checks: the user id does not change, the user is no longer anonymous, the old session still refreshes, and a second user
cannot take the same phone (users_phone_key, which the function answers as phone_in_use). It deletes both users at the end. Dev only."""
import vault as gsvault
import json, os, re, sys, urllib.error, urllib.request

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = gsvault.read("02_databases.env")
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY")
PHONE = "919999900123"


def call(method, path, body=None, key=ANON):
    req = urllib.request.Request(URL + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


users = []
try:
    s, a = call("POST", "/auth/v1/signup", {})
    users.append(a["user"]["id"])
    ok = [check("a guest starts anonymous", s == 200 and a["user"]["is_anonymous"] is True)]
    s, b = call("PUT", f"/auth/v1/admin/users/{users[0]}", {"phone": PHONE, "phone_confirm": True}, SERVICE)
    ok.append(check("linking a phone keeps the user id and ends anonymous", s == 200 and b["id"] == users[0] and b["is_anonymous"] is False and b["phone"] == PHONE, f"{s}"))
    s, c = call("POST", "/auth/v1/token?grant_type=refresh_token", {"refresh_token": a["refresh_token"]})
    ok.append(check("the guest's old session still refreshes, as the same user, with the phone", s == 200 and c["user"]["id"] == users[0] and c["user"]["phone"] == PHONE, f"{s}"))
    s2, a2 = call("POST", "/auth/v1/signup", {})
    users.append(a2["user"]["id"])
    s, d = call("PUT", f"/auth/v1/admin/users/{users[1]}", {"phone": PHONE, "phone_confirm": True}, SERVICE)
    ok.append(check("a second user cannot take the same phone (users_phone_key)", s >= 400 and "users_phone_key" in str(d), f"{s}"))
finally:
    for u in users:
        call("DELETE", f"/auth/v1/admin/users/{u}", key=SERVICE)
print("PASS" if all(ok) else "FAIL")
sys.exit(0 if all(ok) else 1)
