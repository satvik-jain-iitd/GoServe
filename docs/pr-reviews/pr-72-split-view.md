# PR #72 — feat(app): split view, shared session by link and reset

- **Branch:** `feat/52-split-view` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #52 "Split view, own space per session and reset" (epic #37)
- **Status:** APPROVED (review 5518295016, head `00936b4`, Guard/App/Site green) [VERIFIED]
- **Files:** 32 (14 notebook bundle files andar) · **Lines:** +1073 / -93 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5518295016 (APPROVE), 20 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/72

> Ek dhaba, do screen: customer aur kitchen ek hi table par. Dusra device ek link se usi session mein jud sakta hai, aur reset dono ke orders saaf karta hai. Yeh PR hotel ki chaabi, guest list aur housekeeping ki tarah kaam karta hai.

---

## Overall review

## 1. Ek-line logline
> `Split PR: ek screen par customer aur kitchen dono dikhte hain. Ek session ka link doosre device ko bhi de sakte hain, aur reset us session ke orders dono devices se saaf karta hai.`

## 2. Big Picture (Story & Goal)
- Story #52, epic #37: "Split view, own space per session and reset". [VERIFIED brief]
- S1: ek hi screen par customer pane aur kitchen pane, side by side. [VERIFIED brief]
- S2: doosra device `?join=<session id>` se jud kar sirf wahi session padhta hai. [VERIFIED brief]
- S3: reset ke baad "yes" par session ke orders, events aur decisions dono devices se saaf hote hain. [VERIFIED brief]
- Extra: F71 cleanup script `scripts/clear_dev.py` (owner ki haan, dry run default). [VERIFIED brief]
- Gherkin se kuch chhuta nahi. Live two-device check activation ke baad hoga. [VERIFIED brief]

