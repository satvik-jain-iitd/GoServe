# MVP2 demo script (for the founder)

Story M.4 (#323). Ten steps, about ten minutes. Run it twice before the real demo (M.5). Every line marked **rehearse** is something I read in the code or tests but did not run on prod yet.

## Before you start

- **Run it in daytime, India time.** A kitchen obeys its opening hours (story M.2). The demo kitchens open between 07:30 and 12:00 and close between 22:00 and 23:30. Madras Tiffin Room (the kitchen for pin code 110016) is open 07:30 to 22:00.
- **Switch Demo mode on** in the admin Simulator tab (needs 0043 and the n8n deploy of release #459). Without it a kitchen may switch itself off during the demo and an order takes about 24 minutes. With it the city is steady and an order should reach Delivered in about 10 minutes (to measure on the next rehearsal). If a kitchen is closed anyway, use another pin whose kitchen is open (110018 Punjab Da Dhaba, 110060 Karol Bagh, 110016 Madras Tiffin Room).
- **Prod must have the database changes 0041 and 0042**, then **Reset the city** and **Seed the city** (see "Reset the demo data" below). Without 0042, pin code 110016 says "Not here yet".
- Three screens: the customer on your phone, the admin on a laptop, and the kitchen and rider apps on a second phone or a second browser window.
- Addresses: `goserve-app.pages.dev/customer/`, `/kitchen/`, `/rider/`, `/admin/`.

## The ten steps

| # | Who | You do | You say |
|---|---|---|---|
| 1 | Customer | Open `/customer/`. Type pin code **110016**. Tap **See the menu**. | "A customer types one pin code. We find the kitchen that serves it." |
| 2 | Customer | Look at the menu: the Thali at the top, the photos, "Open till 10:00 pm". Tap a dish. | "Every dish has a real photo and a price. The kitchen is open now, and it tells us until when." |
| 3 | Customer | Add two dishes. Tap **View bill**. | "The price comes from the kitchen's menu. The phone cannot change it." |
| 4 | Customer | Fill your name, phone and address. Tap **Place order ›**. | "Cash on delivery. One tap and the order is in." |
| 5 | Customer | Stay on the order screen. | "The customer sees the same order slip all the way: placed, cooking, on the way." |
| 6 | Kitchen | Open `/kitchen/` (a kitchen staff account, see below). Find the new ticket in **New**. | "The kitchen sees the order at once, with big type and big buttons." |
| 7 | Kitchen | If you play the cook: tap **Accept**, then **Start**, then **Ready**. If the demo city is on, it does this by itself: show it happening. | "Three taps from the cook. In the demo city, the kitchens are programmed, so they do it themselves." |
| 8 | Rider | Open `/rider/` (a rider account). Tap **Go online**. Show the job: **Pick up**, **Arriving**, **Delivered**. Demo riders do this by themselves too. | "The system picks the nearest free rider. The rider has three taps." |
| 9 | Customer | Back on the customer phone: the slip says Delivered. Tap **Yes, I have it**. | "The customer confirms. Cash is counted once." |
| 10 | Admin | Open `/admin/`. Show **Numbers**, **City**, **Orders**, **Decisions** (Rules is on, Jev costs nothing) and **Simulator**. | "The owner sees the day in numbers, every kitchen and rider, and which brain decides. The paid model is off." |

**Rehearse:** which of steps 7 and 8 the demo city does on its own for an order you place (read from ADR-022 and `sim_orders_check`: sim kitchens and sim riders move real orders). If it moves too fast to show, open the Simulator tab and use the slow settings, or show the kitchen and rider screens first.

## Sign-ins

- Customer: nothing to sign in; the phone makes an anonymous session.
- Kitchen and rider: **Continue with Google**. The Google account must be added first: Admin, **City**, **Add a person**, then choose the role and the kitchen. Add two test accounts before the demo and write their emails here: `kitchen: ______`, `rider: ______`.
- Admin: the founder's Google account (already an admin).

## Reset the demo data

1. Admin, **Simulator**, tap **Reset the city** (it removes only the demo kitchens, riders and orders; real rows are kept).
2. Tap **Seed the city**. Wait for 10 kitchens, 120 dishes and 40 riders.
3. Switch the simulator on (the switch at the top of the tab).
4. Open `/customer/` and check pin code 110016 shows Madras Tiffin Room with 12 dishes.

## If something goes wrong

- "Not here yet" for 110016: migration 0042 is not on prod, or the city was not re-seeded.
- "Closed now": the kitchen is outside its hours. Try pin code 110018 (Punjab Da Dhaba, 11:00 to 23:30) or come back in the daytime.
- The menu is old on an iPhone: open **You** and read the Build line; it must match the latest deploy (phone test P3).
- Orders do not move: the simulator switch is off, or the n8n tick workflow is off.

## After the demo

Write what failed in `docs/follow-ups.md` as a row, and fix it as a P0 story (M.5).
