#!/usr/bin/env python3
"""Story #263 layer 2, test E9: replay one seeded lunch peak twice, once with today's per-order rule and once with the Stage 1 ready-time batch rule.

The new rule is the real database function `dispatch_match` (migration 0032), called over HTTP with the same JSON that `dispatch_tick` builds.
The old rule is written here exactly as SUB 13 / dispatch_candidates do it: when the kitchen taps Ready, take the free rider with the fewest trips today, then the nearest.
A third arm, `nearest`, is a control: the same moment (Ready) but the nearest free rider, so a gain of the new rule can be split into 'looks at distance' and 'names the rider before Ready'.

The world is made from the seed alone, so both rules see the same kitchens, riders, orders, cooking times and road luck:
  10 kitchens and 20 riders in a 6.5 km box, about 108 orders in 2 hours with a peak in the middle, kitchens accept after 30 to 120 s and cook a lognormal time
  around their own median (8 to 18 min). The rule is told the kitchen's median (as the database would learn it) and the real ready time once the cook taps Ready.
  Riders really move at 13 to 17 km/h on a road 1.25 to 1.6 times the straight line; the rule assumes 15 km/h and 1.4. A handover and a drop take 60 s each.

Usage: python3 scripts/dispatch_sim.py dev [--seeds 1,2,3] [--hours 2] [--loads 0.4,0.6,1] [--arms old,nearest,new] [--out file.json]   (reads the dev service key from the vault; refuses prod)
Measures (seconds): per pickup visit the MISMATCH between the rider arriving and the food being ready (rider waiting for food, or food waiting for the rider),
and its two halves; order-to-door; share late by more than 10 minutes over the 35 minute promise; spread of trips per rider.
Decision rule written in experiments.md E9 (sharpened here, see the note in the result): median mismatch down 30 % or more AND P90 order-to-door up no more than
60 s, on every seed.
"""
import json, math, os, random, re, statistics, sys, time, urllib.error, urllib.request

STEP = 10          # world clock, seconds
TICK = 30          # the new rule runs every 30 s
HANDOVER = 60      # seconds at the counter and at the door
PROMISE = 35 * 60  # the manifest says 25 to 35 minutes


def dist_m(a, b):
    """Great-circle metres, the same formula as the SQL function distance_m."""
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dl = math.radians(b["lng"] - a["lng"])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def percentile(xs, q):
    xs = sorted(xs)
    if not xs:
        return 0
    i = (len(xs) - 1) * q
    lo, hi = math.floor(i), math.ceil(i)
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo)


def metrics(waits, door, trips, orders, delivered, promise_s):
    return {"orders": orders, "delivered": delivered,
            "wait_p50": percentile(waits, 0.5), "wait_p90": percentile(waits, 0.9),
            "door_p50": percentile(door, 0.5), "door_p90": percentile(door, 0.9),
            "late_share": (sum(1 for d in door if d > promise_s + 600) / len(door)) if door else 0,
            "trip_spread": (max(trips) - min(trips)) if trips else 0}


def ship_rule(pairs):
    """pairs: [(old_metrics, new_metrics)] one per seed. Ship only if it holds on every seed."""
    return all(n["wait_p50"] <= 0.7 * o["wait_p50"] and n["door_p90"] <= o["door_p90"] + 60 for o, n in pairs)


def old_rule_pick(riders, k):
    """Today's rule (SUB 13): the free rider with the fewest trips today, then the nearest to the kitchen. riders = the free ones."""
    free = list(riders)
    return min(free, key=lambda r: (r["trips"], dist_m(r, k))) if free else None


BAND = 500   # metres; --band changes it for a sweep


def band_pick(riders, k, band=500):
    """Story #272: the nearest free rider; trips today break a tie only among riders within `band` metres of the nearest. riders = the free ones."""
    free = list(riders)
    if not free:
        return None
    d0 = min(dist_m(r, k) for r in free)
    return min((r for r in free if dist_m(r, k) <= d0 + band), key=lambda r: (r["trips"], dist_m(r, k)))


def make_world(seed, hours, load=1.0):
    rng = random.Random(seed)
    kitchens = [{"id": f"k{i}", "lat": 28.52 + rng.random() * 0.06, "lng": 77.17 + rng.random() * 0.06, "med": rng.uniform(8, 18) * 60} for i in range(10)]
    riders = [{"id": f"r{i}", "lat": kitchens[i % 10]["lat"], "lng": kitchens[i % 10]["lng"], "trips": 0} for i in range(20)]
    total = hours * 3600
    orders, t, n = [], 0.0, 0
    while True:   # thinning: rate per minute 0.4 at the edges, 1.4 in the middle
        t += rng.expovariate(1.4 * load / 60)
        if t > total:
            break
        rate = 0.4 + 1.0 * (1 - abs(t - total / 2) / (total / 2))
        if rng.random() > rate / 1.4:
            continue
        k = kitchens[rng.randrange(10)]
        ang, d = rng.random() * 2 * math.pi, rng.uniform(500, 3000)
        accept = t + rng.uniform(30, 120)
        orders.append({"id": f"o{n}", "t": t, "k": k, "accept": accept, "ready": accept + k["med"] * rng.lognormvariate(0, 0.25),
                       "lat": k["lat"] + d * math.cos(ang) / 111320.0, "lng": k["lng"] + d * math.sin(ang) / (111320.0 * math.cos(math.radians(k["lat"])))})
        n += 1
    return kitchens, riders, orders