## 3. Yeh ab aaya kyun? (Context)
- Pehle kya tha: brief mein nahi tha.
- Is PR se kya unlock hota hai: S1, S2 aur S3 teeno ek saath. Ops screen (#51) ka agla kaam bhi isi PR ke baad shuru hota hai, kyunki woh `decision_log` aur `run_log` padhta hai jo SUB 13 aur 14 pehle se likhte hain. [VERIFIED brief]
- Iske bina kya nahi ho paata: brief mein nahi tha.

## 4. Real-Life Analogy
Hotel. Har session ek room hai. Link ek chaabi hai. Reset housekeeping ka kaam hai.

1. `session.ts` = key card desk: batata hai ki yeh guest kis room mein kaam karega, apne room mein ya dost ke room mein.
2. `0006_demo_sessions.sql` = guest list, "room share" ka niyam, aur housekeeping ki master key (reset).
3. `session_links` table = guest list: kaun kaunse room mein ja sakta hai.
4. `is_my_session` = doorman ki check: aapka room, ya woh room jiske liye aapko invite mila hai.
5. `join_session` = guest list par invite ke saath naam likhna.
6. `reset_session` = housekeeping ek room saaf karti hai. Hotel ka ledger (`run_log`) waise hi rehta hai.
7. `DemoBar.tsx` = front desk ke buttons: "dost ko chaabi do", "mera room saaf karo (pakka?)".
8. `App.tsx` = lobby: invite URL se padhta hai, sign-in ka intezaar karta hai, phir live board kholta hai.
9. `live.ts` = board deewar par: ek room padhta hai; sab rooms ka "room saaf hua" sunta hai, sirf apni slips girata hai.
10. `split.spec.ts` = rehearsal: nakli front desk aur nakli ghanti, jo ab delete par bhi bajti hai.
11. `clear_dev.py` = poore training hotel ki housekeeping (sirf dev), default mein sirf ginti.

## 5. Is PR mein naye Concepts (6)
Poori list `concepts.delta.md` mein hai: Link as the key · Security definer function in a read rule · A door in a frozen table · Unfilterable deletes · Gate before the live list · Dry run by default.

## 6. High-Level Flow
1. Device B `/?join=<A>` kholta hai → `joinCode` uuid check karta hai → `ready=false`, live list ruki rehti hai. [VERIFIED brief]
2. `ensureSession()` (B ka apna anonymous user) → `join_session(A)` → `session_links` mein row → `rememberJoin(A)` localStorage mein → URL saaf → `ready=true`. [VERIFIED brief]
3. `useLiveOrders` → `currentSession()` = A → `fetchOrders(A)` (RLS `is_my_session(A)` link ki wajah se true) → channel `orders-A` aur DELETE listener. [VERIFIED brief]
4. B order deta hai → session A ke saath n8n `place_order` → dono devices par INSERT. [VERIFIED brief]
5. Kitchen tap B par → `changeStatus` order ke `session_id` (A) ke saath, rasta purana hi. [VERIFIED brief]
6. Reset kisi bhi device par → `reset_session(A)` → `is_my_session` check → transaction ke liye flag on → events, decisions, orders delete → DELETE sab khule screens tak jaata hai; har screen apne paas ke ids girata hai. Reset karne wala device cart, placed, step, `arrived` aur idempotency key bhi saaf karta hai. [VERIFIED brief]
6d. Join aur reset ek hi guest list se chalte hain: join par naam likha jaata hai, reset par housekeeping us room ka saaf karta hai (flow 2 aur 6 ka saar). [INFERRED brief]
7. Split tab → `customerView` aur `kitchenView` ek two-column grid mein, ek hi `orders` list ke saath. [VERIFIED brief]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `app/src/App.tsx` | Lobby: join effect `?join=` par, `ready` gate, `reset()`, `shareLink`, split pane, chaar tabs |
| `app/src/lib/session.ts` (new) | Key card desk: `joinCode`, `rememberJoin` / `activeSession`, `joinLink`, `joinSession` aur `resetSession` rpc, `currentSession` |
| `app/src/lib/live.ts` | Board: `fetchOrders` ab session ke hisaab se filter karta hai; `watchOrders` ek unfiltered DELETE listener jodta hai |
| `app/src/lib/useLiveOrders.ts` | Board boy: ab key card desk se poochta hai ki kaunsa room; delete par slips utarta hai |
| `app/src/screens/DemoBar.tsx` (new) | Front desk buttons: link copy (fallback mein link dikhta hai), reset ka yes/no step, status lines |
| `app/src/styles/app.css` | Paint: `.demobar`, `.shell.split`, `.panes` do column |
| `app/supabase/migrations/0006_demo_sessions.sql` (new) | Guest list, doorman, invite aur housekeeping ke niyam (sab SQL rules) |
| `app/tests/e2e/helpers.ts` | Nakli front desk aur nakli ghanti: ab rpc calls record hoti hain, DELETE bhi bajti hai |
| `app/tests/e2e/split.spec.ts` (new) | Rehearsal: 6 specs (S1 side by side, S2 join aur read, S2 link, S3 ask/yes/no, S3 doosre device se delete) |
| `app/tests/integration/supabase.test.ts` | Asli dev hotel test: joined device INSERT < 2 s, reset DELETE dono devices par |
| `app/tests/integration/kitchen.test.ts` | `fetchOrders` ka naya signature |
| `app/tests/unit/session.test.ts` (new) | Key card desk ke chhote niyam: code, active session, link, reset ok/fail |
| `scripts/clear_dev.py` (new) | Dev housekeeping: ginti, `--apply` par paanch tables saaf, sirf dev ref |
| `scripts/test_clear_dev.py` (new) | Check: dusra ref refuse, dry run ek select, apply ek transaction |
| `scripts/test_order_rpc.py` | Inspector: 6 naye tests, har darwaaze ka niyam, sab rollback |

## 8. Pieces aapas mein kaise baat karte hain
```
App.tsx ──> lib/session.ts (join, reset, share link)
App.tsx ──> screens/DemoBar.tsx (copy link, reset)
App.tsx ──> lib/useLiveOrders.ts ──> lib/session.ts (currentSession)
useLiveOrders.ts ──> lib/live.ts (fetchOrders, watchOrders)
session.ts ──> lib/supabase.ts (rpc join_session, reset_session)
0006 (DB) ──> session_links, is_my_session, join_session, reset_session
clear_dev.py ──> dev DB (Management API), same reset flag
```

## 9. Pehle se kya badla
- +1073 / -93 in 32 files. Ismein 14 notebook bundle files bhi hain. [VERIFIED brief]
- Naya: `session.ts`, `DemoBar.tsx`, migration `0006_demo_sessions.sql`, `split.spec.ts`, `session.test.ts`, `clear_dev.py`, `test_clear_dev.py`. [VERIFIED brief]
- Badla: `App.tsx` (+67/-25), `live.ts` (+9/-4), `useLiveOrders.ts` (+5/-4), `helpers.ts` (+19/-7), `test_order_rpc.py` (+50), `kitchen.test.ts` (+1/-1). [VERIFIED brief]
- Docs: ADR-011 (proposed), ADR-010 note, A43/A44/A45 Confirmed, A46 naya (open), F63, F64, F71, F74 (a–g), test-cases 8 rows, LEARNINGS 3 rows. [VERIFIED brief]

## 10. Macro Risks & Downstream Impact
1. **Link hi chaabi hai:** jiske paas `?join=<id>` hai woh session padh aur reset kar sakta hai. Leak hua link = pitch ke beech demo saaf. Evidence: `join_session` sirf dekhta hai ki session hai. [VERIFIED]
2. **Joined device localStorage mein tika rehta hai** jab tak site data saaf na ho. Agle din naya session follow nahi hota. [VERIFIED]
3. **Delete events sab subscribers tak jaate hain** (sirf order ids). Leak = sirf id; screen sirf apne ids girata hai. [VERIFIED code, INFERRED test]
4. **Customer Placed screen par purana tracker** remote reset ke baad tab tak dikhta hai jab tak "Order again" na dabe. Sirf live list khali hoti hai. [INFERRED]
5. **Realtime + RLS + function:** session A ka INSERT subscriber B tak pahunchna sirf coder ke integration test se prove hai, is baar dobara nahi chalaya. Demo ka do-device sach yahi hai. [INFERRED]
6. **`reset_session` koi bhi joined member chala sakta hai.** Host ko bhi wipe kar sakta hai. Demo ke liye theek, pilot ke liye ajeeb. [VERIFIED]
7. **`is_my_session` har row par har read aur har Realtime change par chalta hai.** Demo scale par koi asar nahi; PK hi index hai. [VERIFIED]
8. **`clear_dev.py --apply` 5 tables ki saari rows hataata hai** (run_log aur saare sessions bhi). Sirf dev, dusre ref par refuse. Bada button hai. [VERIFIED]
9. **MAIN 01 node count:** 27 nodes canvas par, sticky notes ko chhod kar cap test 20 se neeche. Koi asar abhi nahi; F73 c split plan khula hai. [VERIFIED]
10. **Live two-device row:** activation ke baad hi. Activation tak workflows active nahi hain (n8n par verify hua). Live path ka asar abhi nahi dikh sakta. [VERIFIED brief, live path INFERRED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Leave button aur QR code nahi (F74 a, d; ponytail). [VERIFIED brief]
- Accounts aur sign up nahi (story ponytail note; MVP 1). [VERIFIED brief]
- Prod migration 0006 nahi (F63, release day). [VERIFIED brief]
- Live two-device check nahi (activation chahiye; test-cases row "Pending activation"). [VERIFIED brief]
- `run_log` reset nahi: operations history jaan-boojh kar rakhi hai (F74 e). [VERIFIED brief]

## 12. Testing Story
- Red pehle: `session.test.ts` `src/lib/session` import nahi kar paaya; `test_order_rpc.py` mein "function join_session(unknown) does not exist" (2 failures, 3 errors); split e2e build nahi hua. Quote PR body se, run INFERRED. [VERIFIED quote, INFERRED run]
- Green, reviewer ne dobara chalaya: vitest 55/55, playwright 28/28, node 42/42, SQL `test_order_rpc.py` 17 OK (goserve-dev par, rollback), `test_clear_dev.py` 3 OK, tsc clean. [VERIFIED]
- Integration vitest (goserve-dev, 6 tests, joined-device 2 s row sahit) reviewer ne nahi chalaya kyunki woh rows chhodta hai. Coder ka claim pass hai. [INFERRED]
- Scenarios: S1, S2, S3 sab cover. Live two-device row activation ke baad. [VERIFIED]
- Test ginti: unit 6, e2e 6, SQL 6 naye, integration 1 naya, clear_dev 3. [VERIFIED]

## 13. Trade-offs & Alternatives
| Chuna | Chhoda | Kyun |
|---|---|---|
| `session_links` + `is_my_session` | "session id localStorage mein copy karo aur maan lo" | RLS ko device B ko A ki rows padhne dena hai; client ki chaal kaam nahi aati. Chhoda: ek table aur ek security definer function [VERIFIED brief] |
| Transaction-local flag | Frozen trigger hata dena | Events doosron ke liye frozen rehte hain. Chhoda: `clear_dev.py` ko bhi wahi flag set karna padega (hidden coupling) [VERIFIED brief] |
| Unfiltered DELETE listener | "reset" broadcast message | Zero extra infrastructure. Chhoda: har client har delete id sunta hai [VERIFIED brief] |
| Reset rows delete karta hai | Naya session shuru karna | Dono devices apna link rakhte hain; 20-order cap bhi reset hota hai (F70 a). Chhoda: us demo ka history [VERIFIED brief] |
| Clipboard copy + visible fallback | QR code | Clipboard kuch browsers mein block hota hai. Chhoda: QR (F74 d) [VERIFIED brief] |

## 14. Patterns is PR se
- **Link as the key:** random uuid URL mein hi lock hai; jiske paas woh hai, woh padh aur reset kar sakta hai. Dekho `session.ts`, ADR-011. [VERIFIED brief]
- **Security definer in a read rule:** function owner ke rights se chalta hai taaki policy woh table padh sake jo phone nahi padh sakta. Dekho `0006` line 13. [VERIFIED brief]
- **One-way door in a frozen table:** trigger DELETE tabhi jaane deta hai jab transaction-local flag on ho. Dekho `0006` line 44. [VERIFIED brief]
- **Shouting delete:** Realtime DELETE column se filter nahi hota, sirf id jaati hai; har screen apne ids girata hai. Dekho `live.ts` line 22. [VERIFIED brief]
- **Gate before the live list:** `ready` flag live list ko join khatam hone tak rokta hai, taaki galat room se subscribe na ho. Dekho `App.tsx` line 37. [VERIFIED brief]
- **Dry run by default:** cleanup script pehle sirf ginti karta hai; `--apply` ke bina kuch nahi hatata, aur dev ke alawa kuch nahi chhuta. Dekho `clear_dev.py`. [VERIFIED brief]

## 15. AI-Review Lens
- **Trust:** SQL tests (17 OK, rollback), e2e fake network par, aur deploy/activation ki line (kuch active nahi, n8n par verify hua). [VERIFIED brief]
- **Interrogate:** "goserve-dev par prove hua" wale dave jin par rerun nahi hua (2 s joined-device row); "link hi chaabi hai" wali security kahani; reset ke baad Placed screen ka purana tracker; aur frozen table ka ek darwaza: doosra code `goserve.reset` kahan set karta hai? [VERIFIED/INFERRED as marked brief]
- **Confident but risky:** clean split screen aur neat reset dekh kar lagta hai sab kaam kar raha hai. Asli do-device proof abhi nahi hua. [INFERRED]

## 16. Questions
- **Top-3 abhi poocho:** (1) `app/supabase/migrations/0006_demo_sessions.sql` line 34, link ki security aur reset; (2) `app/tests/integration/supabase.test.ts` line 120, joined-device test ka rerun aur execution id; (3) `app/src/App.tsx` line 139, reset ke baad Placed screen ka purana tracker.
- Poora bank: "Comment blocks" mein 20 sawaal, file-wise.

## 17. Self-check
- Link kisi ko de diya to woh kya kar sakta hai? Kya woh host ko bhi rok sakta hai?
- Reset dono devices par orders kaise saaf karta hai, jab run_log ko chhoda gaya hai? Kyun?
- Joined device ka live list kab chalna shuru hota hai, aur join fail ho to kya hota hai? (brief mein `ready` gate ka rule hai)

---

## Comment blocks (20 posted, review 5518295016, har block mein GitHub id)

<!-- gh-comment-id: 4271095599 --> `app/supabase/migrations/0006_demo_sessions.sql:34` · Risk · **Top-3**
> `join_session` sirf "session exist karta hai" check karta hai: link = key (ADR-011, F74 b). Demo ke liye theek. Par koi bhi joined member `reset_session` bhi kar sakta hai (line 57), to leak hua link beech pitch mein demo saaf kar sakta hai. Pilot se pehle: invite ek baar wala code ya host-only reset? Owner A46 par haan de to abhi yahi rehne do.
- **Status:** open

<!-- gh-comment-id: 4271095612 --> `app/tests/integration/supabase.test.ts:120` · Testing · **Top-3**
> Yeh ek hi test Realtime + RLS + security definer (`is_my_session`) ko joined device ke liye prove karta hai (INSERT < 2 s). Maine dobara nahi chalaya (rows chhodta hai). Activation ke baad live two-device row (test-cases line 102) isi ko asli phone par dohraati hai. Us run ki execution id aur napa hua time row mein likhna.
- **Status:** open

<!-- gh-comment-id: 4271095620 --> `app/src/App.tsx:139` · Impact · **Top-3**
> Doosra device reset kare to is device ki live list khali ho jaati hai (DELETE), par `placed` state rehti hai: customer "Order placed" tracker purani `placed.status` ke saath dekhta rehta hai jab tak "Order again" na dabaye. Ek line: jab `placed.id` list se gayab ho aur list load ho chuki ho, `setPlaced(null)`? Ya demo mein host hi reset karega, to rehne do (F74 mein note).
- **Status:** open

<!-- gh-comment-id: 4271095632 --> `app/src/App.tsx:37` · Understanding
> `ready` gate: `?join=` ho to live list tab tak nahi chalti jab tak join khatam na ho (success ya fail). Fail par bhi `ready=true` aur device apne session mein rehta hai, error line ke saath. Sahi. Sawal: join fail ke baad URL saaf ho jaata hai, to user dobara link kaise khole? Reload se nahi, copy dobara chahiye: theek hai demo ke liye?
- **Status:** open

<!-- gh-comment-id: 4271095639 --> `app/src/App.tsx:48` · Understanding
> Join effect `ensureSession()` pehle karta hai: B ka apna anonymous user banta hai, phir `join_session(A)`. Matlab har joined device bhi `auth.users` mein ek row hai (30/hour/IP limit, F71). Do device = do users: theek. Bas confirm: yeh effect sirf ek baar chalta hai (`[]`), tab switch par nahi.
- **Status:** open

<!-- gh-comment-id: 4271095657 --> `app/src/lib/session.ts:21` · Risk
> Joined session localStorage mein hamesha rehti hai (F74 a). Agle din host apna site data saaf kare (naya session), kitchen device purani session padhta rahega aur kuch nahi dikhega. Demo checklist (#56) mein line: "dono device par site data saaf karo, phir naya link". Leave button F74 a tak theek?
- **Status:** open

<!-- gh-comment-id: 4271095674 --> `app/src/lib/live.ts:7` · Understanding
> `fetchOrders` ab `.eq("session_id", sessionId)` filter karta hai jabki RLS pehle se sirf apni + joined sessions deta hai. Kyun dono? Mera samajh: joined device ko sirf joined room dikhe, apna purana nahi. Sahi? To RLS = suraksha, filter = chunav.
- **Status:** open

<!-- gh-comment-id: 4271095684 --> `app/src/lib/live.ts:22` · Risk
> DELETE listener bina filter: Realtime delete ko column se filter nahi kar sakta aur sirf id bhejta hai (F74 c). Har khula screen har reset ki ids sunta hai, sirf apni girata hai. Leak = sirf uuid. Supabase ka yeh vyavhar RLS par bhi lagu hai (delete sab ko jaata hai)? Doc link LEARNINGS mein daalo.
- **Status:** open

<!-- gh-comment-id: 4271095695 --> `app/src/lib/useLiveOrders.ts:28` · Testing
> Delete par `cur.filter(o => o.id !== id)`. Reconnect ke baad `reload()` phir se `fetchOrders` karta hai, to ek missed delete bhi agle reconnect par theek ho jaata hai? Nahi: reload merge karta hai, hataata nahi (`rows.reduce(mergeOrder, cur)`). Missed delete tab tak rehta hai jab tak tab band na ho. Demo mein chhota; F74 mein ek line?
- **Status:** open

<!-- gh-comment-id: 4271095711 --> `app/src/screens/DemoBar.tsx:40` · Understanding
> Reset do-step hai (ask → "Yes, clear"), aur `busy` dono button band karta hai. "No, keep" `setAsking(false)`. Accessibility: confirm text `<span>` hai, role nahi; screen reader ke liye `role="status"` ya ek `<p>`? Cosmetic, #56 polish ke saath.
- **Status:** open

<!-- gh-comment-id: 4271095722 --> `app/src/screens/DemoBar.tsx:32` · Assumptions
> Clipboard block ho to link text mein dikhta hai ("Copy this link: …"). Phone par long uuid link select karna mushkil; QR F74 d. Demo ke do device same WiFi par honge: link WhatsApp se bhejoge? Us raste ka ek test (#56 checklist) kaafi hai.
- **Status:** open

<!-- gh-comment-id: 4271095732 --> `app/supabase/migrations/0006_demo_sessions.sql:13` · Risk
> `is_my_session` security definer hai taaki policy `session_links` padh sake jo phone nahi padh sakta. `stable` + `set search_path = public`: theek. Yeh function har row par har read aur har Realtime change par chalta hai; demo scale par theek, `session_links` ka PK hi index hai. Pilot se pehle maapna.
- **Status:** open

<!-- gh-comment-id: 4271095743 --> `app/supabase/migrations/0006_demo_sessions.sql:44` · Understanding
> Frozen table mein ek darwaza: trigger DELETE tabhi jaane deta hai jab `goserve.reset` = 'on' aur flag transaction-local hai (`set_config(..., true)`). Phone ke paas order_events par DELETE policy nahi, to flag akela kaafi nahi: do taale. `clear_dev.py` bhi wahi flag set karta hai (line 33). Aur koi jagah yeh flag set karti hai? Grep se sirf do.
- **Status:** open

<!-- gh-comment-id: 4271095753 --> `app/supabase/migrations/0006_demo_sessions.sql:61` · Impact
> Reset order: events → decision_log → orders. `run_log` ka orders par FK nahi (0001), to reset us par nahi atakta: maine schema dekha. Par SUB 14 `run_log` mein `session_id` likhta hai; reset ke baad woh rows "bhoot session" ki hoti hain. Scorecard (#47) ke liye theek, bas ADR note.
- **Status:** open

<!-- gh-comment-id: 4271095769 --> `scripts/test_order_rpc.py:144` · Testing
> Joined device reset kar sakta hai, stranger `not_your_session`. Maine chalaya: Ran 17 OK, rolled back, to migration 0006 dev par lagi hai. Yeh test `auth.users` mein rows banata hai transaction ke andar: rollback saaf karta hai, 30/hour sign-in limit par asar nahi. Sahi?
- **Status:** open

<!-- gh-comment-id: 4271095776 --> `scripts/clear_dev.py:9` · Risk
> `--apply` paanch tables ki SAARI rows hataata hai (sab sessions, `run_log` bhi), ref `tmxyizmkpwwfyazvrfhw` ke alawa refuse. Dev only, test se proven. Body kehta hai 12 orders / 15 events saaf hue: owner ka haan F71 par tha (discussions line 22). Theek. `--ref` flag ka matlab sirf "galti pakdo" hai, prod kabhi nahi: docstring mein ek line.
- **Status:** open

<!-- gh-comment-id: 4271095786 --> `app/tests/e2e/helpers.ts:62` · Testing
> Fake socket ab client ki binding list wapas bhejta hai aur DELETE ko `old_record` ke saath sahi binding number par. LEARNINGS row 1 isi se aaya (position se match). Asli Realtime delete payload ka shape (`old` sirf PK) doc se confirm kiya ya integration test se? Dono ho to best.
- **Status:** open

<!-- gh-comment-id: 4271095799 --> `app/tests/e2e/split.spec.ts:27` · Testing
> Side-by-side ka proof = headings ki y-doori < 80 px aur kitchen x > customer x. Phone width (360 px) par grid do column rehta hai: `.panes` `1fr 1fr` bina media query. Demo laptop par theek; phone par split tab bekaar. Story S1 "one phone" kehti hai: split laptop par hi dikhega?
- **Status:** open

<!-- gh-comment-id: 4271095811 --> `docs/assumptions.md:56` · Assumptions
> A46 teen hisse: do device, link = key, phone sirf do DB functions (join, reset) seedhe bula sakta hai aur baaki writes n8n se. ADR-011 "merge = accept". Owner se alag haan ya na chahiye: A46 aur ADR-011 par.
- **Status:** open

<!-- gh-comment-id: 4271095822 --> `docs/tests/test-cases.md:102` · Impact
> Live two-device row "Pending activation". Activation ke baad kram: customer phone order → kitchen device (copied link) dekhe → Reset dono saaf. Jab chalao, MAIN/SUB execution ids aur 2 s ka napa hua time isi row mein likho (F73 f ke saath ek hi run).
- **Status:** open

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #72 approve ho chuka hai. Tum abhi merge karo (feat/52-split-view -> dev).
A46 aur ADR-011 par alag haan ya na do. "activate" abhi alag shabd hai, woh abhi nahi bola gaya.
Demo checklist mein likho: dono device par site data saaf karo, phir naya link.
```

Coder paste-block (English):
```
State: 20 posted · 0 must-fix · actor: coder, then owner (merge)

You are the developer for GoServe PR #72 (feat/52-split-view). Do this: (1) reply on all 20 review threads in 1-2 sentences each, by comment id; (2) change code only if a reply says a change is needed, and put it in one commit; (3) do not deploy or activate anything, the owner must say "activate" separately; (4) after the owner merges PR #72, copy the bundle and the rows as usual; (5) continue development: start story #51 "Ops screen: AI suggestion and metrics panel" (epic #36) on feat/51-ops-screen from dev.
```

posted as satvik-jain-iitd, review 5518295016 (APPROVE), 20 inline threads
