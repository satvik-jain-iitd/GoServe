# Screen audit, one board at a time (started 8 Nov 2026)

The owner asked for this on 8 Nov 2026: review every board on the design canvas, one at a time, in canvas order.
For each board: what the reviewer saw, what the owner saw, what we decided, what changed on the board, what changes in the code.
Nothing moves to the next board until the board fix is published. The code fix gets a story or joins an open one.
This file is the memory of every comment. Read it before touching any board. It goes to `docs/design/screen-audit.md` in the next docs PR.

## Standing rules learned in this audit (apply to every board and every screen)
1. **Zigzag:** the zigzag is a row of whole light-green triangles. It starts with a full triangle at the left edge and ends with a full triangle at the right edge. No half triangle at either end. (Owner, screen 1.)
2. **A button's state matches the data on the board.** An empty required field means the main button is drawn disabled (grey). (Owner, screen 1.)
3. **The live state goes in Production.** A board that shows what the live app shows today sits in Production with state LIVE. A variant behind a switch that is off sits next to it and says so. (Owner rule 3, repeated on screen 1.)
4. **Board titles are short and whole.** No title is cut off in the middle of a word or sentence. (Owner, screen 1.)
5. **No explanation lines.** A control carries its label only. A line under it only for live state (count, time, distance, price) or an error with its way out. (Owner, 8 Nov.)
6. **Phone numbers:** 10 digits together, `9876543210`; with the code, `+91 9876543210`. (Owner, 8 Nov.)
9. **No payment words outside the bill.** The welcome tagline is "Hot meals from our kitchen, delivered to your door". (Owner, screen 2.)
10. **History boards are never edited.** REJECTED and OLD boards keep the words they had. (Reviewer, screen 2.)
8. **No false or negative promises.** Never write "No app to install" (the app goes to the Play Store) or "no card needed". Never tell people what we do not ask for. No replacement line; the space stays empty. (Owner, screen 2.)
7. **Time units:** `sec`, `min`, `hr`. Never one letter, never plural. (Owner, 8 Nov.)

## Screen 1: `LIVE · O0 · First open with the phone-code switch ON (admin panel): number first, Google under it. Switch is OFF today,`
Production, row 1a, first board. Compared with the dev app's CI pictures `welcome-phone.png` and `welcome.png`.

| # | Who saw it | What was wrong | Decision | Board | Code |
|---|---|---|---|---|---|
| 1 | Reviewer | The number field is empty, but "Send code" is drawn green and active. In the app it is grey until 10 digits are typed. | Draw it disabled. | Fixed | Already right |
| 2 | Reviewer | The live app has the phone-code switch OFF, so customers see the Google-first screen (board O0g-B). That board sat in Section 2 as ON STAGING, and its own title said "as it is live today". | O0g-B moves to Production row 1a, first, state LIVE. O0 follows it and says "switch ON". | Fixed | No change |
| 3 | Reviewer | The app still shows three explanation lines: "Your mobile number, then a 6 digit code…", "No password, no code to wait for.", "We ask for your mobile number on the bill…". | Remove them in the code. | Already removed | Story #1044 |
| 4 | Reviewer | Both board titles are cut off in the middle ("Switch is OFF today,", "switch O"). | Short, whole titles. | Fixed | No change |
| 5 | Owner | The zigzag cuts a triangle in half at the left edge and the right edge. | Whole triangles from edge to edge, on every zigzag: the brand mark and the top of every slip. | Fixed in the board stylesheet (canvas v247) | Story #1046 |

Owner on points 1 to 4: "whatever feedback you have given for this screen are 100% correct".

**Done on the board, canvas v247:** "Send code" drawn disabled; O0g-B moved to Production row 1a, first, state LIVE, title "First open: Google only (phone-code switch OFF, as live today)"; O0 title "First open: number, then Google (phone-code switch ON)"; the empty row 2f removed; zigzag rewritten as whole triangles in the board stylesheet (it fixes every board). Rendered and checked at the left and right edges.
**Code:** zigzag story #1046; the three explanation lines are in #1044.
**Status:** screen 1 closed on the board. Next: screen 2.

## Screen 2: `LIVE · O0g-B · First open: Google only (phone-code switch OFF, as live today)`
Production, row 1a, first board (moved there on screen 1). Compared with the dev app's CI picture `welcome.png`.

