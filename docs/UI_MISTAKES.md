# UI mistakes we keep making

Owner, 8 Nov 2026: "Why does this issue keep happening?" This file is the answer and the cure.
It lists every UI mistake we made more than once. **Read it fully before any PR that touches a
screen** (`app/src/**/*.tsx`, `app/src/**/*.css`, a canvas board). Then write in the PR body:
`UI mistakes revised: yes` plus the numbers of the checks that apply to the change.
Rule 21 in `CLAUDE.md`. A new UI mistake the owner finds is added here in the same PR that fixes it.

Grade-5 English. One row per mistake. Never delete a row; add a newer one.

## A. Why they keep happening (the four roots)

1. **Fix at one call site, not the shared rule.** Story #923 fixed the iPhone time box only
   inside `.ui-form`; the Edit kitchen sheet used another class and broke the same way (#999).
   Cure: fix the shared CSS rule or the shared component; grep every sibling before the PR.
2. **Pictures only in Chromium.** `screens.spec.ts` runs on the Pixel 7 engine. iPhone Safari
   draws form controls, sheets and the keyboard differently. Cure: every sheet and form screen
   also runs in the `webkit` project; the overflow gate (#999) runs there.
3. **One screen fixed, siblings left.** The owner's feedback on one board (toggle size, photo
   size, zigzag width) was applied only there. Cure: the sibling sweep, every time, without asking.
4. **Tests read words, not layout.** `.ui-tile` meant two things and broke the menu on prod while
   every text test passed (#274). Cure: a layout assert (width, overflow, position) with each fix.

## B. The checklist (run it before every UI PR)

| # | Mistake we made | Where it happened | Check before the PR |
|---|---|---|---|
| 1 | A sheet or page scrolls sideways on an iPhone: a time or date input keeps its own minimum width | #923 Add kitchen; #999 Edit kitchen sheet | Global rule `input[type="time"], input[type="date"] { min-width: 0; appearance: none }`; `.ui-sheet { overflow-x: hidden }`; WebKit overflow gate green |
| 2 | Too little air between fields and rows | #999 Edit kitchen (12 px); #984 Closed banner touching Tell me | Labels keep 16 px above; stacked rows 12 px; a banner and a button never touch (`--gs-space-3` at least) |
| 3 | A sheet leaves a gap at the bottom after the keyboard closes, or does not reach the screen edge | #980 sheets; #954 Remove kitchen sheet | `bindSheetFit` on every sheet; test with focus then blur; sheet bottom = viewport bottom |
| 4 | Landscape shows a narrow centred column | #983 rider app | Landscape query `(orientation: landscape) and (max-height: 520px)` drops the 28rem centring; manifests `orientation: portrait` |
| 5 | Text colour picked without looking at the fill behind it (dark on green, light on cream) | Canvas boards, Pre-register button 1.98:1, `a { color: inherit }` beating a button class | Measure 4.5:1 against the real fill; never let an editor pick the colour; axe after animations end |
| 6 | One CSS class, two meanings | `.ui-tile` menu row and number tile (#274) | Grep `ui.css` for the class before adding; one name, one meaning |
| 7 | Chrome hidden under a 100dvh frame; found by one thumb scroll | #242 | A test scrolls every screen to the end; nothing sits under a board |
| 8 | A button inside a button (invalid, odd taps) | Kitchen ticket row | A tap row with a button is two siblings, never nested |
| 9 | A UI change in code with no board, or a board that lags the code | 27 Oct rule; several stories | Board first (2 or 3 frames, the owner picks), code matches the board, picture lined in the PR |
| 10 | Owner feedback applied to one screen only | C1 toggle 44×24, photo 36 px, zigzag 100 % | Sibling sweep: every screen and every role with the same element, in the same PR |
| 11 | A loading word where a number should be ("Loading…") | #994 admin Orders tab | Skeleton or count-up tiles; never a loading sentence on a numbers screen |
| 12 | A test double shown to a real person as data (grey pin code 110024, fixed OTP) | #969; S4 fixed OTP | Placeholder is greyed `000000` and says it is empty; a double is named in the PR with its repay date |
| 13 | A geometric stand-in as a placeholder ("two rings in a green square") | Dish photo placeholder (#937) | A designed placeholder from a board the owner picked; grey when sold out; no words in the box |
| 14 | Copy the owner did not ask for, or said no to (greeting line, "Good night") | #978 | Only the words on the board; a removed line stays removed everywhere |
| 15 | An error that is false for the person who reads it ("number already used" shown to its owner) | OTP in-use (O7) | The error names the real case for that person and the way out next to it |
| 16 | Icons drawn one by one, different grid and stroke | App icons, action icons (#997) | One grid, one stroke weight, one corner radius; contact sheet first |
| 17 | A picture baseline changed without a board line | Guard fails on #970, #971, #979, #981, #982, #986, #993, #991 | Body carries `Screen changed: <png> | <board> | #story` before CI starts |
| 18 | Axe contrast scan during an animation reads a blended colour | Stamp fade, reveal animations | Wait for `document.getAnimations()` to finish, in the shared helper |
| 19 | Inputs without `box-sizing: border-box` or `min-width: 0` inside a grid or flex row | Sheet inputs, `.ui-two` children | Every input: `box-sizing: border-box; width: 100%; min-width: 0`; grid columns `minmax(0, 1fr)` |
| 20 | A fixed-height or fixed-width box that grows with content on a real phone (long dish name, long address) | Dish rows, address lines | Text boxes wrap (`min-width: 0`, `overflow-wrap: anywhere`); test with the longest real value |

## C. How to use this file

- Before the PR: read A and B. Note the numbers that touch your change.
- In the PR body: `UI mistakes revised: yes · checks 1, 2, 19`. The Guard will fail a UI PR
  without the line (story to add the check: see `docs/follow-ups.md`).
- After the owner finds a UI mistake: fix it at the shared rule, sweep the siblings, add a row
  here, and add a row to `docs/LEARNINGS.md` with the five parts.
