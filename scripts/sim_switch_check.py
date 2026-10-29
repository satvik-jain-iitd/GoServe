#!/usr/bin/env python3
"""Story #783: prove on the DEV project that after Reset a guest order on a real kitchen goes through the deployed `orders` function and reaches the kitchen's list, and that Seed brings the demo city back.
Run: python3 scripts/sim_switch_check.py dev   (dev only; reads SUPABASE_GOSERVE_DEV_* from ~/Desktop/Secrets/goserve/goserve.env (SUPABASE_ACCESS_TOKEN from 02_databases.env))
It resets the city, places one guest order on the first open real kitchen, reads it back as the kitchen list does, deletes that order and the guest, seeds, counts, and resets again so dev ends as it began (no synthetic rows)."""
import vault as gsvault
import json, re, sys, urllib.error, urllib.request, uuid

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = gsvault.read("02_databases.env")
get = lambda k: re.search(rf"^{k}=(\S+)", vault, re.M).group(1)
URL, ANON, SERVICE, MGMT = get("SUPABASE_GOSERVE_DEV_URL"), get("SUPABASE_GOSERVE_DEV_ANON_KEY"), get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY"), get("SUPABASE_ACCESS_TOKEN")
REF = "tmxyizmkpwwfyazvrfhw"


def call(method, path, body=None, key=ANON, bearer=None):
    req = urllib.request.Request(URL + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + (bearer or key), "Content-Type": "application/json", "User-Agent": "goserve-check"})
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
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query", data=json.dumps({"query": q}).encode(),
                                 headers={"Authorization": "Bearer " + MGMT, "Content-Type": "application/json", "User-Agent": "goserve-check"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def check(name, ok, note=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))
    return ok


ok, user, order_id = [], None, None
try:
    s, r = call("POST", "/rest/v1/rpc/sim_reset", {}, SERVICE)
    left = sql("select (select count(*) from kitchens where synthetic) k, (select count(*) from riders where synthetic) r, (select count(*) from menu_items where synthetic) d")[0]
    ok.append(check("Reset leaves no synthetic kitchen, rider or dish", s == 200 and left == {"k": 0, "r": 0, "d": 0}, f"{s} {left}"))
    kit = sql("select k.id, k.pin_codes[1] pin, (select m.id from menu_items m where m.kitchen_id = k.id and m.available order by m.name limit 1) dish, "
              "(select m.price_paise from menu_items m where m.kitchen_id = k.id and m.available order by m.name limit 1) price "
              "from kitchens k where not synthetic and active and open order by name limit 1")[0]
    s, a = call("POST", "/auth/v1/signup", {}); user, token = a["user"]["id"], a["access_token"]
    body = {"kitchen_id": kit["id"], "lines": [{"menu_item_id": kit["dish"], "qty": 1, "option_ids": []}], "address": {"pin_code": kit["pin"], "text": "Flat 4, switch check"},
            "idempotency_key": "switch-check-" + uuid.uuid4().hex[:8], "expected_to_pay_paise": kit["price"]}
    s, o = call("POST", "/functions/v1/orders", body, key=ANON, bearer=token)
    order_id = (o.get("order") or {}).get("id") if isinstance(o, dict) else None
    ok.append(check("a guest order on a real kitchen is placed after Reset (201)", s == 201 and bool(order_id), f"{s} {str(o)[:140]}"))
    s, rows = call("GET", f"/rest/v1/orders?kitchen_id=eq.{kit['id']}&id=eq.{order_id}&select=id,status,session_id", None, SERVICE)
    ok.append(check("the order is in the kitchen's list as placed", s == 200 and len(rows) == 1 and rows[0]["status"] == "placed" and rows[0]["session_id"] == user, f"{s} {rows}"))
finally:
    if order_id:
        sql(f"begin; select set_config('goserve.reset', 'on', true); delete from order_events where order_id = '{order_id}'; delete from order_trace where order_id = '{order_id}'; "
            f"delete from decision_log where order_id = '{order_id}'; delete from orders where id = '{order_id}'; commit;")
    if user:
        call("DELETE", f"/auth/v1/admin/users/{user}", None, SERVICE)
    s, r = call("POST", "/rest/v1/rpc/sim_seed", {"p": {}}, SERVICE)
    n = sql("select (select count(*) from kitchens where synthetic) k, (select count(*) from riders where synthetic) r, (select count(*) from menu_items where synthetic) d")[0]
    ok.append(check("Seed brings the demo city back", s == 200 and n["k"] > 0 and n["r"] > 0 and n["d"] > 0, f"{s} {n}"))
    call("POST", "/rest/v1/rpc/sim_reset", {}, SERVICE)
    end = sql("select count(*) c from kitchens where synthetic")[0]["c"]
    ok.append(check("dev ends as it began, no synthetic kitchen", end == 0, str(end)))
print("PASS" if ok and all(ok) else "FAIL")
sys.exit(0 if ok and all(ok) else 1)
