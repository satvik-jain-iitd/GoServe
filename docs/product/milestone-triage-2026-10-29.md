# Milestone triage (29 Oct 2026)

Owner marks given in chat on 29 Oct (the page lost them). Rule from the owner: everything left over from these six milestones is part of M3 (release 2 Nov); design changes and motion go to M4; the Laya set and #120 go to M6.

## A. MVP 1 Golden path (due 22 Oct)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| 96 | Story: web push for the delivered prompt (after the demo). | Built: the phone notification "Was your order delivered?" ships (push outbox #483, audit row I.3). | epic #116 | close as done | Close with a note pointing at #483 and the audit row I.3. | The thing the story asks for exists on prod. | yes, closed |
| 97 | Story: UAT numbers in the 21:00 card and the Ops panel. | The 21:00 Telegram card (MAIN 90) runs daily with the day's numbers; the Ops panel shows the day's tiles (Numbers tab). | epic #116 | close as done | Close with a note: MAIN 90 card and the admin Numbers screen. | Both places show the numbers; the "UAT day" framing is over. | yes, closed |
| 120 | Story: Jev D2 ETA (a delivery time per order from the decision engine). | Not built. The tracker says "About 30 min" from the kitchen's fixed ETA. | epic #116 | move to M6 | Move to M6 (v2.0) with the Laya work; the fixed ETA is enough for the pilot. | No pilot kitchen asked for a per-order ETA yet; the engine work sits with Laya. | yes, M6 |
| 116 | Epic: MVP 1 Golden path. | Every other story closed; the golden path runs on prod. | milestone | close | Close when the three rows above are done. | Nothing left in it. | yes, closed |

