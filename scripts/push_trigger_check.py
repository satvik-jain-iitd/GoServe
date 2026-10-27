#!/usr/bin/env python3
"""Story #563 (layer 2 of #351): prove on the DEV project that an order change reaches /push/notify and gives one send per device.
Run: python3 scripts/push_trigger_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* and SUPABASE_ACCESS_TOKEN from ~/Desktop/Secrets/02_databases.env)
Setup it keeps on dev (a dev value, nothing real): the function secret PUSH_NOTIFY_SECRET on the `push` function, and the vault secrets push_notify_url and
push_notify_secret in the dev database. Then, with FakePush on the function: 1. a customer with an Android and an iOS token; 2. an order for them;
3. the kitchen accepts it; 4. pg_net's answer says 200 and sent 2; 5. a repeat of the same status asks nothing more. It deletes everything it made, except the setup."""
import json, os, re, secrets, sys, time, urllib.error, urllib.request, uuid

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = open(os.path.expanduser("~/Desktop/Secrets/02_databases.env")).read()
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE, MGMT = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY"), get("SUPABASE_ACCESS_TOKEN")
REF = "tmxyizmkpwwfyazvrfhw"
API = "https://api.supabase.com"


def call(method, path, body=None, key=ANON, base=None):
    req = urllib.request.Request((base or URL) + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "goserve-check", "Prefer": "return=minimal"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def sql(q):
    s, r = call("POST", f"/v1/projects/{REF}/database/query", {"query": q}, key=MGMT, base=API)
    return r if s in (200, 201) else {"error": r}


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


secret = secrets.token_hex(16)
s, _ = call("POST", f"/v1/projects/{REF}/secrets", [{"name": "PUSH_NOTIFY_SECRET", "value": secret}], key=MGMT, base=API)
ok = [check("the dev function takes the notify secret", s in (200, 201), f"{s}")]
sql("delete from vault.secrets where name in ('push_notify_url', 'push_notify_secret')")
sql(f"select vault.create_secret('{URL}/functions/v1/push/notify', 'push_notify_url'), vault.create_secret('{secret}', 'push_notify_secret')")
user, kitchen, order = None, str(uuid.uuid4()), str(uuid.uuid4())
try:
    s, a = call("POST", "/auth/v1/signup", {}); user = a["user"]["id"]
    call("POST", "/rest/v1/kitchens", {"id": kitchen, "name": "Push check", "pin_codes": ["119997"]}, SERVICE)
    call("POST", "/rest/v1/orders", {"id": order, "kitchen_id": kitchen, "session_id": user, "client_order_key": "push-check", "items": [], "total_paise": 100, "address": "x"}, SERVICE)
    sql(f"select register_push_device_v2('{user}', 'android', 'check-a-{order[:8]}'), register_push_device_v2('{user}', 'ios', 'check-i-{order[:8]}')")
    sql(f"update orders set status = 'accepted' where id = '{order}'")
    got = []
    for _ in range(20):   # pg_net sends after the commit; the function answers in a second or two
        got = sql(f"select r.status_code, r.content from push_jobs j join net._http_response r on r.id = j.request_id where j.order_id = '{order}'")
        if isinstance(got, list) and got:
            break
        time.sleep(1.5)
    body = json.loads(got[0]["content"]) if isinstance(got, list) and got else {}
    ok.append(check("one job and one answer, 200", isinstance(got, list) and len(got) == 1 and got[0]["status_code"] == 200, str(got)[:160]))
    ok.append(check("one send per device (FakePush)", body.get("sent") == 2 and body.get("failed") == 0, str(body)))
    sql(f"update orders set status = 'accepted' where id = '{order}'")
    n = sql(f"select count(*) as n from push_jobs where order_id = '{order}'")
    ok.append(check("the same status again queues nothing more", isinstance(n, list) and n[0]["n"] == 1, str(n)))
finally:
    sql(f"delete from push_devices where session_id = '{user}'; delete from orders where id = '{order}'; delete from kitchens where id = '{kitchen}'")
    if user:
        call("DELETE", f"/auth/v1/admin/users/{user}", None, SERVICE)
print("PASS" if all(ok) else "FAIL")
sys.exit(0 if all(ok) else 1)
