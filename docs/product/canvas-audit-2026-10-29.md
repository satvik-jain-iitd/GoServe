# Canvas audit: Section 1 (Production) against the live app, 29 Oct 2026

Owner's words, 29 Oct 2026 (evening): go screen by screen, one at a time, check that each board matches what we decided for production; note every mismatch as a mistake; make the plan; then fix all of it. His two examples: the Menu board plays a pin fly-in every time it opens (prod plays it once, after the pin pick), and the M2 thali board shows an old stepper.

His decisions on the fix (same evening): "abhi kuchh bhi drop ni karenge bas ek alag section me rakh sakte hain baki jo already approved hai wo aaj nhin to kal aa hi jayegi app me stories ban ke" and "abhi one time me design ko update krdo and issues fix krke best state possible bana do, section 5 me kyun daalana hai duplicates nhin banane hain aur. har screen ko update krne se pehle merese ab confirmation lena". So: nothing is dropped, the approved-but-unbuilt items get their own canvas section and stories; no old copies go to Section 5; every board is confirmed with the owner before it is rewritten.

Method: two read-only passes by Explore agents over the 66 Section 1 boards against `origin/main` (31e1f39, release #687), checked by the reviewer before any fix. Compared: words, components and classes, buttons, motion classes, structure and states. Sample data is not a difference. The record of the old boards is this page plus the canvas's own version history.

## Findings
Result so far: of 66 Section 1 boards, 45 checked; only 4 match (A1-LocationAsk, F2-FeedbackSent, M6-OfflineEmpty, and nothing else yet). The rest drifted. The pattern is one mistake, not many: stories changed live screens (copy audits #659 #661, the OTP sheet, kitchen tabs, admin tabs, the You screen) without touching their boards, so Section 1 stopped being the latest live version.

Mistakes by board (journey order). Side = who fixes. "board stale" = rewrite the board from the app; "owner's call" = the board shows an approved idea the app never built (keep as a Section 2 DESIGN board and a coder story, or drop; the owner decides, see the question below).

Row 1a, first open and address
- O0-Welcome, O0b-Code: field label "Mobile" vs app "Mobile number"; no placeholder in the app; +91 and the input are two elements (`otp-phone`), not one box; Google button is `ui-btn ghost` not `big`; "Sent to … Change number" has no "·" and is a `ui-link` button; order is boxes, Verify, then the resend line; no `role="group"` on the boxes. Side: board stale.
- A2-AddressFound, A3-AddressByHand: the slip is a `div role="group"`, the pin input is `type="tel"`; A3 lacks the "We could not get your location. Type it by hand." note state. Side: board stale.
- S-NoKitchen: the whole board is the pre-#655 pin screen ("Where do we deliver?", pin only, "We do not reach 110099 yet.", "Track an order"); the app shows the address step with "Not here yet. We do not deliver to {pin} yet." and "A pin code next to yours may work.". Side: board stale (rebuild from AreaScreen.tsx:42-97).
- A1-LocationAsk: matches.

Row 1b, menu to order
- Menu, M2, S-Loading, S-Closed: pin is an inline svg `ui-pin-svg` (board: brand mark `img`), aria "Change area, pin code …", `ui-mark-land` only on `land` (board: always); greeting sub-line is `h2.ui-greet-line` "Open till {time}" (board: "Dinner at your door in 25 to 35 min"); Menu's veg/non-veg switch is `nav.ui-seg` (the current Menu board lost the class); thali card has no `ui-meta` parts line and no struck "parts ₹220", title is the dish name, and the stepper is the shared Stepper/Add (#608); dish tiles have no `ui-meta` description. Side: board stale.
- S-Loading: the skeleton has no Add pill; the fly-in plays on this screen in the app (the first Menu after the pin pick mounts loading). Side: board stale; the loading board is the right place for a note "the pin lands here, once".
- S-Closed: one-line closed card "Closed now. Opens at 11:00 am. You can look at the menu." (board: two lines); no greeting sub-line; the thali card still shows with Add disabled. Side: board stale.
- Categories: the app has a "Search dishes" field above the switch. Side: board stale.
- Dish: no description paragraph; kicker is "{Veg/Non-veg} · {category}"; a credit line shows when the photo has one. Side: board stale.
- D1-BillFields, S-EmptyBill: no "Cash" header meta; slip head is one part; with the OTP gate on (prod), the name and phone fields are hidden and only the address is asked; the missing-fields line is `p.ui-note.ui-bar-note`; the app shows the "How you pay" fieldset (cash / UPI / card; UPI and card behind flags). Delivery fee shows "Free". Side: board stale.
- Placed: back is "Back to menu"; slip aria "Order"; body "The kitchen has your order. This page updates on its own."; timeline and address line shown; buttons "Cancel order" (ghost big) and "Call the kitchen"; no "Track your order"; "Ping me when it is ready" when alerts are "ask". Side: board stale.

Row 1c, after the order
- Tracker, T1, Delivered: back is "Back to menu"; timeline label "Accepted" with no times, aria "Order progress"; T1 hides the address; Delivered: 12-hour time, no "4 min early", one-line thank-you, main button "See the menu". Side: board stale; "4 min early" and "Order again" are owner's call.
- Orders, S-EmptyOrders: "{n} orders" not "slips"; "Newest first"; "No orders yet" / "Your orders will show here." (copy audit). Side: board stale.

Row 1d, You, alerts, feedback
- Y3, Y2, U1 to U4, F1 to F3: no "No account needed" meta; live pill "No. {no}" without "32:00 left"; slip head "Used on your bill"; Look has two chips (Day, Night), no "By the clock"; no "Use on another phone" row; "Send feedback" row always; "Privacy · Terms" and the build label at the bottom; Google block is `ui-google` with the help line "Keeps your orders on every phone."; alerts sub-lines are "Tap to turn on" / "On for this phone"; Y2 labels "Your name" and "Address"; the alerts error is `p.ui-field-error` after the row. Side: board stale; "By the clock" and "Use on another phone" are owner's call.
- F1, F3: screenshot label "Add a screenshot (optional)" and help "Take one with your phone buttons first, then pick it here."; the picker is a native select; Send/Close are the old `btn` classes in a `.demobar` and the backdrop is the old `.sheet-back`. Side: the words are board stale; the old `btn`/`.sheet-back` classes in FeedbackSheet.tsx are app drift (the sheet never moved to the ui-* system): coder story.
- F2: matches.

Row 1e, offline and Night
- M5-MenuOffline: same Menu drift (pin, greeting, ui-meta, parts price) plus the offline banner sits inside `ui-scroll` after the greeting and the closed block. Side: board stale.
- M6: matches.
- N1-YouNightSignedIn: the You drift above, plus the Sign out button is `ui-btn ghost` inline in `p.notice`. Side: board stale.
- N-Blue: a variation board (night-blue theme), not a live screen: belongs in Section 4 or 3, not Section 1. Side: manifest move.

Row 1f, the phone code at checkout
- O1 to O9: label "Mobile number", no placeholder, `otp-phone` two elements, buttons `ui-btn bar` not `big`, "Not now" ghost button on the sheet, `ui-sheet-head` title, dialog aria stays "Confirm your number", no live ten-digit validation line (Send code is disabled instead), order boxes, Verify, resend; Verify enabled after a wrong code; "Resend code" is a ghost button below Verify; O6 lacks "Resend code · not now" and the 429 keeps the number step; O7 choices are `ui-btn`/`ghost` with Verify still shown; O8 toast is "Number confirmed" only; O9 has no helper line, no placeholder, `autoComplete="name"`, Continue `bar` and disabled until typed, "Skip". Side: board stale; the live ten-digit error line (O2) and the "once, the rider sees this name" helper (O9) are owner's call.

Row 1g, kitchen
- K2-Tickets, K2-Cooking, K-YourKitchen: third tab is "Today" (board "Kitchen"); badge is `ui-tab-badge` "N new"; tab icons differ (note, pot, house); row action is `ui-btn big`; footer "New tickets land here · accept within 2 min"; Cooking's "Accepted" tag has no CSS rule (shows the filled base tag): app drift, one line; Ready heading is `section.ui-group`; rider line has no "· here"; Today line "… ₹X cash today"; dish headings `ui-group`; "Send feedback ›", "Sign out ›" and the rider cash rows at the end. Side: board stale, except the `ui-tag accepted` rule (coder, one line).
- K-SignIn, R-SignIn, A-SignIn: only the Google button differs (`ui-btn ghost`, not big primary). Side: board stale.
- K-NotStaff, R-NotRider, A-NotAdmin: slip head "Signed in" without a name; the footer line "No app to install · works in the browser" always shows. Side: board stale.
- K-Ticket: slip head "Cash at door"; a "Deliver to" block (name, address) instead of a customer note (orders have no note field); "₹" on line prices; helper "Accept. Start when cooking. Ready calls the rider." Side: board stale; the customer note is owner's call (a feature the app never had).
- K-NoTickets: only the tab label "Today" and the icons. Side: board stale.

Row 1h, rider
- All seven: first tab is "Delivery" (board "Job"). R-Online: empty text starts "No deliveries yet."; sub line "Today · N delivered". R-PickUp, R-OnTheWay: no pin line under the address; the raw phone; a rule before "Collect cash"; "₹" on lines; R-OnTheWay has a third `ui-btn text` "Not delivered". R-Delivered: no "4 min early". R-Today: cash sub-line adds "· day ends at HH:MM"; rows are static, second line "{name} · {full address}". R-Me: "every 30 seconds", "Your phone", no "Rides for" row, a "Send feedback ›" row. Side: board stale; "Rides for" and "4 min early" are owner's call.

Row 1i, admin
- A-Orders, A-Order, A-City, A-Kitchen: four tabs (Simulator) with a live badge on Orders; section heads are `section.ui-group` with the count inside the h2. A-Order: kitchen name only in the head, "₹" lines, no "Delivery 40" line, the address between two rules, "Call" without "one tap each", kitchen row "{kitchen} / Kitchen · {phone}", timeline labels only (no times, no "by Sunita", no "Now"), Cancel only while placed or accepted. A-City: kitchen sub = all pins and all staff; rider sub = phone or email, a "Remove" button; admin rows listed. A-Kitchen: no "Edit details ›"; staff rows are emails with "Remove", no call icon; each dish has an actions row (Sold out / Back in stock, price input, Save price, Delete). A-AddKitchen: "Phone" + helper "10 digits"; "Pin codes" + helper "At least one · comma between pins" + placeholder; the pin error is the top line "Pin codes are six digits. Check: 11004"; button "Add kitchen", never disabled; time inputs are `type="time"`. Side: board stale; timeline times and "Edit details" are owner's call.
- A-Numbers: four tabs (Simulator added), badge on Orders, the day total line, "Cash today" tile, no "On time" and "Riders online" tiles, a "Per kitchen" group, "Send feedback ›", the Decisions block; the simulator lives on its own tab with different words. Side: board stale ("On time" and "Riders online" tiles are owner's call).

Totals: 66 boards; 4 match (A1, F2, M6, and K-NoTickets / R-Offline / the three SignIn boards match apart from one shared row each); 62 need a rewrite or a move. App drift found (coder stories, the board is right): FeedbackSheet still uses the old `btn` / `.sheet-back` classes; `ui-tag accepted` has no CSS rule (K2-Cooking shows the wrong tag). Manifest moves: N-Blue to Section 4 (a rejected variation, with Sunset's note), not Section 1.

Owner's call (approved on a board, never built in the app): "4 min early" on Delivered and R-Delivered; "Order again"; timeline times and "by Sunita"; "No account needed" header meta; "By the clock" Look chip; "Use on another phone" row; "Track an order" on the no-kitchen state; live ten-digit error line (O2); "Once. The rider and the kitchen see this name." (O9); "Resend code · not now" (O6); customer note on the kitchen ticket; "Rides for" on R-Me; "On time" and "Riders online" tiles; "Edit details ›" on A-Kitchen. Two options: (a) keep each as a Section 2 DESIGN board (one per screen, the extras marked) with a coder story in M4; (b) drop them, the live app is the design. Recommendation: (a) only for the four that change what the customer sees (4 min early, Order again, timeline times, Use on another phone), (b) for the rest, so Section 1 stops carrying wishes.


## What happens next
1. The reviewer rewrites each stale board from the app's markup and words on `origin/main`, one screen at a time, after the owner's yes on that screen (journey order: 1b, 1a, 1c, 1d, 1e, 1f, 1g, 1h, 1i).
2. The approved-but-unbuilt items go to a new canvas section "Approved, not built yet" (DESIGN), one board per screen, and one coder story each in M4 under E26 #310.
3. App drift becomes coder stories now: FeedbackSheet to the ui-sheet / ui-btn system; the `ui-tag accepted` CSS rule.
4. Rule: a story that changes a live screen names the board it updated in the PR body; the reviewer checks the board before approving (GoServe DoD in docs/PLAN.md; the same line proposed to ShipQuick).
