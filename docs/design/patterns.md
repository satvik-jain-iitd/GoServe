# GoServe pattern catalogue (story #1410)

This page lists the design patterns we use. It also lists the patterns we do not use.
It was written on 13 Nov 2026 from the design learnings up to that day.

The values (colours, type, space) live in `design/tokens.json`. The principles live in `principles-v2.md`.
This page is the one home for patterns. Do not copy a pattern into another file. Link to it.

## How to read this page

- **Use** entries start with a letter and a number, like `F1`. **Do not use** entries start with `X`.
- Entry ids belong to this page. Some look like board codes. Entry `N1` is not the board `N1-NumbersTiles-A.dc.html`. Where an id could be read both ways, the board is named by its full file name.
- Every entry names its source. A line with no source is marked "reviewer's reading, not confirmed".
- When the owner gave a reason, it is quoted. When he gave no reason, the entry says so. It then points to a question in section 16.
- No reason on this page is a guess. If you find one, it is a bug in this page.
- "The owner" decides taste. "Reviewer" means a craft rule from the reviewer session. "Testing" means a rule a test taught us.
- A newer owner call beats an older one. Old calls stay on the page, marked `outdated`, with the date.

### Source tags

| Tag | What it points to |
|---|---|
| `L52` | Learning row 52 of the Design learnings board. Rows are counted from the oldest (`L01`), so a number stays the same when a new row goes on top. Appendix A lists all 75 rows. |
| `row 2at` | A row id in the canvas manifest (`canvas-stages.json`). |
| `note ff-frames` | A sticky note on the design canvas, by its name. |
| `owner rule 15` | The owner's design feedback rules, numbered 1 to 20, in his own rule file (section 1). |
| `#1397` | A GitHub issue of this repo. |
| `talk 8 Nov` | `docs/discussions/2026-11-08.md` (the date names the file). |
| `audit rule 5` | A standing rule in `screen-audit.md`. |
| `LEARNINGS 8 Nov` | A dated row in `docs/LEARNINGS.md`. |
| `UI mistake 21` | A row in `docs/UI_MISTAKES.md`. |

### State words

| Word | Meaning on 13 Nov 2026 |
|---|---|
| on prod | The manifest lists the board in Stage 4, Production. |
| on dev | A merged pull request on `dev` was read in the git log or on the issue. |
| approved, not built | The manifest lists the board in Stage 2. |
| in talk | The manifest lists the board in Stage 1. The owner has not said yes to the frame. |
| not checked | Nobody read the code or the phone for this point. |

Board names are file names on the canvas. Titles are given without the state word, because the state word changes when a board moves.
The canvas cuts long titles, so some titles here are short forms.

What was read for this page is listed in Appendix C.

---

## 1. Words on screens

### W1 · On a one-action screen, the words are the design
- **What:** A screen with one button says something that only GoServe would say.
- **Use when:** The screen has one main action and little else. Sign-in, an empty state, a permission ask, a confirm, an error with one way out.
- **Not when:** The screen is dense and the real question is layout.
- **In the app:** The welcome copy of board `O0g-B-GoogleFirst.dc.html` is on prod (row 5d says a later board replaced its layout).
- **Decided:** The owner, 3 Nov 2026. This is principle 8 in `principles-v2.md`. Read it there.
- **Source:** `note o0-option-a-rejected`, `row 4a`, `LEARNINGS 3 Nov`.

