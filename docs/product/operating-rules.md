# Operating rules (PROPOSED, waiting on the owner)

Status: **proposed** on 28 Oct 2026 (reviewer, story #620). Nothing here is built. The owner says yes or changes each line. After his yes this file becomes the rule, with an ADR and the stories at the end.

The owner, 28 Oct 2026 about 01:10 IST, in the phone sitting (#325): handle very carefully the case where the kitchen switches off while it has open orders. The kitchen gets no notice that the rider reached for pickup, or whether the cash was taken from the rider. On the rider side: accepted, cash collected or not, and when the rider gets paid.

## What exists today (read from the code)

- `Open for orders` only stops new orders (`kitchen_open_now` in `place_order`). Nothing tells the kitchen about tickets still open.
- The rider has an "Arriving" event for the customer (`order.arriving`). There is none for the kitchen.
- The kitchen Today tab has cash hand-over per rider ("Confirm hand-over", `cash_handed_at`). The rider collects cash at the door (`paid_by = cash`), holds it, hands it to the kitchen, and the kitchen confirms.
- Rider pay is not defined in the docs or the code. Research: payouts can be bought from RazorpayX.

## A. The kitchen switches off

1. Off means "no new orders". Every open order (placed, accepted, cooking, ready, out for delivery) goes on as it is. Switching off cannot drop them.
2. Tickets still in New when the kitchen switches off: the app asks first ("2 new tickets: accept or refuse them before you close"). It does not switch off until each is accepted or refused. Refuse means cancelled with the reason "kitchen closed", and the customer is told at once.
3. While off with open orders, the Today tab shows "Closed · 3 still cooking" and the Cooking tab keeps working. The customer tracker of an open order does not change.
4. The city sim and the admin follow the same rule.

## B. The kitchen hears the rider

5. The rider taps "At the kitchen" (a new rider action on a Ready ticket). The kitchen's Cooking tab shows "Rider here: Abhinav" on that ticket, with a sound. The rider's pick-up tap moves the ticket out.
6. The Ready section of the kitchen shows the rider's name and the minutes away as now, plus "here" when the rider has arrived.

## C. Cash

7. The rider collects cash at the door. The order shows "Cash collected ₹x" on the rider's slip and in the kitchen's Today list ("₹160 in hand").
8. The rider hands the cash to the kitchen at the end of the shift, or when the kitchen asks. The kitchen taps "Confirm hand-over" per rider. Both sides see "Handed over 23:40".
9. A rider with cash in hand cannot go offline for the day until the hand-over is confirmed. At first this is a warning, not a block.

## D. Rider pay (the owner decides; nothing is built until he picks)

10. Option 1: a fixed amount per delivery (for example ₹30), settled by GoServe weekly by bank transfer (RazorpayX payout). Option 2: per hour online. Option 3: per delivery plus a distance part. The rider app shows "Today: 6 deliveries · ₹180 earned" and a weekly statement.
11. Cash collected by the rider is the kitchen's (or GoServe's) money. It is never netted against the rider's pay in the MVP. Pay goes by transfer, cash goes to the kitchen.

## Not covered here

Online payments (#348), refunds, tips.

## Stories to open after the owner's yes

- A: the kitchen switches off with open orders, with the sim.
- B: the rider at the kitchen.
- C9: the hand-over warning.
- D: the rider earnings screen and the weekly payout, after the pay model is picked.
