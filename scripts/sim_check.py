#!/usr/bin/env python3
"""Story H5 (#188): prove the synthetic city on a database. Read-only except the two calls under test (sim_seed, sim_reset).
Run: python3 scripts/sim_check.py dev        (prod only after the owner's "yes sim prod")
It reads SUPABASE_GOSERVE_<ENV>_URL and SUPABASE_GOSERVE_<ENV>_SERVICE_ROLE_KEY from ~/Desktop/Secrets/02_databases.env and prints:
the real row counts before, the seed answer twice (same ids both times), the counts after reset, and the seconds each call took.
Pass mark (fixed before the run): seed twice gives the same kitchen ids; reset leaves the real counts exactly as before.
"""
import json, os, re, sys, time, urllib.request

env = (sys.argv[1] if len(sys.argv) > 1 else "dev").upper()
if env != "DEV" and "--yes-prod" not in sys.argv:
    sys.exit("prod needs the owner's yes: add --yes-prod")
vault = open(os.path.expanduser("~/Desktop/Secrets/02_databases.env")).read()
URL = re.search(rf"^SUPABASE_GOSERVE_{env}_URL=(\S+)", vault, re.M).group(1)
KEY = re.search(rf"^SUPABASE_GOSERVE_{env}_SERVICE_ROLE_KEY=(\S+)", vault, re.M).group(1)
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={**H, **(headers or {})})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null"), round(time.time() - t, 2)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200], round(time.time() - t, 2)


def count(table, where=""):
    s, b, _ = call("GET", f"/rest/v1/{table}?select=id{where}", headers={"Prefer": "count=exact", "Range": "0-0"})
    return b if s >= 400 else None


def counts():
    s, k, _ = call("GET", "/rest/v1/kitchens?select=id,synthetic")
    s2, r, _ = call("GET", "/rest/v1/riders?select=user_id,synthetic")
    s3, d, _ = call("GET", "/rest/v1/menu_items?select=id,synthetic")
    real = lambda rows: sum(1 for x in rows if not x.get("synthetic")) if isinstance(rows, list) else "?"
    syn = lambda rows: sum(1 for x in rows if x.get("synthetic")) if isinstance(rows, list) else "?"
    return {"kitchens": (real(k), syn(k)), "riders": (real(r), syn(r)), "dishes": (real(d), syn(d))}


def dream_ok():
    """The fixed Delhi list (#282, #290): 11 kitchens on 2 to 4 real pins each, 10 to 14 dishes each, pin 110092 served, and a drop point for every pin served."""
    _, k, _ = call("GET", "/rest/v1/kitchens?select=id,name,pin_codes&synthetic=eq.true")
    _, d, _ = call("GET", "/rest/v1/menu_items?select=kitchen_id&synthetic=eq.true")
    s, pp, _ = call("GET", "/rest/v1/pin_points?select=pin,lat,lng")
    if not (isinstance(k, list) and isinstance(d, list) and s < 400 and isinstance(pp, list)):
        return False
    pins = {x["pin"] for x in pp}
    per = {x["id"]: sum(1 for y in d if y["kitchen_id"] == x["id"]) for x in k}
    return (all(2 <= len(x["pin_codes"]) <= 4 and all(c in pins and not c.startswith("9") for c in x["pin_codes"]) for x in k)
            and all(10 <= n <= 14 for n in per.values()) and any("110092" in x["pin_codes"] for x in k) and "110092" in pins
            and any(x["name"] == "Laxmi Nagar Wok House" and sorted(x["pin_codes"]) == ["110051", "110091", "110092"] for x in k) and {"110091", "110051"} <= pins)   # #290


def serve_all_ok():
    """#283: with sim_riders_serve_all on (default) the candidates for an order of a REAL kitchen include synthetic riders; off, none. Uses any real order."""
    _, o, _ = call("GET", "/rest/v1/orders?select=id,kitchen_id,kitchens!inner(synthetic)&kitchens.synthetic=eq.false&limit=1")
    if not (isinstance(o, list) and o):
        return None   # no real order on this database: nothing to test against
    _, syn, _ = call("GET", "/rest/v1/riders?select=user_id&synthetic=eq.true")
    ids = {r["user_id"] for r in syn} if isinstance(syn, list) else set()
    def candidates():
        s, c, _ = call("POST", "/rest/v1/rpc/dispatch_candidates", {"p_order": o[0]["id"]})
        return {r["id"] for r in c["riders"]} if s < 400 and isinstance(c, dict) else None
    set_flag = lambda on: call("POST", "/rest/v1/params", {"session_id": "global", "key": "sim_riders_serve_all", "value": {"on": on}, "version": 900 + int(on) + 2 * int(time.time() % 100000)}, {"Prefer": "return=minimal"})
    set_flag(True)
    on = candidates()
    set_flag(False)
    off = candidates()
    set_flag(True)
    return on is not None and off is not None and bool(on & ids) and not (off & ids)


