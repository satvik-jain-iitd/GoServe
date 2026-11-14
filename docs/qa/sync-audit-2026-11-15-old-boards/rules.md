# The owner's design rules as a checklist (sync check, 15 Nov 2026)

Source: `~/.claude/CLAUDE.md`, section 1, "Design feedback rules" 1 to 23, plus the project rules that touch a screen.
"Script" means a script can check it on a rendered page. "Eye" means a person must look. "Process" means it is about how we work, not about one screen.
The checks that exist are in `analyze.py`; they run on the facts that `sync-j1.spec.ts` measures in the real page.

| Rule | In short | How it is checked | Check id |
|---|---|---|---|
| 1 | Text against what is behind it: 4.5 to 1 or more (3 to 1 for big text) | Script: every text and every grey sample text in a field, colour against the fill behind it. Text over a photo: Eye | contrast |
| 2 | Nothing sits outside its board; text boxes never meet | Script: no sideways scroll, no text box past the screen edge, no cut text. Two boxes that meet: Eye (script later) | inside |
| 3 | The canvas is organised by stage; layout from a manifest | Script, on the canvas only (`canvas_stage.py` check). Not a screen rule | - |
| 4 | A new frame starts from the latest approved board | Process | - |
| 5 | Chat never cites a canvas version number | Process | - |
| 6 | One owner of the canvas (the reviewer) | Process | - |
| 7 | Publish from the canvas, then check the file listing | Script, on the canvas only (listing check) | - |
| 8a | The main filled button is last, the outline one above it | Script: among the big buttons of the active layer, the filled one is the lowest | filled-last |
| 8b | The filled button is in the same place on every step of a flow | Script: the same top edge on the first-open steps | same-place |
| 8c | The hero is centred on one line shared by every step | Script where the hero has a known box (alerts, location); Welcome's thali: Eye | hero-line |
| 8d | Every slip ends 24 px above the edge (plus the safe area) | Script: the slip's or the sheet's last button, bottom edge to the screen edge | ends-24 |
| 8e | On a typing step the button rides on the keyboard | Eye, on a real phone (no keyboard in the test browser) | - |
| 9 | Design learnings board, a row for each decision | Process | - |
| 10 | Journeys left to right, branches under the step they leave | Script, on the canvas only | - |
| 11a | White paper is torn at the top only; whole teeth | Eye (script later: the edge's shape) | - |
| 11b | No second ask on the order screen (no "Ping me") | Script: the words of the order screens | no-second-ask |
| 11c | A screen that fit without scroll still fits | Script: page height against the screen. Not measured in slice 1 | - |
| 12 | One thing per message in a design review | Process | - |
| 13 | Before and after in one picture, a red mark on the one change | Process | - |
| 14 | Better by removing: no step counts, no label that says nothing | Script for "Step N of M". A label that says nothing: Eye | no-step-count |
| 15 | A tapped field: its own border turns the brand colour, no ring, same size, field has the sheet's colour | Script: focus the field, read border, outline, shadow, size, fills | tapped-field |
| 16 | A list and its total agree | Script: the bill and the order slip, lines against the total | list-total |
| 17 | Every rejected board has a note with why | Script, on the canvas only | - |
| 18 | An issue closes only after it is seen right on prod | Process (label `prod-check`) | - |
| 19 | A look is measured in a real browser | Process; this check does it | - |
| 20 | A price or value the admin sets is only a sample on a board | Eye: tells a real difference from sample data | - |
| 21 | One canvas per stage | Process | - |
| 22 | Nothing on a canvas changes without the owner's review | Process | - |
| 23 | No layout shift between the states of one screen | Script: the same parts at the same place in two states of one screen | no-shift |
| - | One "View all" pattern (owner, 15 Nov) | Script: every "View all" has the same build. No "View all" in this journey | view-all |
| P20 | An error a customer sees is true for that customer, with the way out | Eye, per error state (not in the happy path) | - |
| P | The credit "Ola Maps" shows where Ola's rows show | Script: the words under the list. Not in this journey | - |
| P | No personal data in a picture or a report | Eye; the test data is made up | - |
