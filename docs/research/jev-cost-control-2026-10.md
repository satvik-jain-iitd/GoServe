# Jev cost in automated tests

**Date:** 22 Oct 2026. Our own numbers (tier S).

| Claim | Evidence | Tier | Confidence | What it changes |
|---|---|---|---|---|
| A Jev call costs about $0.00002. Twenty live runs cost about $0.0004 | `run_log.cost` in the dev database | S | 0.8 | Money is not the risk |
| Flakiness is the risk: 6 of 21 live decide steps took over 900 ms | Live checks | S | 0.7 | Tests must not depend on a live Jev call |
| CI and e2e tests already fake the network | Test code | S | 0.9 | No cost there |

## Plan (a later story)

1. A new Config key `jev_mode` in MAIN 01: `live`, `stub` or `off`. Prod stays `live`.
2. Nightly dev runs use `stub`, except 1 run in 5 which uses `live`.
3. A budget guard in `scripts/live_check.py` and the live spec: add up `run_log.cost` for the run and stop above a cap, for example $0.01.
4. Separate OpenRouter keys for dev and prod, each with a hard cap. The prod key already has a $2 cap.
5. When Laya runs in shadow mode, its call is free and Jev is sampled only.

**Test for step 1:** in `stub` mode `run_log.cost` is 0 and no OpenRouter call is made.