### W2 · Make it better by removing
- **What:** Before a label, a count or a step goes on a screen, ask if the screen is simpler without it.
- **Use when:** Always, before adding text.
- **Keep:** Lines that carry a real fact. A kitchen name. An order number.
- **Boards:** `NC1-WelcomeNoCount.dc.html`, `NC2-SheetNoCount.dc.html`, `NC3-AlertsNoCount.dc.html`, `NC4-LocationNoCount.dc.html` ("... no step count and no Set up line").
- **In the app:** on dev (pull request #1407). Not on prod yet.
- **Decided:** The owner, 13 Nov 2026. His words: "remove it then and all other similar text if any on next few screens".
- **Source:** `L61`, `L66`, `owner rule 14`, `#1404`, `note nc-approved`, `row 2av`.

### W3 · A control carries its label only
- **What:** No line under a button or a tile that says why the button is there.
- **Allowed under a control:** A live state. A count, a time, a distance, a price. Or an error with its way out.
- **Decided:** The owner, 8 Nov 2026, as a canvas comment. The record says he called such lines unnecessary and said they eat space. It is not a quote.
- **Open point:** On 13 Nov he approved one "why we ask" line on two permission screens. See section 17, case 2.
- **Source:** `talk 8 Nov`, `audit rule 5`, `LEARNINGS 8 Nov`.

### W4 · Sentence case
- **What:** Only the first word and proper names start with a capital letter.
- **Kept in capitals:** The typed confirm words (`REMOVE`, `CLEAR`), codes, and UPI.
- **Decided:** The owner, 8 Nov 2026. He also changed boards by hand.
- **Why:** Not written. See Q16.
- **Source:** `audit rule 11`.

### W5 · Time words and clock times
- **What:** Units are `sec`, `min`, `hr`. Never one letter. Never plural. A clock time reads like 6:00 pm.
- **Decided:** The owner. Units on 8 Nov 2026. The record of his reason: a lone letter is not a unit. Clock times on 28 Oct 2026.
- **Source:** `audit rule 7`, `talk 8 Nov`, `note copy-audit`.

### W6 · Phone numbers
- **What:** Ten digits together, with no gap. With the country code, the code, a space, then the ten digits.
- **Decided:** The owner, 8 Nov 2026.
- **Why:** Not written. See Q17.
- **Said again:** The owner, 13 Nov 2026, on boards BF2 and BC1, which the reviewer had drawn with a gap after five digits: "Haan mera decision A hai lekin mobile number me gap nhin hona chahiye 5 digits ke baad jo abhi dikh raha ahi". Both boards are corrected. Read this entry before a board shows a phone number.
- **Source:** `audit rule 6`, `talk 8 Nov`.

### W7 · Payment words stay on the bill
- **What:** No payment words on the welcome, the tagline or the menu.
- **Why (the record of the owner's comment, 8 Nov 2026):** The line would be false once the payment gateway is live, and payment talk belongs on the bill. His words on the tagline: "remove payments entirely from this line".
- **Today:** The customer pays at the door only. Cash, or UPI on the rider's QR (the owner, 10 Nov 2026).
- **Boards:** `P6-BillDoor.dc.html`, `R7-CollectQR.dc.html`, `A10-PayMethods.dc.html`.
- **Source:** `audit rule 9`, `L26`, `row 1q`, `row 3p6`.

### W8 · Never name a thing the app does not know yet
- **What:** The bill says "You pay at the door" until the list of payment methods has loaded.
- **Decided:** Reviewer (craft rule), 10 Nov 2026.
- **Source:** `L25`. The row names #1291.

### W9 · Every error is true for the person who reads it
- **What:** The error names the real case for that customer. The way out sits next to it. The server's own words never reach the screen.
- **Decided:** The owner. Project rule 20 in `CLAUDE.md`, and his copy marks of 28 Oct 2026.
- **Open bug:** #1405. The bill says name and phone are missing when only the phone is.
- **Source:** `note copy-audit`, `UI mistake 15`, `#1405`.

### W10 · Button words say what the button does, on one line
- **What:** The words name the action. They fit on one line inside the button.
- **How to check:** Measure on the smallest phone before the words are picked.
- **Board:** `A1d-LocationRiderWaits.dc.html`. Its buttons read "Use my current location" and "Search for my address".
- **Decided:** One line: testing, 9 Nov 2026. The new words: approved by the owner on 13 Nov 2026 ("yes approved").
- **Source:** `L18`, `note a-frames`, `row 2aq`.

### W11 · Show, do not tell
- **What:** One real example in place of a sentence. The Order alerts screen shows a sample alert under the bell.
- **Board:** `N0c-AlertsChip.dc.html` ("Order alerts fixed: a sample alert drops in under the bell").
- **In the app:** approved, not built. Not checked in the code.
- **Decided:** The owner picked the frame on 13 Nov 2026: "Frame A". The rule line is the reviewer's (craft).
- **Source:** `L42`, `L41`, `note n-frames`, `row 2ap`.

### W12 · A long note needs air
- **What:** Each motto line sits on its own line. A blank line comes before the promise.
- **Use when:** A letter or a long note. Today that is the founder letter.
- **In the app:** `.ui-founder-text`, `.ui-founder-pause`.
- **Decided:** The owner, 9 Nov 2026.
- **Source:** `L09`.

### W13 · The "not in your area" button keeps fixed words
- **What:** The button words feel like talking to the founders. They do not change with the area name.
- **Decided:** The owner, 9 Nov 2026.
- **Source:** `L15`. See also M11 for the letter.

### W14 · Hindi on a screen is in Roman letters, for now
- **What:** Hindi words are written in Roman letters, not in Devanagari.
- **Use when:** Any Hindi line on a screen. The first use is the rider's card at the door.
- **In the app:** not in the app yet. The rider card is in talk (row 3s).
- **Board:** `RS5-RiderSayHindiRoman.dc.html` ("The same card in Hindi, Roman letters: the rider tapped Hindi").
- **Decided:** The owner, 13 Nov 2026. His words: "Hindi should be romanised hindi for now, dont write devnagiri hindi".
- **Why:** Not written. What "for now" waits on is not written either. See Q11.
- **Source:** `L70`, `row 4t`, `row 3s`.

### Do not use: words

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-W1 | A default sign-in screen with words any app could use (board `O0g-A-GoogleOnly.dc.html`) | The owner, 3 Nov 2026, as recorded: it looked basic, like the sign-in most apps have; nothing new; the words around the button did not feel personal. `note o0-option-a-rejected` | W1 |
| X-W2 | A label that stands alone and says nothing ("Set up" on the slip) | The owner, 13 Nov 2026: with the count gone the label "said nothing". `L66` | W2 |
| X-W3 | "No app to install", "no card needed", and any line about what we do not ask for | The owner, 8 Nov 2026, as recorded: it is false, the app goes to the Play Store, and we should not talk about a card at all. `audit rule 8` | Leave the space empty |
| X-W4 | One-letter units ("6 s") | The owner, 8 Nov 2026, as recorded: a lone letter is not a unit. `talk 8 Nov` | W5 |
| X-W5 | Copy the owner did not ask for, or said no to | `UI mistake 14` | Only the words on the board |
| X-W6 | Hindi in Devanagari letters, for now (board `RS3-RiderSayHindi.dc.html`) | The owner, 13 Nov 2026: "dont write devnagiri hindi". The reason behind the call is not written. See Q11. `row 4t`, `L70` | W14 |

---

## 2. Fields and forms

### F1 · A tapped field: its own border turns green
- **What:** The field's border turns the brand colour and goes from 1 px to 2 px. No ring. The field keeps its height. The text does not move.
- **Use when:** Every text field. Search, House, Landmark, the mobile number, text areas, selects.
- **Not when:** Buttons, chips, switches and links. They keep a ring for keyboard users.
- **In the app:** on dev (pull request #1403). `body .ui-field input:focus-visible`, `.ui-search:focus-visible`, `.ui-pin-input:focus-visible`, `.ui-search-box:focus-within` in `app/src/ui/ui.css`. Not on prod yet.
- **Board:** `FF2-FieldBorder.dc.html` ("A field when you tap it: the field's own border turns green, no ring").
- **Decided:** The owner, 13 Nov 2026. He picked FF2.
- **Not checked:** The green border against the white sheet, and the night theme (#1397).
- **Source:** `L52`, `owner rule 15`, `#1397`, `row 2at`, `note ff-frames`.

### F2 · A field has the colour of the sheet it sits on
- **What:** On a white sheet the fields are white. Only the thin border shows.
- **Use when:** A field sits on a sheet or a card.
- **In the app:** on dev (pull request #1399). `.ui-pinmap-details .ui-field input`. Not on prod yet.
- **Not checked:** Other sheets in the app. Issue #1395 covers only the address details sheet.
- **Board:** `C7s-PinDetailsStep3.dc.html` ("Address details on a white sheet with white fields").
- **Decided:** The owner, 13 Nov 2026. His words: "I don't want to keep it cream ... it should be like simple white".
- **Source:** `L50`, `owner rule 15`, `#1395`, `row 2as`, `note c7s-frame`.

### F3 · Example text sits inside the field
- **What:** The example starts with "e.g.". It uses the same font as typed text. It stays the muted colour.
- **Use when:** Every form field that shows an example.
- **In the app:** `.ui-field input.ui-eg` and its placeholder rule. The row says it was built as story #1117.
- **Board:** `C7a-ExampleInside.dc.html`.
- **Decided:** The owner, 9 Nov 2026. His words: "C7a but font thoda sa consistent rakho haina jo actual me type hoga usse".
- **Open bug:** #1406. Fields with no example have a fainter edge than fields with one.
- **Source:** `row 2ag`, `note rej-4j`.

### F4 · The main button is off while a needed field is empty, and a line says why
- **What:** The main button is grey with dark text. One line above it names what is missing. A button that is off gives no feedback at all when touched.
- **In the app:** `.ui-btn:disabled`, `.ui-reason` (story #1170).
- **Board:** `C7s-PinDetailsStep3.dc.html` shows the line and the grey button.
- **Decided:** The owner. The off state on 8 Nov 2026 (screen audit, screen 1). No feedback on touch on 7 Nov 2026.
- **Source:** `audit rule 2`, `talk 7 Nov`, `note c7s-frame`.

### F5 · A code or a PIN is one control
- **What:** One value, shown in boxes. One row, equal widths. Never sized box by box.
- **In the app:** `.otp-boxes`. The phone code flow is on hold (row 3c).
- **Decided:** The owner, 8 Nov 2026. His words: "don't misunderstand a pin as 6 separate digits ever again".
- **Not for:** The postal pin code field. That is one plain input.
- **Source:** `audit rule 14`, `LEARNINGS 8 Nov`.

### F6 · Every field takes its look from `.ui-field`
- **What:** A field is never styled by its wrapper. All fields in one form have one look and one height.
- **Decided:** Testing. The owner saw fields of different heights on 8 Nov 2026.
- **Source:** `UI mistake 21`. Read the checklist in `docs/UI_MISTAKES.md` before any screen change.

### F7 · The bill asks for the phone once, and never the name
- **What:** First order: one phone field, and the label says why. Later orders: the saved phone on one line with Change.
- **State:** in talk. The frames wait for the owner's yes. His calls are already recorded.
- **Boards:** `BF1-BillFirstPhone.dc.html`, `BF2-BillLaterPhone.dc.html`.
- **Decided:** The owner, 13 Nov 2026. His words: "I want to ask the phone number once", "There will be no name field".
- **Why no name field:** Not written. See Q10.
- **What Change opens:** the row turns into the same phone field as on a first order, in place, filled with the saved number. No sheet. Board `BC1-BillChangeInPlace.dc.html` (Approved, row 2bk); not taken: `BC2-BillChangeSheet.dc.html` (row 4ai). The owner, 13 Nov 2026: "Haan mera decision A hai lekin mobile number me gap nhin hona chahiye 5 digits ke baad jo abhi dikh raha ahi". Story #1417.
- **Source:** `L69`, `row 3r`, `note bf-frames`, `row 4s`, `note rej-br-bn`.

### F8 · The clear cross: a small X inside a field clears what was typed
- **What:** When a field holds typed words, one small grey cross sits at the right end, inside the field. A tap empties the field and keeps the keyboard open. With no words there is no cross.
- **Known pattern:** This is the "clear button" of a search field. Phone apps and browsers use the same control. Reviewer's reading, not checked against the platform guides today.
- **Use when:** A search box. First use: the place search on the map and "Search dishes" on the menu.
- **Not when:** Closing a sheet or a screen. A sheet closes by the word Close (S6). A page goes back by the Back arrow.
- **Why a cross and not a word:** a word takes room that the typed letters need. The owner: "clear word inside the field consumes so much space where already we will be writing letters for the search address inside which is why I dont like it that much".
- **Rules:** Only one cross: the browser's own blue cross is hidden. The cross is small and grey, never a big round button. The box never grows. A long line slides left, the end of the words stays in view, and the cross keeps its place and is never covered. The cross has a name for screen readers ("Clear search") and a 44 px touch area.
- **In the app:** not yet. Today the box shows two crosses (issue #1248). The search inputs set no limit on letters.
- **Boards:** `SX1-SearchOneCross.dc.html`, `SX1L-SearchLongLine.dc.html` (Approved, row 2bg). Not taken: `SX2-SearchClearWord.dc.html` (row 4ae).
- **Decided:** The owner, 13 Nov 2026, in chat: "here it is a very small X. I think the X can work in this scenario ... inside a field x can work actually". His reason, in his words: "the earlier X on the modal was very big and was not looking nice, however this one which is inside the field is small and looks good".
- **Source:** `row 2bg`, `row 4ae`, `note sx-acc`, `note sx-rej`, `#1248`.

### F9 · A text field stays one line; a long line slides left
- **What:** A field keeps its height however much is typed. The words slide left, and the end of the words and the caret stay in view. The sheet under it keeps its height.
- **Use when:** Every one-line field on a sheet. First use: the address box "House, street, colony, ward" on Address details.
- **Why:** A box that grows makes the sheet grow, and a taller sheet can break on a small phone. The owner: "B makes the modal get bigger and it does not feel good UX to me because it may result in breaking at some places or some devices with smaller viewport I guess". It fits B7 (a screen that fit must still fit) and S1 (a bottom sheet has no scroll).
- **In the app:** a plain `input type="text"` already does this. The address box takes 120 letters at most on dev today.
- **Boards:** `AD3L1-AddressLongSlide.dc.html` (Approved, row 2bh). Not taken: `AD3L2-AddressLongGrow.dc.html` (row 4af).
- **Decided:** The owner, 13 Nov 2026, in chat: "I like A". The reviewer had leaned to the growing box.
- **Source:** `row 2bh`, `row 4af`, `note ad3l-acc`, `note ad3l-rej`, `#1421`.

### Do not use: fields

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-F1 | A thick ring that stands away from a tapped field (board `FF1-FieldRing.dc.html`) | The owner, 13 Nov 2026: "ye jo fields me green highlight ho raha hai ye normal ni lag raha aisa usually hota nhin hai mobile apps me" (it does not look normal for a phone app). `note rej-4r`, `row 4r` | F1 |
| X-F2 | Cream field boxes on a white sheet | The owner, 13 Nov 2026: he saw the cream as a yellow tint on his phone and called it weird. `L50`, `#1395` | F2 |
| X-F3 | A "For example" line under each empty field (board `C7b-ExampleBelow.dc.html`) | Not known. He picked C7a. See Q7. `note rej-4j`, `row 4j` | F3 |
| X-F4 | A name field on the bill (boards `BN1-BillKnown.dc.html`, `BR1-BillNoPhone.dc.html`, `BR2-BillNoName.dc.html`, `BR3-BillNoNamePhone.dc.html`) | The owner, 13 Nov 2026: "There will be no name field". The reason behind the call is not written. See Q10. `row 4s`, `note rej-br-bn` | F7 |
| X-F5 | A code screen after the bill, for now (board `BN2-BillFirstOrder.dc.html`) | The owner, 13 Nov 2026: "We will integrate the actual SMS integration later ... I want to ask the phone number once". `row 4s` | F7 |
| X-F7 | The word "Clear" inside a search box (board `SX2-SearchClearWord.dc.html`) | The owner, 13 Nov 2026: "clear word inside the field consumes so much space where already we will be writing letters for the search address inside which is why I dont like it that much". `row 4ae`, `note sx-rej`, `#1248` | F8 |
| X-F8 | A field on a sheet that grows taller as the person types (board `AD3L2-AddressLongGrow.dc.html`) | The owner, 13 Nov 2026: "B makes the modal get bigger and it does not feel good UX to me because it may result in breaking at some places or some devices with smaller viewport I guess". `row 4af`, `note ad3l-rej`, `#1421` | F9 |
| X-F6 | A sample value that reads as real data in a field | The owner, 8 Nov 2026, as recorded: a real-looking pin code in the field read as a real value. `talk 8 Nov`, `UI mistake 12` | F3 |

---

## 3. Buttons and step flows

### B1 · The main button is last, in the same place on every step
- **What:** The filled button sits at the bottom. The other choice sits above it. The place is the same on every step.
- **Why (the owner, 9 Nov 2026):** "A person who is unsure taps the lower one, which is the one we want." (the words of `L11`)
- **Use when:** Any flow with steps. Also sheets with a main action.
- **Not when:** Danger and cancel pairs. See S2 and S3.
- **In the app:** `.ui-landing .ui-slip`, `.ui-bottom`, `.ui-push` (story #1133). The dish sheet has Close above and Add to bill last (#1161).
- **Boards:** `O0g-C-GoogleBottom.dc.html`, `N0b-AlertsBottom.dc.html`, `A1c-LocationManual.dc.html`. On prod (row J1).
- **On a working screen too (the owner, 13 Nov 2026):** The buttons tapped most sit at the bottom, and the main one is last. His words on the rider screen: "we should have the primary CTAs at the bottom, the ones that will be clicked most of the times". Board `RX3-RiderMainLast.dc.html` is in talk (row 3v).
- **Source:** `L01`, `L11`, `L74`, `owner rule 8`, `row 1a`, `row 3v`.

### B2 · The second choice is a real outline button
- **What:** An outline button, not a small link. The same pair on every screen.
- **In the app:** `.ui-btn.ghost`.
- **Decided:** The owner, 9 Nov 2026.
- **Why:** Not written. See Q20.
- **Open point:** See section 17, case 1, on one button or two.
- **Source:** `L12`.

### B3 · Buttons of one kind have one height
- **What:** The filled button and the outline button on a step are the same height. On the Order alerts board both are 56 px.
- **In the app:** `.ui-btn.big`, `--gs-tap-big`.
- **Decided:** The owner, 10 Nov 2026. He saw taller second buttons on his phone.
- **Source:** `L35`, `note n-frames`.

### B4 · Hero pictures share one line
- **What:** The hero of each step is centred on one shared line. Measure on the picture's own circle, not on its box.
- **In the app:** `.ui-hero-abs`, `.ui-hero-abs-pic`, `.ui-bellbadge`, `.ui-pinbadge`.
- **Decided:** The owner, 9 Nov 2026.
- **Source:** `L10`, `owner rule 8`.

### B5 · First set-up: next, next, next
- **What:** Each step has one clear main button. A second path that only adds doubt is left out. The old "type it by hand" path is gone.
- **Decided:** The owner, 9 Nov 2026.
- **Open point:** Two buttons still show on approved frames. See section 17, case 1.
- **Source:** `L06`. Issue #1126 asked for the change.

### B6 · No step counts
- **What:** No "Step N of 4" anywhere in the customer app. A title and one big button are enough.
- **Why (the owner's rule, 13 Nov 2026):** "a count that does not match the screens tells the user something false" (`owner rule 14`).
- **In the app:** on dev (pull request #1407). No step count text was found in `app/src` on `dev`. Not on prod yet.
- **Boards:** the four NC boards of W2.
- **Decided:** The owner, 13 Nov 2026. His words: "haan theek h ginti hata do har jagah se A".
- **Not checked:** The kitchen, rider and admin apps. No test with real first-time users.
- **Outdated the same day:** "Step 3 of 4" on the address sheet (`L48`, #1390). The owner said "ok" to it on 13 Nov, then picked no counts.
- **Source:** `L60`, `owner rule 14`, `#1404`, `row 2av`.

### B7 · A screen that fit must still fit
- **What:** A change never adds a scroll to a screen that had none. A new button never adds a scroll.
- **Decided:** The owner, 10 Nov 2026.
- **Source:** `L33`, `owner rule 11`.

### B8 · Never ask twice
- **What:** A thing asked at first open is not asked again later. Alerts are asked at first open. So the order screen has no "Ping me" button.
- **In the app:** on dev (pull request #1347). Prod not checked.
- **Decided:** The owner, 10 Nov 2026.
- **Source:** `L30`, `owner rule 11`, `note pl-frames`.

### B9 · The sign-in button is our own green button
- **What:** Our green main button, with the Google G on a white chip inside it.
- **Board:** `O0g-F-WelcomeChipG.dc.html` ("Welcome fixed: green button, G on a white chip, thali sets itself").
- **In the app:** approved, not built. Not checked in the code.
- **Decided:** The owner, 13 Nov 2026: "I like frame B".
- **Risk, written on the board:** Google's branding page says the G must not sit on a coloured background other than light, dark or neutral. Here it sits on white inside our button. The note says this is told to Google at the brand check.
- **Craft rule (reviewer):** A borrowed logo follows its owner's rules. Read them before you draw the mark.
- **Source:** `L40`, `L39`, `note w-frames`, `row 2ao`.

### B10 · Step screens end 24 px above the edge
- **What:** Every slip ends 24 px above the screen edge, plus the safe area. On a typing step the button rides on top of the keyboard.
- **In the app:** `.ui-landing`, `.ui-welcome` bottom padding. The keyboard part is not checked.
- **Decided:** The owner, 9 Nov 2026.
- **Source:** `owner rule 8`, `note plan-09`.

### Do not use: buttons and steps

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-B1 | A step count ("Step 3 of 4") | See B6. `owner rule 14`, `#1404` | B6 |
| X-B2 | A small link as the second choice | The owner, 9 Nov 2026, picked a real outline button. No reason against the link is written. See Q20. `L12` | B2 |
| X-B3 | A "Ping me" button on the order screen | The owner, 10 Nov 2026: never ask twice. `L30` | B8 |
| X-B4 | Google's own light button on the welcome (board `O0g-E-WelcomeLightG.dc.html`) | Not known. His words: "I like frame B". See Q2. `note rej-4p`, `row 4p` | B9 |
| X-B5 | The main button in the middle of a step screen (boards `O0g-B-GoogleFirst.dc.html`, `A1-LocationAsk.dc.html`) | Replaced on prod by release #1190 on 9 Nov 2026. `row 5d`. See B1 for the reason | B1 |
| X-B6 | A second path "type it by hand" in first set-up | The owner, 9 Nov 2026: it "only adds doubt". `L06` | B5 |
| X-B7 | A rare way out under the main button (the row's example: "Not delivered" on the rider screen) | The owner, 13 Nov 2026: "we should have the primary CTAs at the bottom, the ones that will be clicked most of the times". `L74` | B1 |

---

## 4. Sheets

### S1 · A bottom sheet has no scroll
- **What:** A sheet that slides up opens tall enough to show all it holds.
- **In the app:** `.ui-sheet`, `Sheet` in `app/src/ui/index.tsx`. Not checked sheet by sheet.
- **Decided:** The owner, 9 Nov 2026.
- **Source:** `L05`.

### S2 · The danger sheet
- **What:** One shape for every sheet that destroys something.
  1. A title, a small muted line under it, a round close at the right.
  2. One sentence: what happens, and if it can be undone.
  3. Facts as a two-column table.
  4. The word gate: the person types a word such as `REMOVE`.
  5. The red button first, full width. It sleeps until the word matches.
  6. An outline button to leave.
  7. One last line: what happens after.
- **Use when:** Remove a kitchen. Clear everything. Any later sheet that destroys data.
- **In the app:** `DangerSheet` in `app/src/ui/index.tsx`, classes `.ui-danger-*`. On prod (row 2n).
- **Boards:** `D1-RemoveKitchen.dc.html`, `D2-ClearEverything.dc.html` ("Danger sheet pattern").
- **Decided:** The owner approved on 7 Nov 2026: "new designs for remove kitchen and clear everything look good". He had seen two different sheets for the same job.
- **Open question on the canvas note:** keep the close cross, or is the leave button enough? See Q26.
- **Source:** `note danger-sheet`, `row 2n`.

### S3 · Cancel order asks first
- **What:** Cancel opens a sheet. The sheet says what stops, what you pay, and what comes after. The red button is above. "Keep my order" sits at the bottom.
- **Why (the owner, 11 Nov 2026):** "cancel button galti se na dab jaye isliye liye humen confirmation leni chahiye. I agree ki wo one tap me nhin hona chahiye." (a wrong tap must not cancel; it must not work in one tap)
- **In the app:** on prod since release #1355. `.ui-cancel-rows`.
- **Board:** `CX1-CancelSheet.dc.html` ("Cancel asks first: the danger sheet").
- **Source:** `L28`, `note cx-frames`, `row 1t`, `note rej-4o`.

### S4 · List rows carry no buttons; a tap opens the edit sheet
- **What:** A dish row shows photo, veg mark, name, price and an arrow. A tap opens the Edit sheet. Delete is a quiet red row at the bottom of that sheet. It opens the danger sheet.
- **Use when:** Admin lists that can be edited.
- **In the app:** on prod (row 2o). Classes from story #936.
- **Boards:** `M1-DishRows-B.dc.html`, `M2-DishEdit.dc.html`.
- **Decided:** The owner, 7 Nov 2026: "I like the other one".
- **Source:** `row 2o`, `note dish-edit`.

### S5 · A ticket opens an order sheet; a decline needs a reason
- **What:** The ticket row is a tap target. The sheet shows the order with Accept and Decline. Decline asks for a reason of 20 characters or more. The customer reads the kitchen's own sentence.
- **In the app:** on prod (row 2l).
- **Boards:** `K3-OrderSheet.dc.html`, `K3-OrderDecline.dc.html`, `T2-Declined.dc.html`.
- **Decided:** The owner, 7 Nov 2026.
- **Source:** `row 2l`, `note decline-sheet`.

### S6 · A sheet closes by a small Close link, and the main button is last
- **What:** Every sheet has a small underlined link, "Close", at the top right. There is no round X and no Cancel button. The main (filled) button is the last thing on the sheet, nearest the thumb. A second choice (outline) sits above it.
- **Also closes by:** a tap outside the sheet, and the phone's Back button. An iPhone has no Back button, so the Close link is always there.
- **The one exception:** a danger pair. The safe choice is last and the red button sits above it (S2, S3).
- **Why Close and not Back:** Back already means the arrow on a page that goes to the screen before. A sheet is not a new screen.
- **In the app:** not yet. Story #1419 lists 8 places where the main button is not last and 4 sheets that a tap outside does not close. The Cancel order sheet has the round X today.
- **Boards:** `SC2-SheetCloseLink.dc.html` (Approved, row 2bc). Not taken: `SC1-SheetBackLink.dc.html`, `SC3-SheetHandle.dc.html` (row 4aa).
- **Decided:** The owner, 13 Nov 2026, in chat: "the button that is closer to the thumb should be at the bottom", "the cancel button is at the very bottom. Why would it be there?", "I look at that X and it looks a little negative to me for some reason. Doesn't flow with the design language", then "SC2 sahi hai, SC2 final".
- **Not the same as the clear cross:** the X he dislikes is the big one on a sheet. A small cross inside a field is fine (F8). His words: "the earlier X on the modal was very big and was not looking nice, however this one which is inside the field is small and looks good".
- **Open:** a sheet with typed text must not lose the text without a word when it is closed. Not decided yet.
- **Source:** `row 2bc`, `row 4aa`, `note sc-frames`, issue #1419. This entry changes the "round close at the right" in S2 and S3.

### Do not use: sheets

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-S1 | Cancel in one tap | The owner, 11 Nov 2026. See S3. `L28` | S3 |
| X-S2 | Cancel by tapping twice (board `CX2-CancelTapTwice.dc.html`) | Not known from the owner. He picked CX1. The point "two quick taps in one spot still cancel" is the reviewer's, not his. See Q3. `note rej-4o`, `row 4o` | S3 |
| X-S3 | A switch and a pencil on every dish row (board `M1-DishRows-A.dc.html`) | The owner, 7 Nov 2026: "I dont like the pencil icon version to be honest, it looks bad, I like the other one". `note rej-4c`, `row 4c` | S4 |
| X-S4 | Two different sheets for two destroying actions | The owner saw it on 7 Nov 2026. The pattern is one shape for all. `note danger-sheet` | S2 |
| X-S6 | A big round X that closes a sheet | The owner, 13 Nov 2026: "the earlier X on the modal was very big and was not looking nice, however this one which is inside the field is small and looks good". Earlier the same day: "I look at that X and it looks a little negative to me for some reason". The small cross inside a field is a different control and is fine (F8). `row 2bg`, `row 2bc` | S6 |
| X-S5 | A button inside a button | It is invalid and taps go wrong. `UI mistake 8` | Two siblings |

---

## 5. Slips and paper

### P1 · One slip
- **What:** An order is one slip, from the bill to the tracker. On the first set-up steps the slip runs down to the bottom of the screen, so its height does not jump between steps.
- **In the app:** `.ui-slip`, `.ui-slip-body`, `.ui-landing .ui-slip`.
- **Decided:** "One slip" is principle 2 in `principles-v2.md`. The slip to the bottom is the owner's own canvas edit of 8 Nov 2026.
- **Source:** `screen-audit.md` (the owner's manual canvas edits, round 2).

### P2 · White paper is torn at the top only
- **What:** A white paper panel (a slip, a receipt) has a torn top edge, in the paper's own colour. The bottom is a straight edge. Every tooth is whole. The count of teeth is fixed and they stretch to the panel's width.
- **Use when:** White paper only.
- **In the app:** not in the app yet. Today the slip top is a straight hairline (`.ui-slip::before`, story #1163).
- **Board:** `PL3-PlacedTornTop.dc.html` ("Placed: torn at the top only, no Ping button"). in talk: the frame waits for the owner's yes.
- **Decided:** The owner, 10 Nov 2026. His words: "So the receipt should only be torn from the top, not at the bottom, only at the top."
- **Why top only:** Not written in his words. See Q12.
- **Source:** `L30`, `owner rule 11`, `note pl-frames`, `note rej-4n`, `row 3n`.

### Do not use: slips and paper

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-P1 | The green triangle band (the zigzag), anywhere | The owner, 9 Nov 2026: "zigzag sabhi designs me se hata do... uske upar neeche jo bhi kuchh hai uski position na bigde, even welcome screens me se bhi." His rule of 10 Nov keeps it out. The reason is not written. See Q14. `#1163`, `owner rule 11` | P2 on white paper; nothing elsewhere |
| X-P2 | A slip torn at the bottom (board `PL1-PlacedTornBottom.dc.html`) | The owner, 10 Nov 2026. See P2 for his words. `row 4n`, `note rej-4n` | P2 |
| X-P3 | A slip torn at both ends (board `PL2-PlacedTornBoth.dc.html`) | Same as X-P2. `row 4n`, `note rej-4n` | P2 |
| X-P4 | A tooth cut in half at an edge | The owner, 8 Nov 2026 (screen audit, screen 1). `audit rule 1`, `owner rule 11` | Whole teeth |

The zigzag has a history. It is in section 17, case 4.

---

## 6. Lists, totals, numbers and controls

### N1 · A list and its total agree
- **What:** What is counted is listed. The filter has a Thali row on top, with its count. The rows add up to the total.
- **Use when:** Any list that shows a total or a count.
- **In the app:** on dev (pull request #1408). `.ui-cat-row`, `.ui-count`. Not on prod yet.
- **Board:** `F1t-FilterThali.dc.html` ("Filter with a Thali row on top; the rows add up to the total").
- **Decided:** The owner, 13 Nov 2026. He asked: "thali is a category, should it not show in the filter list?"
- **Source:** `L53`, `owner rule 16`, `#1400`, `row 2au`, `note f1t-frame`.

### N2 · Filters are checkboxes
- **What:** The filter is a sheet with one checkbox per group. More than one can be ticked.
- **In the app:** on prod (row 2r). `.ui-cats`, `.ui-cat-row`.
- **Board:** `F1-Filter.dc.html` ("Filter with checkboxes").
- **Decided:** The owner, 7 Nov 2026.
- **Source:** `talk 7 Nov`, `row 2r`.

### N3 · The delivery time is one big number of minutes
- **What:** One big number of minutes under the stamp. The clock time sits small under it.
- **Use when:** The order screen. One glance must be enough.
- **In the app:** on prod (row J1). `.ui-eta-big`, `.ui-eta-by`.
- **Board:** `E2a-EtaBig.dc.html` ("Order screen: one big number of minutes, the clock time small under it").
- **Decided:** The owner, 8 Nov 2026: "E2A karenge hum."
- **Source:** `row J1`, `note rej-4e`, `note rej-4f`, `talk 8 Nov`.

### N4 · Admin numbers are tiles
- **What:** Today's numbers are four tiles with fixed labels. The numbers count up from 0. Never a loading sentence where a number should be.
- **In the app:** approved, not built. Not checked in the code.
- **Board:** `N1-NumbersTiles-A.dc.html` ("Today's numbers, four tiles, count-up").
- **Decided:** The owner, 8 Nov 2026: "this screen is much. much better bro".
- **Source:** `row 2t`, `note rej-4d`, `UI mistake 11`.

### N5 · You is a page of cards
- **What:** A full page with Back. A lime name card with Edit. Then the rows in white cards, by group. Sign out and Delete sit in their own card at the end, in red.
- **In the app:** on prod (row 2ah). `.ui-you-page`, `.ui-you-card`, `.ui-you-card.lime`, `.ui-you-card.risky`.
- **Board:** `Y4b-YouPageCards.dc.html`.
- **Decided:** The owner, 9 Nov 2026: "I like this screen more than the previous one".
- **Source:** `row 2ah`, `note rej-4k`.

### N6 · The switch
- **What:** Off is a light grey track with a white knob. On is a brand green track with a white knob.
- **Use when:** One thing that is on or off. Veg only. Order alerts.
- **In the app:** on dev since 9 Nov (pull request #1159). `.ui-switch`, `--gs-switch-off`, `--gs-switch-knob`. Prod not checked. The manifest still lists the board in Stage 2.
- **Board:** `SW5a-SwitchGrey.dc.html`.
- **Decided:** The owner picked option A on 9 Nov 2026. He typed no reason.
- **Craft notes:** The switch never shrinks beside a long label. The grey track keeps the owner's colour; a thin inner edge carries the 3:1 contrast.
- **Source:** `row 2ai`, `note rej-4l`, `#1157`, `LEARNINGS 28 Oct`, `LEARNINGS 9 Nov`.

### N7 · The joined bar, for a choice of two or three
- **What:** One bar with two or three joined parts. The chosen part is filled with `--gs-lime-soft`. It is the same kind of control as the veg switch on the menu.
- **Use when:** The person picks one of two or three options that exclude each other. The first use is the language on the rider's card. The second use is "Save as" (Home, Office, Other) on Address details, boards `NC2-SheetNoCount.dc.html` and `AD3-AddressOneBox.dc.html` (story #1422); the owner, 13 Nov 2026: "fix the pill UI ... jo component save kiya tha design system me usko use krlo".
- **In the app:** not in the app yet as a shared part. The closest is the two-part veg switch, `.ui-seg`.
- **Board:** `RS6-RiderSayBar.dc.html` ("Option A for the language switch: one joined bar with three parts, like the app's veg switch").
- **State:** Approved, not built yet (canvas row 2az). Kept for later use: the rider's door card (boards RY3, row 2ay) shows the Mix line only and has no switch for now.
- **Decided:** The owner, 13 Nov 2026, in a canvas comment on the board: "this is better, looks great I want this to be a component I can use in the future also". Later the same day, in chat: "I had created a new kind of component for this which I liked a lot, keep that in design system for future". The pills on the four frames before it (RS1, RS5, RS4, RS2) are rejected: "in these 4 screens i did not like the pill setup" (row 4z).
- **Source:** `L72`, `row 2az`, `row 4u`, `row 4z`, `note rs-switch`. The canvas comment itself: see Appendix C.

### N8 · One switch, one meaning
- **What:** A setting that costs money is one switch, and it is off until someone turns it on.
- **In the app:** on prod since release #1348 (row 1p).
- **Board:** `A14-EarlyFriendSwitch.dc.html` ("Admin: early-friend offer switch, off").
- **Decided:** The owner made the offer a setting on 10 Nov 2026. The rule line is the canvas note's.
- **Source:** `note ef-frame`, `row 1p`.

### N9 · A long saved list shows three rows, then View all
- **What:** The saved addresses sit in one card. Three show. View all opens the rest. After Remove the row goes and an Undo bar stays for 6 sec.
- **In the app:** on prod (row 2y). `.ui-saved-card`, `.ui-view-all`, `.ui-undo-bar`.
- **Boards:** `C10-RemoveUndo.dc.html`, `C12-ListViewAll.dc.html`, `C13-ListExpanded.dc.html`.
- **Decided:** The owner, 8 Nov 2026: "row 3l all yes, I like these a lot" (as the row quotes him).
- **Source:** `row 2y`, `talk 8 Nov`.

### More calls on the app shell (the owner, 7 Nov 2026)

These are one-line calls, as `talk 7 Nov` records them. No reason is written for any of them. See Q19.
Nobody checked them in the app for this page.

| Id | The call, as recorded |
|---|---|
| N10 | No pinch zoom. |
| N11 | The bottom tabs never hide. |
| N12 | A chevron or trailing icon keeps at least 12 px from the right edge. |
| N13 | The app must not turn into a narrow column on rotate (portrait lock, #983). |
| N14 | The location button must not touch the map. |
| N15 | No recent searches in the address sheet. |
| N16 | No greeting sentence on the home screen. |
| N17 | "the Google photo in the circle". |

### Do not use: lists, numbers and controls

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-N1 | A total that counts things the list does not show | The owner, 13 Nov 2026. See N1. `L53` | N1 |
| X-N2 | Three lines of delivery time: a range, a kitchen and ride split, a "Running late" sentence (boards `E1a-EtaRange.dc.html`, `E1b-EtaLate.dc.html`, `E1c-EtaWorking.dc.html`) | The owner, 8 Nov 2026: "i dont like the 3 styles. It is not simple enough to just glance and understand how quickly something is going to arrive. These text looks long and scary and confusing." `note rej-4e`, `row 4e` | N3 |
| X-N3 | The delivery time as a big clock time (board `E2b-EtaClock.dc.html`) | Not known. He picked E2a. See Q6. `note rej-4f`, `row 4f` | N3 |
| X-N4 | Admin numbers as one band (board `N1-NumbersBand-B.dc.html`) | Not known. He praised the tiles and said nothing against the band. See Q5. `note rej-4d`, `row 4d` | N4 |
| X-N5 | You as one plain list with small group labels (board `Y4a-YouPageList.dc.html`) | Not known. He liked the cards more. See Q8. `note rej-4k`, `row 4k` | N5 |
| X-N6 | A switch with an outlined track and a small grey knob (board `SW5b-SwitchOutline.dc.html`) | Not known. He typed no reason. SW5a was the reviewer's pick too. See Q9. `note rej-4l`, `row 4l` | N6 |
| X-N7 | Separate pills for a choice of two or three (the pills on board `RS1-RiderSayFirst3.dc.html`) | The owner, 13 Nov 2026, in a canvas comment: "I dont like this pill like setup, do something better like a simple switch or something or maybe a different kind of switcher for language and message." No other reason is written. `L71`, `note rs-switch` (both hold the first part of these words) | N7 |
| X-N8 | A loading word where a number should be | `UI mistake 11` | N4 |
| X-N9 | A one-tap control that steps through the choices (board `RS7-RiderSayOneTap.dc.html`) | Not known. He praised the joined bar. No word against this one is written. See Q25. `row 4u` | N7 |

---

## 7. Greetings, loading and motion

### G1 · The app greets with Namaste
- **What:** At app open, after the first time: the GoServe logo at the top, the finished thali in the middle, and one word under it, "Namaste". At every hour. No name.
- **Why (the owner, 13 Nov 2026, as `L68` records his words):** It sounds Indian and human, and it fits people who want home-cooked Indian food.
- **Why no name (the owner):** "a name can be very long" (`L45`, `note sp-frames`).
- **Timing (his numbers):** Fade in 0.375 sec. Stay 0.6 sec or more. Fade out about 1 sec. 2 sec in all at the shortest.
- **In the app:** approved, not built. The word was not found in `app/src` on `dev`.
- **Board:** `SP1-ThaliOpen.dc.html` ("App open, every time after the first: the GoServe logo, the finished thali and Namaste fade in and out").
- **Decided:** The owner, 13 Nov 2026: "haan kardo sp1 me Namaste".
- **Not checked:** The word has not been shown to real customers. The real load time on a phone is not measured.
- **Source:** `L68`, `L45`, `#1385`, `row 2ar`, `note sp-frames`.

### G2 · A loading cover leaves when the thing behind it is ready
- **What:** The cover starts its fade out only after the menu has loaded. It does not run on a fixed clock.
- **Decided:** The owner, 13 Nov 2026: "start the fade out once the menu has already loaded behind the scene ... I don't want to show the user a menu which has not loaded properly."
- **Source:** `L46`, `#1385`.

### G3 · Two kinds of wait, two motions
- **What:** The first set-up is slow, so a story plays there (the rider, G4). Every later open is fast, so the logo, the thali and the greeting only fade in and out (G1). The grey waiting screen stays for moves inside the app.
- **In the app:** The grey waiting screen is `Skeleton` in `app/src/ui/index.tsx` (board `S-Loading.dc.html`).
- **Decided:** The owner, 13 Nov 2026.
- **Craft rule (reviewer):** Put the story where the wait really is. Read the code to find the slow moment first.
- **Source:** `L45`, `L43`.

### G4 · The rider on the location screen
- **What:** A rider rides in from the left in a straight line and waits in the centre. His wheels turn. After Save address he rides out to the right while the menu loads. No grey waiting screen on first set-up.
- **In the app:** approved, not built. Not checked in the code.
- **Boards:** `A1d-LocationRiderWaits.dc.html`, `A1e-LocationRiderLeaves.dc.html`.
- **Decided:** The owner, 13 Nov 2026: "yes approved".
- **Open:** What the screen shows when the save or the load fails. The rider drawing is a stand-in.
- **Source:** `L44`, `note a-frames`, `row 2aq`.

### G5 · The sample alert drops in once
- **What:** The sample alert slides down a little and fades in, like a real phone alert. Then it stays.
- **Decided:** The owner, 13 Nov 2026: "add motion graphic for notification fade in effect like it happens on most mobile phones".
- **Board:** `N0c-AlertsChip.dc.html`. approved, not built.
- **Source:** `L42`, `L41`, `note rej-4q`, `note n-frames`.

### G6 · The welcome thali sets itself
- **What:** The plate comes first. Then the dishes, one by one. Then the steam. The steam is three lines, spread wide, that rise together. All parts of one picture share one drawing style: the bowls have the same dark outline as the roti and the rice.
- **In the app:** approved, not built. Not checked in the code.
- **Board:** `O0g-F-WelcomeChipG.dc.html`.
- **Decided:** The owner, 13 Nov 2026.
- **Source:** `L40`, `L56`, `L55`, `note w-frames`.

### G7 · Nothing moves unless the motion was designed
- **What:** A motion that nobody designed is a bug.
- **Decided:** The owner, 10 Nov 2026. On 3 Nov he had said of the flying pin: he wants it nowhere (as `audit-2026-11-04.md` records).
- **In the app:** The pin fly-in on the menu was removed on dev (pull request #1338). Prod not checked.
- **Source:** `L34`.

### G8 · A motion plays once, and not at all for reduce motion
- **What:** In the app each of these motions plays one time. A phone that asks for less motion gets a still picture.
- **Decided:** The owner said "once" for the sample alert on 13 Nov 2026. Reduce motion is principle 4 in `principles-v2.md`.
- **Source:** `L42`, `note w-frames`, `note n-frames`, `note a-frames`.

### Do not use: greetings and motion

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-G1 | A clock greeting ("Good morning", "Good evening") at app open | Replaced by the owner on 13 Nov 2026 with Namaste; "the app needs no clock rule at all". `L68` | G1 |
| X-G2 | The customer's name in the greeting | The owner, 13 Nov 2026: "a name can be very long". `L45` | G1 |
| X-G3 | "Good night" as a greeting | The owner, 7 Nov 2026. The reason is not written. See Q15. `talk 7 Nov`, `L45` | G1 |
| X-G4 | Steam that moves like a snake | The owner, 13 Nov 2026. The row's words: the steam "only says 'home food', it is not a show". `L56` | G6 |
| X-G5 | The pin logo flying in | The owner, 10 Nov 2026: "a bug, not a style". `L34` | G7 |
| X-G6 | A cover that leaves on a fixed clock | The owner, 13 Nov 2026. See G2. `L46` | G2 |
| X-G7 | The grey waiting screen on first set-up | The owner, 13 Nov 2026. The rider covers that wait. `L44` | G4 |
| X-G8 | The Order alerts screen with no sample alert (board `N0d-AlertsPlain.dc.html`) | Not known. His words: "Frame A". See Q1. `note rej-4q`, `row 4q` | W11 |
| X-G9 | A motion that plays again and again in the app | The owner, 13 Nov 2026: it plays once. `L42` | G8 |

---

## 8. Maps and addresses

### M1 · A map is always full screen
- **What:** A map opens full screen from a button or a row. It never sits inside a form or a page.
- **Why (the record of the owner's words, 8 Nov 2026):** An inline map takes half the screen and hides the options.
- **In the app:** on prod (rows 2x, 2y). `.ui-pinmap`.
- **Boards:** `C6-PinMap.dc.html`, `C9-EditOnMap.dc.html`, `A12-KitchenPin.dc.html`, `T5-RiderMapFull.dc.html`.
- **Source:** `talk 8 Nov`, `LEARNINGS 8 Nov`, `row 2x`, `row 2y`.

### M2 · The pin stays in the centre; the map moves
- **What:** The pin is fixed in the middle. The person drags the map under it. This is the same on every screen that sets a place.
- **Not when:** A view-only map, like the rider on the tracker. It has no pin to set.
- **In the app:** `.ui-pinmap-pin`.
- **Decided:** The owner, 8 Nov 2026: "the pin always stays in the centre; when we drag, it moves the map under the pin, not the pin".
- **Source:** `talk 8 Nov`, `LEARNINGS 8 Nov`.

### M3 · One pin colour
- **What:** The location pin is the primary green everywhere. Red is the error colour only.
- **Decided:** The owner, 8 Nov 2026: "use the same colour of pin everywhere".
- **Source:** `talk 8 Nov`.

### M4 · Two marks on one spot must both be seen
- **What:** The phone's own place is a brown dot with a white ring. When the dot and a pin sit on one place, neither hides the other.
- **In the app:** `.gs-here-dot`.
- **Decided:** The owner. The dot on 8 Nov 2026 (not green, he said). Both seen on 9 Nov 2026.
- **Source:** `L19`, `talk 8 Nov`.

### M5 · The kitchen on the map is our small plate mark
- **What:** The plate, fork and spoon from the no-photo dish picture, made very small, with a small tag. Reuse a mark the app already has.
- **Why (the owner, 9 Nov 2026):** The map already has the pin and his brown dot; a third mark must not fight them (`L16`).
- **In the app:** on prod (row 2af). `.gs-kitchen-mark`, `DishPlate` in `app/src/ui/index.tsx`.
- **Board:** `C6e-PinMapPlate.dc.html`.
- **Source:** `L17`, `L16`, `row 2af`, `note rej-4i`.

### M6 · When the owner names a reference app, borrow its layout
- **What:** Copy the positions, the order and the sizes. Change only tokens, fonts and words.
- **Decided:** The owner, 8 Nov 2026: "keep the layout of the buttons exactly like Swiggy ... design system will be ours, colours will be ours, but the layout needs to be borrowed from them".
- **Not when:** No reference app was named. Then our own layout rules hold.
- **Source:** `talk 8 Nov`, `LEARNINGS 8 Nov`.

### M7 · Search lives on the map
- **What:** No extra screen for a thing the map screen already does. Search must not jump to Saved addresses.
- **In the app:** `.ui-pinmap-search`, `.ui-pinmap-results`.
- **Decided:** The owner, 9 Nov 2026.
- **Source:** `L07`.

### M8 · Far from Home: keep Home, offer "Deliver here"
- **What:** On open the header keeps the last chosen address. A strip offers to deliver where the phone is.
- **Why (the owner, 8 Nov 2026):** "I like SW2 it keeps it straight forward, since it keeps the home address as default which happens 90% times and for 10% time when he is outside we can show he is far from home and he can click deliver here."
- **In the app:** on prod (row 2aa). `.ui-farstrip`.
- **Board:** `SW2-HomeKeep.dc.html`.
- **Source:** `row 2aa`, `note rej-4g`.

### M9 · Location off is never a dead end
- **What:** The sheet offers three ways on: turn location on, pick a saved address, or search.
- **In the app:** on prod (row J1a). `.ui-locoff`.
- **Board:** `SW3-LocationOff.dc.html`.
- **Decided:** The owner, 8 Nov 2026: "SW3 bhi acchha hai".
- **Source:** `row 2aa`, `row J1a`.

### M10 · After "use my location", the customer sets the pin on the map
- **What:** The full map comes first. Then the details sheet. The pin is the truth for the rider. The words are the help at the door.
- **Why (the record of the owner's reason, 8 Nov 2026):** The first order must reach the exact door.
- **In the app:** on prod (row J1).
- **Boards:** `A1p-OnboardPin.dc.html`, `C7-PinDetails.dc.html`.
- **Source:** `screen-audit.md` (owner ask, 8 Nov), `row 2m`, `note rej-4b`.

### M11 · "Not in your area" is a warm letter
- **What:** First the place, Change location, and "Tell me when you come here". Then a letter from the co-founder, signed in a handwriting font. The reader is thanked for trusting us early. It is not a dead end.
- **In the app:** on prod (row J1b). `.ui-founder`, `.ui-founder-sign`, `.ui-nkplace`.
- **Boards:** `NK-A-NoKitchenNotify.dc.html`, `NK-L2-FounderNoteHand.dc.html`.
- **Decided:** The owner, 8 and 9 Nov 2026. His words on the sign: "sign ki jagah bhi bas naam likhdo mera abhi handwritten font lagna chahiye".
- **Source:** `L08`, `row J1b`, `note rej-4h`.

### M12 · The pin map says once that the map moves
- **What:** A small dark bubble right above the pin: "Move the map to set the pin". It has a tail that points at the pin.
- **When it shows:** On every use of the pin map, until this person has moved the map once on this phone. Then never again. A move the app makes does not count.
- **Why a bubble at the pin and not a line in the card:** The owner, 13 Nov 2026 (in Roman Hindi): "wo jo ph2 me line likhi thi wo bohot chhoti dikh rhi thi and mujhe lag ni raha tha usko dekhke ki user isko dekhke jaldi inform hoga, blank wali ph1 wali me wo shayad jaldi information miljayegi usko aisa laga". In short: the card line looked very small and would not tell the person quickly; the bubble would.
- **The craft rule:** A hint sits next to the thing it explains, and leaves once it has done its job. A teaching hint shows until the person has done the thing once.
- **In the app:** not yet. Story #1389.
- **Boards:** `PH1-PinHintBubble.dc.html` (Approved, row 2bi). Not taken: `PH2-PinHintCardLine.dc.html` (row 4ag).
- **Decided:** The owner, 13 Nov 2026: "PH1". He said yes ("haan") to the reviewer's rule for when it shows.
- **Source:** `row 2bi`, `row 4ag`, `note ph-acc`, `note ph-rej`, `#1389`.

### Do not use: maps and addresses

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-M1 | A map inside a form or a page | See M1. `talk 8 Nov` | M1 |
| X-M2 | A marker the person drags | See M2. `talk 8 Nov` | M2 |
| X-M3 | A red pin, or pins of different colours | See M3. `talk 8 Nov` | M3 |
| X-M4 | A tooltip on the map ("Move the pin to change location") | The owner, 8 Nov 2026, as recorded: it is not needed. `talk 8 Nov` | Nothing |
| X-M5 | The pin as a chip with no map (board `A2-AddressChip.dc.html`) | The owner, 7 Nov 2026: "5 address frame me A wala not B dont do B", and later "mujhe to pin + map jesa kuchh dikhna chahiye tha". The row title's line "the customer cannot see a wrong pin" is the reviewer's summary. `note rej-4b`, `row 4b` | M10 |
| X-M6 | The header takes the phone's place on open (board `SW1-HomeHere.dc.html`) | See M8 for the owner's words. `note rej-4g`, `row 4g` | M8 |
| X-M7 | The kitchen drawn as a kadhai (board `C6c-PinMapKitchen.dc.html`) | The owner, 9 Nov 2026: "they feel that it is fried and it is unhealthy, I don't want to send that vibe, I want to send something hygienic, something ... tasty". `note rej-4i`, `row 4i` | M5 |
| X-M8 | A new mark in a square box for the kitchen | The owner, 9 Nov 2026: it "was hard to read". `L17` | M5 |
| X-M9 | The founder note signed in DM Mono (board `NK-L1-FounderNote.dc.html`) | The owner asked for a handwritten look (his words in M11). The reason behind it is not written. See Q13. `note rej-4h`, `row 4h` | M11 |
| X-M10 | A forced address page, or a nudge, on every open | The owner, 8 Nov 2026: "practically that will never happen". The record adds: the extra prompt is friction. `talk 8 Nov` | M8 |

---

## 9. Menu and food

### D1 · The veg and non-veg pill
- **What:** The chosen half is filled. The pill's own shape cuts it, so it is D-shaped. No ring. The fill is light green for veg and light red for non-veg, and it follows the swipe.
- **In the app:** on prod (row 2i). `.ui-seg a.on`, `.ui-seg a.nonveg.on`.
- **Boards:** `Menu-DishLine-Tint.dc.html` ("the thali switch tinted veg green and non-veg red"). The options board is `M4-PillOptions.dc.html`.
- **Decided:** The owner. Option A on 28 Oct 2026 (#638). The tint: his ask of 3 Nov, approved 6 Nov 2026 ("yes go ahead").
- **Two dates:** `LEARNINGS 29 Oct` says he chose A on 29 Oct. Issue #638 has his pick stamped 28 Oct. The issue is the first record.
- **Source:** `#638`, `row 2i`, `note frames-6nov`, `note sitting-fixes`.

### D2 · A dish with no photo shows the plate
- **What:** A drawn plate, fork and spoon. Grey when sold out. No words in the box.
- **In the app:** on prod (row 2u). `DishPlate`, `.ui-ph`.
- **Board:** `P1-Placeholder.dc.html`.
- **Decided:** The owner picked option A on 8 Nov 2026.
- **Source:** `row 2u`, `talk 8 Nov`, `UI mistake 13`.

### D3 · A closed kitchen looks closed
- **What:** The menu is greyed. There is no Add and no View bill bar while the kitchen is closed.
- **Why (the owner, 9 Nov 2026):** "kuchh aissa ho ki menu ka bhi colour grey sa dikhe disabled sa" and "jab closed ho kitchen to add button gayab hi ho jaye bro wo dikhe hi na" (the menu should look grey; the Add button should be gone).
- **In the app:** on prod (row J1c). `.closed-grey`, `.ui-closed-note`.
- **Board:** `L4d-ClosedGreyMenu.dc.html`.
- **Source:** `row J1c`, `note rej-4m`.

### D4 · A sold out dish keeps its card
- **What:** The card stays, greyed, with a Sold out stamp in place of Add.
- **In the app:** on prod (row J1c). `.ui-tile.sold`.
- **Board:** `L2-SoldOut.dc.html`.
- **Source:** `row J1c`, `note closed-live`.

### D5 · One stepper for every dish
- **What:** A thali in the cart shows the same minus, count and plus as every other dish.
- **In the app:** `Stepper` in `app/src/ui/index.tsx`, `.ui-step`.
- **Board:** `M2-MenuThaliStep.dc.html`.
- **Decided:** From the owner's phone sitting of 28 Oct 2026.
- **Source:** `note sitting-fixes`.

### D6 · An empty kitchen is not an offline kitchen
- **What:** A kitchen with no dish yet says so. It does not show the no-internet screen.
- **In the app:** on prod (row J1c). `.ui-menu-empty`.
- **Board:** `M7-MenuEmpty.dc.html`.
- **Decided:** The owner approved the frame on 6 Nov 2026: "yes go ahead".
- **Source:** `note frames-6nov`, `row 2i`.

### Do not use: menu and food

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-D1 | A ring around the chosen side of the pill (board `M3-VegPill.dc.html`) | The owner, 28 Oct 2026, as the issue records: the ring was a full round shape on a D-shaped half, and a green ring on the veg side is confusing because green is our brand colour and the veg colour. `#638`, `row 4a` | D1 |
| X-D2 | Pill options B (a green bar under the half) and C (a ring in the text colour), on board `M4-PillOptions.dc.html` | Not known. The issue says only that he picked A. See Q4. `#638`, `row 4a` | D1 |
| X-D3 | A closed menu with a "From 6 pm" label, with Add still on, or with Add greyed (boards `L4a-ClosedLabel.dc.html`, `L4b-ClosedAddLive.dc.html`, `L4c-ClosedAddDisabled.dc.html`) | The owner, 9 Nov 2026. See D3 for his words. The note adds: even a greyed Add looked on to him. `note rej-4m`, `row 4m` | D3 |
| X-D4 | A plain shape as a placeholder | `UI mistake 13` | D2 |
| X-D5 | Dark green placeholder tiles | The owner, 3 Nov 2026: "the shade should not be dark green". The reason is not written. See Q18. `audit-2026-11-04.md` | D2 |

---

## 10. No internet

### O1 · No internet means no app
- **What:** One clear screen: check your network, try again. Never an old saved menu.
- **Why (the owner, 13 Nov 2026):** The saved menu may be out of date (`L47`). His words: "If there is no internet then I don't want to allow the user to use the application ... show that screen which says you have no network, try refreshing." He saw that two big food apps do the same on his own phone.
- **In the app:** The screen exists (the board below). The rule "always, even with a saved menu" is story #1387. Not checked if it is built.
- **Board:** `M6-OfflineEmpty.dc.html` ("No connection and no saved menu: full screen").
- **Source:** `L47`, `#1387`.

### O2 · An order in progress is not blocked
- **What:** The order screen keeps the last known status and the call button. One line says there is no internet and the status may be old.
- **Decided:** Reviewer, 13 Nov 2026, after the owner said "ispe kuchh decision lelo" (you decide). It is to be looked at again.
- **Source:** `#1387` (comment).

### Do not use: no internet

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-O1 | The saved menu with a "No connection" line (board `M5-MenuOffline.dc.html`) | `outdated` on 13 Nov 2026. It was the rule of story #637 (28 Oct). The owner's newer call wins. See O1. `L47`, `#1387`, `note menu-offline` | O1 |

---

## 11. Kitchen, rider and admin screens

### K1 · Each role app is designed from its own user
- **What:** The rider app and the kitchen app are not the customer app. Design for the rider on the road and the cook in the kitchen. Show first what that person needs most.
- **Each screen shows only what its own user needs.** The owner, 13 Nov 2026: "the rider does not need to see all the details that the customer needs to see". Check each detail from that user's side.
- **Boards:** `RX2-RiderFull.dc.html`, `RX3-RiderMainLast.dc.html`. in talk: they wait for the owner's yes (row 3v).
- **Decided:** The owner, 9 Nov and 13 Nov 2026.
- **Source:** `L21`, `L75`, `row 3v`.

### K2 · A new order is a full-width bar
- **What:** A new order shows as one full-width bar, on every tab of the kitchen app.
- **In the app:** on prod since release #1333 (row 1r). `.ui-newbar`.
- **Board:** `K4-NewOrderBar.dc.html`.
- **Source:** `row 1r`, `note upd-19`.

### K3 · A note that can stop harm is a filled band
- **What:** The customer's note (an allergy, for one) is a filled band. Never small. Never cut. It wraps.
- **In the app:** on prod since release #1333 (row 1r). `NoteBand` in `app/src/ui/index.tsx`, `.ui-noteband`.
- **Board:** `K5-NoteBand.dc.html`.
- **Decided:** Reviewer (craft rule), 10 Nov 2026.
- **Source:** `L24`, `row 1r`.

### K4 · Every ticket is one grid
- **What:** Left: the number line and the dish lines. Right: one button, always the same width. So the text column never jumps.
- **In the app:** `.ui-ticket` (two columns, the right one 112 px).
- **Boards:** `K2-Tickets.dc.html`, `K2-Cooking.dc.html`.
- **Decided:** From the owner's phone sitting of 28 Oct 2026.
- **Source:** `note sitting-fixes`, the purpose line of manifest Stage 6.

### K5 · An action lives in the app of the person who owns it
- **What:** Removing a kitchen belongs to the admin, not to the cook. A real kitchen is turned off, never deleted.
- **In the app:** on prod (row 2j).
- **Board:** `A-Kitchen-Remove.dc.html`.
- **Decided:** The owner, 6 Nov 2026: "ye to admin app me hona chahiye na?"
- **Source:** `talk 6 Nov`, `row 2j`, `row 5c`, `note remove-admin`.

### K6 · A new control goes where it leaves room for what comes next
- **What:** The rider's Navigate is a small button beside the address. It is not a full row.
- **Why (the owner, 13 Nov 2026):** "it leaves space at bottom for greeting message also".
- **In the app:** approved, not built (row 2aw). Not checked in the code.
- **Board:** `R6b-NavPill.dc.html` ("Navigate as an outline pill beside the address; the note under the address").
- **In talk:** `R6c-NavGreen.dc.html`. The same button as a filled green round button with an arrow and no word. It is the owner's ask on R6b. It waits for his yes (row 3u).
- **Source:** `L73`, `row 2aw`, `row 4v`, `row 3u`, `#1182`.

### Do not use: staff screens

| Id | What | Why, with source | Use instead |
|---|---|---|---|
| X-K1 | "Remove this kitchen" inside the kitchen app (board `K-Remove-Confirm.dc.html`) | Wrong actor. The owner's pain was on the admin side. `row 5c`, `LEARNINGS 6 Nov` | K5 |
| X-K2 | A ticket grid whose button column changes width | Buttons of different widths made the text column jump. Purpose line of manifest Stage 6 | K4 |
| X-K3 | A small, cut customer note on a ticket | See K3. `L24`, `note upd-14` | K3 |
| X-K4 | Navigate as a full row under Call (board `R6a-NavRow.dc.html`) | The owner, 13 Nov 2026: "R6b because it leaves space at bottom for greeting message also". `row 4v`, `L73` | K6 |
| X-K5 | The light cut of the rider's screen (board `RX1-RiderLight.dc.html`) | Not known. His words: "RX2 seems better than RX1". See Q27. `row 4w` | The full cut, in talk (board `RX2-RiderFull.dc.html`) |

---

## 12. Colour, contrast and theme

The values are in `design/tokens.json`. The story of each colour is in `docs/design-tokens.md`. This section holds only the rules of use that came from feedback.

| Id | Rule | Who and when | Source |
|---|---|---|---|
| C1 | Before any text is placed, look at what sits behind it. Light behind means dark text. Dark behind means light text. Measure 4.5:1 or more. | The owner, 29 Oct 2026 | `owner rule 1`, `UI mistake 5` |
| C2 | Text on a lime or light green box is the ink colour, in Day and in Night. | Story #653, found by a test | `note night-contrast` |
| C3 | Red is the error colour only. The location pin is never red. | The owner on the pin, 8 Nov 2026 | `talk 8 Nov` |
| C4 | A decorative brand mark the owner has chosen is not judged by text contrast rules. | Reviewer's lesson, 27 Oct 2026 | `LEARNINGS 27 Oct` |
| C5 | A quiet state is made with a muted token or an off button. Never by fading text with opacity. | Reviewer's lesson, 29 Oct 2026 | `LEARNINGS 29 Oct` |
| C6 | When a board colour fails the 3:1 rule for shapes, keep the owner's colour and carry the contrast on a thin edge. | Reviewer's lesson, 9 Nov 2026 | `LEARNINGS 9 Nov` |
| C7 | Day is the default at any hour. Night is a pin in You. | The owner, 24 Oct 2026 | `docs/decisions/ADR-019-ink-v3-in-the-app.md` |

The Night lamp is an idea, not built. Read `night-lamp.md`.

---

## 13. Canvas process rules

These rules are about how we work on the design canvas. The generic copy is ShipQuick's `docs/DESIGN_PROCESS.md`.
The kit copy read on 13 Nov 2026 has sections 1 to 10. It does not yet hold the rules of 9 to 13 Nov. Not checked: the newest ShipQuick `dev`.

| Id | Rule | Who and when | Source |
|---|---|---|---|
| V1 | Show two or three frames first. Get the owner's words. Then draw more, two or three at a time. | The owner, 29 Oct 2026 | ShipQuick `DESIGN_PROCESS.md` section 1 |
| V2 | Where a change touches the UI, a board is made and approved by the owner first. Then it is built. | The owner, 8 and 9 Nov 2026 | `L20`, `talk 8 Nov` |
| V3 | A fix changes the board first, in the same story. | Testing, 10 Nov 2026 | `L23` |
| V4 | Every release pull request lists the boards that move to Production. | Testing, 10 Nov 2026 | `L22` |
| V5 | The canvas reads left to right by stage: in talk, approved, on dev, production, rejected, old screens, learnings. | The owner, 9 and 10 Nov 2026 | `L27`, `owner rule 3` |
| V6 | A journey reads left to right as the happy path. An edge, sad or error case is a sister branch. It starts under the step it leaves from. | The owner, 10 Nov 2026 | `L29`, `owner rule 10` |
| V7 | Nothing sits outside its board. A board grows when screens are added. Find the root cause, do not only move the screens. | The owner, 29 Oct 2026; testing, 9 Nov 2026 | `L14`, `owner rule 2` |
| V8 | Notes and labels never overlap. Be generous with space. | The owner, 9 Nov 2026 | `L04` |
| V9 | The QA canvas draws the flow. An arrow goes from each button to the screen it opens. Green when it works, red when it is wrong, with a sticky note for the error. | The owner, 9 Nov 2026 | `L03` |
| V10 | A design gap is called out only when it is real. The change asked for is exact and the reason is strong. | The owner, 9 Nov 2026 | `L02` |
| V11 | A red sticky note lists every change as bullets, with the action under it. The owner approves the note. Then the board is changed. | The owner, 10 Nov 2026 | `L32` |
| V12 | In design QA every screen gets a sticky note with the action to take. One screen at a time. | The owner, 12 Nov 2026 | `L36` |
| V13 | A screen is locked with the owner's yes before the next one starts. The lock is written on the canvas. | The owner, 13 Nov 2026 | `L57` |
| V14 | QA finds are filed as they are seen and fixed later, together, by priority. One epic is one flow. Each find is its own issue. | The owner, 12 Nov 2026 | `L37` |
| V15 | One thing per message. Name one change, the exact board title, its stage and its row. | The owner, 13 Nov 2026 | `L65`, `owner rule 12` |
| V16 | Every case comes with a before and an after picture, side by side. | The owner, 13 Nov 2026 | `L64`, `owner rule 13` |
| V17 | Every rejected board has a sticky note: why it was rejected, in the owner's words, and what was picked. | The owner, 13 Nov 2026 | `L62`, `owner rule 17` |
| V18 | The learnings board keeps the owner's taste apart from the craft rules. Each new frame says which rule it shows. | The owner, 9 Nov 2026 | `L13`, `owner rule 9` |
| V19 | The canvas ends with a table: screen by screen, are design, dev and prod the same, or which one leads. | The owner, 10 Nov 2026 | `L31` |
| V20 | Never change the owner's own canvas edits. His words: "do not change my updates that I have made manually, don't touch my manual updates". | The owner, 8 Nov 2026 | `audit rule 12` |
| V21 | Rejected and old boards keep the words they had. | Reviewer, 8 Nov 2026 | `audit rule 10` |
| V22 | Every frame goes on the one design canvas. Never a second page. | The owner, 8 Nov 2026 | `talk 8 Nov` |
| V23 | Feedback on one screen means: sweep every sibling screen and every role for the same thing. | The owner, 8 Nov 2026 | `talk 8 Nov`, `UI mistake 10` |
| V24 | A new frame starts from the latest approved board. When an options board exists, say which option won. | The owner, 29 Oct 2026 | `owner rule 4`, `LEARNINGS 29 Oct` |
| V25 | A board moves by editing the manifest and running the layout tool. Never by hand. | The owner, 29 Oct 2026 | `owner rule 3`, `LEARNINGS 4 Nov` |
| V26 | One owner of the canvas: the reviewer session. The coder never edits it. Read the live canvas before every publish. | The owner, 29 Oct and 9 Nov 2026 | `owner rule 6`, `owner rule 7` |
| V27 | A final design screen carries no motion notes. It looks exactly like the app. | The owner, 27 Oct 2026 | `docs/owner-principles.md` row 19 |

---

## 14. Testing and release rules

| Id | Rule | Who and when | Source |
|---|---|---|---|
| T1 | A look is measured in a real browser. Focus the thing. Read the computed style and the size. A test that reads CSS as text cannot see which rule wins. | Testing, 13 Nov 2026 | `L67`, `owner rule 19` |
| T2 | The phone's own Back is a test case on every screen. Press Back: the thing on top closes. The owner: "we will test this again and again, wherever the case applies". | Testing, 13 Nov 2026 | `L51`, `owner rule 19` |
| T3 | An issue closes only after the fix is opened on the prod app and looks right. Until then it carries the label `prod-check`. | The owner, 13 Nov 2026 | `L63`, `owner rule 18`, `#1395` |
| T4 | Fixes go to prod together in one release, when the owner says. | The owner, 13 Nov 2026 | `L59`, `owner rule 18` |
| T5 | A price on a board is only a sample. Check the size and place of the price, not the number. | Testing, 13 Nov 2026 | `L58`, `owner rule 20` |
| T6 | A motion is checked frame by frame before the owner sees it. | Testing, 13 Nov 2026 | `L54` |
| T7 | A cold reader's list is cut before it is filed. Only what the code or a live look proves wrong becomes an issue. | Testing, 13 Nov 2026 | `L49` |
| T8 | The design board, the dev app and the prod app must match, in looks and in what each control does. A gap between any two is an issue. | Testing, 12 Nov 2026 | `L38` |
| T9 | When the test of a story is a picture, make the picture. Put the app and the board side by side at one scale and check all four edges. | Reviewer's lessons, 31 Oct and 8 Nov 2026 | `LEARNINGS 31 Oct`, `LEARNINGS 8 Nov` |
| T10 | Before any pull request that touches a screen, read the checklist in `docs/UI_MISTAKES.md`. | The owner asked for the file on 8 Nov 2026 | `docs/UI_MISTAKES.md` |

---

## 15. In talk: not rules yet

Nothing in this section is a rule yet. These frames wait for the owner's yes, or are on hold.
The joined bar on the rider card is not here. The owner picked it. See N7.

| What | Boards | What is recorded | Source |
|---|---|---|---|
| What the rider says at the door, on his own screen | `RS1-RiderSayFirst3.dc.html`, `RS5-RiderSayHindiRoman.dc.html`, `RS4-RiderSayEnglish.dc.html`, `RS2-RiderSayKnown.dc.html` | The owner's idea, 13 Nov 2026. Three languages: "3 hone chahiye and mix default rhe". Hindi is in Roman letters for now (W14). | `row 3s`, `note rs-frames` |
| The bill with one phone field | see F7 | | `row 3r` |
| The placed order, torn at the top | see P2 | | `row 3n` |
| The rider's screen with only what a rider needs | `RX2-RiderFull.dc.html`, `RX3-RiderMainLast.dc.html` | RX3 is RX2 with Delivered as the last button. It waits for his yes. See K1 and B1. | `row 3v` |
| Navigate as a green round button with no word | `R6c-NavGreen.dc.html` | The owner's ask on R6b, 13 Nov 2026. It waits for his yes. See K6. | `row 3u`, `#1182` |
| No kitchen near the pin, with the areas we serve | `NK-B-NoKitchenAreas.dc.html` | The owner took NK-A for now (8 Nov 2026). B stays. | `row 3l` |
| Two admin switches | `A9-Offers.dc.html` | The owner is to say yes or change. | `row 3i` |
| The saved address menu, Add and Edit sheets | `C3-AddressMenu.dc.html`, `C4-AddressAdd.dc.html`, `C5-AddressEdit.dc.html` | The owner picks. | `row 3k` |
| The phone code at checkout | `O1-Number.dc.html` to `O9-Name.dc.html` | On hold until the SMS work (the owner, 3 Nov 2026). | `row 3c` |
| The Sunset theme | `N-Sunset.dc.html` | On hold. | `row 3a` |

---

## 16. Why not known yet: questions for the owner

No reason is guessed here. Each line says what the record holds and what is missing.

### A. A board was rejected, and only the pick is written

| Q | Board (row) | What it is | What he picked | What the record holds |
|---|---|---|---|---|
| Q1 | `N0d-AlertsPlain.dc.html` (4q) | Order alerts with no sample alert | `N0c-AlertsChip.dc.html` | "Frame A". No word against frame B. |
| Q2 | `O0g-E-WelcomeLightG.dc.html` (4p) | Welcome with Google's own light button | `O0g-F-WelcomeChipG.dc.html` | "I like frame B". No word against frame A. |
| Q3 | `CX2-CancelTapTwice.dc.html` (4o) | Cancel by tapping twice | `CX1-CancelSheet.dc.html` | "CX1". The point against two taps is the reviewer's. |
| Q4 | `M4-PillOptions.dc.html` (4a) | Pill options B (a bar under) and C (a ring in the text colour) | Option A, the filled half | The issue says only that he picked A. |
| Q5 | `N1-NumbersBand-B.dc.html` (4d) | Admin numbers as one band | `N1-NumbersTiles-A.dc.html` | He praised the tiles. Nothing against the band. |
| Q6 | `E2b-EtaClock.dc.html` (4f) | The delivery time as a big clock time | `E2a-EtaBig.dc.html` | "E2A karenge hum." No reason. |
| Q7 | `C7b-ExampleBelow.dc.html` (4j) | A "For example" line under each field | `C7a-ExampleInside.dc.html` | He picked C7a and asked for one font. No word against C7b. |
| Q8 | `Y4a-YouPageList.dc.html` (4k) | You as one plain list | `Y4b-YouPageCards.dc.html` | "I like this screen more than the previous one". |
| Q9 | `SW5b-SwitchOutline.dc.html` (4l) | A switch with an outlined track | `SW5a-SwitchGrey.dc.html` | He typed no reason. |
| Q25 | `RS7-RiderSayOneTap.dc.html` (4u) | The language as one word; a tap moves to the next | `RS6-RiderSayBar.dc.html` | He praised RS6. No word against RS7. |
| Q27 | `RX1-RiderLight.dc.html` (4w) | The light cut of the rider's screen | `RX2-RiderFull.dc.html` | "RX2 seems better than RX1". No reason. |

### B. The call is clear, and the reason behind it is not written

| Q | The call | Boards | What the record holds |
|---|---|---|---|
| Q10 | No name field on the bill | `BN1`, `BR1`, `BR2`, `BR3` (4s) | "There will be no name field". The note says the name is asked later, with the feedback. |
| Q11 | The rider card in Roman letters, not Devanagari, "for now" | `RS3` (4t) | His words only. |
| Q12 | The slip is torn at the top only, not at the bottom | `PL1`, `PL2` (4n) | His words in P2. The line "a receipt hangs from where it was torn off the roll" is the reviewer's note, not his. |
| Q13 | The founder's sign in a handwriting font, not DM Mono | `NK-L1` (4h) | His ask in M11. No word against the mono sign. |
| Q14 | No zigzag anywhere, and the green band stays out | none | His words of 9 Nov in X-P1. On 3 Nov he had called the half-hanging zigzag odd. |
| Q15 | The greeting never says "Good night" | none | The call, 7 Nov 2026. |
| Q16 | Sentence case everywhere | none | The call, 8 Nov 2026. |
| Q17 | Phone numbers as ten digits together | none | The call, 8 Nov 2026. |
| Q18 | Placeholder options B (thali) and C (letter) were not taken; no dark green tiles | `P1-Placeholder.dc.html` | He picked A on 8 Nov. "the shade should not be dark green" (3 Nov). |
| Q19 | The app shell calls N10 to N17: no pinch zoom, the bottom tabs never hide, no recent searches, no greeting sentence, and the rest | none | The calls, 7 Nov 2026. One line each, no reason. |
| Q20 | The second choice is an outline button, never a small link | none | The call, 9 Nov 2026 (`L12`). |

### C. Two calls pull apart: which one stands?

| Q | The question | See |
|---|---|---|
| Q21 | Is a set-up step allowed two buttons, or only one? | section 17, case 1 |
| Q22 | Is one "why we ask" line allowed on a permission screen, though lines under controls are not? | section 17, case 2 |
| Q23 | Is the tawa-roti-pin launch motion of 27 Oct dropped, now that app open is the thali and Namaste? | section 17, case 7 |
| Q24 | Does "lime is for small pops only" still hold, with the lime name card on You? | section 17, case 9 |
| Q26 | The danger sheet: keep the close cross, or is the leave button enough? | S2 |

---

## 17. Where two sources disagree

The newest owner call wins. Both sides are shown.

1. **One button or two on a set-up step.**
   `L06` (the owner, 9 Nov 2026): one clear button per step; a second path only adds doubt.
   `L12` (the owner, 9 Nov 2026): the second choice is a real outline button, the same pair on every screen.
   The Location frame approved on 13 Nov 2026 has two buttons (`note a-frames`).
   Reviewer's reading, not confirmed: `L06` removed the "type it by hand" path; a real second choice keeps its outline button. See Q21.
2. **Explanation lines.**
   8 Nov 2026 (the owner): no line under a button or tile that says why it is there (W3).
   13 Nov 2026 (the owner approved the frames): Order alerts and Location each carry one line that says why we ask. Order alerts also says "You can turn this on later in You." above the buttons (`note n-frames`, `note a-frames`).
   Reviewer's reading, not confirmed: the 8 Nov rule is about lines under controls; the 13 Nov lines sit under the title of a permission ask. See Q22.
3. **Step counts.** "Step 3 of 4" (`L48`, the owner's "ok", 13 Nov 2026) and no step counts anywhere (`L60`, the same day, later). The later call wins. `L48` is `outdated`.
4. **The zigzag.**
   27 Oct 2026: the owner had chosen the light sage zigzag on purpose (`LEARNINGS 27 Oct`).
   3 Nov: the half-hanging zigzag looks odd; it should run the full width (`audit-2026-11-04.md`).
   8 Nov: whole triangles from edge to edge (`audit rule 1`).
   9 Nov: no zigzag anywhere (`#1163`).
   10 Nov: white paper is torn at the top, in the paper's own colour; the green band stays out (`owner rule 11`).
   The 10 Nov call wins. The token `zigzag` stays in `design/tokens.json`; no value was changed for this page.
5. **The menu with no internet.** 28 Oct 2026 (story #637): show the saved menu with a line on top. 13 Nov 2026 (the owner): never the saved menu. The 13 Nov call wins (O1).
6. **How long a motion may run.** On 27 Oct 2026 the owner's answer in `motion-framework.md` was about 1 second on every open, and a tap skips it. Principle 4 in `principles-v2.md` says under two seconds. On 13 Nov 2026 the owner approved a thali that sets itself in about 3 sec, and a cover that stays until the menu is ready. The 13 Nov calls win. Principle 4 is marked `outdated in part`.
7. **The launch motion.** `motion-framework.md` (27 Oct 2026) scored 21 ideas. It named the tawa-roti-pin the winner. It marked the thali, the steam and the rider as rejected. Its own next step was "the owner's yes"; no yes is recorded there. On 13 Nov 2026 the owner approved a thali with steam, a rider, and the thali with Namaste at app open. The 13 Nov calls win for those screens. What happens to the tawa-roti-pin is not recorded. See Q23.
8. **The pin code example.** 8 Nov 2026: a greyed row of zeros. Later on 8 Nov: `123456` everywhere (`audit rule 13`). 9 Nov: every example starts with "e.g." (F3). On `dev` the address sheet reads "e.g. 123456". The 9 Nov rule wins.
9. **Lime.** `design/tokens.json` says lime and warm yellow are small pops only. The You page has a lime name card (the owner picked it, 9 Nov 2026). Reviewer's reading, not confirmed: this may bend the rule. The rule in the token file was not changed. See Q24.
10. **Night by the clock.** `note how-blue` says Day and Night follow the clock (locked 24 Oct 2026). `ADR-019` was amended the same day: Day is the default at any hour. The ADR amendment is the later record (C7).
11. **The manifest and the code.** The manifest of 13 Nov lists `FF2`, `C7s`, `NC1` to `NC4`, `F1t` and `SW5a` in Stage 2 (approved, not built). The git log shows their pull requests merged on `dev`. The manifest is behind the code here. This is not an owner disagreement.

---

## Appendix A. The 75 learning rows and where each one landed

The table shows the rows as the board does, newest on top. The numbers count from the oldest row (`L01`) to the newest (`L75`).
So a new row on top gets the next number, and no old number changes.
Kinds: 59 owner, 11 testing, 5 craft.
Rows `L69` to `L75` were added to the manifest on 13 Nov 2026 while this page was being written. The task for this page counted 68 rows.
A row added after the last read (see Appendix C) is not on this page yet.

| Row | Kind | Date | The row, in short | Entry |
|---|---|---|---|---|
| L75 | owner | 13 Nov | Each screen shows only what its own user needs | K1 |
| L74 | owner | 13 Nov | The buttons tapped most sit at the bottom | B1 |
| L73 | owner | 13 Nov | A new control leaves room for what comes next | K6 |
| L72 | owner | 13 Nov | A choice of two or three is one joined bar | N7 |
| L71 | owner | 13 Nov | No row of separate pills for a switch | X-N7 |
| L70 | owner | 13 Nov | Hindi in Roman letters for now | W14 |
| L69 | owner | 13 Nov | The bill asks the phone once, never the name | F7 |
| L68 | owner | 13 Nov | Namaste at every hour | G1 |
| L67 | testing | 13 Nov | Measure a look in a real browser | T1 |
| L66 | owner | 13 Nov | A lone label that says nothing goes | W2 |
| L65 | owner | 13 Nov | One thing per message | V15 |
| L64 | owner | 13 Nov | Before and after pictures | V16 |
| L63 | testing | 13 Nov | Close only after prod looks right | T3 |
| L62 | owner | 13 Nov | Every rejected board has a why note | V17 |
| L61 | owner | 13 Nov | Better by removing | W2 |
| L60 | owner | 13 Nov | No step counts anywhere | B6 |
| L59 | owner | 13 Nov | Fixes go to prod together | T4 |
| L58 | testing | 13 Nov | A price on a board is a sample | T5 |
| L57 | owner | 13 Nov | Design QA one screen at a time, locked | V13 |
| L56 | owner | 13 Nov | Simple steam, three lines | G6 |
| L55 | owner | 13 Nov | One picture, one drawing style | G6 |
| L54 | testing | 13 Nov | Check a motion frame by frame | T6 |
| L53 | owner | 13 Nov | A list and its total agree | N1 |
| L52 | owner | 13 Nov | A tapped field gets a green border | F1 |
| L51 | testing | 13 Nov | The phone's Back is a test case | T2 |
| L50 | owner | 13 Nov | A field has the colour of its sheet | F2 |
| L49 | testing | 13 Nov | Cut the cold reader's list | T7 |
| L48 | owner | 13 Nov | Step 3 of 4 on the address sheet | Appendix A2 (replaced by L60) |
| L47 | owner | 13 Nov | No internet means no app | O1 |
| L46 | owner | 13 Nov | A cover leaves when the thing is ready | G2 |
| L45 | owner | 13 Nov | Two kinds of wait, two motions | G3, G1 |
| L44 | owner | 13 Nov | The rider on the location screen | G4 |
| L43 | craft | 13 Nov | A wait that tells a story | G3 |
| L42 | owner | 13 Nov | A sample alert that drops in once | W11, G5, G8 |
| L41 | craft | 13 Nov | Show, do not tell | W11 |
| L40 | owner | 13 Nov | Our green button with the G chip | B9, G6 |
| L39 | craft | 13 Nov | A borrowed logo follows its owner's rules | B9 |
| L38 | testing | 12 Nov | Board, dev and prod must match | T8 |
| L37 | owner | 12 Nov | Finds filed as seen, fixed together | V14 |
| L36 | owner | 12 Nov | A sticky note with the action per screen | V12 |
| L35 | owner | 10 Nov | Buttons of one kind have one height | B3 |
| L34 | owner | 10 Nov | Nothing moves unless designed | G7 |
| L33 | owner | 10 Nov | A screen that fit must still fit | B7 |
| L32 | owner | 10 Nov | A red note lists every change | V11 |
| L31 | owner | 10 Nov | The stage table at the end | V19 |
| L30 | owner | 10 Nov | White paper torn at the top; never ask twice | P2, B8 |
| L29 | owner | 10 Nov | Journeys with sister branches | V6 |
| L28 | owner | 10 Nov | Cancel order asks first | S3 |
| L27 | owner | 10 Nov | The canvas reads left to right by stage | V5 |
| L26 | owner | 10 Nov | Pay at the door only, for now | W7 |
| L25 | craft | 10 Nov | Never name a thing the app does not know | W8 |
| L24 | craft | 10 Nov | A harm note is a filled band | K3 |
| L23 | testing | 10 Nov | The board changes first | V3 |
| L22 | testing | 10 Nov | Release PRs list the boards that move | V4 |
| L21 | owner | 9 Nov | Role apps from their own user | K1 |
| L20 | owner | 9 Nov | A board is approved before the build | V2 |
| L19 | owner | 9 Nov | Two marks on one spot both seen | M4 |
| L18 | testing | 9 Nov | Button words fit on one line | W10 |
| L17 | owner | 9 Nov | Reuse a mark the app has | M5 |
| L16 | owner | 9 Nov | The kitchen mark is very small | M5 |
| L15 | owner | 9 Nov | Fixed words on the "not in your area" button | W13 |
| L14 | testing | 9 Nov | A board grows; find the root cause | V7 |
| L13 | owner | 9 Nov | His taste kept apart from craft rules | V18 |
| L12 | owner | 9 Nov | The second choice is an outline button | B2 |
| L11 | owner | 9 Nov | Filled button below, other choice above | B1 |
| L10 | owner | 9 Nov | Hero pictures line up by circle centre | B4 |
| L09 | owner | 9 Nov | A long note needs air | W12 |
| L08 | owner | 9 Nov | A warm letter, signed by hand | M11 |
| L07 | owner | 9 Nov | Search lives on the map | M7 |
| L06 | owner | 9 Nov | One clear button per step | B5 |
| L05 | owner | 9 Nov | A bottom sheet has no scroll | S1 |
| L04 | owner | 9 Nov | Notes never overlap | V8 |
| L03 | owner | 9 Nov | The QA canvas draws the flow | V9 |
| L02 | owner | 9 Nov | A gap is called out only when real | V10 |
| L01 | owner | 9 Nov | The main button sits last | B1 |

### Appendix A2. Rows not turned into a pattern, and why

| Row | Why it is not a pattern |
|---|---|
| L48 | It asked for "Step 3 of 4" on the address sheet. The owner replaced it the same day with no step counts anywhere (`L60`). The row itself says so. It is kept in B6 as `outdated`. |

---

## Appendix B. The 34 rejected boards

"Why" says where the reason is. "Owner's words" means the record quotes him. A `Q` number means the reason is not known yet.
Boards 32 to 34 were added to the manifest on 13 Nov 2026 while this page was being written. The task for this page counted 31 boards.

| # | Board | Row | Rejected | Picked in its place | Why | Entry |
|---|---|---|---|---|---|---|
| 1 | `RS3-RiderSayHindi.dc.html` | 4t | 13 Nov | Hindi in Roman letters (RS1) and English (RS4), as the row says | Owner's words (the call); reason behind it: Q11 | X-W6 |
| 2 | `BN2-BillFirstOrder.dc.html` | 4s | 13 Nov | BF1 | Owner's words | X-F5 |
| 3 | `BN1-BillKnown.dc.html` | 4s | 13 Nov | BF2 | Owner's words (the call); reason behind it: Q10 | X-F4 |
| 4 | `BR1-BillNoPhone.dc.html` | 4s | 13 Nov | BF1, BF2 | Owner's words (the call); reason behind it: Q10 | X-F4 |
| 5 | `BR2-BillNoName.dc.html` | 4s | 13 Nov | BF1, BF2 | Owner's words (the call); reason behind it: Q10 | X-F4 |
| 6 | `BR3-BillNoNamePhone.dc.html` | 4s | 13 Nov | BF1, BF2 | Owner's words (the call); reason behind it: Q10 | X-F4 |
| 7 | `FF1-FieldRing.dc.html` | 4r | 13 Nov | FF2 | Owner's words | X-F1 |
| 8 | `N0d-AlertsPlain.dc.html` | 4q | 13 Nov | N0c | Q1 | X-G8 |
| 9 | `O0g-E-WelcomeLightG.dc.html` | 4p | 13 Nov | O0g-F | Q2 | X-B4 |
| 10 | `CX2-CancelTapTwice.dc.html` | 4o | 11 Nov | CX1 | Q3 | X-S2 |
| 11 | `PL1-PlacedTornBottom.dc.html` | 4n | 10 Nov | PL3 | Owner's words (the call); reason behind it: Q12 | X-P2 |
| 12 | `PL2-PlacedTornBoth.dc.html` | 4n | 10 Nov | PL3 | Owner's words (the call); reason behind it: Q12 | X-P3 |
| 13 | `M4-PillOptions.dc.html` | 4a | 28 Oct | Option A | Q4 | X-D2 |
| 14 | `M3-VegPill.dc.html` | 4a | 28 Oct | Option A on `M4-PillOptions.dc.html` | Owner's words, as issue #638 records them | X-D1 |
| 15 | `O0g-A-GoogleOnly.dc.html` | 4a | 3 Nov | O0g-B | Owner's words, as the note records them | X-W1 |
| 16 | `A2-AddressChip.dc.html` | 4b | 7 Nov | A2 option A, the pin on a map | Owner's words | X-M5 |
| 17 | `M1-DishRows-A.dc.html` | 4c | 7 Nov | `M1-DishRows-B.dc.html` | Owner's words | X-S3 |
| 18 | `N1-NumbersBand-B.dc.html` | 4d | 8 Nov | `N1-NumbersTiles-A.dc.html` | Q5 | X-N4 |
| 19 | `E1a-EtaRange.dc.html` | 4e | 8 Nov | E2a | Owner's words | X-N2 |
| 20 | `E1b-EtaLate.dc.html` | 4e | 8 Nov | E2a | Owner's words | X-N2 |
| 21 | `E1c-EtaWorking.dc.html` | 4e | 8 Nov | E2a | Owner's words | X-N2 |
| 22 | `E2b-EtaClock.dc.html` | 4f | 8 Nov | E2a | Q6 | X-N3 |
| 23 | `SW1-HomeHere.dc.html` | 4g | 8 Nov | SW2 | Owner's words | X-M6 |
| 24 | `NK-L1-FounderNote.dc.html` | 4h | 9 Nov | NK-L2 | Owner's words (the ask); reason behind it: Q13 | X-M9 |
| 25 | `C6c-PinMapKitchen.dc.html` | 4i | 9 Nov | C6e | Owner's words | X-M7 |
| 26 | `C7b-ExampleBelow.dc.html` | 4j | 9 Nov | C7a | Q7 | X-F3 |
| 27 | `Y4a-YouPageList.dc.html` | 4k | 9 Nov | Y4b | Q8 | X-N5 |
| 28 | `SW5b-SwitchOutline.dc.html` | 4l | 9 Nov | SW5a | Q9 | X-N6 |
| 29 | `L4a-ClosedLabel.dc.html` | 4m | 9 Nov | L4d | Owner's words (one reason for the three) | X-D3 |
| 30 | `L4b-ClosedAddLive.dc.html` | 4m | 9 Nov | L4d | Owner's words (one reason for the three) | X-D3 |
| 31 | `L4c-ClosedAddDisabled.dc.html` | 4m | 9 Nov | L4d | Owner's words (one reason for the three) | X-D3 |
| 32 | `R6a-NavRow.dc.html` | 4v | 13 Nov | R6b | Owner's words | X-K4 |
| 33 | `RS7-RiderSayOneTap.dc.html` | 4u | 13 Nov | RS6 | Q25 | X-N9 |
| 34 | `RX1-RiderLight.dc.html` | 4w | 13 Nov | RX2 | Q27 | X-K5 |

Count: 23 boards have the owner's words on record. 11 boards have only the pick (Q1 to Q9, Q25 and Q27).
Of the 23, 8 hold a clear call whose deeper reason is not written (Q10 to Q13).

---

## Appendix C. What was read for this page, and what was not

Read on 13 Nov 2026:

- The reviewer's working copy of the canvas manifest, `canvas-stages.json`, read three times, because it grew while this page was written. The first read had 68 learning rows and 31 rejected boards. The second had 73 and 33. The last read, at 11:05 IST on 13 Nov 2026, had 75 and 34. Every row title of every stage was read. A row added after that time is not on this page.
- The copy of the manifest in git (`design/canvas-stages.json`) says `arranged` 2026-11-06 and holds no learning rows, so it is older.
- The live design canvas file `project/canvas.json`, read three times: 106 sticky notes each time; 253, then 255, then 258 board titles. The local working copy of that file was older (27 notes), so the live one was used.
- The three newest rejected boards (`R6a`, `RS7`, `RX1`) had no "why" sticky note on the canvas at the last read. Their words come from the manifest rows 4v, 4u and 4w.
- The owner's design feedback rules 1 to 20 in his own rule file.
- ShipQuick's `docs/DESIGN_PROCESS.md` (the kit copy).
- Issues #1410, #1397, #1404, #1395, #1400, #1385, #1390, #1405, #1406, #1182, #1387, #638, #1163, #1161, #1126, #1157.
- In this repo: `design/README.md`, `design/tokens.json`, every file in `docs/design/` except the two research notes, `docs/UI_MISTAKES.md`, `docs/owner-principles.md`, `docs/design-tokens.md`, `docs/decisions/ADR-019-ink-v3-in-the-app.md`, the discussion files of 4, 6, 7 and 8 Nov, and the design rows of `docs/LEARNINGS.md`.
- On `dev`: `app/src/ui/ui.css`, the exports of `app/src/ui/index.tsx`, `app/src/ui/Styleguide.tsx`, and the last 28 commit subjects.

Given to the writer, not read on the canvas:

- The two canvas comments of 13 Nov 2026 in N7 and X-N7. The reviewer session passed them on. The comments themselves were not read on the canvas.
- The words in N7 were then read in the manifest (`L72`, row 4u). The first part of the words in X-N7 was read in `L71` and in `note rs-switch`. The rest of that quote comes only from the reviewer session.

Not checked:

- No phone and no prod app was opened for this page.
- "on prod" means only that the manifest lists the board in Stage 4. Some row titles there still carry older words such as "not live".
- The class names were read in `ui.css`. Nobody checked that each screen uses them.
- The two research notes in `docs/design/` and the October discussion files were not read for this page.
- The board files themselves were not opened. What a board shows is taken from its title and its notes.

