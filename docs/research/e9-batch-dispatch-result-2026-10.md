# E9: does ready-time batch dispatch beat today's rule?

Run 25 Oct 2026 on the dev database, by `scripts/dispatch_sim.py`. Test row: E9 in `experiments.md`. Rule: ADR-021. Research: `quick-commerce-dispatch-2026-10.md`.

## What was tested

One seeded lunch peak of 2 hours, played three times: with today's rule, with a control, and with the new rule. Same kitchens, riders, orders, cooking times and road luck each time.

- **Today's rule** (SUB 13): when the cook taps Ready, the free rider with the fewest trips today, then the nearest.
- **Control, "nearest at Ready":** the same moment, but the nearest free rider. It shows how much of any gain is only "look at the distance".
- **New rule:** the real database function `dispatch_match`, run every 30 seconds. It names the rider while the food is still being made.

The world has 10 kitchens and 20 riders in a 6.5 km box. Orders come in a peak shape. Cooks accept after 30 to 120 s and cook a lognormal time around their own median (8 to 18 min). The rule is told that median, as the database would learn it, and the real time once Ready is tapped. Riders really go 13 to 17 km/h on roads 1.25 to 1.6 times the straight line. The rule assumes 15 km/h and 1.4. A handover and a drop take 60 s each.

Three loads, three seeds each: 0.4, 0.6 and 1.0 times the base peak (about 45, 77 and 110 orders). Today's rule keeps riders busy 25 to 32 %, 53 to 58 % and 65 to 76 % of the time.

## The measure

- **Mismatch:** at each pickup, how many seconds apart were the rider's arrival and the food being ready. Either side counts: a rider waiting for food, or food waiting for a rider.
- **Door P90:** the order-to-door time that 9 orders in 10 beat.
- **Late share:** orders that came more than 10 minutes after the 35 minute promise.

The E9 row said "rider wait at the kitchen". In every run the rider wait was 0: a rider is never early, because he cannot be. So the written metric could not move in the model. The number that moves is food waiting for the rider. I used the mismatch, which holds both. The reviewer confirmed that reading, with a caveat: real data in shadow mode (#267) must agree before batch goes on.

## Results (seconds)

Median mismatch, today's rule, control, new rule:

| Load | Seed 1 | Seed 2 | Seed 3 |
|---|---|---|---|
| 0.4 | 427, 364, **364** | 442, 291, **272** | 356, 194, **179** |
| 0.6 | 1476, 939, **376** | 696, 518, **345** | 719, 419, **320** |
| 1.0 | 2047, 1453, **540** | 2086, 2031, **644** | 2023, 2003, **306** |

Door P90, today's rule and new rule:

| Load | Seed 1 | Seed 2 | Seed 3 |
|---|---|---|---|
| 0.4 | 2833, **2570** | 3230, **2399** | 2881, **2427** |
| 0.6 | 4204, **3004** | 3478, **3011** | 3495, **2767** |
| 1.0 | 5526, **3823** | 5504, **3575** | 5567, **3306** |

Late share at load 1.0: today's rule 67 %, 65 %, 70 %; new rule 34 %, 27 %, 21 %.

## Reading

1. **The rule as written passes at load 1.0 and load 0.6, on all three seeds.** Mismatch falls 49 to 85 %. Door P90 falls 14 to 41 %, never rises.
2. **At the light load 0.4 it fails the rule on seed 1.** The mismatch fell only 15 % there (427 to 364). Seeds 2 and 3 fell 38 % and 50 %. Door P90 fell on all three seeds, so the new rule is not worse; it is just not 30 % better.
3. **At light load the whole gain is "look at the distance".** The control matches the new rule there (364 and 364, 291 and 272, 194 and 179). Today's rule loses because it takes the rider with the fewest trips first, even a far one. With scarce riders (0.6 and 1.0) the control stays near today's rule and the new rule is far ahead. That is where naming the rider early and matching in batches earns its keep.
4. **Today's rule is weak on distance.** A nearest-first change alone would cut the mismatch 15 to 50 % at light load for almost nothing. That is a separate, cheap idea (follow-up row), and it is the honest comparison for a small city like our first pilot.
5. **Riders cannot arrive early.** Rider wait is 0 everywhere. A rider is often 2 to 4 km from the next kitchen, and that trip takes longer than cooking. Fixing that is pre-positioning, a Stage 3 idea.

## What this does not show

- The world is my construction. Cooking times, road luck and the order stream are guesses. Real orders may differ. The numbers say the rule is sound in a model, not that it will win in Delhi.
- Zone closing is not played: the same orders always arrive, even where the new rule would close a zone. The sim counts nothing for customers who would have been turned away.
- Three seeds, two hours each. Enough to see a 30 % change at load 0.6 and 1.0; thin at load 0.4.
- Stacking uses the A72 assumption (no customer places), so the extra drive of a stacked order is a guess.

## Verdict

**PARTIAL.** The rule as written passes at the named peak and at 0.6, misses one seed at 0.4, and the model is mine. Not a failure, not yet a ship.

## Decision

The code ships **off** and is behind a hard gate (the rider app must show an early job, F173). `dispatch_mode` stays `per_order`. The rule as written passes at the peak the test named (load 1.0) and at 0.6. It fails strictly at 0.4 on one seed, where it is still not worse. Turning it on is the owner's yes, with the light-load result in front of him. Before it goes on for real riders: F-row for the rider app (an early job must show), and the first real orders to compare against.
