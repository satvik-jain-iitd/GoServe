# PR #73 — feat(app): ops screen with AI suggestion and metrics

- **Branch:** `feat/51-ops-screen` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #51 "Ops screen: AI suggestion and metrics panel" (epic #36)
- **Status:** APPROVED (review 5518666086, head `3a3d416`, Guard/App/Site green) [VERIFIED]
- **Files:** 25 · **Lines:** +424 / -22 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5518666086 (APPROVE), 20 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/73

> Ek hotel ka duty manager desk. Har ready order ke saath ek slip: concierge ki salah, house rule ka chunav, aur ek chhota numbers board. Yeh PR wahi desk banati hai.

---

## Overall review

## 1. Ek-line logline
> `Ops PR: ops screen par har Ready order ki AI salah aur rule ka chunav ek slip par dikhte hain, saath mein teen numbers. Jab tracked order list se gayab ho, customer menu par wapas jaata hai.`

## 2. Big Picture (Story & Goal)
- Story #51, epic #36: "Ops screen: AI suggestion and metrics panel". [VERIFIED brief]
- S1: ek Ready order ka `decision_log` row nahi hai, to ek `decide` call jaati hai. Screen par line aati hai, jaise "AI suggests rider R2 (81%). The rule agrees." Disagree, unsure, no-suggestion aur no-rider lines bhi hain. [VERIFIED brief]
- S2: teen plain numbers: order se screen tak ka time, decision time, aaj ke runs. [VERIFIED brief]
- Extra: tracker-to-menu fix (#72 review se, pehle red test), `--ref` docstring line, F74 h–l notes. [VERIFIED brief]
- Kis ke liye: ops role wala user, paanchwa tab. Yeh tab `useOps(ready && role === "ops", ...)` se chalta hai.
- Missing: kuch nahi. Live Jev row activation ke baad aayegi. [VERIFIED brief]

## 3. Yeh ab aaya kyun? (Context)
- Pehle kya tha: `decide` route aur SUB 13 pehle se the, par deployed inactive. [VERIFIED brief]
- Pehle `decision_log` aur `run_log` par RLS on tha, par 0002 se koi policy nahi thi. Sirf service role padh sakta tha. Hotel mein: ledger tale mein tha, chaabi sirf back office ke paas. [VERIFIED brief]
- Is PR se: 0007 do read door kholta hai (`is_my_session` ke through). Ab ops screen apne session ke advice aur run rows padh sakti hai. [VERIFIED brief]
- Iske bina: screen ke paas advice aur run numbers nahi aate. [INFERRED]
- Pichhla PR: PR #72 merged `2aa2827` at 13:05Z, 20/20 threads answered. [VERIFIED brief]
- Notebook bundle (chapter 13) is PR mein nahi hai. Branch "notebook filed" se pehle cut hua tha. [VERIFIED brief]

## 4. Real-Life Analogy
Hotel. Har Ready order ek guest ki request hai. Ops screen duty manager ki desk hai.

1. `OpsScreen.tsx` = duty manager ki desk: har ready order ke liye ek slip, concierge ki salah aur house rule ka chunav, aur ek chhota numbers board.
2. `useOps.ts` = desk clerk: advice ledger padhta hai, aur jis ready order ki salah abhi nahi aayi, concierge ko ek baar ghanti bajata hai.
3. `ops.ts` = phrase book aur calculator: ledger row ko ek vaakya banata hai; median, ms format, aaj ki shuruaat.
4. `orders.ts` `askDecision` = concierge ki phone line. Wahi line, naya shabd "decide".
5. `0007_ops_read.sql` = doorman ab mehman ko apne room ka advice ledger aur run ledger padhne deta hai.
6. `useLiveOrders.ts` lags = slip par stopwatch: slip kab aaya aur kab likha gaya.
7. `App.tsx` tracker fix = receipt desk: tracked slip gayab (room clear) to menu par wapas.
8. `helpers.ts` / `ops.spec.ts` = rehearsal: nakli ledger, nakla concierge, content-range header se ginti.
9. `test_order_rpc.py` = inspector: kaun kaunsa ledger padh sakta hai.

## 5. Is PR mein naye Concepts (6)
Poori list `concepts.delta.md` mein hai: Advice vs decision in one row · Ask once, even on failure · Count without rows · Two clocks · Read rule added later · Seen-then-gone.

## 6. High-Level Flow
Journey: order ek slip ban kar desk tak jaata hai, phir numbers board tak.

1. Ops tab khulta hai → `useLiveOrders` active hota hai → orders list (wahi hook) → `useOps` active hota hai. [VERIFIED brief]
2. `useOps` pehle `currentSession()` leta hai, phir `fetchDecisions` (RLS `is_my_session` ke through). Har Ready order jiska row nahi aur jisse pucha nahi gaya: `askDecision` → MAIN 01 `decide` → SUB 13 (rule chunta hai, Jev salah deta hai) → ek `decision_log` row → refetch. Hotel: concierge ek baar ghanti bajata hai, jawab ledger mein likhta hai. [VERIFIED brief]
3. `fetchRunStats`: is session ke `run_log` rows, local midnight se (count exact), aur latest `GS MAIN 01 Order API: decide` ki duration. [VERIFIED brief]
4. Screen: har order par ek line `suggestionText(decision)` se; numbers: `lags` ka median, last decide ms, runs today. [VERIFIED brief]
5. Koi order badlta hai (status, insert, delete) to effect key badalti hai aur effect phir chalta hai. Yeh sirf padhta hai; `asked` repeat call rokta hai. [VERIFIED brief]
6. Tracker fix: customer Placed par hai. Order list mein dikha (seen). Baad mein DELETE use hata deta hai, to customer menu par wapas. Receipt desk ki tarah. [VERIFIED brief]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `app/src/screens/OpsScreen.tsx` (new) | Duty manager ki desk: ready orders ya decision wale orders, ek line har slip par, teen numbers |
| `app/src/lib/useOps.ts` (new) | Desk clerk: decisions padhta hai, aur naye ready order ke liye concierge ko ek baar bulata hai |
| `app/src/lib/ops.ts` (new) | Phrase book aur calculator: types, demo riders, suggestion line, ms format, median, aaj ki shuruaat, dono fetch |
| `app/src/lib/orders.ts` | Phone line: `callApi` ab `need` ("order" ya "decision") leta hai; `askDecision` `decide` action bhejta hai |
| `app/src/lib/useLiveOrders.ts` | Slip ka stopwatch: INSERT par `lags` mein ek number jodta hai |
| `app/src/lib/live.ts` | Board ka announcement: `onOrder(order, eventType)` ab event type bhi deta hai |
| `app/src/App.tsx` | Lobby: paanchwa tab Ops, `useOps` ka switch, aur receipt desk wala tracker fix |
| `app/src/styles/app.css` | Paint: `.roles` wrap, `.metrics` grid |
| `app/supabase/migrations/0007_ops_read.sql` (new) | Doorman ke do naye niyam: decision_log aur run_log ke select, sirf apne session ke |
| `app/tests/e2e/helpers.ts` | Nakli ledger aur nakla concierge: decision_log, run_log (content-range se count), `decide` jawab |
| `app/tests/e2e/ops.spec.ts` (new) | Rehearsal: 6 specs (S1 four cases, S2 two cases) |
| `app/tests/e2e/split.spec.ts` | Rehearsal: tracker ka menu par wapas jaana (S3) |
| `app/tests/unit/ops.test.ts` (new) | Phrase book ke chhote niyam: 5 suggestion lines, rider label, ms, median, demo riders |
| `app/tests/unit/orders.test.ts` | Phone line ka test: `askDecision` ka body aur refusal |
| `scripts/test_order_rpc.py` | Inspector: kaun kaunsa ledger padh sakta hai (own, joined, others, anon) |
| `scripts/clear_dev.py` | Housekeeping ke darwaze par ek docstring line (`--ref`) |

## 8. Pieces aapas mein kaise baat karte hain
```
App.tsx ──> screens/OpsScreen.tsx (Ops tab)
App.tsx ──> lib/useOps.ts (useOps(ready && role === "ops", orders, api))
OpsScreen.tsx ──> lib/ops.ts, lib/kitchen.ts
useOps.ts ──> lib/orders.ts (askDecision), lib/ops.ts, lib/session.ts
orders.ts ──> MAIN 01 "decide" (callApi, need = "decision")
MAIN 01 ──> SUB 13 (rule chunta hai, Jev salah deta hai) ──> decision_log (ek row)
ops.ts ──> decision_log, run_log (padhte hain 0007 ke through, is_my_session)
useLiveOrders.ts ──> lags (INSERT par) ──> OpsScreen numbers
```

## 9. Pehle se kya badla
- +424 / -22 in 25 files. [VERIFIED brief]
- Naya: `OpsScreen.tsx`, `useOps.ts`, `ops.ts`, `0007_ops_read.sql`, `ops.spec.ts`, `ops.test.ts`.
- Badla: `orders.ts` (+15/-7), `useLiveOrders.ts` (+9/-2), `live.ts` (+2/-2), `App.tsx` (+19/-4), `app.css` (+6), `helpers.ts` (+18/-4), `split.spec.ts` (+12), `orders.test.ts` (+15/-1), `test_order_rpc.py` (+16), `clear_dev.py` (+1).
- Docs: ADR-012 (proposed), ADR-010/011 notes, A47 (open), F63 adds 0007, F74 h–l (from the #72 replies), F75 a–e, test-cases 8 rows, LEARNINGS 3 rows, trace 2 rows.

## 10. Macro Risks & Downstream Impact
1. **Refuse hua `decide` slip ko "Asking for a suggestion…" par atka deta hai.** Refused call (503 kill switch, 401, Jev down) par slip kabhi "no suggestion" nahi kehta. Upar alert dikhta hai. Impact: demo mein confusion agar n8n paused ho. Evidence: `OpsScreen.tsx` line 26, `useOps` `asked` ref. [VERIFIED]
2. **Do device, double ask.** Dono Ops tab par ho to dono ek hi Ready order ke liye `decide` pooch sakte hain row banne se pehle. Do Jev call, do rows, newest dikhta hai. SUB 13 "ek decision per order" check nahi karta. Impact: cents, F75 c. Evidence: SUB 13 mein koi check nahi. [VERIFIED code read]
3. **Dev URL par live nahi.** Dev par har Ready order par alert aata hai (n8n inactive, webhook 404). Impact: activation tak expected. Evidence: PR body, test-cases "Pending activation". [VERIFIED]
4. **"Runs today" poore system ka nahi, sirf is session (is demo) ka hai.** Investor ise system-wide samajh sakta hai. Evidence: `ops.ts` line 50, ADR-012 line 26. [VERIFIED]
5. **`lags` reset par saaf nahi hote.** Median purane run se mix hota hai, aur apne device ke orders bhi ginte hain. Impact: chhota. Evidence: `useLiveOrders.ts` line 33. [VERIFIED]
6. **Har order change par do REST reads.** Demo scale par theek. Evidence: `useOps.ts` line 14. [VERIFIED]
7. **`run_log` ab session ke liye padhne layak hai.** Workflow naam, duration, cost, error text dikh sakte hain. Personal data nahi. Impact: link wale ko demo ka kharcha dikh sakta hai. Evidence: 0007, ADR-012. [VERIFIED]
8. **Notebook chapter 13 is PR mein nahi.** Impact: bundle ek PR baad aayega, agar ab nahi jodha. Evidence: file list. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Charts nahi. Kyun: story ponytail note; plain numbers. [VERIFIED brief]
- Riders table nahi. Kyun: A42 aur A47 ke fixed demo riders; pilot ke liye (F75 d). [VERIFIED brief]
- "Ek decision per order" DB rule nahi. Kyun: F75 c; demo scale par cents. [VERIFIED brief]
- `decision_log` par Realtime nahi. Kyun: orders ke badalne se refetch hota hai; ek screen ke liye kaafi. [VERIFIED brief]
- Prod migration 0007 nahi. Kyun: F63, release day. [VERIFIED brief]
- Live Jev row nahi. Kyun: "activate" chahiye. [VERIFIED brief]

## 12. Testing Story
- Red pehle: `ops.test.ts` mein "Cannot find module '../../src/lib/ops'"; `askDecision is not a function`; SQL test `test_a_device_reads_decisions_and_runs...` 1 failure (19 tests); tracker e2e `toHaveCount(0)` par fail. Quote PR body se, run INFERRED. [VERIFIED quote, INFERRED run]
- Green, reviewer ne dobara chalaya: tsc clean, vitest 66/66, playwright 35/35, node 42/42, `scripts/test_order_rpc.py` 19 OK (goserve-dev par, rollback), clear_dev dry run OK. [VERIFIED]
- Test ginti: unit 11 naye (ops.test.ts 9, orders.test.ts 2), e2e 7 naye (ops.spec.ts 6, split.spec.ts 1), SQL 2 naye. [VERIFIED brief]
- Scenarios: S1 (chaar cases), S2 (do cases). Live Jev row activation ke baad. [VERIFIED brief]

## 13. Trade-offs & Alternatives
| Chuna | Chhoda | Kyun |
|---|---|---|
| Phone se Ready par decide poochna, kitchen ke Ready tap se nahi | Decision tabhi banega jab koi Ops kholega; do screen double-ask kar sakti hain | Kitchen tap pehle se hai; decision ka view ops screen ka kaam hai |
| Ek effect, key = ids + statuses | Realtime nahi; do REST reads har change par | Naya channel nahi chahiye |
| Device clock se lag | Clock skew (F75 b) | Server round trip nahi |
| Per-session read policies | "Runs today" system ka nahi, sirf demo ka | `is_my_session` pehle se hai; paanch SQL lines |
| `callApi` mein `need` flag | Looser return type (casts) | Ek hi error shape |

## 14. Patterns is PR se
- **Advice aur decision ek row mein:** `rule_pick` faisla hai, `jev` sirf salah (`agrees`, `confidence`). Screen dono bolta hai. (hotel: house rule porter chunta hai, concierge sirf sujhav deta hai)
- **Ek baar poocho, fail par bhi:** `asked` ref refused call ko loop nahi hone deta. (concierge ko ek baar ghanti)
- **Ginti bina rows:** `count: "exact"` + `limit` header se total deta hai. (ledger ka page count)
- **Taala baad mein khulta hai:** table pehle band (no policy), har story ek darwaza kholti hai (0007). (ledger back office se lobby tak, ek guest ek room)
- **Dekha-phir-gayab:** ref yaad rakhta hai ki order list mein tha; khali pehla load reset nahi samjha jaata. (receipt desk)

## 15. AI-Review Lens
- **Trust:** suggestion wording (unit test, workflow ke exact decision statuses ke saath), RLS tests (rollback), no-loop e2e. [VERIFIED brief]
- **Interrogate:** koi bhi claim ki ops screen "live" kaam karti hai (abhi kuch active nahi), refused call par "Asking…" state, aur do-device double-ask. [VERIFIED brief]

## 16. Questions
- **Top-3 abhi poocho:** (1) `app/src/screens/OpsScreen.tsx` line 26, refused decide par slip; (2) `docs/assumptions.md` line 57, A47 ke teen hisse; (3) `app/src/lib/useOps.ts` line 26, do device par double ask.
- Poora bank: "Comment blocks" mein 20 sawaal, file-wise.

## 17. Self-check
- Decide call refuse ho to slip par kya dikhta hai, aur kyun? (OpsScreen line 26)
- "Runs today" kis ka number hai: system ka ya is demo ka? (ADR-012)
- Do device Ops khole to ek order par kitne Jev call ho sakte hain, aur kaun rokta hai? (F75 c)

---

## Comment blocks (20 posted, review 5518666086, har block mein GitHub id)

<!-- gh-comment-id: 4271400256 --> `app/src/screens/OpsScreen.tsx:26` · Risk · **Top-3**
> Decide call refuse ho (503 kill switch, Jev down) to slip hamesha "Asking for a suggestion…" dikhata hai aur upar alert. `asked` ref dobara nahi poochta (sahi), par slip kabhi "No suggestion: <reason>" nahi kehta. Demo mein n8n paused ho to yeh confusing. Ek line: failed ids ka set bhi rakho aur slip par reason dikhao? Ya rehne do (F75)?
- **Reply (klickbae8yt-star):** Fixed in the #54 PR. A slip with a refused decision now says why: "No suggestion: <reason>". The test is red first.
- **Status:** answered

<!-- gh-comment-id: 4271400282 --> `docs/assumptions.md:57` · Assumptions · **Top-3**
> A47 teen hisse: (1) ops paanchwa tab, Ready par ek `decide` call teen fixed riders ke saath (rule R2 chunta hai); (2) "Order to this screen" = device clock vs server `created_at` (median), "Decision time" = aakhri decide run, "Runs today" = is session ke run_log rows aaj se; (3) charts nahi. Owner se alag haan ya na, A47 aur ADR-012 (phone decision_log + run_log padhta hai) par.
- **Reply (klickbae8yt-star):** These two need the owner's own yes, apart from the merge. A47 stays Open until then. ADR-012 is accepted by the merge.
- **Status:** answered

<!-- gh-comment-id: 4271400300 --> `app/src/lib/useOps.ts:26` · Impact · **Top-3**
> Do device, dono Ops tab par: Ready order ke liye dono `decide` poochh sakte hain row banne se pehle (F75 c): do Jev call, do rows, screen newest dikhata hai. SUB 13 "ek decision per order" check nahi karta (maine code dekha). Demo scale par cents. Par 18 Oct par kitchen device Ops kholega? Agar haan, DB rule `unique (order_id)` partial index 1 line hai: abhi ya F75?
- **Reply (klickbae8yt-star):** I looked at SUB 13: it does not check for a second decision, so a unique rule alone would turn the second insert into a 502. A fix needs the rule and a workflow change. It only matters if the kitchen device opens Ops on 18 Oct. I kept it in F75 (j). Say if you want it earlier.
- **Status:** answered

<!-- gh-comment-id: 4271400322 --> `app/src/lib/ops.ts:30` · Understanding
> `suggestionText`: rule_pick none → "No rider is free."; jev ok → "AI suggests R2 (81%). The rule agrees/picked Rn."; low confidence → "too unsure to use"; warna "AI gave no suggestion (reason)". Status naam `decide_result.js` se match karte hain (maine dono padhe). Naya status workflow mein aaye to yahan "no reason given": theek, par ek LEARNINGS line: do jagah ek list.
- **Reply (klickbae8yt-star):** Agreed. I added a LEARNINGS line: the two lists drift apart, and "no reason given" is the safe fallback.
- **Status:** answered

<!-- gh-comment-id: 4271400333 --> `app/src/lib/useOps.ts:14` · Understanding
> Effect key = sab orders ke id+status. Har order change par decisions aur run stats dobara padhe jaate hain (do REST reads). Demo scale theek. Sawal: `decision_log` par Realtime kyun nahi? Mera samajh: order change hi decision ko trigger karta hai, to ek channel bachaya. Sahi?
- **Reply (klickbae8yt-star):** Yes, your reading is right. An order change is what causes a decision, and the screen already listens to orders. One channel less.
- **Status:** answered

<!-- gh-comment-id: 4271400345 --> `app/src/lib/ops.ts:60` · Risk
> `count: "exact"` + `limit(50)`: ginti header se aati hai, rows sirf 50. "Decision time" = in 50 mein pehla `: decide` row. 50 se zyada runs aaj aur aakhri decide purana ho to null dikhega ("No decision yet."). Demo mein 20 orders x ~5 calls = 100 runs: ho sakta hai! `.eq("workflow", "GS MAIN 01 Order API: decide").limit(1)` alag query, ya limit hatao?
- **Reply (klickbae8yt-star):** You are right: with about 100 runs in a demo, the last decide row could fall out of the first 50. Fixed in the #54 PR. The count is now its own head query, and the last decide run has its own query. The test has 60 other runs and was red first.
- **Status:** answered

<!-- gh-comment-id: 4271400357 --> `app/src/lib/ops.ts:50` · Understanding
> `startOfToday` device ki local midnight hai, ISO (UTC) mein bheji jaati hai: Delhi 00:00 = 18:30Z pichhle din. Server `created_at` UTC: compare sahi. "Runs today" = is session ke, system ke nahi (ADR-012). Demo mein investor "today" ko poore system ka samjhega: label "Runs today (this demo)"?
- **Reply (klickbae8yt-star):** Agreed. The label now says "Runs today (this demo)".
- **Status:** answered

<!-- gh-comment-id: 4271400376 --> `app/src/lib/useLiveOrders.ts:33` · Understanding
> Lag sirf INSERT par: `now - created_at`, negative → 0 (do ghadiyan, F75 b). Apne hi device ka order bhi ginta hai. Reset par `lags` saaf nahi hota: median purane run se mix. Ek line `setLags([])` reset mein? Ya F75 b ke saath.
- **Reply (klickbae8yt-star):** Fixed in the #54 PR. The timings reset when a delete arrives and when this device resets. Counting this device's own orders is on purpose: it is the same path the kitchen screen sees.
- **Status:** answered

<!-- gh-comment-id: 4271400393 --> `app/src/lib/orders.ts:17` · Risk
> `callApi(body, deps, need)`: `answer[need]` check. `need="decision"` par `order` nahi chahiye: sahi, SUB 13 order nahi bhejta. Return type ab `ApiAnswer`, callers `as PlacedOrder` cast karte hain. Cast = TypeScript par bharosa kam; ek overload ya generic `need` se type aata? Ponytail: rehne do, bas jaan lo.
- **Reply (klickbae8yt-star):** Understood. I kept the cast for now (ponytail). If more answer types come, a generic return type is the next step.
- **Status:** answered

<!-- gh-comment-id: 4271400416 --> `app/src/lib/orders.ts:53` · Testing
> `askDecision` `riders` body mein bhejta hai (A42: free flag aur distance phone ki baat). `decide_guard.js` riders 1..10, unique ids, `free` boolean check karta hai: DEMO_RIDERS pass. Unit test body aur refusal dono cover karta hai. Live row activation ke baad: SUB 13 execution id + Jev ms is row mein.
- **Reply (klickbae8yt-star):** Agreed. After activation I write the SUB 13 execution id and the Jev time into the live row.
- **Status:** answered

<!-- gh-comment-id: 4271400428 --> `app/supabase/migrations/0007_ops_read.sql:5` · Impact
> `run_log` ab session ke liye padhne layak: workflow naam, duration, cost, error text. Personal data nahi. Link rakhne wala demo ka kharcha dekh sakta hai: theek. `params` band hai (ADR-012). SQL test (maine chalaya, 19 OK) joined + own padhta hai, doosra nahi, anon kuch nahi.
- **Reply (klickbae8yt-star):** Thanks. The tables hold ids, times, costs and error codes only, no personal data.
- **Status:** answered

<!-- gh-comment-id: 4271400443 --> `app/src/App.tsx:45` · Understanding
> Tracker fix: `trackedSeen` ref: order list mein dikha, phir gayab → menu. Pehle load par list khali ho to kuch nahi hota (sahi: INSERT abhi aaya nahi). Edge: reconnect par `reload` merge karta hai, hataata nahi (F74 h), to remote reset ke baad bhi DELETE event hi raasta hai. Theek.
- **Reply (klickbae8yt-star):** Yes. The cart is already empty after an order is placed, so the remote path only needs the tracker and the step.
- **Status:** answered

<!-- gh-comment-id: 4271400457 --> `app/src/App.tsx:42` · Understanding
> `useOps(ready && role === "ops", orders, api)`: Ops tab band → effect band, par `asked` ref rehta hai. Kitchen tab se Ready dabao → Ops par aao → tab poochta hai. Split view mein Ops nahi hai: demo mein ops screen teesra device ya laptop tab? #56 checklist line.
- **Reply (klickbae8yt-star):** Right: the `asked` list stays when the tab closes, so nothing is asked twice. Split view has no Ops tab. I added it to F75 (k): open Ops on a third device or a laptop tab, and put that in the #56 checklist.
- **Status:** answered

<!-- gh-comment-id: 4271400487 --> `app/tests/e2e/ops.spec.ts:35` · Testing
> "refused call shows the reason once and does not loop": 1.5 s wait ke baad call count 1. Acha guard. Par 1.5 s mein effect dobara chalne ke liye order change chahiye, jo test mein nahi aata. Loop ka asli trigger = key change. Ek UPDATE push karke phir count 1 check: loop proof pakka.
- **Reply (klickbae8yt-star):** Good point. The test now pushes an order update (the real loop trigger), waits, and checks the call count is still 1.
- **Status:** answered

<!-- gh-comment-id: 4271400492 --> `app/tests/e2e/ops.spec.ts:52` · Testing
> Metrics: lag live INSERT se (700 ms purana created_at), decision 420 ms, runs 7 content-range se. Fake run_log header `0-0/7` deta hai: asli PostgREST bhi `content-range` `exact` par deta hai aur browser ko `access-control-expose-headers` chahiye (helpers line 6 mein add kiya). Asli Supabase yeh header expose karta hai? Live row mein check.
- **Reply (klickbae8yt-star):** The fake exposes the header on purpose. Real Supabase answers browser count queries with `content-range`; supabase-js reads it in browsers in normal use. The live row checks it, and I added it to that row.
- **Status:** answered

<!-- gh-comment-id: 4271400509 --> `app/tests/e2e/split.spec.ts:86` · Testing
> #72 review ka optional item red-first: UPDATE se tracker "Accepted" (list padhta hai proof), phir DELETE → menu. Acha. `placed` saaf hone par `keyRef`/cart bhi saaf hona chahiye? `reset()` wala raasta karta hai; remote wala sirf `placed`+`step`. Cart khali hi hoga (order ke baad). Theek?
- **Reply (klickbae8yt-star):** Yes. The cart is empty after an order is placed (`place` clears it), so the remote path only clears the tracker and the step.
- **Status:** answered

<!-- gh-comment-id: 4271400525 --> `scripts/test_order_rpc.py:162` · Testing
> Seed decision_log + run_log A aur C ke liye; B kuch nahi, A apna, B join ke baad A ka. `kitchens limit 1` se kitchen_id. Rolled back. Yeh test 0007 ke bina fail hota (body: 1 failure): red proof. Prod par 0007 F63 mein: release checklist (F64 a) ab 7 files.
- **Reply (klickbae8yt-star):** Thanks. Migration 0007 is in the F63 list, so the release checklist has seven files.
- **Status:** answered

<!-- gh-comment-id: 4271400534 --> `app/tests/e2e/helpers.ts:15` · Testing
> `decisionOf` default = R2, 0.81, agrees. Fake decide ke baad `state.decisions` mein ek row. Asli SUB 13 `decision` mein `use_case, options, state, params_version, chosen_by` bhi bhejta hai: screen sirf 4 fields padhta hai, baaki ignore. Shape test (`event.test.js` jaisa) `decide_done` output vs `Decision` type ke liye hai? Nahi to F75.
- **Reply (klickbae8yt-star):** A shape test between `decide_done` and the `Decision` type does not exist yet. I added it to F75 (i).
- **Status:** answered

<!-- gh-comment-id: 4271400545 --> `docs/follow-ups.md:82` · Impact
> F75 a–e: live row, clock skew, double-ask, riders table, per-session runs. Jodna: (f) "Asking…" state on refused call, (g) `limit(50)` vs last decide row, (h) `lags` reset. Aur F74 h–l #72 replies se aaye: acha, ek jagah.
- **Reply (klickbae8yt-star):** Done. F75 now has f to k, and the #54 PR marks which ones are fixed.
- **Status:** answered

<!-- gh-comment-id: 4271400567 --> `docs/tests/test-cases.md:108` · Impact
> Live row "AI suggests rider R2 (nn%)" asli Jev call se, activation ke baad. Jev `agrees` tab true jab Jev bhi R2 chune: asli model R1 bhi chun sakta hai, line "The rule picked R2." hogi. Row ka expected text dono ko allow kare. Execution ids + ms yahin.
- **Reply (klickbae8yt-star):** Agreed. The row now allows both lines: "The rule agrees." and "The rule picked R2.". The execution ids and the Jev time go there.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #73 approve ho chuka hai. Coder ka notebook commit aaye to merge karo (feat/51-ops-screen -> dev); nahi aaya to abhi merge karo, bundle agle PR mein aayega.
A47 aur ADR-012 par alag haan ya na do. "activate" abhi alag shabd hai, woh abhi nahi bola gaya.
Ops screen demo mein kis device par chalega (#56)? Yeh bhi batao.
```

Coder paste-block (English):
```
State: 20 posted · 0 must-fix · actor: coder, then owner (merge)

Developer for GoServe PR #73 (feat/51-ops-screen). Do this: (1) copy the notebook bundle (chapter 13 and rows, from tpm/bundle/) onto this branch and commit it as one docs commit before you push; (2) reply on all 20 review threads in 1-2 sentences each, by comment id; (3) change code only if a reply says a change is needed, in one commit; optional: show a reason on the refused decide slip, and drop limit(50) or query the last decide row directly; (4) deploy and activate nothing; the owner must say "activate" separately; (5) continue development: start story #54 "Health check page (Supabase, n8n, Jev)" (epic #37) on feat/54-health-check from dev.
```

posted as satvik-jain-iitd, review 5518666086 (APPROVE), 20 inline threads
