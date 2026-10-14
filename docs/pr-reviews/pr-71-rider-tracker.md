# PR #71 — feat(app): rider steps and live customer tracker

- **Branch:** `feat/50-rider-steps` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #50 "Rider steps and live customer status through Delivered" (epic #36)
- **Status:** APPROVED (review 5516845168, head `d24d387`, Guard/App/Site green, 20 threads answered) · earlier head `8673ab0` (COMMENT review 5514994645, Guard red) [VERIFIED]
- **Files:** 36 (5 notebook bundle files andar) · **Lines:** +855 / -145 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5514994645 (COMMENT), 20 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/71

> Rider ke teen tap (Pick up, Arriving, Delivered) ab order ko aage badhate hain. Customer ki progress strip bina refresh ke chalti hai. Guard CI laal hai: ek commit subject 73 characters ka hai.

---

## Overall review

## 1. Ek-line logline
> `Rider PR: rider tab par teen tap order ko aage badhate hain, aur customer ka receipt har step live dikhata hai. Ek commit ka naam Guard se lamba hai, isliye CI laal hai.`

## 2. Big Picture (Story & Goal)
- Story #50, epic #36. Persona: rider aur customer. Spec §5 aur build design §2 step 6. [VERIFIED issue]
- S1: rider Pick up, Arriving, Delivered tap kare; har tap ek event likhe. [VERIFIED issue]
- S2: customer ki screen har step bina refresh ke dikhaye, aur Delivered par khatam ho. [VERIFIED issue]
- Depends on #49 (kitchen, merged). Ponytail: real GPS MVP 2 mein; MVP 0 mein rider fake hai. [VERIFIED issue]
- "Rider assigned" wali baat MVP 0 mein nahi hai (A45, F72 c). [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Pehle kitchen order placed tak le jaata tha. Rider aur tracker ka kaam abhi nahi tha (#50 pending). [VERIFIED journal]
- Is PR ke bina rider ke paas tap nahi, aur customer ko Delivered nahi dikhta. [INFERRED from S1, S2]
- Dono kaam ek hi live hook par chalte hain: rider ke tap aur customer ki strip. [VERIFIED]

## 4. Real-Life Analogy
Dhaba ka delivery desk. Slip rider ke paas jaati hai, rider teen stamp lagata hai, aur customer ke receipt par progress strip chalti hai.
1. `riderActions` = delivery boy ke teen stamps: Picked up, Arriving (margin note, ek baar), Delivered.
2. `rider_event` = manager ka margin note: sirf sadak par slip ke liye, sirf ek baar.
3. `change_status` = manager ka status stamp (picked_up, delivered). Yeh pehle se tha.
4. `trackerSteps` = customer ki progress strip: chhe box, current wala lit.
5. `useLiveOrders` = ek board boy, teen kamre (kitchen, delivery desk, customer table). Jo kamra khula ho, wahi sunta hai.
6. `GS SUB 15 Add event` = counter par nayi khidki margin notes ke liye. MAIN 01 ke Route par ab paanch darwaze hain; "15" wala board "20" ho gaya.
7. Guard red = gate clerk ne 73 akshar ka naam tag wapas kiya, jabki badge sirf 72 ka hai.

## 5. Is PR mein naye Concepts (7)
Poori list `concepts.delta.md` mein hai: Event, not status · Row lock makes the once-check safe · One hook, three rooms · Progress strip from a status list · Phone memory vs server truth · Moving the bar in the same PR · Gate clerk on names.

## 6. High-Level Flow
1. Rider tab kholta hai → `useLiveOrders` (apna session, Realtime) → `riderOrders` ready aur sadak par slips dikhata hai.
2. Pick up → `changeStatus(out_for_delivery, rider)` → MAIN 01 → SUB 12 → `change_status` → event `order.picked_up`.
3. Arriving → `addEvent(order.arriving, rider)` → MAIN 01 Route `event` → SUB 15 → `rider_event` → ek event, status wahi. Dobara tap → 409 "Already done.".
4. Delivered → SUB 12 → `delivered` → slip rider list se hat jaati hai.
5. Customer ki placed screen par wahi hook UPDATE merge karta hai; `trackerSteps` Placed → Accepted → Cooking → Ready → On the way → Delivered light karta hai.
Flow ka tag: [VERIFIED code + tests; live INFERRED]. Live proof deploy aur activation ke baad.

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `app/src/App.tsx` | Switchboard: Rider role, `act()` jo status ya event bhejta hai |
| `app/src/lib/useLiveOrders.ts` | Board boy: ek hook, teen kamre |
| `app/src/lib/kitchen.ts` | Niyam: `riderActions`, `riderOrders`, `trackerSteps`, ek `LABELS` map |
| `app/src/lib/orders.ts` | Window ka form: `addEvent`, `updated_at` ab required |
| `app/src/screens/RiderScreen.tsx` | Delivery desk: slips aur teen stamp buttons |
| `app/src/screens/PlacedScreen.tsx` | Receipt: progress strip |
| `app/supabase/migrations/0005_rider_event.sql` | Margin note ka counter (`rider_event`) |
| `ops/n8n/order/build.js`, `code/guard_event.js`, `code/shape.js` | Blueprint mein nayi khidki, gate clerk, jawab card |
| `app/tests/e2e/helpers.ts`, `rider.spec.ts` | Stand-in counter aur ghanti, rider ki rehearsal |

## 8. Pieces aapas mein kaise baat karte hain
```
RiderScreen, PlacedScreen  <── App.tsx (act, live list)
App.tsx ──> lib/useLiveOrders.ts ──> lib/live.ts ──> Supabase (RLS + Realtime)
App.tsx ──> lib/kitchen.ts (riderActions, trackerSteps) · lib/orders.ts (changeStatus, addEvent)
orders.ts ──> MAIN 01 Route:  status → SUB 12 → change_status
                              event  → SUB 15 → rider_event (0005)
```

## 9. Pehle se kya badla
- +855 / -145 in 36 files: app code, tests, n8n build aur code, SQL 0005, docs, aur 5 notebook bundle files. [VERIFIED]
- Naya: migration 0005, SUB 15 + `guard_event.js` + `event.test.js`, `useLiveOrders` hook, RiderScreen, tracker strip. [VERIFIED]
- Badla: kitchen effect `App.tsx` se hook mein gaya, `sessionRef` hata, label "New" ab "Placed" hai. PR #70 ke review items (Date.parse, updated_at required, dev-only guard) `af59a6e` mein hain. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Guard red:** PR green nahi hoga jab tak commit subject 72 ka na ho. Chhota kaam, par merge ka blocker. [VERIFIED] → Fixed: subject `ebc0090` 69 characters, Guard green. [VERIFIED]
2. **Arriving customer ko nahi dikhta** (A45). Demo mein tap ki value saaf nahi. [VERIFIED]
3. **MAIN 01 node cap 15 → 20** isi PR mein. Har naya action = ek Route output + ek Call SUB node. [VERIFIED]
4. **Event allow-list teen jagah:** `guard_event.js`, SQL, `shape.js`. `rider_assigned` aaye to teen edits lagenge (F72 c). [VERIFIED]
5. **Prod release:** 0005 + SUB 15 + MAIN 01 update chahiye (F63, F72 e). [VERIFIED docs]
6. **Live path unproven:** SUB 15 deploy nahi hua; stand-in webhook sirf docs ka contract jaanta hai. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
Real GPS (MVP 2), rider assignment screen, `order.rider_assigned` event (F72 c), ops list, reset aur split view (#52), deploy aur activation (owner ka yes), F71 cleanup. Ponytail: sirf teen tap aur ek strip. [VERIFIED PR body + docs]

## 12. Testing Story
- Red first: vitest 10 fail, e2e build fail, SQL 2 failures + 1 error, node 10 fail. [VERIFIED PR body]
- Green, reviewer ne dobara chalaya: lint clean, vitest 6 files 49 tests, playwright 21 (19.0 s), node 41 pass, SQL 11 OK (goserve-dev par, rollback). [VERIFIED]
- Integration vitest reviewer ne nahi chalaya. Live counts orders 12, events 15, wahi hain. [VERIFIED]
- SQL test poora raasta prove karta hai: placed → … → out_for_delivery → arriving (chhe events, status wahi). `delivered` after arriving `d24d387` mein aa gaya (do run, API sirf aakhri statement ki rows deta hai). [VERIFIED]
- Nahi test hua: asli n8n `event` jawab, reconnect ke baad reload error, reload ke baad grey button, prod. Live row 91 deploy aur activation ke baad. [VERIFIED]

## 13. Trade-offs & Alternatives
| Chuna | Chhoda | Kyun |
|---|---|---|
| `rider_event` alag function | `change_status` mein `event` branch | Chhota, apne rules aur grants; par ek aur SQL + n8n path [VERIFIED] |
| Ek live hook | Har screen ka apna effect | Kam code, ek time par ek subscription [VERIFIED] |
| Node cap 15 → 20 | MAIN 01 split abhi | Abhi tez; bada canvas baad mein [VERIFIED] |
| `arrived` Set (phone memory) | `order_events` padhna | Ek Set; warna ek aur table read + policy (`events_own_session` hai) [VERIFIED] |

## 14. Patterns is PR se
- **One hook, many rooms:** `useLiveOrders(active)` (App.tsx lines 34–35).
- **Event lane:** ek note ka alag write path, apne rules (SUB 15 + `rider_event`).
- **Row lock as guard:** `for update` order row par (0005 line 13).
- **Progress strip:** `trackerSteps` ek ordered FLOW list se done, current, todo nikalta hai (kitchen.ts 41–45).
- **Allow-list copies:** teen jagah ek hi list (`guard_event.js`, SQL, `shape.js`).

## 15. AI-Review Lens
- **Trust:** `riderActions`, `trackerSteps`, `mergeOrder` ke pure rules unit tests se; SQL rules rolled-back test se; SUB 15 wiring test se. [VERIFIED]
- **Interrogate:** commit ka naam (CI laal hai to laal hai), node cap ka move, "kaun Arriving dekhta hai", reload error ka swallow, stand-in ka `event` jawab shape. [VERIFIED/INFERRED as marked]
- **Confident but risky:** "placed → delivered with arriving" ka live row abhi pending hai; PR yeh saaf likhta hai. [VERIFIED]

## 16. Questions
- **Top-3 abhi poocho:** (1) `docs/process-trace.md` line 162, Guard red (must-fix); (2) `app/src/lib/kitchen.ts` line 36, Arriving ka demo fayda (A45); (3) `ops/n8n/order/order.test.js` line 134, node cap 15 → 20.
- Poora bank: "Comment blocks" mein 20 sawaal, file-wise.

## 17. Self-check
- Arriving stamp kyun nahi, margin note kyun? Status kaun badalta hai?
- Do Arriving taps ek saath aayein to doosra kyun ruk jaata hai?
- Guard laal kyun hai jab saare tests green hain?

---

## Mode B — file review

### B1. `app/src/App.tsx` + `app/src/lib/useLiveOrders.ts`
- Job: App switchboard, ab teen role (kitchen, rider, customer). Hook live list sambhalta hai. [VERIFIED]
- `useLiveOrders(active)` (lines 13–40): ensureSession, fetchOrders, phir watchOrders; SUBSCRIBED par reload. Returns orders, loading, error, setOrders, setError. Analogy: board boy. [VERIFIED unit + e2e]
- `act(order, action, actor)` (App.tsx 43–55): status ya event call, server ka copy merge, event par `arrived` mein add, error `live.setError` mein. Analogy: counter par stamp ya margin note, jawab slip par. [VERIFIED]
- Watch: `active` false par sunna band; state rehta hai. Questions: App.tsx 50 (Q4), 34 (Q5), 119 (Q6); useLiveOrders.ts 27 (Q15).

### B2. `app/src/lib/kitchen.ts`, `orders.ts`, `live.ts`
- `kitchen.ts`: ek `LABELS` map (6 status); `mergeOrder` `Date.parse` se compare karta hai (28); `riderActions` (34–38); `riderOrders` (39); `FLOW` + `trackerSteps` (41–45). Analogy: board ke niyam aur strip ka naksha. [VERIFIED unit]
- `orders.ts`: `updated_at` required (9); `addEvent` body `{action:'event', ...}` (44–48). Analogy: window ka form, ab margin note ka form bhi. [VERIFIED unit]
- `live.ts`: sirf reconnect comment (12). Analogy: ghanti ke saath likhi chhoti note. [VERIFIED]
- Questions: kitchen.ts 36 (Q2, Top-3).

### B3. `app/src/screens/RiderScreen.tsx`, `PlacedScreen.tsx`, `app/src/styles/app.css`
- RiderScreen (+35): har slip par address aur "Collect ₹ (pay on delivery)"; har action ka ek button, `aria-label="<Label> <shortId>"`; Arriving `arrived` mein ho to disabled (23–26). Analogy: slip par teen stamp ki jagah. [VERIFIED]
- PlacedScreen (+10/-3): `status` prop; `<ol class="tracker">` with `aria-current="step"` (13–17); delivered line (18). Analogy: receipt ki progress strip. [VERIFIED]
- `app.css` (+6): `.tracker`, `.step`, `.step.done`, `.step.current`, tokens se. Analogy: strip ka paint. [VERIFIED]
- Questions: PlacedScreen.tsx 13 (Q17).

### B4. Migration `0005_rider_event.sql` + `scripts/test_order_rpc.py`
- `rider_event(p_order, p_session, p_event, p_actor)` (lines 4–27): sirf `order.arriving`; order row `for update` se lock; status `out_for_delivery` nahi to `illegal_event`; repeat `event_exists`; ek event insert; `to_jsonb(v_order)` wapas (status same). Grants (29–30): public, anon, authenticated se revoke; service_role ko grant. Analogy: margin note ka counter, pen ek waqt par. [VERIFIED]
- `test_order_rpc.py` (+17/-2): arriving walk (86–91); refusals `illegal_event`, `event_exists`, `invalid_event`, `order_not_found` (93–98); anon ka privilege test (100–106). Ran 11, OK. Analogy: dress rehearsal jo rollback ho jaati hai. [VERIFIED]
- Questions: 0005 line 4 (Q7), 0005 line 20 (Q8), test_order_rpc.py 86 (Q9).

### B5. n8n: `build.js`, `code/guard_event.js`, `code/check_token.js`, `code/shape.js`, `deploy.js`, tests
- `build.js` (+13/-4): `sub15` `sub()` helper se (143–146: fields, guard_event.js, rpc `rider_event`); Route mein `event` (172); `Call SUB 15 Add event` (186–188); edges (201–202); ADD EVENT sticky (212). RECEIVE sticky abhi purana hai ("place or status"). Analogy: blueprint mein nayi khidki. [VERIFIED]
- `guard_event.js` (+12): kill switch 503; session ≤ 64, order uuid, `event === 'order.arriving'`, actor list; warna 400 (8–9); rpc body (11–12). Analogy: gate clerk ke sawaal. [VERIFIED]
- `check_token.js`: `event` action (6). `shape.js` teen mapping (12–14): `event_exists` → 409 "Already done."; `illegal_event` → 409 `illegal_step`; `invalid_event` → 400 "Unknown status." (event ke liye galat shabd). Analogy: counter ka jawab card. [VERIFIED]
- `deploy.js` (13–14): saat naam; ORDER mein sub15 main01 se pehle. Dry run: ERR 00, SUB 11–14, MAIN 01 update; SUB 15 create; kuch activate nahi. [VERIFIED]
- `event.test.js` (+67, 7 tests): guard, 503/400, shape, check_token, MAIN route, SUB 15 wiring. `order.test.js` 134 aur `decide.test.js`: node cap ≤ 20. Node 41 pass. [VERIFIED]
- Questions: build.js 212 (Q11), deploy.js 14 (Q12), shape.js 14 (Q10), order.test.js 134 (Q3, Top-3).

### B6. App tests: unit, e2e (helpers, rider, kitchen), integration
- Unit `kitchen.test.ts` (+45/-1): moments (35–41), rider steps (65–79), tracker (82–96). `orders.test.ts` (+14/-1): `addEvent` body; 409 already_done (69–78). [VERIFIED]
- E2E `helpers.ts` (+66): stand-in REST + auth, menu ek dish, webhook jawab action se (37–41: place 201, event → out_for_delivery, status → requested), Phoenix v2 socket with `SETTLE_MS` (45). Analogy: stand-in counter aur ghanti. [VERIFIED]
- E2E `rider.spec.ts` (+65): S1 teen tap + bodies + token (11–27); rider list + live UPDATE (29–35); refused tap (37–43); S2 paanch UPDATE, Delivered tak (45–65). `kitchen.spec.ts` (+8/-64): helpers use; label "Placed"; cart test apne naam ka kaam karta hai (73–80). [VERIFIED]
- Integration `kitchen.test.ts` + `supabase.test.ts`: dev-only guard (13–15), URL mein dev project ref ho tabhi chale. Analogy: rehearsal sirf dev dhaba par. Reviewer ne integration nahi chalaya. [VERIFIED]
- Questions: rider.spec.ts 60 (Q13), helpers.ts 37 (Q14), kitchen.test.ts 14 (Q16).

### B7. Docs
- `assumptions.md`: A44 extended (54); A45 (55): rider teesra tab, Arriving = event ek baar, customer "On the way" dekhta hai. `follow-ups.md`: F63 (70), F72 a–e (79). `n8n-order-workflows.md`: SUB 15 row (12), event rules (52–58), contract (90). `test-cases.md`: rows 85–91 (live row 91 pending). `LEARNINGS.md` 92–95; `process-trace.md` 155–156. [VERIFIED]
- Analogy: dhaba ki rule book ke naye panne. Ek naya panna = ek naya raasta.
- Questions: process-trace.md 162 (Q1, Top-3), assumptions.md 55 (Q18), follow-ups.md 79 (Q19), n8n-order-workflows.md 58 (Q20).

---

## Comment blocks (20 posted, review 5514994645, har block mein GitHub id)

<!-- gh-comment-id: 4268370286 --> `docs/process-trace.md:162` · Risk · **Top-3**
> Guard CI laal hai: commit `af59a6e` ka subject 73 characters (limit 72, `scripts/guard.py` line 48; maine locally chalaya, rc=1). Subject chhota karo (jaise `fix(app): compare moments, require updated_at, dev-only tests`) aur `feat/50-rider-steps` force-push. Yeh ek hi must-fix hai; merge isse pehle nahi.
- **Reply (klickbae8yt-star):** Fixed. The subject is now 'fix(app): compare moments, require updated_at, dev-only tests' and the branch is force-pushed (d24d387).
- **Status:** answered

<!-- gh-comment-id: 4268370297 --> `app/src/lib/kitchen.ts:36` · Understanding · **Top-3**
> Rider ke paas on the road par do button: Arriving (event, ek baar) aur Delivered. Customer tracker Arriving kabhi nahi dikhata (A45: "On the way" until Delivered). To demo mein Arriving tap ka dikhne wala fayda kya hai: sirf `order_events` row? Spec build design §2 step 6 arriving bolta hai. Tracker par "Rider arriving" line (events se ek read, RLS `events_own_session` hai) ya ops screen (#51)? Owner ka A45 call.
- **Reply (klickbae8yt-star):** This is the owner's A45 call. Today Arriving is only an `order_events` row. Showing 'Rider arriving' to the customer is a read of the events (F73 e).
- **Status:** answered

<!-- gh-comment-id: 4268370307 --> `ops/n8n/order/order.test.js:134` · Assumptions · **Top-3**
> Node cap test 15 → 20 isi PR mein, jisko iski zaroorat thi. Rulebook 95.1: aim 15, split ~25 — legal, par bar hilana wahi PR mein jo cross karta hai, zor se bolna chahiye. Har naya action = Route output + Call SUB node. Agla action (rider_assigned, reset) 20 chhu lega. Plan: MAIN 01 split (MAIN 02 for events?) ya 20 par rukna? Rulebook note.
- **Reply (klickbae8yt-star):** Fair. The bar moved to 20 in the PR that needed it; the plan is to split MAIN 01 or stop at 20 before the next action (F73 c).
- **Status:** answered

<!-- gh-comment-id: 4268370312 --> `app/src/App.tsx:50` · Risk
> `arrived` Set phone ki memory hai (F72 b): reload → Arriving button wapas → server 409 "Already done." error alert ki tarah dikhega. Ek line: `act()` mein `code === 'already_done'` ko success maano (button grey, koi alert nahi). Demo mein rider tab reload hona aam hai.
- **Reply (klickbae8yt-star):** Done in d24d387: a 409 `already_done` for Arriving is treated as success (button greyed, no alert). The e2e test was red first.
- **Status:** answered

<!-- gh-comment-id: 4268370320 --> `app/src/App.tsx:34` · Understanding
> `useLiveOrders(active)`: kitchen, rider, ya customer placed step par. Tab badalne par unsubscribe → subscribe, `orders` state rehta hai. Ek browser mein kabhi do subscriptions nahi (role ek). "Order more" → active false → sunna band. Sawaal: Customer → Kitchen switch ke beech in-flight tap ka merge `alive=false` ke baad bhi `live.setOrders` se lagta hai (hook ka state), theek? Ek line comment.
- **Reply (klickbae8yt-star):** Yes, an in-flight tap still merges into the hook's state after a tab switch, and merging is harmless. I leave it; the list is the same one for all three screens.
- **Status:** answered

<!-- gh-comment-id: 4268370324 --> `app/src/App.tsx:119` · Understanding
> Tracker status = live list se, warna placed answer. Place ke turant baad list mein row nahi hoti (reload/Realtime baad mein), to `placed.status` dikhta hai. Acha fallback. "Order more" ke baad purana order list mein rehta hai, find by id se theek. Sirf confirm: naya order place karte hi tracker "Placed" se shuru hota hai, purane ka Delivered nahi dikhta (e2e S2 ek hi order hai).
- **Reply (klickbae8yt-star):** Confirmed: the tracker status comes from the live list for that order id, with the place answer as the first value. A new order starts at Placed; the old order stays in the list but is not shown.
- **Status:** answered

<!-- gh-comment-id: 4268370328 --> `app/supabase/migrations/0005_rider_event.sql:4` · Purpose
> Naam `rider_event` general hai, par sirf `order.arriving` leta hai (line 9). `rider_assigned` (F72 c) aayega to allow-list badhegi — teen jagah: `guard_event.js`, SQL check, `shape.js`. Ya naam `rider_arriving` rakho aur baad mein alag function? Ponytail: rehne do, F72 c mein "three places" likho.
- **Reply (klickbae8yt-star):** Keeping the name (ponytail). F73(a) says the allow-list lives in three places (`guard_event.js`, the SQL check, `shape.js`) when `rider_assigned` arrives.
- **Status:** answered

<!-- gh-comment-id: 4268370336 --> `app/supabase/migrations/0005_rider_event.sql:20` · Risk
> `exists(...)` check + `for update` lock on the order row: do Arriving taps ek saath aayein to doosra lock par rukta hai, phir event dekh kar `event_exists`. Lock se check safe hai — sikhne layak. Belt and braces: `unique (order_id, event)` partial index `where event = 'order.arriving'`? Abhi zaroorat nahi; note.
- **Reply (klickbae8yt-star):** Right: the row lock makes the exists check safe, and two taps give `event_exists`. A unique partial index is a second lock for later (F73 b).
- **Status:** answered

<!-- gh-comment-id: 4268370345 --> `scripts/test_order_rpc.py:86` · Testability
> Yeh test poora raasta SQL mein prove karta hai (placed → … → out_for_delivery → arriving, chhe events, status wahi), rolled back (maine chalaya: Ran 11 OK). Ek line aur: arriving ke baad `change_status(delivered)` bhi, taaki live row 91 ka poora path SQL mein pehle prove ho.
- **Reply (klickbae8yt-star):** Done in d24d387: after Arriving the test also does `change_status(delivered)` and checks the events and the status. The test needed two runs because the API returns only the last statement's rows.
- **Status:** answered

<!-- gh-comment-id: 4268370352 --> `ops/n8n/order/code/shape.js:14` · Understanding
> `invalid_event` → 400 par message "Unknown status." — event ke liye galat shabd. `msg.startsWith('invalid_event') ? 'Unknown event.' : 'Unknown status.'` ek line.
- **Reply (klickbae8yt-star):** Fixed in d24d387: 'Unknown event.' for an invalid event, with a test.
- **Status:** answered

<!-- gh-comment-id: 4268370361 --> `ops/n8n/order/build.js:212` · Impact
> ADD EVENT section theek. Par RECEIVE sticky (line ~204) abhi bhi "Body field action is place or status" kehta hai: ab chaar actions. B12: sticky ka What/Needs sach hona chahiye. Text badlo. Deploy PUT poora MAIN 01 badalta hai (Route output 3 ab SUB 15, 400 output 4): inactive par theek; activate ke baad deploy sirf owner ke haan se.
- **Reply (klickbae8yt-star):** Fixed in d24d387: the receive note names place, status, decide or event, with a test. The deploy updates all of MAIN 01; it stays inactive until you say activate.
- **Status:** answered

<!-- gh-comment-id: 4268370367 --> `ops/n8n/order/deploy.js:14` · Assumptions
> Dry run maine chalaya: SUB 15 create, baaki chhe update, kuch activate nahi. "push kar do" chahiye. Order ERR → SUB 11..15 → MAIN last (95.16): MAIN last kyun? (SUB id MAIN ke Call node mein jaata hai.) Prod copy (F65 c) ab saat workflows.
- **Reply (klickbae8yt-star):** MAIN is last because its Call nodes need the SUB ids, and a SUB must exist before the MAIN that calls it (rulebook 95.16). Prod will be seven workflows again (F65 c).
- **Status:** answered

<!-- gh-comment-id: 4268370380 --> `app/tests/e2e/rider.spec.ts:60` · Testability
> S2 paanch UPDATE push, har ek 6 s timeout, stand-in socket. Current step label check hota hai, done/todo styling nahi (unit cover karta hai). Theek. Live row 91 (deploy + activate ke baad) hi asli proof hai. Tracker 2 s bound (#49 S1 jaisa) customer side par bhi naapna hai?
- **Reply (klickbae8yt-star):** Yes, I will measure the tracker's 2 second bound after activation, on the dev URL (F73 f).
- **Status:** answered

<!-- gh-comment-id: 4268370391 --> `app/tests/e2e/helpers.ts:37` · Testability
> Stand-in webhook `event` par `{ok, order: out_for_delivery}` deta hai: yeh docs ka contract hai, n8n ka asli jawab nahi. Agar SUB 15 ka `order` field alag shape mein aaya to phone "Something went wrong" dikhayega. Live row kaun chalata hai aur MAIN/SUB execution ids kahan likhta hai (F66 g)?
- **Reply (klickbae8yt-star):** True, the stand-in answer is the contract from the docs, not the real n8n answer. The live row checks the real shape. F73(d) proposes a script that runs the live rows and prints the execution ids.
- **Status:** answered

<!-- gh-comment-id: 4268370399 --> `app/src/lib/useLiveOrders.ts:27` · Alternatives
> `reload().catch(() => {})`: reconnect ke baad reload fail ho to list purani, koi message nahi. Kam se kam `setError` ya `console.warn`? Hook `setOrders`/`setError` bahar deta hai taaki `act()` merge kare — ponytail theek.
- **Reply (klickbae8yt-star):** Agreed that a failed reload after a reconnect is silent. A message is F73(g); for now the list stays as it was.
- **Status:** answered

<!-- gh-comment-id: 4268370409 --> `app/tests/integration/kitchen.test.ts:14` · Risk
> Dev-only guard = project ref string code mein (URL ka hissa, secret nahi: theek). Do files mein wahi string; ek `DEV_REF` const? Ponytail: rehne do. F71 rows nahi badhi (12/15 wahi), matlab integration vitest is PR mein nahi chala — sahi, `test_order_rpc.py` rollback karta hai.
- **Reply (klickbae8yt-star):** Yes, the ref is public and the same string is in two files. One constant is F73(i). Right that the integration tests did not run in this PR, so F71 rows did not grow.
- **Status:** answered

<!-- gh-comment-id: 4268370417 --> `app/src/screens/PlacedScreen.tsx:13` · Purpose
> `<ol aria-current="step">` accessible, acha. Heading "Order placed" Delivered par bhi rehta hai; neeche "Your order has been delivered." aata hai. Cosmetic: heading "Your order"? Owner ka call, #52/#56 polish mein.
- **Reply (klickbae8yt-star):** Cosmetic and the owner's call; it goes with the polish in #52 or #56 (F73 h).
- **Status:** answered

<!-- gh-comment-id: 4268370427 --> `docs/assumptions.md:55` · Future
> A45 teen faisle: rider teesra tab; Arriving = event ek baar, customer "On the way" dekhta hai; rider assignment aur `rider_assigned` event nahi. Owner se alag alag haan le raha hoon.
- **Reply (klickbae8yt-star):** Noted. Waiting for your yes on each part of A45.
- **Status:** answered

<!-- gh-comment-id: 4268370435 --> `docs/follow-ups.md:79` · Impact
> F72 (a): push kar do + activate ke baad live checklist lambi hai (401/201/200/409/503, Jev, Jev-down, placed → delivered + arriving). 20 demo runs (#56) ke liye ek `scripts/live_check.py` jo yeh sab chalaye aur execution ids print kare — ya manual? Script ek baar likho, baar baar chale.
- **Reply (klickbae8yt-star):** A script is a good idea for the 20 demo runs: F73(d). I write it after the owner says push kar do and activate, so it runs against the real workflows.
- **Status:** answered

<!-- gh-comment-id: 4268370440 --> `docs/integrations/n8n-order-workflows.md:58` · Assumptions
> Doc: repeat → 409 already_done, doosra event name → 400 — code se match (guard 400, SQL invalid_event 400). Par "Rider arriving" section Steps/Actors se pehle aata hai aur SUB 15 contract line 90 par: ek jagah "event actions" table banao jab rider_assigned aaye.
- **Reply (klickbae8yt-star):** Agreed: one 'event actions' table when `rider_assigned` arrives (F73 a).
- **Status:** answered

---

## Handoff

```text
State: 20 posted · 1 must-fix · actor: coder, then owner (sync, merge, decisions)

You are the developer for GoServe PR #71 (feat/50-rider-steps). Guard CI is red: commit af59a6e's subject is 73 characters (limit 72). Do this: (1) reword that subject to 72 or fewer, for example "fix(app): compare moments, require updated_at, dev-only tests", and force-push feat/50-rider-steps; (2) reply on all 20 threads in 1-2 sentences; (3) optional: treat 409 already_done as success in act(), say "Unknown event." for invalid_event, fix the RECEIVE sticky text, add delivered-after-arriving to the SQL test; (4) reply "PR #71 fixed at <sha>"; (5) deploy or activate nothing until the owner says "push kar do" and "activate"; (6) next story #52 "Split view, own space per session and reset" after the owner's pick; copy the reviewer's bundle (pr-71 chapter) as the last step of that PR.
```

Posted as satvik-jain-iitd, review 5514994645 (COMMENT), 20 inline threads.

**Owner ke liye (Romanized Hindi):** Guard laal hai, isliye coder ka subject fix pehle aayega. Tum abhi kuch merge mat karo. Coder "threads answered" bole to `/tpm sync 71` bolna. Decisions abhi khule hain: A43, A44, A45, F71, "push kar do" (SUB 15 + MAIN 01), "activate", aur 18 Oct ke liye ek device ya do device. Inmein se kuch bhi abhi agreed nahi hai.

## Sync (14 Oct, d24d387)

- Coder ne subject `ebc0090` kiya (69 characters), force-push. Guard, App, Site teeno green. [VERIFIED]
- Nayi commit `d24d387`: `act()` mein 409 `already_done` Arriving par success (button grey, alert nahi; e2e red-first); `shape.js` `invalid_event` → "Unknown event."; RECEIVE sticky chaar actions; SQL test arriving → delivered. Reviewer ne dobara chalaya: node 42/42, rider e2e 5/5. [VERIFIED]
- Sab 20 threads answered. Baaki sujhav F73 a–i mein gaye (event actions table, unique partial index, MAIN 01 split plan, live_check script, tracker Arriving line, 2 s latency measure, reload error message, heading polish, DEV_REF const).
- Open owner calls wahi: A45 teen hisse, A43, A44, F71 cleanup, ek ya do device, "push kar do" + "activate".
- APPROVE review 5516845168 posted as satvik-jain-iitd (state read back: APPROVED, mergeStateStatus CLEAN). Body 103 words.
- Seekha: GoServe folder mein `gh()` wrapper token klickbae8yt-star par set karta hai, `export GH_TOKEN` ke baad bhi. Reviewer posts ke liye `command gh` chahiye; pehla approve 422 "Can not approve your own pull request" aaya.
