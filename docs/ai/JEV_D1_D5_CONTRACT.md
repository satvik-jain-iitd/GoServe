# Go Serve — Jev D1 to D5: Interface Contract and Test Plan

This document defines exactly what we send to Jev, what we expect back, and how we prove each decision works before we trust it. It covers the five decisions used in MVP 1: D1 to D5.

The rule for this whole document is simple. Jev suggests. Our code decides. If Jev is slow, unsure, or wrong, a plain fallback rule takes over. Nothing Jev does can break an order or touch money.

---

## 1. The shared wrapper

There is one module that talks to Jev. Nothing else in the system calls the model directly. Everything else calls this wrapper.

The wrapper has four jobs:

1. Build the request from a plain state object.
2. Call Jev through OpenRouter.
3. Validate the reply against an allowed list.
4. Fall back to a fixed rule when anything is off.

### 1.1 Where it calls

OpenRouter's **decisions endpoint**: `POST https://openrouter.ai/api/alpha/decisions` (Tier A: OpenRouter's Jev tutorial; confirmed by a real call on 15 Oct 2026). Jev is a decisions model: the chat completions endpoint refuses it with a 400 ("is a decisions model and cannot be used with the chat/completions endpoint"). An earlier version of this contract said chat completions; the first live run found the mistake. We never call TypeSafe directly. The GoServe key lives in `~/Desktop/Secrets/` as `GOSERVE_OPENROUTER_KEY` and in the n8n credential `GoServe OpenRouter`.

Model choice:

- Default (general traffic): `typesafe/jev-router`. It picks the right Jev behind the scenes.
- Pinned (tests and reproducible runs): `typesafe/jev-1.13`. Output is free, input is $0.042 per million tokens, released 18 Sep 2026. A real D1 call cost about $0.00002.
- Testing only: `typesafe/jev-latest`.

### 1.2 Call settings

| Setting | Value | Why |
|---|---|---|
| Timeout | 900 ms | If it is slower than this, fallback runs. (A real call from a laptop took 560 to 900 ms; check the time on the n8n box.) |
| Question type | `choice` (D1) | One option from a list, with a probability for each. |
| Retries | 1 | One retry, then straight to fallback. |

There is no temperature or token setting: the endpoint takes a state and typed questions and returns typed answers.

### 1.3 The body we send

```json
{
  "model": "typesafe/jev-1.13",
  "state": { "order_id": "o1", "riders": [{ "id": "r1", "free": true, "distance_m": 1200, "trips_done": 2 }, { "id": "r2", "free": true, "distance_m": 2100, "trips_done": 0 }] },
  "questions": {
    "rider": {
      "type": "choice",
      "instructions": "Which rider should get this order? Prefer a free rider with fewer trips and a short distance.",
      "criteria": { "r1": "Rider r1.", "r2": "Rider r2.", "none": "No rider is free." }
    }
  }
}
```

No names, phones or addresses go in the state.

### 1.4 The reply we accept

```json
{ "answers": { "rider": { "type": "choice", "choice": "r2", "confidence": 1, "probabilities": { "r1": 0, "r2": 1, "none": 0 } } },
  "usage": { "input_tokens": 477, "output_tokens": 50, "cost": 0.00002 } }
```

We read three things:

| Field | Type | Meaning |
|---|---|---|
| answers.rider.choice | string | Must be one of the allowed options. |
| answers.rider.confidence | number | 0 to 1. Our trust in this answer. |
| usage.cost | number | US dollars for this call. Over the cost cap, we ignore the answer. |

There is no `reason` text: the endpoint returns probabilities, not words.

### 1.5 When we ignore Jev and use fallback

Fallback runs if any of these is true:

1. The reply is not in the shape above (no `answers.rider` of type `choice`).
2. `choice` is not in the allowed list.
3. `confidence` is missing, or not a number, or below the threshold for that decision.
4. The call times out or errors.
5. The state given to us is empty or clearly malformed.

Fallback always exists. Fallback is never silent. Every fallback is logged with the reason.

### 1.6 What we log on every call

One row per call:

- decision id (D1 to D5)
- a hash of the state, not the raw state
- the allowed choices
- raw model reply
- parsed choice and confidence
- model used
- latency in ms
- whether fallback ran, and why
- timestamp

A hash keeps logs small and avoids storing customer details twice.

### 1.7 The one hard rule

Jev is never in the payment path. D1 to D5 are dispatch and planning only. Money is handled by normal, boring, well-tested code.

---

## 2. D1 — Assign rider

