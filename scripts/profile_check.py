#!/usr/bin/env python3
"""Story #340: prove on the DEV project, through the deployed `me` function, that a customer keeps a name and email, deletes the account, and the purge job removes the rest.
Run: python3 scripts/profile_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* and SUPABASE_ACCESS_TOKEN from ~/Desktop/Secrets/02_databases.env)
It makes a guest with a saved detail row, a test kitchen and an order; GET, PATCH and DELETE /me; then ages the deleted_at of THIS user only and runs the purge job.
It deletes what it made (the purge deletes the login itself)."""
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


def wipe(kitchen_id):
    """The order events are append-only; the demo reset switch is on for this one transaction."""
    k = f"'{kitchen_id}'"
    sql("begin; select set_config('goserve.reset', 'on', true); "
        f"delete from order_events where order_id in (select id from orders where kitchen_id = {k}); delete from order_trace where order_id in (select id from orders where kitchen_id = {k}); "
        f"delete from decision_log where order_id in (select id from orders where kitchen_id = {k}); delete from orders where kitchen_id = {k}; commit;")


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


kitchen, order, user = str(uuid.uuid4()), str(uuid.uuid4()), None
ok = []
try:
    s, a = call("POST", "/auth/v1/signup", {}); user, token = a["user"]["id"], a["access_token"]
    call("POST", "/rest/v1/kitchens", {"id": kitchen, "name": "Profile check", "pin_codes": ["119993"]}, SERVICE)
    call("POST", "/rest/v1/orders", {"id": order, "kitchen_id": kitchen, "session_id": user, "client_order_key": "profile-check", "items": [], "total_paise": 100, "address": "Flat 4, profile check",
                                     "customer_name": "Asha", "customer_phone": "9876543210"}, SERVICE)
    call("POST", "/rest/v1/customers", {"user_id": user, "name": "Asha", "phone": "9876543210"}, SERVICE)
    me = lambda m, b=None: call(m, "/functions/v1/me", b, bearer=token)
    s, g = me("GET")
    ok.append(check("a new customer has an empty profile", s == 200 and g == {"ok": True, "profile": {"name": None, "email": None}}, f"{s} {g}"))
    s, p = me("PATCH", {"name": "Asha K", "email": "asha@example.com"})
    s2, g = me("GET")
    ok.append(check("PATCH saves the name and email, GET reads them", s == 200 and g.get("profile") == {"name": "Asha K", "email": "asha@example.com"}, f"{s} {s2} {g}"))
    s, e = me("PATCH", {"email": "nope"})
    ok.append(check("a bad email is refused (422 invalid_email)", s == 422 and e.get("error") == "invalid_email", f"{s} {e}"))
    s, d = me("DELETE")
    s2, g = me("GET")
    ok.append(check("DELETE soft-deletes at once: GET says 410 account_deleted", s == 200 and s2 == 410 and g.get("error") == "account_deleted", f"{s} {s2}"))
    young = sql("select purge_deleted_accounts_v2(30) as r")
    still = sql(f"select count(*) as n from customers where user_id = '{user}'")
    ok.append(check("the job does not purge a young deletion", isinstance(still, list) and still[0]["n"] == 1, f"{young} {still}"))
    sql(f"update profiles set deleted_at = now() - interval '31 days' where user_id = '{user}'")
    done = sql("select purge_deleted_accounts_v2(30) as r")
    rows = sql(f"select (select count(*) from customers where user_id = '{user}') c, (select count(*) from auth.users where id = '{user}') u, (select customer_name from orders where id = '{order}') nm, (select address from orders where id = '{order}') ad")
    ok.append(check("after the wait the job purges: details gone, login gone, the order stays blanked", isinstance(rows, list) and rows[0] == {"c": 0, "u": 0, "nm": None, "ad": "[deleted]"}, f"{done} {rows}"))
finally:
    wipe(kitchen)
    call("DELETE", f"/rest/v1/kitchens?id=eq.{kitchen}", None, SERVICE)
    if user:
        call("DELETE", f"/auth/v1/admin/users/{user}", None, SERVICE)
print("PASS" if ok and all(ok) else "FAIL")
sys.exit(0 if ok and all(ok) else 1)
