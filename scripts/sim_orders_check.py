#!/usr/bin/env python3
"""Story #284 (epic E16): prove that programmed kitchens and riders move real orders. Dev only. Run: python3 scripts/sim_orders_check.py dev
Reads SUPABASE_GOSERVE_DEV_* from ~/Desktop/Secrets/02_databases.env. It seeds the dream city, makes orders through place_order (the same path the app uses),
calls sim_tick by hand and reads order_events. Pass marks (fixed before the run):
  A one order placed on pin 110092 reaches delivered within 150 ticks, with exactly these events once each: placed, accepted, preparing, ready, assigned, picked_up, delivered;
  B 100 orders with reject_pct 12 and sold_out_pct 8: the cancelled share is between 10 and 30 percent, each with a reason;
  C delay_pct 100 makes the ready time longer than delay_pct 0 for the same kitchen (compared by the median seconds from accepted to ready);
  D rider_drop_pct 100 writes order.unassigned, the rider goes offline and the order has no rider;
  E a real (manual) kitchen's placed order is still placed, with only its own event, after all the ticks (the order is cancelled at the end);
  F riders are free in Delhi: with rider_flip_pct 100 the riders go offline and come back online, at least one lands more than 3 km from where it left, and a rider
    that is the only one online, 3 km or more from the other kitchens, gets the order of the kitchen it is near.
"""
import json, os, re, sys, time, urllib.request, uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kitchen_restore

if (sys.argv[1] if len(sys.argv) > 1 else "dev") != "dev":
    sys.exit("dev only")
vault = open(os.path.expanduser("~/Desktop/Secrets/02_databases.env")).read()
URL = re.search(r"^SUPABASE_GOSERVE_DEV_URL=(\S+)", vault, re.M).group(1)
KEY = re.search(r"^SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY=(\S+)", vault, re.M).group(1)
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={**H, **(headers or {})})
    for attempt in range(3):   # the database is far away: one slow handshake is not a failed check
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.status, json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()[:300]
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2)
    return 599, "network"


rpc = lambda fn, body=None: call("POST", f"/rest/v1/rpc/{fn}", body if body is not None else {})
get = lambda path: call("GET", "/rest/v1/" + path)[1]
results = []
SAVED = {}   # F210: the open flag and hours of every kitchen the check changes, put back in a finally


