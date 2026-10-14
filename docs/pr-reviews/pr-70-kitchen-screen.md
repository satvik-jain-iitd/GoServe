# PR #70 — feat(app): kitchen screen with live orders and next-step buttons

- **Branch:** `feat/49-kitchen-screen` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #49 "Kitchen screen: live orders with Accept, Start, Ready" (epic #36)
- **Status:** open (OPEN, MERGEABLE) · head `a53b35a` (1 commit) [VERIFIED]
- **Files:** 25 (6 notebook bundle files andar) · **Lines:** +839 / -44 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5513955035 (APPROVE), 20 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/70

> Kitchen ka screen aaya. Customer ka order board par live aata hai, aur kitchen Accept, Start, Ready daba kar aage badhata hai. Asli live row activation ke baad aayegi.

---

## Overall review

## 1. Ek-line logline
> `Feat PR: kitchen screen. Order board par naya slip live aata hai, aur kitchen ek-ek step (Accept, Start, Ready) aage badhata hai.`

## 2. Big Picture (Story & Goal)
- Story #49, epic #36. Persona: kitchen manager. Spec §5 steps 4 se 5. [VERIFIED]
- S1: customer order bheje, kitchen screen 2 second mein dikhaye, refresh ke bina. [VERIFIED]
- S2: Accept, Start, Ready tap ho; har tap order ek step aage le jaye aur ek event likhe. [VERIFIED]
- Depends on #65 (Realtime) aur #66 (status workflow), dono merged. Printer aur multi-tablet sync ponytail mein hain. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Pehle customer order bhej sakta tha (#69), par kitchen ke paas screen nahi thi. [VERIFIED journal]
- Is PR se kitchen order dekh kar status badal sakta hai. Demo ka rasta placed tak poora hota hai; delivered tak #50 chahiye. [VERIFIED brief]
- Iske bina order placed par atak jaata. [INFERRED from S2]

## 4. Real-Life Analogy
Dhaba ka order board. Customer slip deta hai, kitchen board par slip ko aage badhata hai.
1. `live.ts` = board boy: pehle register se is session ki saari slips copy karta hai, phir ghanti (Realtime) par nayi ya badli slip pin karta hai.
2. `kitchen.ts` = board ke niyam: naya slip upar; do copies aayein to later stamp (`updated_at`) jeetta hai; slip par ek hi button, agla step.
3. `changeStatus` = cook slip par stamp lagata hai, naam "kitchen", usi window se jo customer use karta hai.
4. `change_status` = manager: slip aur session check, status ek step aage, event likhna.
5. Role tabs = ek booklet, do cover: ek browser customer aur kitchen dono dikhata hai.
6. Integration test = dhaba ki rehearsal goserve-dev par: asli slip likhi jaati hai, aur mitai nahi ja sakti.

## 5. Is PR mein naye Concepts (7)
Poori list `concepts.delta.md` mein hai. Naam: Read then listen, then read again; Later stamp wins; Next-step table; Actor is self-declared; Stand-in socket; Rehearsal leaves marks; One booklet, two covers.

