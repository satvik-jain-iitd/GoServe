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

## Next

Two daytime runs after #594 lands. Two passing runs close #324 (follow-up F258).