**What:** when an order is ready, pick which rider delivers it.
**When:** the order status changes to ready.
**Where it runs:** dispatch service.

### Input state

- orders waiting: list of `{id, prep_eta_sec, items}`
- riders: list of `{id, free, distance_m, trips_done, kitchen}`
- kitchen: which kitchen the order came from

### Allowed choices

The rider ids, plus `none` (meaning hold and wait).

### Fallback rule

Pick the free rider with the fewest trips done today. Break ties by shortest distance. If no rider is free, return `none`.

### Threshold

Accept Jev only if confidence is at or above `0.70`.

### Guard after Jev answers

Even if Jev is confident, we check the chosen rider is actually free and actually close enough. If not, fallback wins. Jev cannot assign a busy rider.

### Failure mode

If the rider is far away or busy, we would be promising a late order. The guard above stops this.

---

## 3. D2 — Delivery ETA

**What:** give the customer an estimated arrival time.
**When:** a rider is assigned, and again as the rider moves.
**Where it runs:** live tracking service.

### Input state

- kitchen location (lat, lng)
- rider location (lat, lng)
- distance_m
- peak flag (true or false)
- historical average delivery time for this kitchen

### Allowed choices

`fast` (12 min), `normal` (15 min), `slow` (20 min).

### Fallback rule

ETA = distance_km x 1.5 minutes off peak, and x 2.5 minutes at peak. Minimum 5 minutes.

### Threshold

Accept Jev only if confidence is at or above `0.65`.

### Guard after Jev answers

The ETA must never be lower than the fallback by more than 3 minutes. A too-fast promise is worse than a slow one, because it breaks trust.

### Failure mode

A wildly optimistic ETA misleads the customer. The guard keeps the promise believable.

---

## 4. D3 — Next order to cook

**What:** tell the kitchen which waiting order to start next.
**When:** a station becomes free, or a new order is accepted.
**Where it runs:** kitchen display system.

### Input state

- orders waiting: list of `{id, prep_eta_sec, items, age_sec}`
- station load: how many orders are being cooked right now
- SLA minutes per order

### Allowed choices

The order ids from the waiting list.

### Fallback rule

Oldest order first. First in, first out.

### Threshold

Accept Jev only if confidence is at or above `0.70`.

### Guard after Jev answers

The chosen order must still be waiting. If Jev names an order that is already cooking or done, fallback wins.

### Failure mode

If Jev picks an order that needs an ingredient we do not have, the kitchen stalls. Fallback is the safe default.

---

## 5. D4 — Late-order risk

**What:** say if an order is at risk of being late.
**When:** every time the order state changes.
**Where it runs:** ops alert worker.

### Input state

- order age_sec
- order state: preparing, packed, or rider assigned
- SLA minutes
- rider ETA in seconds, if a rider is assigned

### Allowed choices

`at_risk`, `on_track`.

### Fallback rule

If age_sec is more than 60% of the SLA, `at_risk`. Otherwise `on_track`.

### Threshold

Accept Jev only if confidence is at or above `0.60`.

### Failure mode

Too aggressive, and ops wastes energy on fine orders. Too lax, and real late orders slip through. The fallback sits in the safe middle.

---

## 6. D5 — Zone and service check

**What:** say if a customer address is inside our delivery zone.
**When:** at checkout, before the order is placed.
**Where it runs:** checkout service.

### Input state

- customer address (lat, lng)
- the kitchen zone, as a polygon of points

### Allowed choices

`inside`, `outside`.

### Fallback rule

Point-in-polygon test using the saved kitchen zone.

### Threshold

Accept Jev only if confidence is at or above `0.85`. This is the highest bar of the five.

### Guard after Jev answers

If Jev says `inside` but the point is clearly outside the polygon, fallback wins. We do not trust Jev over the map here.

### Failure mode

A wrong `outside` loses a customer. A wrong `inside` promises a delivery we cannot make. Both are costly, so this decision has the strictest gate.

---

## 7. Threshold table (all five)

| Decision | Choice type | Fallback | Min confidence |
|---|---|---|---|
| D1 Assign rider | rider id or none | fewest trips today | 0.70 |
| D2 Delivery ETA | fast / normal / slow | distance x 1.5 or 2.5 | 0.65 |
| D3 Next to cook | order id | oldest first | 0.70 |
| D4 Late risk | at_risk / on_track | age over 60% of SLA | 0.60 |
| D5 Zone check | inside / outside | point in polygon | 0.85 |

---

## 8. Test plan

