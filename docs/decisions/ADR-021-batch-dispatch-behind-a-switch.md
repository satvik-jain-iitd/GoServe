# ADR-021: Stage 1 batch dispatch, behind a switch, tested before it ships

## Status

Proposed 25 Oct 2026 (story #263, layer 2). Becomes Accepted when test E9 passes on dev and the owner says yes to turning it on.

## Date

2026-10-25.

## Context

Today a rider is picked when the cook taps Ready: the nearest free rider with the fewest trips. The food then waits for the rider to arrive. The research file `docs/research/quick-commerce-dispatch-2026-10.md` says the big apps do the opposite: they name the rider while the food is being made, so the rider arrives as the bag is sealed, and they match in small batches instead of one order at a time. We own the kitchens and see the real Accept and Ready taps, so we can do this better than apps that guess.

## Decision

1. The rule is one pure database function, `dispatch_match(jsonb)`. It takes riders, orders, kitchens and tunables and returns assignments and zone states. A test and the E9 replay both call this exact function.
2. A second function, `dispatch_tick()`, reads the tables, calls the matcher, names the riders and writes `zone_state`. Real and synthetic rows are matched in separate rounds and never mix. n8n GS MAIN 33 calls it every 30 seconds. All the numbers live in `params` (`dispatch_rules`).
3. It is off. `params` global/`dispatch_mode` is `per_order` until an admin sets `batch`, and the rule only works while the decision engine (ADR in story #263 layer 1) is Rules. In batch mode SUB 22 stands down and a closed zone refuses new orders.
4. E9 decides. The owner turns it on only after the replay passes on dev (research file section 2: median mismatch between rider arrival and food ready down 30 % or more, P90 order-to-door up no more than 1 minute, on all three seeds).

## What the function does

- A rider and an order can be paired when the send time has come: `now >= ready - travel - 2 min`. Travel is the straight line times 1.4 at 15 km/h until real trips show better numbers.
- Cost of a pair is travel minutes, plus a penalty for arriving more than 3 minutes before the food, plus 0.5 for each trip the rider did today. The best pair goes first; each rider and order is used once.
- A second order of the same kitchen may join a rider if the ready times are within 5 minutes and the first customer waits under 5 minutes more. At most 2 orders per rider.
- Per kitchen, orders due within 10 minutes divided by free riders within 15 minutes: over 2 the zone is slow (ETA plus 10 minutes), over 3 it is closed.

## Alternatives considered

- Keep per-order dispatch and tune it: cannot fix the food waiting for the rider, which is the cause.
- Hungarian or auction matching: no gain at 20 riders, and harder to test (research file, finding D3).
- Put the matcher in n8n code: slow to test and no database transaction around it. A SQL function can be replayed.
- Turn it on at once: no. A risky change goes to a test first (global rule 10).

## Consequences

- Riders can be named while the food is being made. The rider app shows such a job only from Ready today (F-row); a rider who is named early needs to be told to head to the kitchen.
- Customers have no coordinates yet, so the second-order check uses the ready-time gap plus a 2 minute allowance for the extra stop (A-row).
- A closed zone is a hard stop for new orders. The customer sees a plain "we are very busy" line; the live tracking story (#266) makes this message and the ETA friendlier.
- Rolling back is one admin action (mode back to `per_order`) or the engine set to Jev.