def travel(seed, rid, oid, a, b):
    """Real seconds for a leg: road factor and speed are luck, fixed by (seed, rider, order) so both rules meet the same luck."""
    g = random.Random(f"{seed}-{rid}-{oid}")
    return dist_m(a, b) * g.uniform(1.25, 1.6) / (g.uniform(13, 17) / 3.6)


def run_sim(seed, mode, matcher, hours=2.0, load=1.0):
    kitchens, riders, orders = make_world(seed, hours, load)
    R = {r["id"]: dict(r, state="idle", orders=[], arrival=0.0, free_at=0.0, busy=0.0, since=0.0) for r in riders}
    waits, rider_wait, food_wait, zone_ticks = [], [], [], 0
    t, placed_done = 0.0, 0
    while True:
        # riders back from a delivery
        for r in R.values():
            if r["state"] == "out" and t >= r["free_at"]:
                r["state"] = "idle"
        # a rider at the counter picks up when he has arrived and every food is ready
        for r in R.values():
            if r["state"] == "to_kitchen":
                last_ready = max(o["ready"] for o in r["orders"])
                if t >= max(r["arrival"], last_ready):
                    mism = r["arrival"] - last_ready
                    waits.append(abs(mism)); rider_wait.append(max(0, -mism)); food_wait.append(max(0, mism))
                    clock, pos, left = max(r["arrival"], last_ready) + HANDOVER, {"lat": r["orders"][0]["k"]["lat"], "lng": r["orders"][0]["k"]["lng"]}, list(r["orders"])
                    while left:
                        o = min(left, key=lambda x: dist_m(pos, x)); left.remove(o)
                        clock += travel(seed, r["id"], o["id"], pos, o) + HANDOVER
                        o["delivered"] = clock; pos = {"lat": o["lat"], "lng": o["lng"]}
                    r["trips"] += len(r["orders"]); r["lat"], r["lng"] = pos["lat"], pos["lng"]
                    r["state"], r["free_at"], r["orders"] = "out", clock, []
                    r["busy"] += clock - r["since"]   # busy = from the first assignment to the last drop
        accepted = [o for o in orders if o["accept"] <= t and "rider" not in o]
        if mode in ("old", "nearest", "band"):
            for o in sorted([o for o in accepted if o["ready"] + 5 <= t], key=lambda x: x["ready"]):   # at Ready, five seconds for n8n
                idle = [x for x in R.values() if x["state"] == "idle"]
                r = old_rule_pick(idle, o["k"]) if mode == "old" else band_pick(idle, o["k"], BAND) if mode == "band" else (min(idle, key=lambda x: dist_m(x, o["k"])) if idle else None)   # nearest: a control, distance only; band: story #272
                if r is not None:
                    _assign(seed, R[r["id"]], o, t)
        elif t % TICK == 0 and (accepted or any(r["state"] == "to_kitchen" for r in R.values())):
            state = _state(t, kitchens, R, accepted)
            ans = matcher(state)
            zone_ticks += any(z["state"] != "open" for z in ans.get("zones", []))
            byid = {o["id"]: o for o in accepted}
            for a in ans.get("assignments", []):
                o, r = byid.get(a["order_id"]), R.get(a["rider_id"])
                if o is None or r is None or "rider" in o:
                    continue
                if r["state"] == "idle" or (r["state"] == "to_kitchen" and len(r["orders"]) == 1 and r["orders"][0]["k"] is o["k"]):
                    _assign(seed, r, o, t)
        t += STEP
        if t > hours * 3600 and all("delivered" in o for o in orders):
            break
        if t > hours * 3600 + 6 * 3600:
            break
    done = [o for o in orders if "delivered" in o]
    door = [o["delivered"] - o["t"] for o in done]
    m = metrics(waits, door, [r["trips"] for r in R.values()], len(orders), len(done), PROMISE)
    horizon = max(max((o["delivered"] for o in done), default=0), hours * 3600)
    m.update(utilisation=sum(r["busy"] for r in R.values()) / (len(R) * horizon), rider_wait_p50=percentile(rider_wait, 0.5), food_wait_p50=percentile(food_wait, 0.5), food_wait_p90=percentile(food_wait, 0.9), zone_ticks=zone_ticks)
    return {"m": m, "waits": waits, "door": door, "rider_wait": rider_wait, "food_wait": food_wait}


def _assign(seed, r, o, t):
    o["rider"] = r["id"]
    if r["state"] == "idle":
        r["since"] = t
        r["state"], r["orders"] = "to_kitchen", [o]
        r["arrival"] = t + travel(seed, r["id"], o["id"], r, o["k"])
    else:
        r["orders"].append(o)


