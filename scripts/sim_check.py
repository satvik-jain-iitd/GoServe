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


def main():
    before = counts()
    print("before (real, synthetic):", before)
    s, a, t1 = call("POST", "/rest/v1/rpc/sim_seed", {"p": {"kitchens": 10, "riders": 20, "dishes_per_kitchen": 6, "seed": 42}})
    print(f"seed #1: {s} {a} in {t1}s")
    if s >= 400:
        sys.exit("seed failed: the functions are missing or refused")
    _, ids1, _ = call("GET", "/rest/v1/kitchens?select=id&synthetic=eq.true&order=id")
    s, b, t2 = call("POST", "/rest/v1/rpc/sim_seed", {"p": {"kitchens": 10, "riders": 20, "dishes_per_kitchen": 6, "seed": 42}})
    _, ids2, _ = call("GET", "/rest/v1/kitchens?select=id&synthetic=eq.true&order=id")
    print(f"seed #2: {s} {b} in {t2}s; same ids: {ids1 == ids2}")
    mid = counts()
    print("after seed (real, synthetic):", mid)
    # H6 (#189): the tick. Off by default: skipped. On: every online synthetic rider moves 100 to 300 m; real rows stay as they were.
    _, real_before, _ = call("GET", "/rest/v1/kitchens?select=id,open&synthetic=eq.false&order=id")
    _, pos0, _ = call("GET", "/rest/v1/riders?select=user_id,lat,lng&synthetic=eq.true&online=eq.true&order=user_id")
    s, t0, _ = call("POST", "/rest/v1/rpc/sim_tick", {"p": {}})
    print(f"tick while off: {s} {t0}")
    call("POST", "/rest/v1/rpc/sim_enable", {"p": {"enabled": True}})
    s, t1, t4 = call("POST", "/rest/v1/rpc/sim_tick", {"p": {}})
    _, pos1, _ = call("GET", "/rest/v1/riders?select=user_id,lat,lng&synthetic=eq.true&online=eq.true&order=user_id")
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
    ok = ids1 == ids2 and a.get("kitchens") == 10 and a.get("riders") == 20 and a.get("dishes") == 60 \
        and all(after[k][0] == before[k][0] for k in before) and all(after[k][1] == 0 for k in after) and tick_ok and status_ok
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