We test in three rounds. Round 1 runs with no network. Round 2 runs against the live model. Round 3 proves the fallback still works after we wire everything in.

### Round 1 — Contract tests (no network)

We feed the wrapper fake replies and check it does the right thing.

| Test | Fake reply | Expected result |
|---|---|---|
| Invalid JSON | `not json` | fallback, logged |
| Choice not allowed | `choice: r99` | fallback, logged |
| Confidence too low | `choice: r1, confidence: 0.2` | fallback, logged |
| Good reply | `choice: r1, confidence: 0.9` | Jev answer used |
| Timeout | no reply within 900 ms | fallback, logged |
| Empty state | `{}` | fallback, no call made |

Six contract tests. All must pass with no network access at all.

### Round 2 — Live tests (real calls)

We call the real model once per decision, on both `typesafe/jev-router` and `typesafe/jev-1.13`. We record choice, confidence, and latency.

D1 live: 3 orders, 3 free riders. Expect a free rider, confidence at or above 0.70.
D2 live: 1 km, off peak. Expect `normal` or `fast`, confidence at or above 0.65.
D3 live: 3 orders with different ages. Expect the oldest, confidence at or above 0.70.
D4 live: order at 80% of SLA. Expect `at_risk`, confidence at or above 0.60.
D5 live: address clearly inside the zone. Expect `inside`, confidence at or above 0.85.

Each live test passes only if the call returns valid JSON, the choice is allowed, and it finishes under 900 ms. We run each one three times to see if the answer stays stable.

### Round 3 — Fallback and regression

We force failures, on purpose, and confirm the system still behaves.

- Point the wrapper at a bad key. Every decision must fall back and log it.
- Give every decision an empty state. Must fall back without calling out.
- Simulate 5 slow calls. Must time out and fall back each time.
- Confirm a forced failure never reaches the payment path, because nothing in D1 to D5 touches payments anyway.

Then we replay all Round 1 and Round 2 states after every code change. This is the regression set. If any threshold or behaviour shifts, the build is red.

### What good looks like

- All three rounds pass.
- Latency under 900 ms in at least 95 out of 100 calls.
- Every call is logged with the input hash, output, latency, and fallback flag.
- No Jev call anywhere near the payment path.

### What we track over time

Four numbers, kept as a running record:

- Accuracy: how often Jev matches what a human would pick.
- Fallback rate: how often we had to ignore Jev.
- Latency: median and 95th percentile.
- Cost per decision.

These four feed the health tracker idea from `IDEAS.md`. Over weeks they tell us whether Jev is earning its place, or whether rules would do better.

---

## 9. Sample states for tests

D1:

```json
{
  "orders": [{"id": "o1", "prep_eta_sec": 180, "items": 3}],
  "riders": [
    {"id": "r1", "free": true, "distance_m": 1200, "trips_done": 2},
    {"id": "r2", "free": true, "distance_m": 2100, "trips_done": 0},
    {"id": "r3", "free": false, "distance_m": 400, "trips_done": 9}
  ],
  "kitchen": "k1"
}
```

D2:

```json
{
  "kitchen": {"lat": 28.63, "lng": 77.22},
  "rider": {"lat": 28.64, "lng": 77.23},
  "distance_m": 1000,
  "peak": false,
  "historical_avg_min": 14
}
```

D3:

```json
{
  "orders": [
    {"id": "o1", "prep_eta_sec": 200, "items": 2, "age_sec": 600},
    {"id": "o2", "prep_eta_sec": 120, "items": 1, "age_sec": 300},
    {"id": "o3", "prep_eta_sec": 300, "items": 4, "age_sec": 900}
  ],
  "station_load": 2,
  "sla_min": 15
}
```

D4:

```json
{
  "order_age_sec": 720,
  "state": "preparing",
  "sla_min": 15,
  "rider_eta_sec": null
}
```

D5:

```json
{
  "address": {"lat": 28.631, "lng": 77.219},
  "zone": [[28.62, 77.20], [28.62, 77.23], [28.64, 77.23], [28.64, 77.20]]
}
```

---

## 10. Definition of done

This contract is done when:

1. The wrapper exists and is the only code that calls OpenRouter.
2. All five decisions have a working fallback, even with no network.
3. Round 1, Round 2, and Round 3 all pass.
4. Every call is logged.
5. A forced failure falls back cleanly and never touches money.
6. The four tracking numbers are being recorded.

After this, we wire D1 to D5 into dispatch, tracking, and the kitchen display. Only then do we move to the next decisions, D6 onward.