## B. MVP 2 Pilot ready (due 24 Oct)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| 55 | Story: UptimeRobot monitors for dev and prod. | No monitor. The prod health URL exists now: `/functions/v1/health`. | epic (follow-up F54) | owner click | You make two monitors in UptimeRobot (free): prod app `https://goserve-app.pages.dev/customer/` and prod health. I write the two URLs and the alert email in the story. | Needs an account the owner holds. Five minutes. | yes, closed; F287 |
| 107 | Story: Laya training data generator and validator. | Built: `ops/ai/laya/gen.py`, `audit.py`, seeds. | epic #106 | close as done | Close with the file list. | The scripts are in the repo and were used in later rounds. | yes, closed |
| 111 | Story: Laya train and eval scripts on Kaggle. | Built: `ops/ai/laya/kaggle/train.py`, `eval.py`, `stage.py`, `push.sh`. | epic #106 | close as done | Close with the file list. | Same. | yes, closed |
| 113 | Story: Laya data v2 and retrain to targets. | Rounds ran on Kaggle; targets not proven met. | epic #106 | move to M6 | Move to M6 with the epic. | Laya is the v2.0 decision model, not a pilot need (Jev rules serve the pilot). | yes, M6 |
| 127 | Story: Laya round 3 (refund, at_risk). | Partly run. | epic #106 | move to M6 | Move to M6. | Same. | yes, M6 |
| 131 | Story: Laya robustness check. | Not run. | epic #106 | move to M6 | Move to M6. | Same. | yes, M6 |
| 137 | Story: Laya round 5, blind test, pressure suite. | Not run. | epic #106 | move to M6 | Move to M6. | Same. | yes, M6 |
| 106 | Epic: fine-tune Laya on GoServe decisions (Kaggle). | Two stories done, four open. | milestone | move to M6 | Move the epic and its four open stories to M6; close #107 and #111 inside it. | Owner-driven GPU work; keeps the pilot milestones clean. | yes, M6 |
| 139 | Story: Google OAuth brand verification. | Parked by you on 23 Oct (low priority). The consent screen shows the raw project name. | epic #179 | owner click, move to M4 | Move to M4; when you have 15 minutes, the Google Cloud console form (logo, home page, privacy URL). I write the exact fields in the story. | Needs the owner's Google account. | yes, M3 (fields in the story) |
| 146 | Epic E13: design system and investor-grade UI. | Ink v3 design system is in the app and on the canvas; every customer and staff screen uses it. | milestone | close | Close with #155. | Delivered under other epics (Ink boards, #193 and after). | yes, closed |
| 155 | Story: D3 staff and admin screens in the design system. | Built: kitchen, rider and admin screens use the Ink components (boards K, R, A on the canvas). | epic #146 | close as done | Close with the board names. | Same. | yes, closed; new story #690 canvas by stage |
| 147 | Epic E14: release MVP 2 and closure. | Superseded by epic E25 (#309): the freeze and the tag. | milestone | close as superseded | Close, point at #309. | Two epics for one release. | yes, closed superseded |
| 156 | Story: R release MVP 2 and closure. | Superseded by #326 (release and tag mvp2-demo). | epic #147 | close as superseded | Close, point at #326. | Same. | yes, closed superseded |

## C. MVP 2.5 Pilot hardening (due 26 Oct)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| 534 | Story: push outbox re-offers a row that was taken but never sent. | Not built; the outbox (#483, #532) is on prod now. | epic #309 | build next | Coder builds it after the phone test: one SQL function and a test. | Small, real: a lost push is a lost "ready" ping. | yes, build next (PR #692) |
| 246 | Story: README v3, everything built so far. | README is old (v2). | epic #203 | build (docs) | Coder writes it in a docs PR after the phone test. | You asked for it on 25 Oct; a stranger still cannot read the repo in two minutes. | yes, docs |
| 207 | Story: PostHog product analytics. | Not set up. | epic #203 | owner click, move to M4 | Move to M4. When wanted: you make the PostHog project (free), paste the key into the vault, the coder adds the snippet behind a flag. | Needs an account; not a pilot blocker. | yes, build now, M3 |
| 196 | Story: H13 integrations research (which APIs are still needed, tiers, costs). | Not written. | epic #183 | move to M4 | Move to M4; one research doc when the pilot kitchen is picked. | The list depends on the pilot's real needs (payments, SMS provider, maps). | yes, M3 |
| 192 | Story: H9 four-skill blind test (menu and tracker built four ways). | Not run; Ink v3 was chosen and shipped instead. | epic #182 | close as dropped | Close, note that Ink v3 won without the test. | The decision it was for is made. | no: M4 (no design changes in M3) |
| 191 | Story: H8 Ola Maps geocode and distance. | Superseded: the address comes from the phone's location and OpenStreetMap (#668); distance and the nearest kitchen are F279. | epic #181 | close as superseded | Close, point at #668 and F279. | A second maps provider is not needed for the pilot. | yes, closed; rider map #691 under #181 |
| 187 | Story: H4 validation rules end to end (one table, the database is the truth). | Partly: single rules exist (#466 readable refusals, pin code required). No table. | epic #179 | move to M4 | Move to M4; the table comes with the server-side kitchen match (F279). | Not a blocker now; the rules that mattered are in. | yes, M3 |
| 179 | Epic E15: pilot blockers and validation rules. | Blockers done (pin code, demo console off prod, one kitchen per staff); #187 and #139 remain. | milestone | move to M4 | Move with #187 and #139. | Keeps the open rows together. | yes, M3 |
| 181 | Epic E17: maps. | Superseded by #668 and F279. | milestone | close as superseded | Close. | Same as #191. | keep open, M3 (#691) |
| 182 | Epic E18: UI pass 2. | Done another way: Ink v3 across every screen. | milestone | close | Close with #192. | Same. | no: M4 |
| 183 | Epic E19: integrations map. | Only #196 in it. | milestone | move to M4 | Move with #196. | Same. | yes, M3 |
| 203 | Epic E20: pilot reporting, health, README, analytics. | Daily card and health exist; README and PostHog open. | milestone | keep until #246 | Close after #246; #207 moves to M4. | README is the last pilot-facing piece. | keep until #246 |

## D. M0 Roadmap live (due 26 Oct)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| 247 | Story: hosted roadmap on Cloudflare Pages. | Live: `https://goserve-roadmap.pages.dev/` answers 200; the workflow refreshes it. | epic #238 | close as done | Close with the link. | It is up. | yes, closed |
| 238 | Epic E21: live roadmap page. | Everything else in it is closed. | milestone | close | Close with #247. | Nothing left. | yes, closed |

## E. M1 MVP2 demo-ready (due 27 Oct)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| 325 | Story: owner phone list passed (P1, P2, T1 to T7). | Rows 1 to 4 passed on earlier builds; rows 5 to 7, Privacy words and M6 remain; the new build (first open, address) needs one more sitting. | epic #309 | owner: one sitting | You run the list on the new build; I give one row per message. | Only you can do it. | yes, one sitting on the new build |
| 326 | Story: release and freeze the PWA (tag mvp2-demo). | Release is on main; the tag waits for #325. | epic #309 | after #325 | I give you the one tag command after #325. | Same. | after #325 |
| 619 | Story: a closed kitchen or a sold-out dish shows at once; a refused order says why. | Not built. The design guideline of today applies: two frames first. | epic #309 | build (design first) | I show you two frames (closed stamp live; sold-out dish), you pick, then the coder builds. | Found by you in the sitting; real. | yes, M3, two frames first |
| 643 | Story: the copy audit. | Done: 107 rows marked, four fix stories merged (#659 to #661, #655 layers). | epic #309 | close as done | Close with the page link and the PR list. | Nothing left in it. | yes, closed |
| 309 | Epic E25: MVP2 demo freeze. | #325, #326, #619 open. | milestone | keep | Close with #326. | The freeze is the milestone. | keep |

## F. M2 Design v2 approved (due 28 Oct)

| # | Situation | Today | Job | Verdict | New words | Why | Owner |
|---|---|---|---|---|---|---|---|
| 331 | Story: design principles v2 and the Living Slip (a doc). | The slip is the app's core shape on every screen; the seven principles are not written as one doc. | epic #310 | build (docs, small) | Coder writes `docs/design/principles-v2.md` from the boards and the motion plan, one page. | You asked for one shared page; cheap. | yes, docs, M3 |
| 332 | Story: Ink v4 native tokens (one tokens file for both apps). | `design/tokens.json` carries the `ink` block; the native apps read it (M4 stories). | epic #310 | close as done | Close with the file. | The keys are there. | yes, closed |
| 333 | Story: twelve key customer screens on the design canvas. | On the canvas: first open (O0, O0b), address (A1 to A3), menu, dish, bill, placed, tracker, orders, you, feedback, offline, alerts. | epic #310 | close as done | Close with the canvas link. | More than twelve, reviewed by you board by board. | yes, closed |
| 334 | Story: kitchen, rider and admin key screens (6). | On the canvas: K boards, A boards, rider boards. | epic #310 | close as done | Close with the board names. | Same. | yes, closed |
| 335 | Story: jobs check on every screen (five questions per screen). | Done another way: the copy audit (#643) asked "what is the job" of every line and image. | epic #310 | close as done | Close, point at #643. | Same question, deeper. | yes, closed |
| 336 | Story: owner design yes. | You said yes board by board through the sittings. | epic #310 | close as done | Close with a note. | The yes exists in the story comments. | yes, closed |
| 503 | Story: the bare app address, a scroll story with four doors. | Not built; the bare address shows the customer app. | epic #310 | move to M4 | Move to M4; two frames first when it comes up. | Nice to have; not a pilot need. | no: not built, M3, frames first |
| 508 | Story: the pin screen with Use my location. | Superseded by #668 (location step) and the first open (#667). | epic #310 | close as superseded | Close, point at #668. | Built under another story. | yes, closed superseded |
| 310 | Epic E26: design v2 (the Living Slip). | Six of eight done or superseded; #331 small, #503 moves. | milestone | close after #331 | Close when #331 lands. | Then the milestone is done. | keep, M3 |
