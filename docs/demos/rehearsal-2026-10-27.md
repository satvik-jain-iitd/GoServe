# Demo rehearsal, 27 Oct 2026 (story #324)

Run on prod (`https://goserve-app.pages.dev`, pin 110016, Madras Tiffin Room) by the reviewer on the owner's yes. The coder never runs prod. Spec: `app/tests/live/demo-rehearsal.live.spec.ts` (story #584).
Prod state before the runs: demo mode on, 10 kitchens open, 20 riders online, 120 dishes.

## Run 1, order 0074eb28, placed 21:43 IST

| Step | Result | Seconds |
|---|---|---|
| 1 pin and See the menu | pass | 2 |
| 2 the menu: dishes, photos and Open till | pass | 0 |
| 3 two dishes and View bill | pass | 0 |
| 4 name, phone, address and Place order | pass | 2 |
| 5 the order slip | pass | 0 |
| 6 to 8 the demo city moves the order to Delivered | pass | 868 |
| 9 Yes, I have it | **fail** | 627 |

Step 9 failed with `locator.click: Test timeout of 1500000ms exceeded.`

Why: the app asks "Yes, I have it" at the earlier of ready + 3 min and placed + 8 min. The spec waited for the heading Delivered first, so the question had come and gone. A spec order bug, not a product bug. Fixed in story #593 (PR #594).

Delivery took 868 s (14.5 minutes). `docs/demo/mvp2-demo.md` says about 11 minutes (follow-up F259).

## Run 2, started 22:06 IST

| Step | Result | Seconds |
|---|---|---|
| 1 pin and See the menu | pass | 3 |
| 2 the menu: dishes, photos and Open till | **fail** | 5 |

The menu said "Good night!": the kitchen closes at 22:00 IST. Expected, not a bug.

## Night runs, after the spec fix (#594), 27 Oct

Spec: steps 6 to 9 are one row now (the question "Yes, I have it" comes first, then Delivered and the cash line).

| Step | Run 1 (order b07232a4) | Run 2 (order dcc0a6e7) |
|---|---|---|
| 1 pin and See the menu | pass, 2 s | pass, 2 s |
| 2 the menu | pass, 0 s | pass, 0 s |
| 3 two dishes and View bill | pass, 0 s | pass, 0 s |
| 4 name, phone, address and Place order | pass, 2 s | pass, 2 s |
| 5 the order slip | pass, 0 s | pass, 0 s |
| 6 to 9 delivered and Yes, I have it | pass, 518 s | **fail**, 1496 s |

Run 2 failed at "Paid: cash". The server had `delivered` and `paid_by` cash (three updates in one transaction at 23:03:02.785, the Yes before the sim rider picked up). The phone showed "Cash at door" and no Paid line.
Why: `mergeOrder` replaced the order when `updated_at` was equal, so a live event with `paid_by` null cleared the cash that the Yes answer had set. A real product bug. Fixed in story #601: `mergeOrder` keeps `paid_by` once set (staging PR #604, release PR #603 to `main`).

## Final runs on the redeployed prod app (main 69cbba0), 28 Oct

| Step | Run 1 (order 3c927135) | Run 2 (order 989d3a41) |
|---|---|---|
| 1 pin and See the menu | pass, 3 s | pass, 2 s |
| 2 the menu | pass, 0 s | pass, 0 s |
| 3 two dishes and View bill | pass, 0 s | pass, 0 s |
| 4 name, phone, address and Place order | pass, 2 s | pass, 2 s |
| 5 the order slip | pass, 0 s | pass, 0 s |
| 6 to 9 delivered and Yes, I have it | pass, 464 s | pass, 413 s |

"Paid: cash" showed in both. Two passing runs: #324 is closed (reviewer). Delivery took 7 to 8 minutes in these runs, against 14.5 minutes in the first run (the demo kitchens are open all day since 27 Oct 22:43, follow-up F260).
