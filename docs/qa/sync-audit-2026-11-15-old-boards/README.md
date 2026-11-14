# Sync audit of 15 Nov 2026: the OLD design boards against the app

The owner asked to keep this result for good. It is the first run of the sync check. It compared the old design boards with the app. The owner then said the check must use the new production canvas. That second run is kept apart.

## What was checked
- One journey: the customer's first order, the happy path. 13 screen states.
- DESIGN: the old board that claims each screen (from the canvas notes of 14 Nov).
- DEV: `origin/dev` at 52e3b269. PROD: `origin/main` at 3bee04fb (release 6).
- Dev and prod were built from code with test data and a stand-in backend, in a desktop browser at phone size (390 wide). The live app and a real phone were not used.

## Result
- Dev against prod: 13 of 13 the same. Both branches hold the same `app/` tree.
- Old boards against prod: 0 of 13 the same.

| State | Old board | Part of the picture that differs | What differs |
|---|---|---|---|
| Welcome | O0g-C-GoogleBottom | 11.37 % | The board says "Welcome", "Step 1 of 4", "One tap and you are in". The app says "Sign in to start", a line about alerts and address, and the Terms line. |
| Order alerts | N0b-AlertsBottom | 7.41 % | The board says "Order alerts", "Step 2 of 4". The app has the why line and a sample alert. |
| Location ask | A1d-LocationRiderWaits | 5.26 % | Only the board has "Set up", "Step 3 of 4". |
| Pin map | A1p-OnboardPin | 43.75 % | The board has address words. The app says "Move the map to set the pin". Partly test data. |
| Address details | C7-PinDetails | 78.29 % | The board says "Step 2 of 2" and "House, flat, floor". The app's label is "House, street, colony, ward". |
| Finding your kitchen | A1e-LocationRiderLeaves | 4.06 % | Only the board has "Set up", "Step 4 of 4". |
| Menu | C1-HomeTop | 36.16 % | Mostly sample data. |
| Dish | Dish | 64.22 % | The board has a photo and a description. Sample data. |
| Your bill | D2-BillNote | 50.88 % | The app has the "How you pay" block. The board has a name field. |
| Order: cooking | E2a-EtaBig | 41.36 % | Sample data. The board has more rows with times. |
| Rider row | T4-TrackerMapRow | 32.29 % | Mostly sample data. |
| Order: delivered | DL1-DeliveredBigTime | 27.42 % | Sample data. The board shows times on the rows. |
| History | H1-History | 9.82 % | The test has no orders, so the app says "No orders yet". |

From the menu on, much of the gap is sample data (dish names, prices). The script cannot tell sample data from a real change of words.

## Design rules
- Fail on prod: sample text in fields is too faint (3.53 to 1 on Address details, 3.2 to 1 on the Bill; the rule is 4.5 to 1). The Address details sheet ends 16 px above the edge; the rule is 24. Story #1533.
- Fail on the old boards: five boards still say "Step N of M" (O0g-C, N0b, A1d, A1e, C7). The app has none.
- Pass on prod: nothing outside the screen, no cut text, the filled button last, the button in the same place on the three first-open steps, first-open slips end at 24 px, no second alerts ask, list and total agree, the tapped field, no layout shift on the pairs measured.
- `rules.md` says which rules a script can check and which need eyes.

## Not verified
- The radar run found tools (lost-pixel, argos, pixelslop) but their READMEs were not read. Rule 0 is not met in full. It is said in `radar-run.md`.
- Which old board is the right one for each screen was taken from notes. The owner did not confirm it.
- Only parts of the picture were looked at by a person.

## Files
- `j1.json`: the data of every state.
- `rules.md`: the owner's design rules as a check list.
- `radar-run.md`: the radar run.
- `sync-j1-part1.jpg` to `sync-j1-part5.jpg`: the picture, cut in five parts (each state is one row: design, dev, prod).