## 6. High-Level Flow
1. Kitchen tab kholo → `ensureSession` → `fetchOrders` (RLS: sirf apni session) → `watchOrders` (Realtime, session filter). SUBSCRIBED par ek reload. [VERIFIED code]
2. Customer (same browser) order bhejta hai → n8n → `place_order` row likhta hai → Realtime INSERT → `mergeOrder` → card "New", Accept button. [live path INFERRED]
3. Accept tap → `changeStatus` → MAIN 01 → SUB 12 → `change_status` (status accepted, event `order.accepted`, actor kitchen) → server ka copy merge. [VERIFIED unit, e2e, SQL; live path INFERRED]
4. Start → preparing (label "Cooking") → Ready → ready; ab koi button nahi. [VERIFIED unit]
5. Rider steps (#50) order ko board se hata denge. [pending #50]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `app/src/App.tsx` | Booklet ka switchboard: role tabs, kitchen effect, `tap()` |
| `app/src/lib/kitchen.ts` | Board ke niyam: agla step, labels, later stamp jeetta |
| `app/src/lib/live.ts` | Board boy: register copy aur ghanti |
| `app/src/lib/orders.ts` | Window: `callApi` (place aur status dono), `changeStatus` |
| `app/src/screens/KitchenScreen.tsx` | Board ke tickets, ek button per slip |
| `app/src/styles/app.css` | Board ke rang, status tokens se |
| `app/tests/*`, `app/playwright.config.ts` | Rehearsal aur checklist |
| `docs/*` | A44, F70, F71, test rows, LEARNINGS, spec |

## 8. Pieces aapas mein kaise baat karte hain
```
App.tsx ──> lib/live.ts ──> Supabase (RLS + Realtime)
App.tsx ──> lib/kitchen.ts (nextStep, mergeOrder)
App.tsx ──> lib/orders.ts (changeStatus ──> callApi ──> n8n MAIN 01)
App.tsx ──> screens/KitchenScreen.tsx (tickets)
```

## 9. Pehle se kya badla
- +839 / -44 in 25 files: code, tests, docs, aur 6 notebook bundle files. [VERIFIED]
- Customer side par chhote badlaav: `callApi` shared, `shortId` shared, `getClient` export, `PlacedScreen` +2/-1. [VERIFIED]
- Spec badla: MVP0_SPEC §5 step 6, order number dono screens par pehle 8 characters. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. Kisi ke paas demo token ho to woh kitchen ban kar status badal sakta hai, kyunki `actor` phone ki baat hai. ADR-009 ne demo ke liye maana. [VERIFIED]
2. goserve-dev par test rows jama ho rahe hain: 12 orders, 15 events abhi, har run +2 orders. Cleanup ke liye protection trigger off karna padega (F71); guard ne mana kiya. [VERIFIED]
3. Ek browser = ek session: do device demo nahi chalega (A44, F64 d). Fix story #52. [VERIFIED]
4. Live gaps: SUBSCRIBED ke ek second baad server events gira sakta hai; reconnect aur ek ghante wala JWT untested. [INFERRED]
5. `updated_at` string se compare hota hai: aaj sahi (Postgres ISO `+00:00`), par kisi aur format par chupchaap galat. [INFERRED]
6. Anonymous sign-in ki limit 30 per hour per IP hai. Rehearsal, demo aur reset ek ghante mein limit cross kar sakte hain. [VERIFIED docs claim; reviewer ne value dobara nahi check ki]
7. Offline kitchen tab "Could not load orders" dikhata hai. [INFERRED from code]
8. Status words do jagah: kitchen labels yahan; customer tracker (#50) wahi words use kare. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
Printer aur multi-tablet rules (ponytail); rider steps aur customer tracker (#50); split view aur reset (#52); kitchen login (MVP 1); F71 dev cleanup; activation aur live rows. [VERIFIED PR body + docs]
Owner ke paas chaar faisle pending hain: A43, A44, F71 cleanup, activation. Handoff ki state line "A43 + A44 yes, F71 yes, activation yes" ka matlab hai: owner in par haan ya na bole, haan pehle se nahi hai. [VERIFIED brief]

## 12. Testing Story
- Red first: unit (module missing, `changeStatus is not a function`) aur e2e build fail. [VERIFIED PR body]
- Green: unit 39, e2e 17 (5 runs), tsc clean. Reviewer ne lint, unit (39) aur e2e (17, 19.7 s) dobara chalaye. [VERIFIED]
- Integration 2 pass sirf coder ke local run mein. Reviewer ne nahi chalaya, kyunki har run goserve-dev par rows chhodta hai. [VERIFIED]
- S1 ka "2 second" sirf integration test mein naapa jaata hai. CI mein keys nahi hain, to woh skip hota hai. [VERIFIED]
- Ek flake: pehla socket helper shuru ke events gira deta tha; ek test teen mein se ek run par fail hota tha. Fix hua (LEARNINGS 89). [VERIFIED]
- Nahi test hua: reconnect reload, ek ghanta khula tab, `updated_at` format badlna, cart ka asli check, live kitchen run (activation pending). [VERIFIED]

## 13. Trade-offs & Alternatives
| Chuna | Chhoda | Kyun |
|---|---|---|
| Role tab ek app mein | Doosra route ya app | Naya deploy zero, same session (ADR-010); par do-device demo nahi (A44) [VERIFIED] |
| Client merge `updated_at` se | Har event par refetch | Kam reads; stamp ka niyam chahiye [VERIFIED] |
| Integration test real dev DB par | Sirf stand-ins | 2 s aur RLS ka asli proof; rows frozen (F71) [VERIFIED] |
| `SETTLE_MS` sleep (e2e) | Protocol-level wait | Simple, par thoda nazuk [VERIFIED] |

## 14. Patterns is PR se
- Read, listen, read again: `live.ts` `watchOrders` (SUBSCRIBED par reload).
- Later stamp wins: `kitchen.ts` `mergeOrder`.
- Next-step table: `kitchen.ts` `STEPS` + `nextStep`.
- Stand-in socket: `kitchen.spec.ts` `setup()`.
- Rehearsal on the real dev DB: `integration/kitchen.test.ts`.

## 15. AI-Review Lens
- Trust: `kitchen.ts` ke pure niyam aur 8 unit tests; teeno taps ki e2e request bodies; RLS aur Realtime integration run mein. [VERIFIED]
- Interrogate: "live over time" cheezein (reconnect, JWT refresh, ek second ka gap, stamp ki string compare) aur "token wala = kitchen". [INFERRED]
- Confident but risky: "2 second" ka claim ek local integration run par hai, 1.5 s pre-sleep ke saath. PR ne yeh imandari se likha hai. [VERIFIED]

## 16. Questions
- **Top 3 abhi poocho:** Q35 (demo token wala kitchen ban sakta hai), Q36 (goserve-dev par rows jama), Q37 (ek device ya do device demo). Poora bank "Comment blocks" mein hai: 20 sawaal.
- **Self-check:** Board boy register kab padhta hai, aur ghanti kab sunta hai? Do copies ek slip ki aayein to kaunsi jeetti hai, aur kyun phone ki ghadi nahi? Rehearsal dhaba (goserve-dev) par slips kyun reh jaati hain?

---

## Mode B — file review

### B1. `app/src/App.tsx`
- Job: app ka switchboard. Customer aur kitchen tab; kitchen par order list. [VERIFIED]
- Kitchen effect (lines 42–63): tab kitchen par ho to session, fetch, aur ghanti chalti hai; cleanup channel band karta hai. [VERIFIED]
- `tap()` (lines 65–77): `changeStatus` kitchen naam se; server ka copy merge (`saved.updated_at ?? order.updated_at`); error `kitchenError` mein. [VERIFIED]
- Watch: `sessionRef` likha jaata hai, kabhi padha nahi jaata. Questions: TOP line 70, TOP line 42, line 35.

### B2. `app/src/lib/kitchen.ts`, `live.ts`, `orders.ts`
- `kitchen.ts`: board ke niyam. `nextStep` placed → accepted → preparing → ready → none. `kitchenOrders` delivered aur out_for_delivery hata deta hai. `mergeOrder`: newest pehle, later `updated_at` jeetta. [VERIFIED unit]
- `live.ts`: `fetchOrders` (RLS se apni session). `watchOrders`: channel `orders-<session>`, INSERT/UPDATE par `onOrder`, SUBSCRIBED par `onReady`, aur remover wapas. [VERIFIED code + e2e]
- `orders.ts`: `callApi` place aur status dono ke liye ek hi window. `changeStatus` body mein `actor: "kitchen"` aur token jaata hai. [VERIFIED unit + e2e]
- Questions: kitchen.ts line 26; orders.ts lines 10 aur 17; live.ts lines 20, 17, 6.

### B3. `KitchenScreen.tsx`, `app.css`, `playwright.config.ts`
- KitchenScreen: har slip par `Order <shortId>`, status badge, lines, address, total, aur ek next-step button. Busy hone par button disabled. Empty, loading aur error states. [VERIFIED]
- app.css: `.roles`, `.tickets`, `.ticket`, `.badge`; status rang `--gs-status-*` tokens se. [VERIFIED]
- playwright.config.ts: port 4180, taaki hand-started preview kabhi reuse na ho. [VERIFIED]
- Questions: KitchenScreen line 28; app.css line 52.

### B4. `app/tests/unit/` (kitchen 8 tests, orders +3)
- `kitchen.test.ts`: step order, Ready ke baad none, newest pehle, replace, purani late copy ignore, filter, shortId, labels. [VERIFIED]
- `orders.test.ts`: changeStatus ka body aur token, 409 ka reason, network error. [VERIFIED]

### B5. `app/tests/e2e/kitchen.spec.ts` (stand-in socket)
- `setup()` Supabase ka stand-in deta hai, webhook recorder jawab deta hai, aur ek fake Realtime socket (Phoenix v2 frames) chalta hai. Analogy: director ki rehearsal ghanti. [VERIFIED]
- 7 tests: naya order, pehle ke orders, Accept→Start→Ready bodies, live UPDATE se card move, 409 par button rehta hai, rider le gaya to slip hat jaata hai, "keeps the cart". [VERIFIED]
- `SETTLE_MS = 1500` (line 40) ek timing hack hai. "Keeps the cart" sirf heading check karta hai (line 131). [VERIFIED]
- Questions: line 131, line 40, line 74.

### B6. `app/tests/integration/kitchen.test.ts` (goserve-dev)
- Teen env keys na hon to test skip hota hai. Vault mein teeno hain. `place()` service key se `place_order` chalata hai. [VERIFIED]
- S1 (lines 46–61): subscribe, 1.5 s settle, place, 2 s mein placed, `change_status` accepted, 2 s mein accepted. S2: sirf is session ke orders. [VERIFIED test code]
- afterAll orders delete karta hai, par events frozen hain, isliye quietly fail karta hai (line 37). [VERIFIED]
- Questions: line 37 (TOP), line 10, line 51.

### B7. `docs/`
- A44 (line 54): tab ek app mein; sirf is browser ke orders; Ready ke baad koi button nahi. [VERIFIED]
- F70 (line 77), F71 (line 78); test-cases 7 rows (78–84; live row 83 pending); LEARNINGS 88–91; MVP0_SPEC line 72; process-trace rows 153–154. [VERIFIED]
- Questions: assumptions line 54; follow-ups line 78; test-cases line 84.

---

## Comment blocks
Yeh 20 threads PR par post ho chuke hain (review 5513955035). Har block mein GitHub id hai.

<!-- gh-comment-id: 4267533234 --> `app/src/App.tsx:70` · Assumptions · **Top-3**
> Kitchen tap `session_id: order.session_id` + `actor: "kitchen"` + wahi demo token bhejta hai. Server (`change_status`) sirf order + session + legal step dekhta hai; actor phone ki baat hai (guard_status sirf list check karta hai). Matlab token wala koi bhi "kitchen" ban kar status badal sakta hai. ADR-009 demo ke liye accepted. A44 mein yeh line jodo, aur kitchen login MVP 1 mein?
- **Reply (klickbae8yt-star):** Yes, anyone with the demo token can send a kitchen tap: the actor is the phone's word (ADR-009, accepted for the demo). I add this line to A44, and a kitchen login is MVP 1.
- **Status:** answered

<!-- gh-comment-id: 4267533242 --> `app/tests/integration/kitchen.test.ts:37` · Impact · **Top-3**
> Har run 2+ orders aur events goserve-dev par chhod deta hai (maine abhi gina: 12 orders, 15 events, 0 anon users). F71 cleanup = protection trigger ek transaction ke liye off. Owner se poochh raha hoon. Alternative bina trigger chhue: test rows ko address 'test' se tag rehne do aur reset story #52 ke saath ek `scripts/clear_dev.py` jo dry-run default ho aur dev project ref ke bina refuse kare. Kaunsa?
- **Reply (klickbae8yt-star):** I prefer the safer one: tag test rows and write a `clear_dev` script that is a dry run by default and refuses any project but dev, run with the owner's yes. Waiting for the owner on F71.
- **Status:** answered

<!-- gh-comment-id: 4267533253 --> `app/src/App.tsx:42` · Assumptions · **Top-3**
> A44: kitchen = isi browser ka session, sirf apne orders. Do device (customer phone + kitchen tablet) par demo kaam nahi karega (F64 d, story #52). 18 Oct demo ek device split view hai ya do device? Agar do, to #52 ko #50 se pehle lena hoga.
- **Reply (klickbae8yt-star):** Two devices will not work until the session can be shared (#52). If the 18 Oct demo is two devices, #52 must come before #50. It is the owner's call; until then I build #50 on one device with split view.
- **Status:** answered

<!-- gh-comment-id: 4267533264 --> `app/src/lib/kitchen.ts:26` · Understanding
> `updated_at` string compare (`>`): REST row, Realtime record aur `to_jsonb` (change_status) teeno Postgres ISO `+00:00` dete hain, to aaj sahi. Koi source kabhi `Z` ya chhota fraction bheje to compare chupchaap galat. `Date.parse` ek line hai, ya ek unit test "same instant, different format" — kaunsa?
- **Reply (klickbae8yt-star):** Agreed: `Date.parse` is one line and safer than a string compare. I add it with a unit test 'same instant, different format'.
- **Status:** answered

<!-- gh-comment-id: 4267533268 --> `app/src/lib/orders.ts:10` · Understanding
> `PlacedOrder.updated_at?` optional, par `change_status` hamesha `to_jsonb(v_order)` deta hai (updated_at trigger se). Required karo to `tap()` ka `?? order.updated_at` fallback hat jaata hai aur purana stamp kabhi nahi bachta. Ponytail: ek type change.
- **Reply (klickbae8yt-star):** Yes, making `updated_at` required is one type change and removes the fallback. I will do it.
- **Status:** answered

<!-- gh-comment-id: 4267533280 --> `app/src/lib/live.ts:20` · Purpose
> "SUBSCRIBED par ek baar reload" first-moment order ke liye. Socket toot kar jude (reconnect) to supabase-js phir SUBSCRIBED deta hai? Agar haan, reload har rejoin par chalega (acha), par test nahi hai. Ek line comment ya e2e "reconnect" case?
- **Reply (klickbae8yt-star):** supabase-js sends SUBSCRIBED again after a reconnect, so the reload would run on every rejoin. I add a one-line comment; a reconnect e2e test is not worth it now.
- **Status:** answered

<!-- gh-comment-id: 4267533287 --> `app/src/lib/live.ts:17` · Risk
> Filter + RLS authenticated JWT par. Anonymous JWT 1 ghante ka hai; supabase-js refresh ke baad naya token channel ko deta hai? Kitchen tab demo rehearsal mein ghante bhar khula rahe to events rukne nahi chahiye. Live row mein "1 hour open" check jodo?
- **Reply (klickbae8yt-star):** supabase-js passes the refreshed token to the channel, but I did not prove it. I add 'tab open for 1 hour' to the live checks.
- **Status:** answered

<!-- gh-comment-id: 4267533293 --> `app/src/lib/live.ts:6` · Understanding
> `select("*")` bina limit, RLS se apna session, cap 20 → max 20 rows. Delivered bhi aate hain, `kitchenOrders` phone par hataata hai. Aaj theek; #50 ke baad list badhegi — server par `.in('status', ...)` tab, ya abhi?
- **Reply (klickbae8yt-star):** Fine for now: at most 20 rows per session. When the list grows after #50, the server filter `.in('status', ...)` goes in then.
- **Status:** answered

<!-- gh-comment-id: 4267533301 --> `app/src/App.tsx:35` · Alternatives
> `sessionRef` set hota hai, kahin padha nahi jaata (dead). Hatao. Saath mein: Kitchen tab kholte hi `ensureSession` anonymous sign-in karta hai bina order ke — intended (30/hour limit ke saath)?
- **Reply (klickbae8yt-star):** Removing `sessionRef`; it is dead. The anonymous sign-in on opening the Kitchen tab is intended (one per browser, within the 30 an hour limit).
- **Status:** answered

<!-- gh-comment-id: 4267533307 --> `app/tests/e2e/kitchen.spec.ts:131` · Testability
> Naam "keeps the cart", assert sirf heading "GoServe". Menu stand-in `[]` deta hai, to menu alert dikhta hai aur cart banta hi nahi. Test wahi prove kare jo naam kehta hai: dish add → Kitchen → Customer → "View cart (1)". Ya naam badlo.
- **Reply (klickbae8yt-star):** Right, the test did not prove its name. I change it: add a dish, go to Kitchen and back, and check 'View cart (1)'.
- **Status:** answered

<!-- gh-comment-id: 4267533309 --> `app/tests/e2e/kitchen.spec.ts:40` · Testability
> `SETTLE_MS = 1500` + waiting queue: client join reply bind hone ka samay. 5 runs green, CI retry 1. Timing hack flake ka source ban sakta hai. Kya client ke `system` ok message (postgres_changes bound) ka wait zyada pakka hai? INFERRED. CI mein ek bhi retry dikhe to LEARNINGS.
- **Reply (klickbae8yt-star):** Agreed that 1500 ms is a timing hack. Waiting for the client's 'bound' signal is better but I have not checked it. If CI ever needs a retry on this test, I switch and write it in LEARNINGS.
- **Status:** answered

<!-- gh-comment-id: 4267533315 --> `app/tests/e2e/kitchen.spec.ts:74` · Understanding
> e2e 5 s wait, 2 s bound sirf integration par (1.5 s settle ke baad). Story S1 "within 2 seconds" ka proof CI mein nahi hai. Activation ke baad dev URL par bhi 2 s naapo (console timestamp) — live row 83 mein likho kaun aur kaise.
- **Reply (klickbae8yt-star):** True: the 2 second proof is only in the integration test. After activation I measure it on the dev URL with a console timestamp and write who and how in the live row.
- **Status:** answered

<!-- gh-comment-id: 4267533321 --> `app/tests/integration/kitchen.test.ts:10` · Risk
> Service role key env se (code mein nahi: sahi). Par koi "dev only" check nahi: galti se prod keys env mein hon to prod par orders banenge. `skipIf(!url.includes('<dev project ref>'))` ek line hai.
- **Reply (klickbae8yt-star):** Good catch. I add a guard that skips the integration tests unless the Supabase url is the dev project.
- **Status:** answered

<!-- gh-comment-id: 4267533327 --> `app/tests/integration/kitchen.test.ts:51` · Impact
> "server needs about a second after SUBSCRIBED": asli app mein bhi us second ka order miss ho sakta hai; reload INSERT cover karta hai, UPDATE nahi. Demo mein kitchen tab pehle khulta hai, order baad mein — theek. A44 ya F-row mein note?
- **Reply (klickbae8yt-star):** True, and the first-moment gap covers INSERT (the reload) but not UPDATE. In the demo the Kitchen tab opens first. I note it in A44.
- **Status:** answered

<!-- gh-comment-id: 4267533336 --> `app/src/lib/orders.ts:17` · Purpose
> `callApi` shared: place aur status ek hi window. `PlaceError` naam ab status ke liye bhi. `ApiError` rename ek line, ya rehne do (ponytail)? Sirf naam.
- **Reply (klickbae8yt-star):** Keeping `PlaceError` (ponytail); only the name is off. A rename to `ApiError` is easy when we touch the file again.
- **Status:** answered

<!-- gh-comment-id: 4267533343 --> `app/src/screens/KitchenScreen.tsx:28` · Future
> `disabled={busyId === o.id}`: ek order par double tap rukta hai, do orders par parallel taps chalte hain (theek). Accept ke baad "Start" server ke jawab se aata hai, optimistic nahi. Acha. Printer/multi-tablet story ponytail mein — #50 ke baad "ops stub" list (spec step 7) isi screen se?
- **Reply (klickbae8yt-star):** Yes, an ops list (spec step 7) can come from the same list code later. Printer and multi-tablet stay out.
- **Status:** answered

<!-- gh-comment-id: 4267533353 --> `app/src/styles/app.css:52` · Understanding
> Status rang tokens se (`--gs-status-*`, maine check kiya: sab hain). Label "Cooking" = `preparing`; spec step 5 customer tracker bhi "cooking" bolta hai. #50 mein wahi `statusLabel` map share karo, do copies nahi.
- **Reply (klickbae8yt-star):** Agreed. #50 shares the same `statusLabel` map, not a second copy.
- **Status:** answered

<!-- gh-comment-id: 4267533361 --> `docs/assumptions.md:54` · Assumptions
> A44 teen baatein: tab in same app; only this browser's orders; no button after Ready. Owner se alag alag haan le raha hoon.
- **Reply (klickbae8yt-star):** Noted, waiting for your yes on each part of A44.
- **Status:** answered

<!-- gh-comment-id: 4267533365 --> `docs/follow-ups.md:78` · Future
> F71: anonymous sign-ins 30/hour/IP. Ek device ek session → theek. Par #56 ke 20 runs agar har run reset (#52 = naya anonymous user) kare, rehearsal + demo same hour mein 30 cross ho sakta hai. #52 design mein "reset = same user, clear rows" vs "new user" tay karo.
- **Reply (klickbae8yt-star):** Good point. #52 must decide: reset = a new anonymous user (counts against 30 an hour) or the same user with rows cleared. I write this into the #52 design.
- **Status:** answered

<!-- gh-comment-id: 4267533374 --> `docs/tests/test-cases.md:84` · Impact
> Phone steps ache (6). Step 3 airplane mode mein Kitchen tap karein to "Could not load orders" dikhega (sign-in/fetch fail). Customer ko offline kitchen nahi chahiye; airplane story #53 ke liye note karo ki kitchen tab offline kya dikhaye.
- **Reply (klickbae8yt-star):** Right: in airplane mode the Kitchen tab shows 'Could not load orders'. I note for #53 what the kitchen should show offline.
- **Status:** answered

---

## Handoff

```text
State: 20 posted · 0 must-fix · actor: owner (merge; haan ya na on A43, A44, F71, activation)

You are the developer for GoServe PR #70 (feat/49-kitchen-screen). Review is APPROVE with 20 inline threads. Do this: (1) reply on all 20 threads in 1-2 sentences; no code change required; (2) optional small fixes: make the "keeps the cart" e2e test add a dish and check "View cart (1)", drop the unused sessionRef, refuse a non-dev project ref in the integration test, make updated_at required on PlacedOrder; (3) run the dev cleanup only after the owner says yes to F71; (4) start story #50 "Rider steps and live customer status" on feat/50-rider-steps from dev, red first, unless the owner picks #52 first; (5) last step of that PR: copy the reviewer's bundle (pr-70 chapter) into docs/pr-reviews/ and append the rows (path in chat); (6) activate nothing until the owner says "activate".
```

Posted as satvik-jain-iitd, review 5513955035 (APPROVE), 20 inline threads.