def main():
    before = counts()
    print("before (real, synthetic):", before)
    s, a, t1 = call("POST", "/rest/v1/rpc/sim_seed", {"p": {}})
    print(f"seed #1: {s} {a} in {t1}s")
    if s >= 400:
        sys.exit("seed failed: the functions are missing or refused")
    _, ids1, _ = call("GET", "/rest/v1/kitchens?select=id&synthetic=eq.true&order=id")
    s, b, t2 = call("POST", "/rest/v1/rpc/sim_seed", {"p": {}})
    _, ids2, _ = call("GET", "/rest/v1/kitchens?select=id&synthetic=eq.true&order=id")
    print(f"seed #2: {s} {b} in {t2}s; same ids: {ids1 == ids2}")
    serve = serve_all_ok()
    print("synthetic riders offered for a real kitchen's order (on) and not (off):", serve)
    dream = dream_ok()   # E16 (#282): the fixed Delhi list
    mid = counts()
    print("after seed (real, synthetic):", mid)
    # H6 (#189): the tick. Off by default: skipped. On: every online synthetic rider moves 100 to 300 m; real rows stay as they were.
    _, real_before, _ = call("GET", "/rest/v1/kitchens?select=id,open&synthetic=eq.false&order=id")
    _, pos0, _ = call("GET", "/rest/v1/riders?select=user_id,lat,lng&synthetic=eq.true&online=eq.true&order=user_id")
    s, t0, _ = call("POST", "/rest/v1/rpc/sim_tick", {"p": {}})
    print(f"tick while off: {s} {t0}")
    call("POST", "/rest/v1/rpc/sim_enable", {"p": {"enabled": True}})
    s, t1, t4 = call("POST", "/rest/v1/rpc/sim_tick", {"p": {}})
    _, pos1, _ = call("GET", "/rest/v1/riders?select=user_id,lat,lng&synthetic=eq.true&order=user_id")   # the tick can flip a rider offline, so compare by id
    pos1 = [y for x in pos0 for y in pos1 if y["user_id"] == x["user_id"]] if isinstance(pos0, list) and isinstance(pos1, list) else pos1
    call("POST", "/rest/v1/rpc/sim_enable", {"p": {"enabled": False}})
    _, real_after, _ = call("GET", "/rest/v1/kitchens?select=id,open&synthetic=eq.false&order=id")
    moved = sum(1 for x, y in zip(pos0, pos1) if (x["lat"], x["lng"]) != (y["lat"], y["lng"])) if isinstance(pos0, list) and isinstance(pos1, list) else -1
    tick_ok = isinstance(t0, dict) and t0.get("skipped") == "sim_disabled" and isinstance(t1, dict) and t1.get("riders_moved") == len(pos0) == moved and moved > 0 and real_before == real_after
    print(f"tick while on: {s} {t1} in {t4}s; riders moved {moved} of {len(pos0) if isinstance(pos0, list) else '?'}; real kitchens unchanged: {real_before == real_after}")
    s, c, t3 = call("POST", "/rest/v1/rpc/sim_reset", {})
    print(f"reset: {s} {c} in {t3}s")
    after = counts()
    print("after reset (real, synthetic):", after)
    s, st, _ = call("POST", "/rest/v1/rpc/sim_status", {})   # H7: what the admin tab reads
    print(f"status: {s} {st}")
    status_ok = isinstance(st, dict) and st.get("enabled") is False and st.get("kitchens") == 0 and st.get("riders") == 0 and st.get("dishes") == 0
    ok = ids1 == ids2 and a.get("kitchens") == 11 and a.get("riders") == 44 and 112 <= a.get("dishes", 0) <= 154 and dream and serve is not False \
        and all(after[k][0] == before[k][0] for k in before) and all(after[k][1] == 0 for k in after) and tick_ok and status_ok
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
