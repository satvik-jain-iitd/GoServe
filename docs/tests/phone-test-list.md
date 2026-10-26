# Phone test list

This is also the MVP 3 gate checklist (#255). Mark each test PASS, or write the story number if it fails. A failed row becomes a story under E22 before the release, not a note.

General set-up (once): an Android phone, Chrome, the tester's Google account, and the prod app at `goserve-app.pages.dev`. Tests P1 and P2 need their own APK or Play link. Other tests use the customer APK from `/get` (T1) or the browser.

The owner runs every phone test together, at the end, from this one list. Each test has steps, what to look for, and the line the reviewer runs after it. New tests are added here as they appear.

## P1. Rider app keeps sending its place with the screen locked (#252, E-TWA-1)

Why: a web app may stop in the background. If the rider app stops pinging, we must build a foreground service (ADR-020). If it keeps pinging, we do not.

Steps:
1. Install `~/Downloads/goserve-rider-spike.apk` (package `in.goserve.rider`) on an Android phone.
2. Open it and sign in as a rider on the prod app.
3. Go online. Accept the location question with "While using the app" or "Always".
4. Lock the screen. Leave the phone for 20 minutes. Do not open any other app.
5. Unlock. Tell the reviewer "ho gaya".

What to look for: nothing on the phone. The proof is in the database.

Reviewer runs after it (the owner's yes is needed for prod):
`python3 scripts/rider_gap.py prod --yes-prod --minutes 25`

Result: PASS when the longest gap between two pings is 60 seconds or less. FAIL means the foreground service is needed. Record the result in `docs/research/experiments.md` row E-TWA-1.

## P2. GoServe installs from the Play internal testing link (#254)

Needs first (owner, F201): Play Console app, store listing, service account and secret `PLAY_SERVICE_ACCOUNT_JSON`, the first bundle uploaded by hand, and your email on the internal track.

Steps:
1. On an Android phone signed in with the tester email, open the internal testing link from the Play Console.
2. Tap "Install", then open GoServe.
3. Later, after a new release to main, wait up to one day and open the Play page again.

What to look for:
- GoServe installs in one tap, with no "unknown source" warning, and opens on the pin screen.
- After a new release, the Play page offers the new version within the day.

Reviewer runs after it: `gh run list --workflow build-apk.yml --limit 3` must show a green run for the release, and the "Send to the Play internal testing track" step must say success.

## T1. Install the customer APK from the download page (#251)

Steps:
1. On the phone open `goserve-app.pages.dev/get/`.
2. Tap the download button, open the file, and allow "install unknown apps" for Chrome if Android asks.
3. Open GoServe from the home screen.

What to look for: the page shows the newest version and a QR picture; the app opens full screen with no browser bar; the first screen asks for the area (pin code).

Reviewer runs after it: `gh release view --json tagName,assets -q '.tagName, [.assets[].name]'` must list `goserve-<version>.apk` and `goserve-<version>.aab`.

## T2. Customer orders food (cash on delivery)

Steps:
1. In the customer app pick the area (pin code 110092 is a dream-kitchen pin), then "See the menu".
2. Tap "Add" on two dishes, then "View bill (2)".
3. Fill the name, phone and delivery address, place the order.
4. Watch the order screen. Tap "Ping me when it is ready" and allow notifications.
5. Cancel nothing. Wait until it says delivered, then tap "Yes, I have it".

What to look for: the bill total matches the dishes; the order moves from placed to delivered by itself (the city is a simulation); a notification arrives when it is ready; the phone shows a Call link for the rider; the dish photos show with the credit link.

Reviewer runs after it: a read of `orders` and `order_events` for this order: events `placed, accepted, preparing, ready, assigned, picked_up, delivered` once each, and `paid_by` cash.

## T3. Customer account, Night theme, privacy, feedback

Steps:
1. Open "Me" (Account). Switch Day and Night. Read "Privacy" and "Terms".
2. Open "Feedback", write one line, add a screenshot, tap "Send".
3. Turn on flight mode, open the app, then turn it off.

What to look for: Night is easy to read; the privacy page names the phone, address and the 30 days for rider places; the feedback is accepted; offline shows a clear message, not a blank page.

Reviewer runs after it: a read of `feedback` for the newest row: the text, the screen name and the picture link.

## T4. Kitchen cooks an order

Steps:
1. Sign in at `goserve-app.pages.dev/kitchen/` with a kitchen staff Google account (the reviewer adds the email first).
2. Open "New". Tap "Accept", then "Start" (cooking), then "Ready" on a ticket.
3. Open "Today". Mark one dish sold out; switch "Open for orders" off and on.

What to look for: tickets have big type and big buttons; each tap moves the ticket and the customer screen follows; a sold-out dish cannot be ordered.

Reviewer runs after it: `order_events` for those tickets show accepted, preparing, ready by the kitchen account.

## T5. Rider delivers and hands over cash

Steps:
1. Sign in at `goserve-app.pages.dev/rider/` with a rider Google account (the reviewer adds the email first). Tap "Go online".
2. When a job shows, tap "Pick up", then "Arriving", then "Delivered".
3. Open the cash view and tap "Confirm hand-over" for the amount.

What to look for: the job shows the pickup and the drop; the Call link opens the dialer; location is asked once; the cash total matches the order.

Reviewer runs after it: `rider_pings` has rows for this rider in the window and `orders.status = delivered` with cash recorded once.

## T6. Admin runs the city

Steps:
1. Sign in at `goserve-app.pages.dev/admin/` with the admin Google account.
2. Open "Numbers", "City", "Menu", "Decisions", "Simulator" and "Orders" one by one.
3. In "Decisions" check which engine is on (it must be Rules). In "Simulator" tap "Tick now".

What to look for: Numbers show tiles and one row per kitchen; City shows kitchens and riders; Decisions shows Rules and Jev at zero calls; Tick now moves orders.

Reviewer runs after it: `select decision_gate();` on prod shows engine rules, `jev_cap` 0, `jev_used` 0.

## T7. Telegram daily card and health report (reviewer, no phone steps)

Steps: the owner opens the Telegram chat "GoServeBot" at 22:15 India time.

What to look for: one card with the pilot numbers, and in the weekly report the lines `Jev calls today: 0 of 0 allowed · cost $0 · OFF` and `Laya calls today: 0 (not deployed)`. (MAIN 90 and MAIN 93 are off on prod today; this test passes only after the owner turns them on, or it is marked "not in this release".)

Reviewer runs after it: the n8n execution list for the scorecard workflow shows one success.


## P3. The installed app picks up a new build (M.1, #320)

Steps:
1. On the iPhone open the app from the home-screen icon (installed from Safari) and go to You. Read the line "Build xxxxxxx" at the bottom. Keep the app open in the background.
2. The coder merges a small change to main (the owner merges it) so that the deploy workflow publishes a new build to prod.
3. Wait two minutes. Switch back to the app from the app switcher (do not close it).

What to look for: the app reloads once by itself and the "Build" line shows a new id. A cart you had filled is still there.

Reviewer runs after it: `git log -1 --format=%h origin/main` must start with the new Build id.

## T8. A kitchen obeys its opening hours (M.2, #321)

Steps:
1. In the customer app open the menu of a demo kitchen during its hours (the dream kitchens open between 07:30 and 12:00 and close between 22:00 and 23:30).
2. Stay on the menu until the closing time of that kitchen, or open another kitchen after its closing time.

What to look for: before closing the menu says "Open till ...", and Add works. After closing the menu says "Closed now. Opens at ...", Add is off, with no reload.

Reviewer runs after it: in prod, `place_order` for a closed kitchen answers `kitchen_closed` (migration 0041 must be on prod).

## T9. A pin code we serve and one we do not (M.3, #322)

Steps:
1. In the customer app change the area to 110016 and tap "See the menu". Do the same with 110099.

What to look for: 110016 opens the menu of Madras Tiffin Room (after migration 0042 and Reset and Seed on prod). 110099 says "Not here yet. We do not deliver to 110099 yet." and makes no promise.

Reviewer runs after it: `select name from kitchens where '110016' = any(pin_codes);` on prod returns Madras Tiffin Room.
