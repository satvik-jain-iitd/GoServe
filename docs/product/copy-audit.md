# Customer app copy audit (story #643)

Owner, 28 Oct 2026: "Every word, every sentence, every line, every icon, every image on the customer app: does it make psychological sense to keep it there, and why. Should it be here, somewhere else, or not at all."

How to read this file:
- One table per screen, in the order a customer meets them.
- `Situation` says where you are in the app and what you were doing when the line shows, so you can judge it without opening the designs.
- `Today` is the exact text on the screen now (prod build 68ac124). `ICON:` and `IMAGE:` rows describe a picture.
- `Job` is what the line does for the customer: the question it answers, the feeling it builds, or the next step it names. A line with no job is noise.
- `Verdict`: **keep**, **rewrite**, **move**, **drop**, or **story #n** when a story already fixes it.
- `New words` is the exact text to ship. The words here are the words in the test.
- `Owner` is the owner's mark: yes, no, or a note. Empty means not marked yet.

Rules used for every row (from the design doc and the sitting rows):
1. Grade 5 English. One idea per line.
2. Say what happens next, not what went wrong inside the system.
3. Never show a raw system or server message (story #635 set this rule for sign-in; it applies everywhere).
4. Thank the customer where they gave us something: an order, a note, a yes.
5. Never promise what the app cannot do.
6. One way to write a time: `7:42 pm`. One way to say "no internet": "Check your internet and try again."
7. Capitals are for labels (the mono kicker style), never for a sentence a customer must read.

## A. Whole-app rows (apply everywhere)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| A.1 | You are on the tracker after placing an order; the clock line under the stamp says `door by 20:12`. Earlier, on the menu, the kitchen line said `Open till 10:00 pm`. | Times are written two ways: `door by 20:12` (24 h) on the tracker, `Open till 10:00 pm` (12 h) on the menu | One clock the customer trusts | rewrite | Every time as `h:mm am/pm`, lower case: `door by 8:12 pm` | Two formats on two screens of the same order read like two apps. India reads 12 h on phones. | yes |
| A.2 | Any screen, the moment the internet drops and you tap something that needs it (See the menu, Place order, Send). An alert line appears under the button. | "Connect and try again." / "Check your connection and try again." / "Connect once to load it." | Tell the customer the one thing to do | rewrite | One phrase everywhere: `Check your internet and try again.` | Same problem, same words, so the customer learns it once. | yes |
| A.3 | Tracker, under the progress list: your delivery address, drawn in small capitals in the mono font, like a label. | The delivery address on the tracker is drawn in CAPITALS (mono style) | Let the customer check the address at a glance | rewrite | Normal case, same mono font: `B-12, Lajpat Nagar II, near the park gate` | Capitals slow reading by about a fifth and hide typos in an address. Labels can stay in caps; sentences and addresses cannot. | yes |
| A.4 | Bill or tracker, after a tap that the server refused. The red alert line shows whatever the server said, word for word. | Server lines reach the screen as they are: `Unknown action.`, `Missing or wrong demo token.`, `The order is not valid.` and 15 more (table L) | None for the customer | rewrite | The app maps every server code to one of the customer lines in table L; the server's words never reach the screen | Rule 3. The customer cannot act on a system word; it only lowers trust. | yes |
| A.5 | Next to every dish name on the menu, the dish sheet, the bill and the tracker: the small green or brown square. | ICON: veg mark (green square, dot) and non-veg mark (brown square, triangle) next to every dish | The one food mark every Indian customer already knows | keep | | It is the FSSAI mark; it needs no label. | yes |
| A.6 | The bar at the bottom of Menu, Orders and You: three icons with their words. | ICON: tab bar, a receipt (Menu), a clock (Orders), a person (You), each with its word | Three places, always visible | keep | | Word plus icon, never icon alone. | yes |
| A.7 | The logo on the pin-code screen and the small pin mark in the menu header. | IMAGE: GoServe lockup and pin mark, day and night versions | Brand on the first screen and in the menu header | keep | | Already the chosen brand. | yes |

## B. Area screen (pin code), the first screen

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| B.1 | First screen, before any pin is saved. Under the logo, a small caps line: the only words that say what GoServe is. | `Hot meals from our kitchen · cash at the door` (kicker, caps) | Answer "what is this?" in one breath: food, from a kitchen, no card | keep | | The three facts a first-time visitor needs. | no. First open: mobile number, OTP, location, the customer's own address; the kitchen stays back-end (story #655). |
| B.2 | Same screen, the card below the logo. The card has a tiny caps head `Pin code`, then a big title, then the field whose own label also says pin code. | `Pin code` (small head) | Names the card | drop | | The field label below says it; two labels for one field is noise. | no. First open: mobile number, OTP, location, the customer's own address; the kitchen stays back-end (story #655). |
| B.3 | The big title of that card, the first question the app asks you. | `Where do we deliver?` (card title) | The question the screen asks | rewrite | `Do we reach you?` | "Where do we deliver" is our question about us. "Do we reach you" is the customer's question. Shorter too. | no. Keep "Where do we reach you?". First open: mobile number, OTP, location, the customer's own address; the kitchen stays back-end (story #655). |
| B.4 | The field under the title: its label and the grey example digits inside the empty box. | `Your pin code` (field label) and `110024` (placeholder) | Tell what to type and how it looks | keep | | A real-looking pin as the example beats "Enter pin". | no. First open: mobile number, OTP, location, the customer's own address; the kitchen stays back-end (story #655). |
| B.5 | You typed 5 digits (or 7) and tapped See the menu. A red line under the field. | `A pin code is six digits.` (error) | Fix a short or long entry | rewrite | `Type all six digits of your pin code.` | Say what to do, not what a pin code is. | no. First open: mobile number, OTP, location, the customer's own address; the kitchen stays back-end (story #655). |
| B.6 | You tapped See the menu with no internet. A red line under the field. | `Could not look up kitchens. Connect and try again.` | No internet | rewrite | `No internet. Check your internet and try again.` | Rule A.2. "Look up kitchens" is our job, not theirs. | yes |
| B.7 | You typed a pin we do not serve and tapped See the menu. A line in the error style under the field. | `Not in {pin} yet. We saved your pin. We will tell you when we come.` | We do not serve this pin | rewrite | `Not in {pin} yet. Try a pin next to yours; we add areas every week.` | "We will tell you" is a promise we cannot keep: we have no phone or email here (rule 5). Merged with B.8. | no. First open: mobile number, OTP, location, the customer's own address; the kitchen stays back-end (story #655). |
| B.8 | Right under B.7, a second, grey note. | `We add pin codes every week. A pin next to yours may work.` (note) | Same as B.7 | drop | | Folded into B.7; two notes for one fact. | no. First open: mobile number, OTP, location, the customer's own address; the kitchen stays back-end (story #655). |
| B.9 | Between the tap and the answer, a grey line under the field. | `Finding your kitchen…` | Wait state | keep | | Short, says what is happening. | yes |
| B.10 | Lines written for this screen when the kitchen is closed; in the app you never see them here because the menu opens instead. | `{name} is closed right now. It opens at {time}.` / `Please try again later.` (Area notes) | Closed kitchen | drop here | | The app moves on to the Menu for a closed kitchen, so these lines never show on this screen. The Menu banner (C.5) does the job. | yes. Keep the Closed sign for now; later maybe deliver from another kitchen and say so openly (ID275). |
| B.11 | The green button under the field. | `See the menu` (button) | The next step | keep | | A verb and the thing they get. | yes |
| B.12 | Bottom of the screen, under the button, a small caps line. | `No app to install · no card needed` (footer kicker) | Remove the two fears of a new app | keep | | Right fears, right place: under the button, before the tap. | yes |

## C. Menu (home)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| C.1 | Menu, top of the page, the big heading. With a saved name it greets you by it. | `Good morning, {name}.` / `Good morning.` (h1, caps) | A greeting that uses the name once we have it | keep | | Warm, short, true to the hour. | yes |
| C.2 | Menu, the line right under the greeting. | `{kitchen} · Open till 10:00 pm` (sub line) | Which kitchen, and how long they have | keep | | Answers "can I still order?" before the scroll. | yes |
| C.3 | Menu header, top left: the small pin mark and the six digits; tapping it goes back to the pin screen. | ICON: pin mark + `110024` (header button, aria "Change area, pin code 110024") | Where the food goes; tap to change | keep | | | yes |
| C.4 | Menu header, top right: the veg square and the funnel, as icon-only buttons. | ICON: veg mark toggle (aria "Veg only") and ICON: funnel (aria "Filter") | Two fast filters | keep | | The veg toggle is the one filter most people use; it earns a header spot. | yes |
| C.5 | Menu, at 10 am when the kitchen opens at 11: a `Closed` stamp and two lines above the dishes; Add buttons are grey. | `Closed` (stamp) + `{name} is closed right now. It opens at 11:00 am.` + `Look at the menu now. Order when it opens.` | Closed kitchen, and what they can still do | keep | | Passed the owner's test T8. Story #619 adds the live change. | yes |
| C.6 | Menu, phone offline but the menu was loaded before: a line above the dishes. | `Showing the saved menu (offline).` | No internet, old menu | story #637 | `No connection. Showing the menu you saw last.` | Already decided. | no. Covered by the offline states (story #637). |
| C.7 | Menu, phone offline and the menu was never loaded on this phone: a red line and no dishes. | `The menu is not available. Connect once to load it.` | No internet, no saved menu | rewrite | `No internet and no saved menu yet. Check your internet; after one load the menu stays on your phone.` | Says why (first time) and the reward (stays on the phone). | no. Covered by the offline states (story #637). |
| C.8 | Menu, after a search word or the veg filter leaves no dish: a title and a line where the dishes were. | `Nothing matches` + `Try another word or clear the filters.` | Empty search | keep | | | yes |
| C.9 | Menu, the first second while the menu loads: grey blocks shaped like the hero and three tiles. | IMAGE: loading skeleton with the word `Mains` inside | Wait state | keep | | Looks like the page that is coming. | yes |
| C.10 | Menu, the big photo section at the top (the thali): the word on the photo and the section's label. | `Today` (tag on the thali photo) and `Today's thali` (section) | The special | keep | | One word, true every day. | yes |
| C.11 | Menu, right side of each dish tile and on the hero: the green Add pill; after a tap it becomes `− 1 +`. | `Add` / stepper `− 2 +` (tiles and hero) | Put a dish on the bill | keep | | Story #608 made the hero match the tiles. | yes |
| C.12 | Menu, each dish tile: under the name, a small grey `Photo: {credit}` line. | `Photo: {credit}` under a dish tile | Credit the photographer | move | Show only in the dish sheet (C.16), not on the tile | A credit on every tile is noise in the scroll; the sheet has room. | yes |
| C.13 | Menu, the bold word above each group of dishes (`Mains`, `Breads`); `Menu` when a dish has no category set. | `{Category}` section titles (`Mains`, `Breads`) and `Menu` when a dish has no category | Group the list | keep | | Ask the kitchen to fill the category so `Menu` never shows. | yes |
| C.14 | Menu, after you add something: a green bar floats above the tabs with the count, the total and `View bill ›`. | `2 items · ₹440` + `View bill ›` (floating bar) | Running total and the way to pay | keep | | "Bill", not "cart": it is how a dhaba talks. | yes |
| C.15 | The sheet that slides up from the funnel: title, dish count, search box, veg switch, the list of sections with counts, Close. | Filter sheet: `Filter`, `12 dishes`, `Search dishes`, `Veg only`, section rows, `Close` | Find a dish | keep | | | yes |
| C.16 | The sheet that slides up when you tap a dish photo: big photo, name, price, a caps line `Veg · Mains`, the credit, `How many` with a stepper, the big Add button, Close. | Dish sheet: name, `₹{price}`, `Veg · Mains`, `Photo: {credit}`, `How many`, stepper, `Add to bill · ₹880`, `Close` | Decide on one dish | rewrite one word | `How many?` | A question mark makes it a question, like the others. The rest stays. | yes |

## D. Bill

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| D.1 | Bill screen (after View bill): the title and the slip's first line. | `Your bill` (title), `{kitchen} · {pin}` (slip head) | Where you are, who cooks, where it goes | keep | | | yes |
| D.2 | Bill when you removed everything: the slip shows a title, a line and a button. | Empty: `Nothing on it yet` + `Add a dish from the menu.` + `See the menu` | Empty bill | keep | | | |
| D.3 | The slip itself: one line per dish with quantity and amount, the Delivery line, the total line. | Slip lines `2 × Dal Makhani … 440`, `Delivery … Free`, total `Cash at door … ₹440` | The bill itself | keep | | "Free" on its own line is the best word on the screen; keep it visible. | |
| D.4 | Under the slip, a ghost button. | `+ Add more` | Back to the menu with the bill kept | keep | | | |
| D.5 | Under the slip, three fields with their labels; the phone label explains why we ask. | `Your name`, `Phone · the rider calls this`, `Address · pin 110024` (field labels) | Why we ask for each | keep | | "The rider calls this" is the reason that makes people type a real number. Do the same for the address if needed: `Address · the rider reads this`. | |
| D.6 | Under the three fields, a grey note. The slip total above already says `Cash at door`, and the bar below says `Cash · ₹440`. | `Pay the rider cash at the door.` (note under the fields) | Payment method | drop | | Said twice already on this screen (slip total `Cash at door`, bar `Cash · ₹440`). Three times reads like we doubt them. | |
| D.7 | The sticky bar at the bottom: amount on the left, the green button on the right. After the tap the button only turns grey. | `Cash · ₹440` + `Place order ›` (sticky bar) | The one button | rewrite while sending | `Placing…` on the button while the order is sent | Today the button only greys out; a customer on slow internet taps again. Same pattern as Feedback `Sending…`. | |
| D.8 | Same bar when a field is empty: the button is grey and nothing says why. | Button greyed with no reason when a name, phone or address is missing | Tell what is missing | rewrite | A small line above the bar: `Add your name, phone and address to place the order.` shown only while a field is empty | A dead button with no reason is the top cause of "the app is stuck". | |

## E. Order placed, tracker, delivered, cancelled (one screen)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| E.1 | The screen after Place order (and later from an order row): the title at the top left, the number or the `Live` dot at the top right. | Titles `Order placed` / `Your order` / `Delivered` / `Cancelled`; `No. 05083667`; `Live` with a dot | State at the top | keep | | | |
| E.2 | The slip's stamp, the slanted word (`Placed`, `Cooking`…). | Stamp `Placed` / `Accepted` / `Cooking` / `Ready` / `On the way` / `Delivered` / `Cancelled` | The state as a stamp | keep | | Same words on Orders rows and in push: one vocabulary. | |
| E.3 | Under the stamp, the clock line. | `About 30 min · door by 20:12` | When | rewrite | `About 30 min · at your door by 8:12 pm` | Rule A.1 (12 h). "At your door" matches step 6 of the progress list. | |
| E.4 | Right under the slip, the first second after placing: one grey line. | `The kitchen has your order. This page updates on its own.` | Calm the first minute: no need to refresh | keep | | The best line on the screen. | |
| E.5 | Under that, the six steps with the current one lit. | Progress list `Placed`, `Accepted`, `Cooking`, `Ready, rider picks up`, `On the way`, `At your door` | The whole journey | keep | | | |
| E.6 | When a rider has the order: a card with the rider's name and a Call link. | `{rider} is bringing your order.` + `Call {rider}` | A person, and a way to reach them | keep | | | |
| E.7 | When the kitchen cancelled: the title says Cancelled and one bold line sits where the progress was. | `Your order was cancelled.` | Cancelled | rewrite | `Your order was cancelled. Nothing to pay.` + button `Order again` | Say the thing they fear (money) and the way back. | |
| E.8 | A few minutes after Ready: a card with a question and two buttons. | `Was your order delivered?` + `Yes, I have it` + `Not yet` | Close the loop | keep | | Plain, and the third `Not yet` opens Feedback: good. | |
| E.9 | After you tapped Yes, I have it (or the rider marked it): a line under the slip. | `Delivered. Thank you for eating with GoServe.` | Thank them | keep | | Rule 4. | |
| E.10 | Glued to the end of E.9, after a dot: the payment and time. | ` Paid: cash · confirmed 7:42 pm` (after E.9) | Receipt | drop | | The slip total already reads `Cash paid · ₹440` and the slip head carries the time. | |
| E.11 | Under the progress list, only if alerts were never asked for: a ghost button. | `Ping me when it is ready` (ghost button) | Ask for alerts at the moment they want one | keep | | Shows only when alerts were never asked; by design (sitting T2). | |
| E.12 | The buttons at the bottom of the tracker, by state. | `Order again`, `Cancel order`, `Call the kitchen` | Next steps | keep | | `Cancel order` only while `Placed`: right. | |
| E.13 | After you tapped Cancel order and the kitchen had already started: a red alert line. | `This order can no longer be cancelled.` | Cancel failed | rewrite | `The kitchen has started, so this order cannot be cancelled now. Call the kitchen if you need to.` | Why, and what to do instead. | |

## F. Orders

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| F.1 | Orders tab: title left, count right. | `Your orders` + `3 orders` | Title and count | keep | | | |
| F.2 | Orders tab with no orders: a title, a line and a button in the middle. | Empty: `No orders yet` + `Your orders show here, newest first. No sign-in needed.` + `See the menu` | Empty list | rewrite | `No orders yet` + `Your orders will show here. No sign-in needed.` + `See the menu` | "Newest first" is noise when there is nothing; the footer says it once there is. | |
| F.3 | Orders tab: each order as a row: number and time, the dishes, kitchen and total, the status tag. | Row: `No. 05083667 · today 19:42`, items, `{kitchen} · ₹440`, status tag | One order | rewrite time | `today 7:42 pm` | Rule A.1. | |
| F.4 | Bottom of the list, a small caps line. | `Newest first` (footer) | Order of the list | keep | | | |

## G. You

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| G.1 | You tab: title left, a caps line right. | `You` + `No account needed` | Title; the promise of the app | keep | | | |
| G.2 | You tab, top, only while an order is open: a strip with the status, the number and an arrow. | Live strip `Cooking · No. 05083667 ›` | Back to the open order from anywhere | keep | | | |
| G.3 | You tab, the card with the saved name, phone, address, pin; `Not saved yet` where empty. | `Delivery details` + `Used on your bill`; labels `Name`, `Phone`, `Address`, `Pin`; `Not saved yet` | What we keep and why | keep | | | |
| G.4 | You tab, the Google button (today it sits over the bottom edge of the card). | `Continue with Google` (button over the card) | Keep orders across phones | story #640 | Row under the card + `Keeps your orders on every phone.` | Boards Y1, Y2. Story #635 fixed the sign-in itself. | |
| G.5 | You tab, the row under the card to edit the details; today the fields change live and a Done row closes them. | `Edit delivery details ›` / `Done ›` | Edit | story #640 | `Save` and `Cancel` inside the card (board Y2) | | |
| G.6 | You tab, the Order alerts row with its switch and its grey sub line. | `Order alerts` + `A ping when it is ready and at your door.` | Alerts switch | keep | | | |
| G.7 | Same row when the phone has blocked notifications: the switch is grey and the sub line changes. | `Blocked in your phone settings. Settings › Notifications › GoServe, then come back.` | Alerts blocked | keep | | Already says the way out (story #609, board U4). | |
| G.8 | You tab, the Look section with two chips. | `Look` + chips `Day` / `Night` | Theme | keep | | | |
| G.9 | You tab, a row with only its title and an arrow. | `Use on another phone ›` | Move orders to a second phone | rewrite | Add a sub line: `Open your orders on a second phone.` | The row name alone does not say what happens on tap. | |
| G.10 | After tapping Use on another phone: one grey line under the rows, by what happened. | `Link copied. Open it on the other phone.` / `Copy this link by hand: {link}` / `Could not make the link. Try again.` | Result of G.9 | keep | | | |
| G.11 | You tab, a row with only its title and an arrow. | `Send feedback ›` | Tell us | rewrite | Add a sub line: `Two lines and a screenshot. We read every note.` | Sets the promise the sent card (#642) keeps. | |
| G.12 | You tab, the last row and the two-button confirm that replaces it. | `Forget me on this phone ›` → `Forget your details on this phone?` + `Yes, forget` / `No` | Leave | keep | | | |
| G.13 | You tab, the very bottom: two small caps links. | `Privacy · Terms` | Legal links | keep | | | |

## H. Feedback sheet

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| H.1 | The sheet that slides up from Send feedback (or after the third Not yet): its title. | `Feedback` (title) | Names the sheet | keep | | | |
| H.2 | The sheet's first box: label and the empty text box. | `What happened?` (text, 300 characters) | The note | keep | | | |
| H.3 | The sheet's dropdown with six choices; `Other` is picked by default. | `What were you doing?` with `Ordering`, `Cooking`, `Delivering`, `Watching ops`, `Installing`, `Other` | Context for us | rewrite | Customer app list: `Ordering`, `Tracking my order`, `Paying the rider`, `Something else` (default `Something else`) | `Cooking`, `Delivering`, `Watching ops` are staff jobs. A customer reading them thinks the form is not for them. | |
| H.4 | The sheet's file row: the label, the Choose File button, and the grey note under it. | `Add a screenshot` + `Take a screenshot with your phone buttons first, then pick it here. It is optional.` | Picture | rewrite | `Add a screenshot (optional)` + `Take one with your phone buttons first, then pick it here.` | "Optional" belongs in the label, where the eye lands first. | |
| H.5 | After you tap Send and it works: a small grey line above the buttons; the sheet stays open; the words clear. | `Thanks, saved.` (small line; sheet stays open) | Confirm and thank | story #642 | Sheet closes; card `Sent. Thank you.` + `The GoServe team reads every note. Yours makes the app better for everyone.` | Board F2. | |
| H.6 | After you tap Send with no internet: the same small grey line, other words. | `Saved on this phone. It will send when you are back online.` | Offline | story #642 | Card `Saved on this phone.` + `It goes to the team the moment you are back online.` | | |
| H.7 | You tapped Send with the text box empty: a red line. | `Please tell us what happened.` (empty words) | Validation | keep | | | |
| H.8 | You picked a very large picture and tapped Send: a red line. | `That picture is too big. Take a new screenshot and try again.` | Picture too big | keep | | | |
| H.9 | Offline, and the phone could not even keep the report: a red line. | `This phone has no room to keep the report. Try again when you are online.` | Storage full | keep | | Rare; honest. | |
| H.10 | The two buttons at the bottom of the sheet; Send changes while it works. | `Send` / `Sending…` / `Close` | Buttons | keep | | | |
| H.11 | The dropdown's small up-down arrow at its right edge, on Night. | ICON: select chevron, black on Night | Open the list | story #636 | | Merged. | |

## I. Push notifications and install

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| I.1 | A phone notification, outside the app, each time the order changes state: title and one line. | Title `GoServe`; bodies `Your order is placed.` / `The kitchen accepted your order.` / `Your order is being cooked.` / `Your order is ready.` / `Your order is on the way.` / `Your order was delivered.` / `Your order was cancelled.` | One line per state | keep | | Same vocabulary as the stamps. | |
| I.2 | The same notification when the app cannot tell which state it is. | `Your order has an update.` (fallback) | When the state is unknown | keep | | | |
| I.3 | A phone notification a few minutes after Ready, outside the app. | `Was your order delivered?` (phone notification) | Close the loop from outside the app | keep | | | |
| I.4 | The install sheet when you add the app to your home screen: the one-line description under the name. | Install description `Hot meals at your door in 25 to 35 minutes.` | The promise on the install sheet | owner's call | | Keep only if the tracker's `About 30 min` is true on most days. A promise on the install sheet is the one they remember. | |
| I.5 | The icon on the home screen. | IMAGE: app icon, the pin with the customer glyph | Home screen | keep | | | |

## J. Privacy and Terms pages

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| J.1 | Privacy and Terms pages, the grey box at the top. | `Test version, 22 October 2026. GoServe is in testing. This page is a simple draft and will be replaced by a lawyer-checked page before the pilot.` | Honest about the stage | keep | | Replace before the pilot, as it says. | |
| J.2 | The Privacy page, all of it, heading by heading. | Privacy: `What GoServe is`, `What we keep` (four bullets), `Google sign-in data`, `Where it is kept`, `What we do not do`, `Your choices`, `Contact` | The whole policy | keep | | Already grade 5, short, true to the code (session number, Google name and email, feedback fields). | |
| J.3 | The last line of both pages. | Contact `klickbae8yt@gmail.com` on both pages | Where to write | owner's call | A GoServe address, or keep this one for the test | A personal Gmail on a legal page reads as a side project. | |
| J.4 | The Terms page, all of it. | Terms: `This is a test`, `Using the app` (three bullets), `No promise`, `Your data`, `Contact` | The terms | keep | | | |
| J.5 | The link at the bottom of both pages. | `Back to GoServe` | Return | keep | | | |

## K. Alerts permission flow

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| K.1 | After you tap the Order alerts switch: the phone's own Allow / Don't allow dialog. | The phone's own permission dialog | Ask | keep | | We cannot change its words. The row G.6 before it and the U-boards after it carry ours. | |
| K.2 | After you allowed, if the alert set-up still fails: the switch just stays off, nothing else. | No text when push set-up fails (`not_set_up`, `failed`): the switch just stays off | Failure | rewrite | Under the switch: `Could not turn alerts on. Try again in a minute.` | Silence after a tap reads as "broken". | |

## L. Error lines (every alert on Bill, tracker, Feedback)

The app maps each server code to one of these lines (rule A.4). The server's own words never show.

| # | Situation | Today (server or app) | When | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| L.1 | Bill, tracker or Feedback: the red alert line for any failure we did not name. | `Something went wrong. Please try again.` | Unknown failure | keep | | Also the line for `Unknown action.`, `Missing or wrong demo token.`, `Unknown event.`, `Unknown status.`, `The event is missing something.`, `Only the customer can confirm.`: none of these are the customer's fault or fixable by them. | |
| L.2 | Same line when the phone has no internet. | `No network. Check your connection and try again.` | No internet | rewrite | `No internet. Check your internet and try again.` | Rule A.2. | |
| L.3 | Same line while ordering is switched off by us. | `Orders are paused. Please try again soon.` | Kill switch | keep | | | |
| L.4 | Bill: you tapped Place order a moment after the kitchen closed. | `The kitchen is closed right now. Please try again later.` | Closed at place time | rewrite | `The kitchen closed just now. It opens at {time}.` (no time known: `The kitchen closed just now. Check back later.`) | Match the menu banner; give the time when we have it. | |
| L.5 | Bill: this phone has already placed the day's limit of orders. | `Too many orders in this demo session.` | Session cap | rewrite | `That is the most orders one phone can place today.` | "Demo session" is our word. | |
| L.6 | Bill: the server rejected the bill's content. | `The order is not valid.` / `The order is missing something.` | Bad request | rewrite | `Something in the bill did not go through. Check it and try again.` | One line, says where to look. | |
| L.7 | Bill: your name, phone or address could not be saved before placing. | `Could not save your details. Try again.` | Profile save failed | keep | | | |
| L.8 | Bill: the app could not start its anonymous session. | `Could not start a session. Check your connection and try again.` | Anonymous sign-in failed | rewrite | `Could not connect. Check your internet and try again.` | Rule A.2; "session" is our word. | |
| L.9 | Tracker: you tapped Yes, I have it and the server refused. | `No such order in this session.` / `The order is not ready yet.` / `That rider is not available.` / `That step is not allowed now.` / `Already done.` / `The status change is missing something.` | `Yes, I have it` failed | rewrite | `Could not mark it delivered. Try again in a minute.` (`Already done.` is a success: show the delivered state, no line) | One line for one tap. | |
| L.10 | Feedback sheet: the server refused the note. | `The report is not valid.` | Feedback refused by the server | rewrite | `Could not send the note. Try again.` | | |
| L.11 | Bill: a developer build without keys (never on your phone). | `The app is not set up: missing Supabase keys.` | A build without keys | keep | | Never reaches a customer on a real build. | |

## M. What to build from this file

After the owner marks the rows: one fix story per screen letter (B to L), each with its board on the Journeys canvas and the exact words above in its test. Rows marked `story #n` stay with that story.