| # | Who saw it | What was wrong | Decision | Board | Code |
|---|---|---|---|---|---|
| 1 | Reviewer | The app shows "No password, no code to wait for." and "We ask for your mobile number on the bill, so the rider can call you." The board does not. | Remove in the code. | Already removed | #1044 |
| 2 | Reviewer | The app's zigzag is cut at both ends. | Same fix as screen 1. | Fixed (v247) | #1046 |
| 3 | Owner (comment on O0, applies to every welcome board) | "No app to install · no card needed" is false: the app goes to the Play Store, and we should not talk about a card at all. | Remove it, no replacement. Removed from O0, O0b, O0g-B. | Fixed (v248) | #1044 (three places in the code, guard test) |
| 4 | Reviewer, open | The logo could not be checked from the local render. | Owner to check on the canvas. | Open | |

Seen for later, not fixed now (one board at a time): the story boards S1 and S2 make the same false claims ("No app to install. No card.", "No card, no wallet, no sign in", "UPI comes later"). They get fixed when the walk reaches them.

### Owner comment on O0 (also screens 1 and 2): the tagline
"Hot meals from our kitchen · cash at the door" will be false once the payment gateway goes live, and payment talk belongs on the bill. Reviewer's options: A "Home kitchens near you", B "Food like home, hot at your door" (reviewer's pick), C no tagline. **Owner picked:** "Hot meals from our kitchen, delivered to your door" ("remove payments entirely from this line"). Done on O0, O0b, O0g-B (canvas v250) with `text-wrap: balance` so it breaks evenly on a phone. Rejected and old boards keep their history (rule: never edit history boards). Code: #1044.

### Tagline v2 (owner, 8 Nov, canvas comment)
- Final line: "Hot meals from our kitchen in 20 mins". Sentence case, one line. Uppercase style removed on this line. Done on O0, O0b, O0g-B (v251). Code: #1044.
- Standing rule 11 (owner): sentence case everywhere. First word and proper nouns capital only. Open question: does it also cover the all-caps labels and headings (WELCOME, STEP 1 OF 3, WHERE DO WE REACH YOU?)?
- Update (v263): the canvas now reads "Hot meals from our kitchen for you in 20 mins" (edited on the canvas page, also on A1). Kept.
- Standing rule 11 settled (owner comments on "Mobile" and the heading): sentence case everywhere. Done v263: uppercase removed from ink.css and inline styles on 98 live/design boards; "VEG" to "Veg", lone lowercase labels capitalised ("Or"). Kept: REMOVE and CLEAR (typed confirm words), LATE-AB12CD34 (code), UPI. Code: #1044 with a guard test.
- Noticed: the canvas page save cut long board titles at about 120 characters. Rule 4 (short, whole titles) fixes these screen by screen.