def _state(t, kitchens, R, accepted):
    """The same JSON dispatch_tick builds from the tables."""
    riders = []
    for r in R.values():
        if r["state"] == "out":
            continue
        load = [{"order_id": o["id"], "kitchen_id": o["k"]["id"], "ready_at": _ready_at(t, o)} for o in r["orders"]]
        riders.append({"id": r["id"], "lat": r["lat"], "lng": r["lng"], "ping_age_s": 10, "trips": r["trips"], "load": load})
    orders = [{"id": o["id"], "kitchen_id": o["k"]["id"], "ready_at": _ready_at(t, o), "k": o["k"]} for o in accepted]
    return {"now": t, "params": {}, "riders": riders, "orders": orders, "kitchens": [{"id": k["id"], "lat": k["lat"], "lng": k["lng"]} for k in kitchens]}


def _ready_at(t, o):
    """What the database knows: the real stamp once the cook taps Ready, else accepted time + the kitchen's median (never in the past)."""
    return o["ready"] if t >= o["ready"] else max(o["accept"] + o["k"]["med"], t + 60)


def db_matcher(url, key):
    def call(state):
        clean = dict(state, orders=[{k: v for k, v in o.items() if k != "k"} for o in state["orders"]])
        req = urllib.request.Request(url + "/rest/v1/rpc/dispatch_match", data=json.dumps({"p": clean}).encode(), method="POST",
                                     headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        for attempt in range(4):   # a slow call or a network blip must not end a 10 minute run
            try:
                with urllib.request.urlopen(req, timeout=60) as res:
                    return json.load(res)
            except (TimeoutError, urllib.error.URLError):
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
    return call


def main(argv):
    if not argv or argv[0] != "dev":
        sys.exit("Usage: dispatch_sim.py dev [--seeds 1,2,3] [--hours 2] [--loads 0.4,0.6,1]  (prod is never allowed)")
    seeds = [int(x) for x in (argv[argv.index("--seeds") + 1] if "--seeds" in argv else "1,2,3").split(",")]
    hours = float(argv[argv.index("--hours") + 1]) if "--hours" in argv else 2.0
    loads = [float(x) for x in (argv[argv.index("--loads") + 1] if "--loads" in argv else "1").split(",")]
    vault = open(os.path.expanduser("~/Desktop/Secrets/02_databases.env")).read()
    url = re.search(r"^SUPABASE_GOSERVE_DEV_URL=(\S+)", vault, re.M).group(1)
    key = re.search(r"^SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY=(\S+)", vault, re.M).group(1)
    global BAND
    BAND = float(argv[argv.index("--band") + 1]) if "--band" in argv else BAND
    arms = argv[argv.index("--arms") + 1].split(",") if "--arms" in argv else ["old", "nearest", "new"]
    matcher, allpairs = db_matcher(url, key) if "new" in arms else None, {}
    print("load  seed  rule  orders  busy  mismatch p50/p90 s  rider wait p50  food wait p50/p90  door p50/p90 s  late>10 min  trip spread  seconds")
    for load in loads:
        pairs = []
        for s in seeds:
            res = {}
            for mode in arms:
                t0 = time.time()
                r = run_sim(s, mode, matcher if mode == "new" else None, hours, load)
                res[mode] = m = r["m"]
                print(f"{load:<5} {s:<5} {mode:<5} {m['delivered']}/{m['orders']:<4} {m['utilisation']:>4.0%}  {m['wait_p50']:>7.0f}/{m['wait_p90']:<7.0f}   {m['rider_wait_p50']:>8.0f}      {m['food_wait_p50']:>6.0f}/{m['food_wait_p90']:<6.0f}  "
                      f"{m['door_p50']:>6.0f}/{m['door_p90']:<6.0f}  {m['late_share']:>9.1%}  {m['trip_spread']:>8}  {time.time() - t0:>6.0f}", flush=True)
            pairs.append((res["old"], res["new"])) if "new" in res else pairs.append((res["old"], res["band"]))
            if "new" in res and "nearest" in res: print(f"      new vs nearest-at-ready: mismatch p50 {res['new']['wait_p50']:.0f} vs {res['nearest']['wait_p50']:.0f} s, door p90 {res['new']['door_p90']:.0f} vs {res['nearest']['door_p90']:.0f} s", flush=True)
        allpairs[load] = pairs
        if "new" in arms:
            print(f"load {load}: ship rule (median mismatch down 30 % and P90 door up at most 60 s, every seed):", "PASS" if ship_rule(pairs) else "FAIL", flush=True)
        else:
            print(f"load {load}: band rule vs today: median mismatch lower on {sum(n['wait_p50'] < o['wait_p50'] for o, n in pairs)}/{len(pairs)} seeds, door P90 up more than 60 s on {sum(n['door_p90'] > o['door_p90'] + 60 for o, n in pairs)}/{len(pairs)} seeds", flush=True)
    if "--out" in argv:   # keep the numbers outside the repo unless asked
        json.dump({str(k): [{"old": o, "new": n} for o, n in v] for k, v in allpairs.items()}, open(argv[argv.index("--out") + 1], "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
