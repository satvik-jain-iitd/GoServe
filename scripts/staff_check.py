#!/usr/bin/env python3
"""Story #468: prove on the DEV project, through the deployed `staff` function, that one person can work in two kitchens and acts only in the ones they belong to.
Run: python3 scripts/staff_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* and SUPABASE_ACCESS_TOKEN from ~/Desktop/Secrets/02_databases.env)
It makes two kitchens A and B, a staff person of A, an admin and an order in B. It tries the order as the A-only person, adds them to B as the admin, lists their kitchens,
accepts the order, removes the one membership, and tries to add as a non-admin. It deletes everything it made."""
import vault as gsvault
import json, os, re, sys, urllib.error, urllib.request, uuid

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = gsvault.read("02_databases.env")
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE, MGMT = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY"), get("SUPABASE_ACCESS_TOKEN")
REF = "tmxyizmkpwwfyazvrfhw"


def call(method, path, body=None, key=ANON, bearer=None, base=None):
    req = urllib.request.Request((base or URL) + path, method=method, data=json.dumps(body).encode() if body is not None else None,
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


def sql(q):
    s, r = call("POST", f"/v1/projects/{REF}/database/query", {"query": q}, key=MGMT, base="https://api.supabase.com")
    return r if s in (200, 201) else {"error": r}


def wipe(kitchen_ids):
    ks = ", ".join(f"'{k}'" for k in kitchen_ids)
    sql("begin; select set_config('goserve.reset', 'on', true); "
        f"delete from order_events where order_id in (select id from orders where kitchen_id in ({ks})); delete from order_trace where order_id in (select id from orders where kitchen_id in ({ks})); "
        f"delete from decision_log where order_id in (select id from orders where kitchen_id in ({ks})); delete from orders where kitchen_id in ({ks}); commit;")


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


ka, kb, order, users = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), []
ok = []
try:
    s, a = call("POST", "/auth/v1/signup", {}); person, ptoken = a["user"]["id"], a["access_token"]; users.append(person)
    s, b = call("POST", "/auth/v1/signup", {}); admin, atoken = b["user"]["id"], b["access_token"]; users.append(admin)
    s, c = call("POST", "/auth/v1/signup", {}); guest = c["user"]["id"]; users.append(guest)
    for k, n in ((ka, "Staff check A"), (kb, "Staff check B")):
        call("POST", "/rest/v1/kitchens", {"id": k, "name": n, "pin_codes": ["119992"]}, SERVICE)
    call("POST", "/rest/v1/kitchen_staff", {"kitchen_id": ka, "user_id": person, "role": "staff"}, SERVICE)
    call("POST", "/rest/v1/admins", {"user_id": admin}, SERVICE)
    call("POST", "/rest/v1/orders", {"id": order, "kitchen_id": kb, "session_id": guest, "client_order_key": "staff-check", "items": [], "total_paise": 100, "address": "Flat 4, staff check"}, SERVICE)
    act = lambda: call("POST", "/rest/v1/rpc/act_on_order", {"p_order": order, "p_action": "accept"}, bearer=ptoken)
    s, r = act()
    ok.append(check("a person of kitchen A only cannot accept a kitchen B order", s == 200 and r.get("error") == "not_allowed", f"{s} {r}"))
    s, r = call("POST", "/functions/v1/staff", {"kitchen_id": kb, "user_id": person, "role": "staff"}, bearer=ptoken)
    ok.append(check("a non-admin cannot add a membership (403)", s == 403 and r.get("error") == "not_allowed", f"{s} {r}"))
    s, r = call("POST", "/functions/v1/staff", {"kitchen_id": kb, "user_id": person, "role": "staff"}, bearer=atoken)
    ok.append(check("the admin adds the person to kitchen B (200)", s == 200 and r.get("ok") is True, f"{s} {r}"))
    s, r = call("GET", "/functions/v1/staff/mine", None, bearer=ptoken)
    ok.append(check("my kitchens lists both with their roles", s == 200 and sorted(k["name"] for k in r.get("kitchens", [])) == ["Staff check A", "Staff check B"] and all(k["role"] == "staff" for k in r["kitchens"]), f"{s} {r}"))
    s, r = act()
    ok.append(check("now the person accepts the kitchen B order", s == 200 and r.get("ok") is True, f"{s} {str(r)[:100]}"))
    s, r = call("DELETE", "/functions/v1/staff", {"kitchen_id": kb, "user_id": person}, bearer=atoken)
    s2, m = call("GET", "/functions/v1/staff/mine", None, bearer=ptoken)
    ok.append(check("the admin removes that one membership, kitchen A stays", s == 200 and [k["name"] for k in m.get("kitchens", [])] == ["Staff check A"], f"{s} {m}"))
finally:
    wipe([ka, kb])
    call("DELETE", f"/rest/v1/kitchen_staff?kitchen_id=in.({ka},{kb})", None, SERVICE)
    call("DELETE", f"/rest/v1/admins?user_id=in.({','.join(users)})", None, SERVICE)
    call("DELETE", f"/rest/v1/kitchens?id=in.({ka},{kb})", None, SERVICE)
    for u in users:
        call("DELETE", f"/auth/v1/admin/users/{u}", None, SERVICE)
print("PASS" if ok and all(ok) else "FAIL")
sys.exit(0 if ok and all(ok) else 1)