## Owner's manual canvas edits, 8 Nov (learned, never overwrite)
Read from the live canvas (version 1794133681) and diffed against the reviewer copy. Local copy synced to it.
1. Sentence case on all messages. Owner did this by hand too; matches the v263 change (uppercase removed).
2. Tagline is "Hot meals from our kitchen for you in 20 mins". One line, `white-space: nowrap`.
3. Tagline shows on every onboarding screen, not only Welcome. It sits inside the `<header>`, under the zigzag. Done by owner on O0, O0b, O0g-B, A1-LocationAsk, A2-AddressFound.
4. The slip (the card with the 6 digit code, "Where does the food go?", the address form) keeps one size on every onboarding screen, so the layout does not jump between steps. Owner set A1-LocationAsk slip to `height: 299px` and A2-AddressFound textarea to `height: 37px`.
5. Admin, kitchen and rider sign-in screens keep their own line ("Admin · the city in one hand"); not changed by owner.
Rules for the reviewer:
- Before any publish, read the live canvas and merge onto it. The publish tool refuses stale copies; never force.
- Never touch the tagline position, the tagline text or a slip height the owner set.
- Code (#1044): tagline on every onboarding step inside the header, one line; slip one fixed height across steps.

### Standing rule 12 (owner, 8 Nov, repeated twice): never change the owner's manual canvas edits
- The owner's hand edits are final. The reviewer never edits, moves or "fixes" them, even to match a pattern.
- Before any publish: read the live file, diff, publish only the reviewer's own change on top. Publish one file at a time with `edits` where possible.
- To extend his pattern to other boards, ask first; never apply on assumption.

## Owner's manual canvas edits, round 2 (8 Nov, read from live version 1794135363; never overwrite)
1. Headings centred (`text-align: center`) on O0, O0b, O0g-B, A1, A2, A3.
2. The slip runs down to the bottom of the screen on every onboarding board: O0 642px, O0b 622px, O0g-B 615px, A1 622px, A2 617px, A3 634px, S-NoKitchen 625px. (A1 was 299px in round 1. A2 textarea fixed height removed again.)
3. A1 has a new line under the heading: "We have multiple kitchens with hygienic homely food".
4. Tagline added on A3 and S-NoKitchen. S-NoKitchen logo now uses the lockup class. S-NoKitchen "Track an order" button removed.
5. A3 pin placeholder is "123456".
6. O0g-B: an image pasted into the slip; the Google button placed absolutely (work in progress, left as is).
7. canvas.json: owner added an image piece "Piece-aqj3".
Code (#1044): centred headings, slip to the bottom on every onboarding step, A1 line, S-NoKitchen without Track an order.

## Owner ask, 8 Nov: pin step in first-time onboarding
- After "Use my location" and the permission, show the full pin map first, then the next step. Reason (owner): the first order must reach the exact door; first impression matters.
- Frame drawn: IN TALK · A1p (row 3l), the same map screen as C6 (pin fixed in the centre, map moves). Back goes to A1, Confirm goes to A2. Waiting for the owner's view.

## Owner ask, 8 Nov: redesign S-NoKitchen ("No kitchen for this pin")
- Mistakes on the old board: it asks for a pin code by hand (the address flow is pin-on-map now); "Cash only" in the slip head (payment words outside the bill, rule 9); the error line under a big red field; the only way out is a disabled button.
- Two frames in row 3l, both on the owner's onboarding pattern (logo, zigzag, tagline, slip to the bottom, centred heading): NK-A the place + Change location + "Tell me when you come here"; NK-B the place + the areas we deliver in (chips) + Change location. Waiting for the owner to pick.

## Owner's manual canvas edits, round 3 (8 Nov, read from live version 1794137038; never overwrite)
1. The small zigzag under the greeting ("Open till 10:00 pm") is removed on Menu, M2-MenuThaliStep, S-Closed and S-Loading. The greeting stands alone.
Code (#1044): remove the `.ui-greet .ui-zigzag` mark. Note: the #1048 test S1 reads that mark; the coder moves S1 to the slip teeth or the welcome mark.
- Standing rule 13 (owner, 8 Nov): the pin code placeholder is "123456" everywhere. Boards A2-AddressOla and C4-AddressAdd changed (v378, v379); A3 already had it. Code: #1011 folded into #1044.
- Owner, 8 Nov: keep all manual edits; build the screens to them. #1044 carries every edit to code.

## Screen 3 · O0b-Code (First open, the code) · 8 Nov 2026
Board rendered from the live canvas; app read from origin/dev `OtpSheet.tsx` (no CI picture of this sheet).
| # | Mistake | Rule | Board fix | Code fix | Status |
|---|---|---|---|---|---|
| 1 | "Resend code in 0:30" | Rule 7: sec, min, hr | "Resend code in 30 sec" | OtpSheet.tsx:146 | done v395, code #1044 |
| 2 | The six boxes do not fill the slip: a gap on the right | Alignment | Six boxes in a 6-column grid, 8 px gaps, same width as the button, height 56 px (v397) | same in OtpSheet | done v397, code #1044 |
| 3 | "Change number" is bold and underlined; C7 "Change" is primary green, no underline | One link style | Primary green, no underline | ui-link style | done v395, code #1044 |
| 4 | App sheet still says "Step 1 of 3", the old tagline, "No app to install" | Owner edits | done on board | #1044 | in #1044 |
| 5 | The code is fixed to 123456 (#655): a test double a real customer meets | Rule 20 | none | SMS provider story | known loan, owner's call |
| 6 | Swish offers resend by SMS and WhatsApp | Swish study | none now | after the SMS provider | idea, later |

- Audit paused after screen 3 (owner, 8 Nov): first finish the build of everything approved so far, owner reviews, then freeze. Next screen when the audit resumes: row 1a after O0b.
- Standing rule 14 (owner, 8 Nov): a code/PIN is one value shown in boxes; the box row is one control (one row, equal widths, never sized box by box).
