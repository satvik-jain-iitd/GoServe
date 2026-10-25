# Dispatch and live tracking: how it grows

Epic E23 (#265). Research: `docs/research/quick-commerce-dispatch-2026-10.md`. Written 25 Oct 2026.

## The idea in one line

Rules decide, at zero cost. Models watch from the side. A model takes over a job only when it beats the rule on real orders.

## Why we can do better than the big apps at our size

The big apps do not own the kitchens. They guess how long the food takes. We own the kitchens. The cook taps Accept, Start and Ready, so we know the real cooking time. That one fact makes our rider timing and our customer screen more honest.

## The stages

| Stage | When | How the rider is chosen | Travel time | Where it runs | Story | Ships when |
|---|---|---|---|---|---|---|
| 0, today | now | Per order: the nearest online rider with the fewest trips | Straight line | Postgres + n8n | done | done |
| 1, rules | before 2 Nov | Every 30 s, all free riders and all orders whose food is nearly ready, matched best pair first; at most 2 orders per rider from one kitchen | Straight line x 1.4 at 15 km/h | Postgres + n8n | #263 | Test E9 passes |
| 1b, shadow | after 1 | Rules still decide; Laya and Jev answer beside them, logged only | same | n8n + the Oracle box | #267 | The daily card shows the comparison |
| 2, roads | after Ola Maps (#191) | Same matcher | Road time from Ola Maps plus a learned correction per kitchen and hour | Postgres + n8n | #268 | Error falls 25% on both legs |
| 3, city scale | thousands of riders | A matcher service per part of the city, every 10 to 30 s, on H3 cells; idle riders sent where orders will come | Road time as a range | Own service, not n8n | #269 | P90 delivery 5% better in a switchback test |

## Live tracking for the customer

Story #266. Built in this order, strongest evidence first:

1. A timeline of real kitchen stages, each with its time: Accepted, Cooking, Packed, Rider on the way, Arriving.
2. Arrival as a range, like "7:40 to 7:50 pm". We promise the slow end. We update it before it slips.
3. The reason for a delay, in plain words.
4. A push at pickup: "Ravi picked up your order".
5. The rider's name, a call button, and a live dot after pickup.
6. A clear "zone closed" message with a reason and a time to try again.
7. The same view for the admin.

We do not show a countdown. We do not promise a single exact minute. A rider is never pushed to race a clock.

## The switch in the admin app

The admin picks the engine that decides: Rules, Jev or Laya. One is on at a time. Rules is the default (#263). Laya can be picked once it runs on our own box (#253).

## How we know it works

Every stage has a test written before the code: E9 for Stage 1, the shadow log for 1b, two weeks of shadow ETAs for Stage 2, a switchback test for Stage 3. A stage that fails its test does not ship. The old rule stays.
