# Personas: who uses each app

Owner, 13 Nov 2026: "go into the exact user persona of each of these different people, understand what they care about ... what they would want to see and what they would not want to see, or what is irrelevant for them to see."

Rules for this file:

- A line is a fact only when it has a source: the owner's words, or what the app does.
- A thing we do not know is written under "Open". It is never filled in with a guess.
- One role is added when its screens are reviewed. Rider first. Kitchen and admin follow.

## Rider

### Facts

| Fact | Source |
|---|---|
| The rider is a GoServe employee, full time. He works only for GoServe and wears GoServe dress. | Owner, 13 Nov 2026 |
| He is on our payroll and waits at the kitchen. Two riders at launch. | Delivery ka hisaab, 6 Nov 2026 (Model 1) |
| He is paid a fixed salary and a small incentive. He rides his own petrol bike; fuel is paid. | Delivery ka hisaab, 6 Nov 2026 |
| His shift is two blocks of four hours, lunch and dinner. | Delivery ka hisaab, 6 Nov 2026 |
| His cost is by the hour, not by the order. So drops a day decide the profit: target 30 or more. The kitchen needs 69 orders a day. | Delivery ka hisaab, 6 Nov 2026 |
| In the slot lane one trip carries 4 to 6 boxes to one area. On demand, one trip carries one order. | Delivery ka hisaab, 6 Nov 2026 |
| He takes the money at the door, cash or UPI by QR, holds the cash and hands it to the kitchen that night. | `RiderScreen.tsx`, Today tab; issue #620 |
| One wrong tap must not break a delivery. | Owner, 13 Nov 2026 |
| He does not need all the details the customer sees. | Owner, 13 Nov 2026 |
| At the door he speaks a Hindi and English mix, in Roman letters. | Owner, 13 Nov 2026 |
| He reads Roman Hindi (Hindi in English letters). | Owner, 13 Nov 2026 |

Wrong and replaced, 13 Nov 2026: an earlier draft said "a rider is not tied to a kitchen" (a line of 25 Oct). The owner corrected it the same day.

### What he cares about, step by step

| Step | He asks | So the screen leads with |
|---|---|---|
| Pick up, at the kitchen | Which packets are mine? Are they complete? | The order number, big. The dishes with counts |
| On the way | Where is the door? | Name, address, Call, Navigate, the customer's note |
| At the door | What do I say? How much do I take? | The line to say. The amount |
| Delivered | Is it done? How much cash do I hold? What is next? | "Cash aapke paas", then "Next delivery" or "Done" (boards DV1, DV2) |

### What is irrelevant for him

- The kitchen's name and address. He works there.
- Dish prices. He needs the dishes and the counts.
- The customer's phone number as digits. The Call button is enough.

### Decided on 13 Nov 2026

- One trip can carry many packets. The admin sets how many (boards RT1, RT2, story #1441).
- A wrong payment tap is put right with "Change" on the Delivered slip, until the night's cash hand-over (story #1448).
- The road to the kitchen and the call to the kitchen are rows on the Me tab (board MC1, stories #1445, #1440).
- The incentive is an amount for each delivery. The admin turns it on or off and sets the amount (board TI1, story #1443). Owner: "incentive wala daalo pr admin settings me bhi jaana chahiye enable disable and adjust krne ka".

### Open

- Whether being early or late matters to his pay.
- Who holds the kitchen phone, the cook or the helper.

### Boards (design canvas, 13 Nov 2026)

- Sign in SI1, not on the list NR3, Offline OF1, Online ON1.
- Pick up RP3 (one order), RT1 and RT2 (one trip, many packets). RP1, RP2 and RP4 are not used.
- On the way and the door: RY1, RY2, RY3 on dev; OW1 removes the hint line (story #1452).
- Collect CP1, Delivered DV1 and DV2, Today TI1, Me MC1.

## Kitchen

### Facts

| Fact | Source |
|---|---|
| Our own kitchen, a cook and a helper on payroll. | Delivery ka hisaab, 6 Nov 2026 |
| Staff "need a good experience to function well as well". | Owner, 13 Nov 2026 |

### What the cook cares about

| Step | He asks | So the screen leads with |
|---|---|---|
| New | What came in? Can I make it? | The dishes with counts, the customer's note, Accept |
| Cooking | What is next? What is done? | Start as an outline, Ready filled (board KC1) |
| Rush | A dish ran out | Sold out, high on the Today tab (board KD1) |

### What is irrelevant for him

- The customer's address and name, dish prices, and the money the rider collects (boards KO1, KK1, story #1455).

These kitchen calls were made by the reviewer on the owner's delegation of 13 Nov 2026 (epic #1453).