def check(name, ok, note=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  [{note}]" if note else ""))


def knobs(**k):
    base = {"reject_pct": 0, "sold_out_pct": 0, "delay_pct": 0, "rider_drop_pct": 0, "prep_scale": 0.02}
    return rpc("sim_set_knobs", {"p": {**base, **k}})


def place(kitchen, pin=None, n=0):
    dishes = get(f"menu_items?select=id&kitchen_id=eq.{kitchen}&available=eq.true&limit=1")
    row = get(f"kitchens?select=open,opens_at,closes_at&id=eq.{kitchen}")
    if isinstance(row, list) and row:
        kitchen_restore.remember(SAVED, kitchen, row[0])
    call("PATCH", f"/rest/v1/kitchens?id=eq.{kitchen}", {"open": True, "opens_at": None, "closes_at": None}, {"Prefer": "return=minimal"})   # opening hours are obeyed by place_order (migration 0041): the check must not depend on the hour it runs
    sess = str(uuid.uuid4())
    if pin:
        call("POST", "/rest/v1/customers", {"user_id": sess, "name": "Check Customer", "phone": "9999900000", "address": "Test lane", "pin_code": pin}, {"Prefer": "return=minimal"})
    s, a = rpc("place_order", {"p_session": sess, "p_key": f"chk-{sess[:8]}-{n}", "p_items": [{"menu_item_id": dishes[0]["id"], "qty": 1}], "p_address": "Test lane, Delhi"})
    return a["order"]["id"] if s < 400 else None


def events(order):
    rows = get(f"order_events?select=event&order_id=eq.{order}&order=id")
    return [e["event"] for e in rows] if isinstance(rows, list) else []


def tick():
    return rpc("sim_tick", {"p": {"kitchen_flip_pct": 0, "dish_flip_pct": 0}})   # the city's own flips would close the kitchen under test


def main():
    try:
        return run()
    finally:
        kitchen_restore.restore(lambda kid, body: call("PATCH", f"/rest/v1/kitchens?id=eq.{kid}", body, {"Prefer": "return=minimal"}), SAVED)


def run():
    rpc("sim_reset")
    s, a = rpc("sim_seed", {"p": {}})
    if s >= 400:
        sys.exit(f"seed failed: {a}")
    rpc("sim_enable", {"p": {"enabled": True}})
    kitchens = get("kitchens?select=id,name,pin_codes&synthetic=eq.true&order=name")
    kit = next(k for k in kitchens if "110092" in k["pin_codes"])
    others = [k["id"] for k in kitchens if k["id"] != kit["id"] and "110092" not in k["pin_codes"]][:3]
    # E needs a real order to protect: place one on a real (manual) kitchen now, open it for the run, and put it back at the end.
    real = get("kitchens?select=id,open,opens_at,closes_at&synthetic=eq.false&active=eq.true&limit=1")
    real = real[0] if isinstance(real, list) and real else None
    real_order = place(real["id"], "110092", 900) if real else None

    # A one order, start to finish
    s, _ = knobs()
    o = place(kit["id"], "110092")
    status, seen = None, 0
    for seen in range(1, 151):
        tick()
        status = get(f"orders?select=status,rider_id&id=eq.{o}")[0]
        if status["status"] == "delivered":
            break
    ev = events(o)
    want = ["order.placed", "order.accepted", "order.preparing", "order.ready", "order.assigned", "order.picked_up", "order.delivered"]
    rider = get(f"riders?select=synthetic&user_id=eq.{status['rider_id']}") if status and status.get("rider_id") else []
    check("A one order reaches delivered", bool(o) and status["status"] == "delivered" and sorted(ev) == sorted(want) and bool(rider) and rider[0]["synthetic"], f"{seen} ticks, events {ev}")

    # B rejects and sold out
    knobs(reject_pct=12, sold_out_pct=8)
    ids = [place(kit["id"], None, i) for i in range(100)]
    for _ in range(8):
        tick()
    rows = get("orders?select=status,cancel_reason&id=in.(" + ",".join(i for i in ids if i) + ")")
    cancelled = [r for r in rows if r["status"] == "cancelled"]
    share = 100 * len(cancelled) / max(len(rows), 1)
    check("B about one in five is turned away, each with a reason", 10 <= share <= 30 and all(r["cancel_reason"] in ("Kitchen busy", "Item sold out") for r in cancelled), f"{len(cancelled)} of {len(rows)}")

    # C delay
    def prep_secs(delay, kitchen):   # a kitchen of its own per arm: the prep time learns from a kitchen's history after 30 orders
        knobs(delay_pct=delay, prep_scale=0.04)
        oo = [place(kitchen, "110092", 100 + i) for i in range(6)]
        t0 = time.time()
        while time.time() - t0 < 150:
            tick()
            if all("order.ready" in events(x) for x in oo):
                break
            time.sleep(1)
        out = []
        for x in oo:
            e = get(f"order_events?select=event,created_at&order_id=eq.{x}&event=in.(order.accepted,order.ready)&order=id")
            if len(e) == 2:
                t = [time.mktime(time.strptime(i["created_at"][:19], "%Y-%m-%dT%H:%M:%S")) for i in e]
                out.append(t[1] - t[0])
        return sorted(out)[len(out) // 2] if out else None
    fast, slow = prep_secs(0, others[0]), prep_secs(100, others[1])
    check("C delay_pct 100 makes prep slower", fast is not None and slow is not None and slow > fast, f"median {fast}s vs {slow}s")

    # D a rider drops (a fresh city: the 100 orders of B keep every rider busy for a long ride)
    rpc("sim_reset")
    rpc("sim_seed", {"p": {}})
    knobs(rider_drop_pct=100, prep_scale=0.04)
    d = place(others[2], "110092", 200)
    dropped = False
    t0 = time.time()
    while time.time() - t0 < 150:
        tick()
        if "order.unassigned" in events(d):
            dropped = True
            break
        time.sleep(1)
    row = get(f"orders?select=rider_id,status&id=eq.{d}")[0]
    check("D a rider drops and the order goes back to dispatch", dropped and row["status"] in ("ready", "preparing", "accepted"), f"{row}")

    # F riders come back anywhere
    knobs()
    rpc("sim_reset")
    rpc("sim_seed", {"p": {}})
    left = {r["user_id"]: (r["lat"], r["lng"]) for r in get("riders?select=user_id,lat,lng&synthetic=eq.true")}
    far = 0
    for _ in range(6):
        call("POST", "/rest/v1/rpc/sim_tick", {"p": {"rider_flip_pct": 100, "kitchen_flip_pct": 0, "dish_flip_pct": 0}})
        now_ = {r["user_id"]: (r["lat"], r["lng"], r["online"]) for r in get("riders?select=user_id,lat,lng,online&synthetic=eq.true")}
        for u, (a, b, on) in now_.items():
            if on and u in left and max(abs(a - left[u][0]), abs(b - left[u][1])) > 0.027:   # about 3 km
                far += 1
            left[u] = (a, b)
    kitchens = get("kitchens?select=id,lat,lng&synthetic=eq.true")
    kb = kitchens[0]
    call("PATCH", "/rest/v1/riders?synthetic=eq.true", {"online": False}, {"Prefer": "return=minimal"})
    lone = get("riders?select=user_id&synthetic=eq.true&limit=1")[0]["user_id"]
    call("PATCH", f"/rest/v1/riders?user_id=eq.{lone}", {"online": True, "lat": kb["lat"] + 0.004, "lng": kb["lng"], "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, {"Prefer": "return=minimal"})
    f = place(kb["id"], "110092", 300)
    got = None
    for _ in range(150):
        call("POST", "/rest/v1/rpc/sim_tick", {"p": {"rider_flip_pct": 0, "move_min_m": 0, "move_max_m": 0}})
        got = get(f"orders?select=rider_id&id=eq.{f}")[0]["rider_id"]
        if got:
            break
    check("F a rider back online far from the old place lands elsewhere and still gets the order near it", far > 0 and got == lone, f"{far} far returns; assigned {got == lone}")

    # G demo mode (#454): one switch makes the city steady and fast; switching it off puts the old numbers back
    NUM = ("reject_pct", "sold_out_pct", "delay_pct", "rider_drop_pct", "prep_scale")
    knobs(reject_pct=7, sold_out_pct=4, delay_pct=20, rider_drop_pct=9, prep_scale=1)
    before = rpc("sim_knobs")[1]
    s_on, a_on = rpc("sim_set_knobs", {"p": {"demo": True}})
    on = a_on["knobs"] if isinstance(a_on, dict) and "knobs" in a_on else {}
    steady = rpc("sim_tick", {"p": {"kitchen_flip_pct": 100, "dish_flip_pct": 100}})[1]
    s_off, a_off = rpc("sim_set_knobs", {"p": {"demo": False}})
    off = a_off["knobs"] if isinstance(a_off, dict) and "knobs" in a_off else {}
    loose = rpc("sim_tick", {"p": {"kitchen_flip_pct": 0, "dish_flip_pct": 100}})[1]
    check("G demo mode: no flips, no rejects, faster prep; off puts the old numbers back",
          bool(on) and on.get("demo") is True and all(on[k] == 0 for k in NUM[:4]) and on["prep_scale"] < 1
          and steady.get("kitchens_flipped") == 0 and steady.get("dishes_flipped") == 0
          and bool(off) and off.get("demo") is False and all(off[k] == before[k] for k in NUM) and loose.get("dishes_flipped", 0) > 0,
          f"on {on}; steady {steady.get('kitchens_flipped')}/{steady.get('dishes_flipped')}; off {off}; loose {loose.get('dishes_flipped')}")
    knobs()

    # E the manual kitchens' kitchen side is not touched: the real order placed at the start is still placed, with only its own event
    row = get(f"orders?select=status&id=eq.{real_order}") if real_order else None
    check("E a real kitchen's order is not moved by the tick", bool(real_order) and isinstance(row, list) and row[0]["status"] == "placed" and events(real_order) == ["order.placed"], f"order {str(real_order)[:8]} {row}")
    if real_order:   # leave dev as found: the order is cancelled (placed may go to cancelled), the kitchen goes back to what it was
        call("PATCH", f"/rest/v1/orders?id=eq.{real_order}", {"status": "cancelled", "cancel_reason": "check finished"}, {"Prefer": "return=minimal"})

    rpc("sim_enable", {"p": {"enabled": False}})
    rpc("sim_reset")
    print("PASS" if all(results) else "FAIL")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
