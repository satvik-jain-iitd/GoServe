# PR #67 — feat(n8n): decide and log workflows, order cap per session

- **Branch:** `feat/46-decide-logs` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** #46 "Decide and logs workflows (SUB 13, SUB 14)" (epic #35)
- **State:** **APPROVED** — head `50853ce` (2026-10-14, review 5511373264 by `satvik-jain-iitd`), CI green, merge pending (owner: A42 + F67 yes)
- **Files:** 26 (5 of them notebook files under `docs/pr-reviews/`) · **Lines:** +1316 / -37 (1 commit, subject 59 chars)
- **Reviewer:** satvik-jain-iitd
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/67

> Dhaba ka dispatcher ab rule se rider chunta hai, aur salahkaar (Jev) ki raay diary mein likh deta hai. Har jawab ke baad duty register mein ek line jaati hai. Ek customer ke 20 orders ke baad counter "bahut ho gaya" (429) bolta hai.

---

## Overall review

## 1. Ek-line logline

> `Feat PR: order ke baad ek dispatcher (SUB 13) rule se rider chunta hai, Jev se salahkaar ki raay leta hai, dono ko diary mein likhta hai; SUB 14 har run ki duty register line likhta hai; aur ek session 20 orders par ruk jaata hai. Sab approved hai, merge baaki hai.`

## 2. Big Picture (Story & Goal)

- Story #46 "Decide and logs workflows (SUB 13, SUB 14)", epic #35. [VERIFIED]
- Persona: ops (founder). Yeh build design §6, §8 item 7 aur LAYA_PLAN §4 se judi hai. [VERIFIED]
- Depends on: order workflows (#66, merged) aur OpenRouter key (cap $2). [VERIFIED]
- S1 decide: rule pehle chalta hai, Jev dusre number par. Ek `decision_log` row mein dono picks. [VERIFIED]
- S2 Jev down: rule ka faisla phir bhi jaata hai, aur row batata hai ki Jev kyun nahi chala. [VERIFIED]
- S3 logs: har run ka ek `run_log` row (time, settings version, cost). [VERIFIED]
- Extra, story se bahar: per-session cap 20 (migration 0004, 429). Yeh activation se pehle ka brake hai jo F66(c) ne maanga tha. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)

- Pehle (PR #66 ke baad) order counter tha, par koi decision note, koi run log aur koi session cap nahi tha. Cap ki migration `0004` is PR mein nayi file hai. [VERIFIED file new; "nahi tha" INFERRED from story dependency]
- Is PR se unlock hota hai: har order ke saath ek decision diary aur ek duty register. Owner ko baad mein dekhna ho to yeh data tayyar hoga. [INFERRED from LAYA_PLAN §4 record fields]
- Iske bina: rule aur salahkaar ka faisla dikhta nahi, run ka cost dikhta nahi, aur ek customer bina limit ke orders bhar sakta hai. [INFERRED]

## 4. Real-Life Analogy

Poori PR ek dhaba ka counter hai. Counter par ek manager hai, aur ek salahkaar (adviser) jo sirf raay deta hai.

1. Phone = customer. Parchi deta hai: `POST` action `decide`, session, order aur riders ki list.
2. `GS MAIN 01 Order API` = counter boy. Settings card (Config) padhta hai, "orders paused" board (kill switch) dekhta hai, aur parchi ko SUB 13 ke paas bhejta hai.
3. `GS SUB 13 Decide` = dispatcher. Bahar khade riders dekhta hai (free hai? aaj kitne trips? kitni door?), house rule se pick karta hai, aur 900 ms mein salahkaar (Jev) se poochta hai: "tum kise bhejoge?"
4. Salahkaar (Jev) = sirf raay. Dispatcher uski baat dekhta hai, par bhejta rule ka rider hi hai. Salahkaar ki baat sirf tab maani jaati hai jab confidence 0.70 se upar ho, cost cap ke andar ho, aur chuna gaya rider list mein ho.
5. `decision_log` = decision diary. Ek hi page par dono opinion, aur ek khaali "kya hua" line jo baad mein bharegi.
6. `jev_status` = diary ka margin note: "adviser agreed", "adviser was late", "adviser spoke nonsense", "adviser not sure", "adviser too expensive", "adviser off".
7. `GS SUB 14 Write logs` = duty register (`run_log`). Customer ko jawab jaane ke baad ek line: kaunsa counter action, kitna time, kaunsi settings version, kitna cost, koi error.
8. Session cap 20 = ek customer ka token limit. 20 orders ke baad counter 429 "bahut ho gaya" bolta hai. Purana token retry karo to purana order mil jaata hai. Reset (story #52) = nayi session.
9. Config tunables (`jev_enabled`, `jev_model`, `jev_cost_cap`, `params_version`) = dispatcher ka settings card. Abhi deewar par chhapa hua (hard-coded). Kal `params` page se padha jaayega (B13).
10. Riders in request = customer ki parchi mein likha hai kaun bahar khada hai (A42). Demo ke liye dispatcher is list par bharosa karta hai.

## 5. Is PR mein naye Concepts (8)

Har concept ki detail `concepts.delta.md` mein hai.

- **Rule first, model second (shown, not trusted)** — rule decide karta hai, salahkaar ka jawab saath mein likha jaata hai. Real-life: dispatcher house rule se bhejta hai, salahkaar ka tip margin mein.
- **Decision record for later learning** — ek row mein state, options, dono picks, status, settings version aur khaali `result`. Real-life: diary ka page jisme "kya hua" ki line khaali hai.
- **Confidence threshold (0.70) aur cost cap** — bar se neeche ya price se upar, salahkaar ki raay rakhi jaati hai par "unusable" mark hoti hai. Real-life: salahkaar bola "pata nahi" ya fees zyada.
- **Continue on error, sirf advice path par (B7 exception)** — Jev node fail ho to bhi SUB chalta rahta hai; write nodes phir bhi fail-closed hain. Real-life: adviser late, dispatcher phir bhi bhejta hai; register ka pen toota, to ruk jao.
- **Log after the answer** — pehle customer ko jawab, phir duty register. Real-life: pehle parcel, phir register.
- **Per-session cap (429)** — public endpoint par brake. Retry ko chhoot hai; reset = nayi session. Real-life: ek customer ka token limit.
- **Red first for workflow code** — 15 tests pehle laal the, code baad mein. Real-life: alarm pehle test hua, phir dukaan khuli.
- **Deploy refuses without its credential** — script likhne se pehle check karta hai ki zaroori key hai. Real-life: delivery van key ke bina nahi nikalti.

## 6. High-Level Flow

Journey: phone se decision tak, aur wapas jawab tak.

1. Phone `POST` bhejta hai: `{action:'decide', session_id, order_id, riders:[...]}`. [VERIFIED]
2. MAIN: Config (tunables) → token check → kill switch → Route `decide`. [VERIFIED]
3. MAIN SUB 13 ko session, kitchen, order, riders, params_version, jev_* aur kill_switch ke saath bulata hai. [VERIFIED]
4. SUB 13 Guard: kill switch, shape check, **rule pick**, Jev prompt (naam, phone, address nahi). [VERIFIED]
5. Agar `jev_enabled` hai: Ask Jev (900 ms, 2 tries, error par aage badho). [VERIFIED]
6. Decide: Jev ka jawab tabhi record mein jaata hai jab time par aaya ho, shape sahi ho, choice allowed ho, confidence ≥ 0.70 ho, aur cost ≤ cap ho. **chosen_pick hamesha rule pick hai.** [VERIFIED]
7. Ek `decision_log` row likha jaata hai (`return=minimal`). [VERIFIED]
8. Decision stored → 200 ke saath `decision` wapas (row fail ho to 502). [VERIFIED]
9. MAIN `Respond result` jawab bhejta hai. [VERIFIED]
10. `Log run` → SUB 14 → ek `run_log` row (duration, params_version, cost, error) jawab jaane ke baad. Yahi LOG tail place aur status ke baad bhi chalta hai. [VERIFIED]

Nothing deployed (VERIFIED: n8n par koi `GS *` workflow nahi).

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/supabase/migrations/0004_session_order_cap.sql` | Manager ka register, naya page: `place_order` ka poora copy plus session cap 20 |
| `ops/n8n/order/build.js` | Blueprint printer: MAIN 01 (Config, Route, Log run), SUB 13 Decide, SUB 14 Write logs |
| `ops/n8n/order/code/decide_guard.js` | Dispatcher ka darwaza: kill switch, riders ki check, rule pick, Jev ka prompt |
| `ops/n8n/order/code/decide_result.js` | Diary ka munshi: Jev ka jawab check karke `decision` record banata hai |
| `ops/n8n/order/code/decide_done.js` | Diary likhne ke baad ka check: 200/201/204 ho to decision wapas, warna 502 |
| `ops/n8n/order/code/guard_log.js` | Duty register ka darwaza: fields check, cost default 0, kill switch log ko nahi roakta |
| `ops/n8n/order/code/log_done.js` | Duty register ka last check (+3) |
| `ops/n8n/order/code/log_run.js` | Duty register ki line banane wala (MAIN ke andar) |
| `ops/n8n/order/code/check_token.js` | Counter boy ka pass check: `decide` action, `started_at`, tunables aage bhejna |
| `ops/n8n/order/code/shape.js` | Reply card: 429 ka message (session cap) |
| `ops/n8n/order/decide.test.js` | Red-first checklist: 15 tests, SUB 13/14 aur MAIN wiring |
| `ops/n8n/order/order.test.js` | Pehle `test.js`, naam badla: 429 mapping, Route ke 4 outputs, deploy ke six |
| `ops/n8n/order/deploy.js` | Delivery van: six workflows ka dry run; OpenRouter credential ke bina apply refuse |
| `scripts/test_order_rpc.py` | Manager ke register ka auditor: cap test (20, retry, 21st), decision_log aur run_log rows |
| `docs/assumptions.md` | A42: 5 faisle ek row mein |
| `docs/follow-ups.md` | F67: OpenRouter credential ki yes |
| `docs/integrations/n8n-order-workflows.md` | Registry card: SUB 13/14 rows, decide body, 429 row, Run log section |
| `docs/tests/test-cases.md` | Test register: 10 nayi rows, ek "Pending deploy" (live Jev) |
| `docs/LEARNINGS.md` | Sabak ki diary: 4 nayi lines (78–81) |
| `docs/process-trace.md` | Daily diary: rows 142–144 |
| `.github/workflows/ci.yml` | Gate ka register: Guard job ab `ops/n8n/order/*.test.js` glob chalata hai |

## 8. Pieces aapas mein kaise baat karte hain

Text map (koi code is map ko run nahi karta):

- Phone → MAIN 01 (`build.js`) → Check token (`check_token.js`) → Route. [VERIFIED wiring test]
- Route `decide` → SUB 13 → `decide_guard.js` (check + rule + prompt) → Ask Jev (HTTP, OpenRouter) → `decide_result.js` (record) → Write decision (`decision_log`) → `decide_done.js` → wapas MAIN. [VERIFIED wiring test]
- MAIN `Respond result` → `Log run` (`log_run.js`) → SUB 14 → `guard_log.js` → Write run log (`run_log`) → `log_done.js`. [VERIFIED wiring test]
- SUB 13 aur SUB 14 ka rasta `place_order` / `change_status` jaisa hi hai: ek SUB, ek kaam. [INFERRED from B11 pattern]
- `decide.test.js` → `build.js` aur code files padhta hai. CI ka Guard job isse chalata hai. [VERIFIED]
- `0004` → `place_order` ka function (DB ke andar). Test `test_order_rpc.py` isse DB par chalata hai. [VERIFIED]

## 9. Pehle se kya badla

- 26 files, +1316 / -37, 1 commit. [VERIFIED]
- Naya: `0004_session_order_cap.sql` (+69), `decide_guard.js` (+24), `decide_result.js` (+26), `decide_done.js` (+7), `guard_log.js` (+12), `log_done.js` (+3), `log_run.js` (+6), `decide.test.js` (+184), 5 notebook files. [VERIFIED counts]
- Badla: `build.js` (+88/-8), `check_token.js` (+3/-2), `order.test.js` (+6/-5, rename from `test.js`), `deploy.js` (+9/-6), `test_order_rpc.py` (+22/-1), `ci.yml` (glob), docs (`assumptions.md`, `follow-ups.md`, `n8n-order-workflows.md` +25/-4, `test-cases.md` +18/-8, `LEARNINGS.md` +4, `process-trace.md`). [VERIFIED counts]
- Before (PR #66 ke baad): order ka raasta tha, par decision note, run log aur session cap nahi the. [INFERRED from story]
- After: order path ke saath decision diary (`decision_log`), duty register (`run_log`) aur session cap 20 hai. Deploy aur activation abhi nahi hue. [VERIFIED]
- Notebook bundle: 5 files (pr-66 chapter, `concepts.md`, `mental-model.md`, `my-questions.md`, `README.md`). `README.md` ke 7 chapters hain. [VERIFIED]

## 10. Macro Risks & Downstream Impact

Ranked. Har risk ke saath kitna bada, aur kya check karna hai.

1. **Rider list phone se aati hai (A42).** Rule client ke bheje `free` flag aur distance par chalta hai. Build design §7 kehta hai server dobara check kare. Demo (ek device) ke liye theek; pilot se pehle riders table ya server state chahiye. Bada: high before pilot. [VERIFIED code + A42; consequence INFERRED]
2. **Contract D1 "guard after Jev answers" `jev_status` mein nahi dikhta.** Jev ka busy rider (high confidence) `ok` + `agrees:false` likha jaata hai. Rule decide karta hai, to abhi nukhsaan nahi; par future labels gandhe honge. Bada: medium. [VERIFIED decide_result.js]
3. **Cap mein race.** `count(*) >= 20` phir insert, koi lock nahi. Do calls ek saath 19 dekhein to 21 ho sakte hain. Demo scale par theek; ek advisory lock line se fix. Bada: low now. [VERIFIED code; race INFERRED]
4. **Jev ka reply shape aur OpenRouter options assume hain.** (`choices[0].message.content` JSON, `usage.cost` via `usage:{include:true}`, `response_format json_object`, timeout ka error shape.) Unit tests stub use karte hain. Live row (test-cases line 76) hi proof hoga. Bada: high before trust. [VERIFIED tests are stubs]
5. **Jev worst case ~2 s** (900 ms × 2 tries + 200 ms) per decision. Demo ka "decision time" panel isse dikhega. Bada: medium. [VERIFIED node settings]
6. **Config abhi hard-coded.** `params_version: 1` aur `params` table khaali (live: 0 rows). B13.1 maangta hai Config `params` se padhe; F66(b) ne SUB 14 ke saath kaha tha, par nahi hua. Bada: medium. [VERIFIED live params 0 rows]
7. **Refusals run log mein nahi aate** (401/503/400 gate par), aur session_id khaali ho to SUB 14 ka guard chup-chaap row drop karta hai. Scorecard (#47) ko refusal counts n8n executions se chahiye honge. Bada: medium. [VERIFIED code + doc]
8. **"Decision only if stored."** `decision_log` ka DB hiccup ho to 502, aur rider assign nahi hota, jabki rule pick taiyaar tha. Yeh jaan-boojh kar audit-first choice hai. Bada: medium for demo. [VERIFIED decide_done.js]
9. **MAIN 01 15 nodes par hai** (B11 ki aim). Agla action ya branch isse upar le jaayega. Test ≤ 15 check karta hai. Bada: low. [VERIFIED test ≤ 15]
10. **`place_order` 0004 mein copy hua** (0003 se ~60 lines). Har badlav poori copy karta hai. Bada: medium over time. [VERIFIED]
11. **Docs drift.** test-cases row "four GS workflows" (ab six), F65(a) "three workflows". Bada: low. [VERIFIED]
12. **OpenRouter key aur cap.** $2 cap OpenRouter side par set hona chahiye, sirf note mein nahi. Credential banane ke liye owner ki haan chahiye (F67). Bada: high before deploy. [VERIFIED docs; cap location INFERRED]

Downstream: #47 (MAIN 90 scorecard) decision_log aur run_log par chalega. #48 (customer screen) cap aur 429 message par nirbhar hai. [INFERRED from story dependency]

## 11. Jo jaan-boojh kar NAHI hai (Scope)

- Laya (decision model, MVP 1), params proposals/promotion, replay tests. Wajah: MVP 1 (ponytail, B13). [VERIFIED]
- Riders table. Wajah: ponytail; riders request mein aate hain (A42). [VERIFIED]
- Daily scorecard MAIN 90. Wajah: story #47. [VERIFIED]
- Deploy aur activation. Wajah: owner ki yes (F65/F67). [VERIFIED]
- Rate limit is session cap ke alawa. Wajah: F65(d), n8n level par baad mein. [VERIFIED]

Samajhne wali baat: "nahi banaya" bhi design decision hai. Riders table nahi bana, to phone par bharosa hai. Yeh risk 1 mein khul kar likha hai.

## 12. Testing Story

- **Red first:** node tests 34 mein se 19 pass, 15 fail (code se pehle), PR body ke mutabik. Cap DB test bhi `FAILED (failures=1)`. [VERIFIED from PR body; red not re-run]
- **Green (node):** 34/34 pass. Reviewer ne chalaya. [VERIFIED]
- **Green (DB):** `python3 -m unittest scripts/test_order_rpc.py` → `Ran 9 tests OK (14 s)`. Reviewer ne chalaya. [VERIFIED]
- **Live DB state after run:** orders 0, events 0, decision_log 0, run_log 0, params 0, anonymous users 0 (sab rollback). [VERIFIED]
- **Covered:** rule cases (ties aur none samet), Jev request shape aur PII strip (naam, phone, address), refusals (503, chhe 400 cases), ek row mein dono picks, rule wins jab Jev alag ho, S2 ke saat unusable cases aur off, log write 200/502 bina raw text ke, SUB 14 row aur refusals, MAIN run row, wiring (routes, log after answer, declared fields, node count), SUB 13 wiring (Jev sirf guard ke baad, Jev node error par aage, write path fail-closed, OpenRouter URL, header auth), safety (callerPolicy, errorWorkflow ALERT, no `sk-or-v1`, Config keys, token placeholder), check_token tunables, layout ×3. DB: cap 20, retry, 21st, doosra session, decision_log aur run_log inserts. [VERIFIED]
- **Not covered:** real Jev call (deploy aur credential ke baad); cap ka race; `s2` cap test sirf list check karta hai; refusal logging; `params` reading. [VERIFIED]
- **Test-cases:** 10 nayi rows (8 Pass unit, 1 Pass local-only DB, 1 Pending deploy live Jev row). [VERIFIED per brief; count ka math brief mein saaf nahi tha]

## 13. Trade-offs & Alternatives

| Option chuna | Kyun | Kya chhoda |
|---|---|---|
| Rule decides, Jev advises | Build design §4 "shown, not trusted"; demo safety | Koi dikhne wala AI effect demo path par (diary mein dikhta hai) |
| Riders request mein | Ponytail; abhi rider data model nahi | Server par sach (risk 1) |
| Log SUB 14 se, jawab ke baad | Latency; ek kaam per SUB (B11) | Gate refusals ka log |
| Cap SQL mein | Brake direct service-role calls par bhi hold kare; ek line | Per-IP limit (F65 d) |
| Function 0004 mein copy | Supabase migration convention | Ek source `place_order` ke liye |
| Config hard-coded | Demo speed | B13 loop (F66 b abhi khula) |

## 14. Patterns is PR se

- **Dispatcher, adviser aur diary (rule first, model second):** `decide_guard.js` (rule), `decide_result.js` (record). Ek line.
- **Diary page ka khaali "result" khana:** `decide_result.js` mein `decision` object (lines 23–24). Baad mein label ke liye.
- **Advice path par continue, write par fail-closed:** `build.js` SUB 13 mein Ask Jev (line 101–104) aur Write decision.
- **Jawab ke baad log:** `build.js` lines 196–198 (`Respond result` → `Log run` → SUB 14).
- **Brake SQL mein:** `0004` line 52 (cap check). Retry se pehle nahi, isliye purana token chalta hai.
- **Deploy refuse without credential:** `deploy.js` line 52.
- **Red first (workflow code):** `decide.test.js` line 1. Pehle laal, phir hara.

## 15. AI-Review Lens

- **Trust karna safe:** rule (3 tested cases, ties aur none samet), PII strip (naam, phone, address ke saath test), saat unusable-Jev cases, write-path fail-closed wiring, red-first evidence, deploy ka credential check. [VERIFIED]
- **Interrogate karo:** Jev ke baare mein stubs kya maante hain (reply shape, cost field, error shape); phone-diye riders par trust boundary; `ok` status us Jev pick par jo D1 guard fail karta hai; cap ka race; Config-from-params ka vaada jo phir khisak gaya. [VERIFIED]
- **Confident but risky:** "Jev sirf advice hai, to Jev fail hone se rule nahi rukta" wiring aur tests mein sach hai. Par Jev ka asli success abhi test nahi hua. Pehli live decision call batayegi ki `usage.cost` aur JSON reply code ki ummeed ke mutabik aate hain ya nahi. [VERIFIED wiring; live INFERRED]

## 16. Questions

**Top-3 abhi poocho** (is PR mein do TOP sawaal hain):

1. (Assumptions, `ops/n8n/order/code/decide_guard.js` line 15) Riders list phone se aati hai (A42: "riders come in the request"). Build design §7 kehta hai phone kabhi rider decide nahi karta, server dobara check karta hai. Par yahan `free` flag aur distance phone ke bataye hue hain, to rule phone ke state par chalta hai. Demo (ek device) theek; pilot se pehle riders table ya server state chahiye. A42 mein yeh trust-boundary line add karo?
2. (Understanding, `ops/n8n/order/code/decide_result.js` line 19) Contract D1 "Guard after Jev answers": Jev ka chuna rider free/close na ho to fallback. Yahan rule hamesha decide karta hai (theek), par Jev busy rider (jaise r3, options mein hai) ko 0.9 se chune to `jev_status: 'ok'`, `agrees: false` record hota hai. Training labels ke liye alag `guard_failed` status rakhein?

<details><summary>Poora question bank (18, 8 categories mein)</summary>

### 1 Purpose
- `ops/n8n/order/build.js` line 83: `rpcPost` `Prefer: return=minimal` → khaali 201; `decide_done` 200/201/204 maanta hai, baaki 502. Matlab `decision_log` insert fail = rider assign bhi nahi (502), jabki rule pick taiyaar tha. "Decision only if stored" jaan-boojh kar (audit first)? Demo mein DB hiccup par order atak jayega — accept?
- `docs/assumptions.md` line 52: A42 mein 5 faisle ek row mein: rule decides, Jev advises, 0.70, $0.001 per call, 20 orders per session. Owner ko alag alag haan aasaan hoga — main chat mein list kar raha hoon; tum confirm ke baad row ko "Confirmed" karna.

### 2 Understanding
- `ops/n8n/order/code/decide_result.js` line 19 (TOP-2): Contract D1 "Guard after Jev answers" — Jev busy rider ko 0.9 se chune to `jev_status: 'ok'`, `agrees: false`. Training labels ke liye alag `guard_failed` status?
- `app/supabase/migrations/0004_session_order_cap.sql` line 46: Retry lookup cap se pehle hai, isliye cap par bhi purana token chalta hai (test proves). Ab `on conflict do nothing` + doosra lookup (line 61) sirf same-moment race ke liye hai — sahi samjha?
- `ops/n8n/order/code/guard_log.js` line 1: "kill switch does not block a log write" — sahi soch (refusals bhi log hon). Par MAIN ka 503 REFUSE branch `Log run` tak aata hi nahi. To aaj yeh line kis case mein kaam aati hai — sirf jab SUB 11/12/13 apne guard se 503 de (SUB-level kill)?

### 3 Assumptions
- `ops/n8n/order/code/decide_guard.js` line 15 (TOP-3): Riders list phone se aata hai, rule phone ke state par chalta hai. Pilot se pehle riders table / server state. A42 mein trust-boundary line?
- `ops/n8n/order/build.js` line 160: Config mein `params_version: 1` aur jev_* hardcoded — par `params` table khaali hai (live: 0 rows). F66(b) ne kaha tha "Config reads params with SUB 14" — yeh PR SUB 14 hai, phir bhi nahi hua. Kab: #47 ke saath, ya ek chhota alag PR?
- `docs/integrations/n8n-order-workflows.md` line 83: "The Jev call is the one node that continues on error" — B7 rule 82 ka exception sahi hai (advice path, write nahi). Par timeout par n8n `continueRegularOutput` item mein `error` field kaise aata hai? Test `{error:'timeout'}` maanta hai; live par yeh shape confirm karna hai (row 76 ke saath).

### 4 Risk
- `app/supabase/migrations/0004_session_order_cap.sql` line 52: Cap `count(*) >= 20` phir insert — koi lock nahi. Do calls ek saath (dono 19 dekhein) to 21 ho sakte hain. Demo scale par theek; `perform pg_advisory_xact_lock(hashtext(p_session))` ek line hai — add karein ya accept karke A42 mein likhein?
- `ops/n8n/order/build.js` line 104: `Ask Jev` 2 tries × 900 ms + 200 ms wait = ~2 s worst case per decision. Demo metrics panel "decision time" dikhayega. Retry 1 (ya off) aur sirf timeout 900 kaafi nahi?
- `ops/n8n/order/deploy.js` line 52: OpenRouter credential ke bina apply refuse — acha. Credential = Header Auth `Authorization: Bearer <key>`, cap $2. Yeh cap OpenRouter dashboard par set hai ya sirf vault note? Key kis account ka (klickbae8yt)? Owner se "haan" chat mein poochh raha hoon (F67).

### 5 Alternatives
- `ops/n8n/order/code/decide_guard.js` line 23: Jev ko chat/completions se JSON prompt bheja. CLAUDE.md §15 Jev ko "non-autoregressive decision API: choice/score/boolean" kehta hai — OpenRouter par Jev ka koi structured choice mode hai jo text-JSON se seedha fit ho? Ya chat JSON hi raasta hai (check kiya)?

### 6 Impact
- `ops/n8n/order/build.js` line 198: `Respond result` → `Log run` → SUB 14: jawab ke baad log, acha (critical path se bahar). Par gate ke refusals (401/503/400) log nahi hote (documented). Scorecard (#47) ko refusal counts chahiye honge — n8n executions se ginoge, ya REFUSE branch ke baad bhi SUB 14 call?
- `ops/n8n/order/code/log_run.js` line 4: `session_id` body se; khaali ho to '' → SUB 14 guard 400 refuse → chup-chaap koi row nahi, MAIN ko pata nahi. Bad-input runs ka log kho jaata hai. Khaali par `'unknown'` likhna behtar, taaki har routed run ki ek line ho?

### 7 Testability
- `ops/n8n/order/decide.test.js` line 1: Red first is baar (19 pass / 15 fail) — acha, PR body mein proof. Par Jev ka real reply shape (`choices[0].message.content` JSON, `usage.cost`), `usage: {include: true}` aur `response_format: json_object` abhi stub hain. Tier A source (OpenRouter docs) hai, ya pehle live call par dekhenge (row 76)?
- `scripts/test_order_rpc.py` line 77: Cap test acha (20, retry, 21st). "Another session is not affected" sirf `isinstance(r, list)` dekhta hai — `created: true` assert karo taaki test sach mein s2 ka order prove kare?

### 8 Future
- `app/supabase/migrations/0004_session_order_cap.sql` line 1: `place_order` pura copy hua (0003 ke 60 lines + cap). Har badlav = poori copy. Ek function source file + migration usse le — Supabase CLI convention aisi nahi, to ponytail accept; bas LEARNINGS/ADR mein ek line "functions are replaced whole, read the latest migration" likh do?
- `docs/tests/test-cases.md` line 65: Row "Deploy script touches only the four GS workflows" — ab six hain (test update hua, row nahi). F65(a) bhi "three workflows" kehta hai. Chhota docs fix is PR mein, ya agle ke saath?

</details>

**Self-check (3 sawaal, khud se poochho):**

- Dispatcher (SUB 13) kis par bhejta hai: rule ya salahkaar? Aur diary mein kya likhta hai?
- Jev "unusable" ke paanch kaaran?
- Session cap kahan lagta hai aur retry par kyun nahi?

---

## Files (ek-ek)

### `app/supabase/migrations/0004_session_order_cap.sql` (+69)

**1. Job:** Manager ke register ka naya page. `place_order` poora dobara likha gaya (0003 ka copy plus cap). Real-life: manager ne register ka page naya chhapwaya, usi format mein, ek nayi line ke saath. [VERIFIED]

**2. Kahan fit hai:** `place_order` ko n8n SUB 11 HTTP POST `/rest/v1/rpc/place_order` se bulata hai. Cap yahin lagta hai, n8n mein nahi. [VERIFIED]

**3. Walkthrough:** Validation lines 16–44 same hain. Retry lookup pehle (46–49): same key → purana order, `created:false`. Cap check line 52: `count(*) >= 20` → `session_order_cap`. Insert `on conflict do nothing` (56–59). Doosra lookup (61–64) sirf same-moment race ke liye. Event (66–67). Grants kept (create or replace). [VERIFIED lines from brief]

**4. Function-by-function:** `place_order` — input session, key, items, address; output `{created, order}`. Cap block ek brake hai: 21st order par error, retry par nahi. [VERIFIED]

**5. Block-level:** Cap block = "token limit ki line" (dhaba register par chhapi hui). Grants block = manager ke pen par naam (kept as is). [VERIFIED]

**6. Data ki journey:** items + session → validation → session ke orders ki ginti → order row + event, ek transaction mein. [VERIFIED; flow INFERRED]

**7. Connections:** `0003` (copy source), `0001` (tables, trigger), `0002` (RLS), SUB 11 (caller), `test_order_rpc.py` (cap test). [VERIFIED]

**8. Concepts:** Per-session cap (429); Retry-safe key (purana), concepts.delta.md mein.

**9. Red flags:**
- Cap mein race (line 52). Low now. [VERIFIED code; race INFERRED]
- `place_order` 60 lines copy (line 1). Medium over time. [VERIFIED]
- Retry lookup cap se pehle (line 46). Intended, tested. [VERIFIED test]

**10. Testability:** `test_order_rpc.py` lines 67–77: 20 inserts, retry k20 20 rahta hai, k21 → `session_order_cap`, s2 accepted (sirf list check). [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247252 -->
> Cap `count(*) >= 20` phir insert — koi lock nahi. Do calls ek saath (dono 19 dekhein) to 21 ho sakte hain. Demo scale par theek; `perform pg_advisory_xact_lock(hashtext(p_session))` ek line hai — add karein ya accept karke A42 mein likhein?
- **Status:** open

<!-- gh-comment-id: 4265247254 -->
> Retry lookup cap se pehle hai, isliye cap par bhi purana token chalta hai (test proves). Ab `on conflict do nothing` + doosra lookup (line 61) sirf same-moment race ke liye hai — sahi samjha?
- **Status:** open

<!-- gh-comment-id: 4265247258 -->
> `place_order` pura copy hua (0003 ke 60 lines + cap). Har badlav = poori copy. Ek function source file + migration usse le — Supabase CLI convention aisi nahi, to ponytail accept; bas LEARNINGS/ADR mein ek line "functions are replaced whole, read the latest migration" likh do?
- **Status:** open

### `ops/n8n/order/build.js` (+88/-8)

**1. Job:** Blueprint printer. Ek script se MAIN 01 aur SUB 13 / SUB 14 ke nodes, edges, settings aur placeholders banate hain. Real-life: counter ka kaam-chart chhapne wali machine, ab teen naye boxes ke saath. [VERIFIED]

**2. Kahan fit hai:** `ops/n8n/order/`. Output n8n par jaana hai (deploy abhi nahi). `decide.test.js` ise padhta hai, `lib/layout.js` isse positions leta hai. [VERIFIED]

**3. Walkthrough:** `KITCHEN` constant (line 12). `rpcPost()` (line 83): POST `/rest/v1/<table>`, `Prefer: return=minimal`, custom-auth credential, neverError, 10 s. SUB 13 nodes (lines 95–108): Start (10 declared inputs), Guard (`decide_guard.js`), Allowed?, Ask Jev? (`use_jev`), Ask Jev (HTTP POST OpenRouter chat/completions, header auth, timeout 900, `onError: continueRegularOutput`, retry 2 tries 200 ms, lines 101–104), Decide (`decide_result.js`), Write decision (`decision_log`), Decision stored (`decide_done.js`), Return refusal. Edges line 110. 7 sections (RECEIVE, CHECK, JEV, DECIDE, WRITE, ANSWER, REFUSE). SUB 14 (lines 124–141): Start (8 inputs), Guard (`guard_log.js`), Allowed?, Write run log (`run_log`), Log written (`log_done.js`), Return refusal. MAIN: Config cfg-4..8 (lines 160–164: params_version 1, kitchen_id, jev_enabled true, jev_model `typesafe/jev-1.13`, jev_cost_cap 0.001). Route gets `decide` (169). Call SUB 13 (177–181). `Log run` (`log_run.js`, 183). Call SUB 14 (184–187). Edges: Route → SUB 13 (output 2), Respond 400 now output 3, `Respond result` → `Log run` → `Call SUB 14` (196–198). MAIN non-sticky nodes = 15 (test ≤ 15). [VERIFIED]

**4. Function-by-function:**
- `rpcPost()`: ek HTTP box jo database ko POST karta hai; `Prefer: return=minimal` ka matlab khaali jawab. Real-life: manager ko chit bhejna, jawab ki zaroorat nahi. [VERIFIED]
- SUB 13 ka shape: check → salahkaar → diary → jawab. Real-life: dispatcher ka ek din. [VERIFIED]
- SUB 14 ka shape: check → duty register line. Real-life: register ka munshi. [VERIFIED]

**5. Block-level:** Config (line 160–164) = settings card: params_version, kitchen, jev on/off, model, cost cap. Real-life: dispatcher ke haath mein card, jo abhi deewar par chhapa hai. [VERIFIED]

**6. Data ki journey:** Parchi (webhook body) → MAIN Config → SUB 13 (declared fields) → Jev (HTTP) → decision (`decision_log`) → jawab. Duty line (`run_log`) baad mein. [VERIFIED; flow INFERRED]

**7. Connections:** `decide.test.js`, `lib/layout.js`, code files (`decide_*`, `guard_log`, `log_*`, `check_token`), `deploy.js` (six names). [VERIFIED]

**8. Concepts:** Rule first, Continue on error (advice path), Log after the answer, Decision record, Confidence threshold. (concepts.delta.md)

**9. Red flags:**
- `Ask Jev` 2 tries × 900 ms → ~2 s worst case (line 104). Medium. [VERIFIED node settings]
- Config hard-coded (line 160). Medium. [VERIFIED]
- `rpcPost` 201-only success path → `decision_log` fail = 502 (line 83). Medium for demo. [VERIFIED decide_done.js]
- MAIN 15 nodes (limit). Low. [VERIFIED]

**10. Testability:** `decide.test.js` wiring tests (routes, SUB 13 continue only on Jev, write fail-closed, OpenRouter URL, header auth, MAIN ≤ 15, layout ×3). Live Jev call pending. [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247263 -->
> `Ask Jev` 2 tries × 900 ms + 200 ms wait = ~2 s worst case per decision. Demo metrics panel "decision time" dikhayega. Retry 1 (ya off) aur sirf timeout 900 kaafi nahi?
- **Status:** open

<!-- gh-comment-id: 4265247266 -->
> `params_version: 1` aur jev_* hardcoded — par `params` table khaali hai (live: 0 rows), to version 1 kisi row ki taraf nahi dekhta. F66(b) ne kaha tha "Config reads params with SUB 14" — yeh PR SUB 14 hai, phir bhi nahi hua. Kab: #47 ke saath, ya ek chhota alag PR?
- **Status:** open

<!-- gh-comment-id: 4265247270 -->
> `Respond result` → `Log run` → SUB 14: jawab ke baad log, acha (critical path se bahar). Par gate ke refusals (401/503/400) log nahi hote (documented). Scorecard (#47) ko refusal counts chahiye honge — n8n executions se ginoge, ya REFUSE branch ke baad bhi SUB 14 call?
- **Status:** open

<!-- gh-comment-id: 4265247275 -->
> `rpcPost` `Prefer: return=minimal` → khaali 201; `decide_done` 200/201/204 maanta hai, baaki 502. Matlab `decision_log` insert fail = rider assign bhi nahi (502), jabki rule pick taiyaar tha. "Decision only if stored" jaan-boojh kar (audit first)? Demo mein DB hiccup par order atak jayega — accept?
- **Status:** open

### `ops/n8n/order/code/decide_guard.js` (+24)

**1. Job:** Dispatcher ka pehla darwaza aur uski list. Kill switch, riders ki check, rule pick, aur salahkaar ke liye prompt. Real-life: dispatcher gaadi nikaalne se pehle bahar khade riders ginta hai. [VERIFIED]

**2. Kahan fit hai:** SUB 13 ka Guard node. Iska output `Allowed?` aur `Ask Jev?` tak jaata hai. [VERIFIED]

**3. Walkthrough:** Kill switch → 503 (line 6–13 ke aas-paas). Riders 1–10, unique ids ≤ 32 chars, `free` boolean, session/kitchen/order checks (6–13). `state` sirf ids, free, distance_m, trips_done (line 15). Rule pick (16–17): free → fewest trips → shortest distance → none. Options = ids + none (18). Prompt contract 1.3 (19–20). `jev_body` (23–24): model Config se, temperature 0, max_tokens 32, response_format json_object, usage include. [VERIFIED]

**4. Function-by-function:** Brief mein is file ke function naam nahi the; block-level upar hai. [VERIFIED]

**5. Block-level:** `state` block = "rider ki chhoti parchi" (naam, phone, address nahi). Real-life: dispatcher ko sirf gaadi, free/busy, kitni door, aaj ke trips. [VERIFIED]

**6. Data ki journey:** riders (request) → state (4 fields) → rule pick + options → Jev prompt (PII ke bina). [VERIFIED]

**7. Connections:** SUB 13 Guard node (`build.js`), `decide_result.js` (agla step), `decide.test.js` (rule 3 cases, PII strip). [VERIFIED]

**8. Concepts:** Rule first, model second; PII strip (concepts.delta.md).

**9. Red flags:** Riders phone se (A42). High before pilot. [VERIFIED code + A42]

**10. Testability:** Rule 3 cases (ties aur none), PII strip test (naam, phone, address). [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247244 -->
> **Top-3** — Riders list phone se aata hai (A42: "riders come in the request"). Build design §7 kehta hai phone kabhi rider decide nahi karta, server dobara check karta hai — par yahan `free` flag aur distance phone ke bataye hue hain, to rule phone ke state par chalta hai. Demo (ek device) theek; pilot se pehle riders table / server state chahiye. A42 mein yeh trust-boundary line add karo?
- **Status:** open

<!-- gh-comment-id: 4265247288 -->
> Jev ko chat/completions se JSON prompt bheja. CLAUDE.md §15 Jev ko "non-autoregressive decision API: choice/score/boolean" kehta hai — OpenRouter par Jev ka koi structured choice mode hai jo text-JSON se seedha fit ho? Ya chat JSON hi raasta hai (check kiya)?
- **Status:** open

### `ops/n8n/order/code/decide_result.js` (+26)

**1. Job:** Diary ka munshi. Jev ka jawab check karke `decision` record banata hai. Real-life: salahkaar ki chitthi padh kar, sahi ho to diary mein likhna, galat ho to "unusable" mark karna. [VERIFIED]

**2. Kahan fit hai:** SUB 13 mein Decide node. Output Write decision (`decision_log`) tak jaata hai. [VERIFIED]

**3. Walkthrough:** THRESHOLD 0.70 (line 5). Statuses (7–19): `jev_off`, `jev_error`, `jev_bad_reply`, `ok`, `cost_cap`, `jev_low_confidence`. Jawab tabhi accept hota hai jab `choice` options mein ho aur confidence 0..1 ka number ho (line 16). `agrees` (18). `decision` object (23–24). Output `cost` aur `log_row` (25–26). Chosen pick = rule pick. [VERIFIED]

**4. Function-by-function:** Brief mein function naam nahi the; block-level upar hai. [VERIFIED]

**5. Block-level:** Statuses = diary ka margin. Real-life: "adviser late", "adviser not sure", "adviser too expensive". [VERIFIED]

**6. Data ki journey:** Jev reply → shape check → status → `decision` object → `log_row` aur output. [VERIFIED]

**7. Connections:** `decide_guard.js` (input), SUB 13 Write decision, `decide.test.js` (7 unusable cases). [VERIFIED]

**8. Concepts:** Confidence threshold, Decision record, Rule first. (concepts.delta.md)

**9. Red flags:** Jev busy rider ko `ok` + `agrees:false` (line 19). Medium. [VERIFIED]

**10. Testability:** Seven unusable Jev cases + off test. [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247247 -->
> **Top-3** — Contract D1 "Guard after Jev answers": Jev ka chuna rider free/close na ho to fallback. Yahan rule hamesha decide karta hai (theek), par Jev busy rider (jaise r3, options mein hai) ko 0.9 se chune to `jev_status: 'ok'`, `agrees: false` record hota hai. Training labels ke liye alag `guard_failed` status rakhein?
- **Status:** open

### `ops/n8n/order/code/log_run.js` (+6)

**1. Job:** Duty register ki line banane wala (MAIN ke andar). Real-life: register mein ek line likhna: kaunsa counter action, kitna time, kitna cost, koi error. [VERIFIED]

**2. Kahan fit hai:** MAIN `Log run` node (line 183), `Respond result` ke baad (196–198). [VERIFIED]

**3. Walkthrough:** `session_id` body se. Workflow naam "GS MAIN 01 Order API: <action>". Duration `started_at` se (check_token.js mein set). Cost SUB ke result se. Error jab ok=false. [VERIFIED]

**4. Function-by-function:** Brief mein function naam nahi the; upar block-level hai. [VERIFIED]

**5. Block-level:** Workflow naam = register ka header. Real-life: line par counter ka naam. [VERIFIED]

**6. Data ki journey:** body (session_id) + timing + SUB result → one run line → SUB 14. [VERIFIED]

**7. Connections:** `check_token.js` (`started_at`), `build.js` (MAIN wiring), `guard_log.js` (SUB 14 guard). [VERIFIED]

**8. Concepts:** Log after the answer; duty register. (concepts.delta.md)

**9. Red flags:** Khaali session_id par row chup-chaap drop (guard 400). Medium. [VERIFIED code + doc]

**10. Testability:** MAIN run row test (place, error, decide cost). [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247295 -->
> `session_id` body se; khaali ho to '' → SUB 14 guard 400 refuse → chup-chaap koi row nahi, MAIN ko pata nahi. Bad-input runs ka log kho jaata hai. Khaali par `'unknown'` likhna behtar, taaki har routed run ki ek line ho?
- **Status:** open

### `ops/n8n/order/code/guard_log.js` (+12)

**1. Job:** Duty register ka darwaza (SUB 14). Fields check, cost default 0, aur kill switch log likhne ko nahi roakta. Real-life: register ka munshi pehle dekhta hai ki line poori hai ya nahi. [VERIFIED]

**2. Kahan fit hai:** SUB 14 ka Guard node. [VERIFIED]

**3. Walkthrough:** Fields check → cost default 0 → kill switch log ko block nahi karta. [VERIFIED]

**4. Function-by-function:** Brief mein function naam nahi the. [VERIFIED]

**5. Block-level:** Kill switch exception line = "register chalu rakho, band board ke bawajood". [VERIFIED]

**6. Data ki journey:** run line → checks → Write run log. [VERIFIED]

**7. Connections:** `log_run.js` (input), `build.js` SUB 14. [VERIFIED]

**8. Concepts:** Log after the answer. (concepts.delta.md)

**9. Red flags:** MAIN ka 503 REFUSE branch `Log run` tak nahi aata. Exception abhi kis case mein chalegi, saaf nahi. [VERIFIED code; use case INFERRED]

**10. Testability:** SUB 14 row + refusals + cost default test. [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247301 -->
> "kill switch does not block a log write" — sahi soch (refusals bhi log hon). Par MAIN ka 503 REFUSE branch `Log run` tak aata hi nahi. To aaj yeh line kis case mein kaam aati hai — sirf jab SUB 11/12/13 apne guard se 503 de (SUB-level kill)?
- **Status:** open

### `ops/n8n/order/deploy.js` (+9/-6)

**1. Job:** Delivery van. Six workflows ka dry run aur apply. Real-life: van nikalne se pehle check: key hai ya nahi. [VERIFIED]

**2. Kahan fit hai:** `ops/n8n/order/`. Build output ko n8n par bhejta hai (abhi nahi). [VERIFIED]

**3. Walkthrough:** Six names. `JEV_CREDENTIAL` lookup (line 40). Dry run "MISSING" likhta hai. Apply line 52 par refuse karta hai bina credential ke. Build ko `openrouterCredential` milta hai. [VERIFIED]

**4. Function-by-function:** Brief mein function naam nahi the. [VERIFIED]

**5. Block-level:** Credential lookup = "van ki key". [VERIFIED]

**6. Data ki journey:** vault/credential name → check → build placeholders → n8n (apply). [VERIFIED; flow INFERRED]

**7. Connections:** `build.js` (openrouterCredential), `order.test.js` (deploy ORDER six), n8n (live). [VERIFIED]

**8. Concepts:** Deploy refuses without its credential. (concepts.delta.md)

**9. Red flags:** Live dry run: `GoServe OpenRouter` MISSING (apply refuse karega). Nothing activated. [VERIFIED]

**10. Testability:** Dry run aur credential refuse live check hue (dry run output). Deploy ka unit test `order.test.js` mein hai: six names, ERR first MAIN last, PUT payload keys, never activate/delete.

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247306 -->
> OpenRouter credential ke bina apply refuse — acha. Credential = Header Auth `Authorization: Bearer <key>`, cap $2. Yeh cap OpenRouter dashboard par set hai ya sirf vault note? Key kis account ka (klickbae8yt)? Owner se "haan" chat mein poochh raha hoon (F67).
- **Status:** open

### `ops/n8n/order/decide.test.js` (+184)

**1. Job:** Red-first checklist: 15 tests SUB 13, SUB 14 aur MAIN ke decide path ke liye. Real-life: pre-flight checklist jo shop khulne se pehle likhi gayi. [VERIFIED]

**2. Kahan fit hai:** CI Guard job (`ci.yml` glob). `build.js` aur code files padhta hai. [VERIFIED]

**3. Walkthrough:** Rule (3 cases), Jev request shape aur PII strip, refusals (503, six 400), ek row mein dono picks, rule wins jab Jev alag, S2 seven unusable + off, log write 200/502 bina raw text ke, SUB 14 row + refusals + cost default, MAIN run row, wiring (MAIN decide route, log after answer, declared fields, ≤ 15 nodes), wiring SUB 13 (Jev sirf guard ke baad, Jev node error par aage, write fail-closed, OpenRouter url, header auth), safety (callerPolicy, errorWorkflow ALERT, no `sk-or-v1`, Config keys, token placeholder), check_token tunables, layout sub13/sub14/main01. [VERIFIED]

**4. Function-by-function:** Har test ek checklist line hai. [VERIFIED]

**5. Block-level:** Stubs = "dummy input" jo Code node ko diya jaata hai. [VERIFIED]

**6. Data ki journey:** build output + code files → tests → pass/fail. [VERIFIED]

**7. Connections:** `build.js`, code files, `lib/layout*.js`, `ci.yml`. [VERIFIED]

**8. Concepts:** Red first for workflow code. (concepts.delta.md)

**9. Red flags:** Jev ka real reply shape stub hai; live row abhi nahi. [VERIFIED]

**10. Testability:** Node total 34 tests: red 19 pass / 15 fail (PR body), green 34/34 (reviewer re-run). [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247280 -->
> Red first is baar (19 pass / 15 fail) — acha, PR body mein proof. Par Jev ka real reply shape (`choices[0].message.content` JSON, `usage.cost`), `usage: {include: true}` aur `response_format: json_object` abhi stub hain. Tier A source (OpenRouter docs) hai, ya pehle live call par dekhenge (row 76)?
- **Status:** open

### `scripts/test_order_rpc.py` (+22/-1)

**1. Job:** Manager ke register ka auditor. Cap test naya, RLS lock test ab real uuid claim se. Real-life: register audit, jo baad mein pen wapas kar deta hai. [VERIFIED]

**2. Kahan fit hai:** `scripts/`, DB par chalta hai. CI discover se chalata hai. [VERIFIED]

**3. Walkthrough:** Cap test (lines 67–77): 20 inserts, retry k20 20 rahta hai, k21 → `session_order_cap`, s2 accepted (sirf list check). decision_log aur run_log rows workflow shape mein accept (79–86). [VERIFIED]

**4. Function-by-function:** Brief mein har test ka naam nahi tha. [VERIFIED]

**5. Block-level:** Cap test block (lines 67–77) = "token limit ka test-case". Run line ke bare mein brief mein kuch nahi tha. [VERIFIED lines from brief]

**6. Data ki journey:** test data → begin → function call → assert → rollback. [VERIFIED]

**7. Connections:** `0004` functions, `test_schema.py` (PR #64), vault token. [VERIFIED]

**8. Concepts:** Per-session cap (429). (concepts.delta.md)

**9. Red flags:** Cap test `s2` sirf list check karta hai (line 77). Low-medium. [VERIFIED]

**10. Testability:** Ran 9 tests OK (reviewer ne chalaya). [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247316 -->
> Cap test acha (20, retry, 21st). "Another session is not affected" sirf `isinstance(r, list)` dekhta hai — `created: true` assert karo taaki test sach mein s2 ka order prove kare?
- **Status:** open

### `docs/assumptions.md` (A42, line 52)

**1. Job:** Assumptions register. A42 mein 5 faisle ek row mein: rule decides, Jev advises, 0.70, $0.001 per call, 20 orders per session. Real-life: owner ke faisle ka chhota note. [VERIFIED]

**2. Kahan fit hai:** `docs/`. A42 ko PR ke andar "Confirmed" hona hai, owner ke haan ke baad. [VERIFIED]

**3. Walkthrough:** Ek row, paanch faisle. [VERIFIED]

**4. Function-by-function:** Doc hai, function nahi. [VERIFIED]

**5. Block-level:** A42 row = "faisle ki parchi". [VERIFIED]

**6. Data ki journey:** Owner ka jawab → row "Confirmed". [INFERRED]

**7. Connections:** `decide_guard.js` (rider trust), `decide_result.js` (0.70), `build.js` (cost cap), `0004` (cap). [VERIFIED]

**8. Concepts:** (naya concept nahi.)

**9. Red flags:** Owner ki haan abhi nahi mili. [VERIFIED per brief]

**10. Testability:** Doc hai, test nahi. [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247308 -->
> A42 mein 5 faisle ek row mein: rule decides, Jev advises, 0.70, $0.001 per call, 20 orders per session. Owner ko alag alag haan aasaan hoga — main chat mein list kar raha hoon; tum confirm ke baad row ko "Confirmed" karna.
- **Status:** open

### `docs/tests/test-cases.md` (+18/-8, line 65)

**1. Job:** Test register. 10 nayi rows, renamed test file rows, ek "Pending deploy" (live Jev, line 76). Real-life: register ka sheet, jisme har check ki line. [VERIFIED]

**2. Kahan fit hai:** `docs/tests/`. [VERIFIED]

**3. Walkthrough:** Renamed rows (`order.test.js`). Naye rows incl. live Jev row (76). Stale row "four GS workflows" (line 65). [VERIFIED]

**4. Function-by-function:** Table hai. [VERIFIED]

**5. Block-level:** Row = ek check. [VERIFIED]

**6. Data ki journey:** Test → row → status. [INFERRED]

**7. Connections:** `decide.test.js`, `order.test.js`, `deploy.js` (six). [VERIFIED]

**8. Concepts:** (naya concept nahi.)

**9. Red flags:** Row 65 stale ("four" → six). [VERIFIED]

**10. Testability:** Docs hai; row ka sach test se aata hai. [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247311 -->
> Row "Deploy script touches only the four GS workflows" — ab six hain (test update hua, row nahi). F65(a) bhi "three workflows" kehta hai. Chhota docs fix is PR mein, ya agle ke saath?
- **Status:** open

### `docs/integrations/n8n-order-workflows.md` (+25/-4, line 83)

**1. Job:** Registry card. SUB 13/14 ki rows, decide body, 429 row, Run log section, SUB contracts, OpenRouter credential, deploy six. Real-life: counter ki laminated menu card, naye items ke saath. [VERIFIED]

**2. Kahan fit hai:** `docs/integrations/`. Rulebook registry (A1.3) yahin hai. [VERIFIED]

**3. Walkthrough:** Registry rows (SUB 13/14), decide body (line 50), 429 row, Run log section (line 73), SUB 13/14 contracts (81–82), Jev continue-on-error (line 83), credential, deploy six. [VERIFIED]

**4. Function-by-function:** Doc hai. [VERIFIED]

**5. Block-level:** Contract table = "reply card ka chart". [VERIFIED]

**6. Data ki journey:** Doc → coder aur reviewer ke liye ek jagah. [INFERRED]

**7. Connections:** `build.js`, `shape.js` (429), F67 (`follow-ups.md`). [VERIFIED]

**8. Concepts:** Continue on error (advice path). (concepts.delta.md)

**9. Red flags:** Jev error shape assumed (line 83). Medium until live. [VERIFIED]

**10. Testability:** Doc hai; live row 76 proof karegi. [VERIFIED]

**11. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265247313 -->
> "The Jev call is the one node that continues on error" — B7 rule 82 ka exception sahi hai (advice path, write nahi). Par timeout par n8n `continueRegularOutput` item mein `error` field kaise aata hai? Test `{error:'timeout'}` maanta hai; live par yeh shape confirm karna hai (row 76 ke saath).
- **Status:** open

### `ops/n8n/order/code/decide_done.js`, `log_done.js`, `check_token.js`, `shape.js`, `order.test.js`, `ci.yml`, `LEARNINGS.md`, `follow-ups.md`, `process-trace.md`, notebook bundle

Chhote badlav, ek-do line mein (in files par koi naya question nahi):
- `decide_done.js` (+7): decision wapas (200/201/204), warna 502. Real-life: diary likhi to hi rider assign. [VERIFIED]
- `log_done.js` (+3): SUB 14 ka last node. Status 200/201/204 → `{ok, 200}`, warna 502 'The run log was not stored.' [VERIFIED count]
- `check_token.js` (+3/-2): `decide` action, `started_at`, tunables aage bhejna. Real-life: pass check ke saath ghadi shuru. [VERIFIED]
- `shape.js`: 429 message (session cap). +1 line: `session_order_cap` → 429 'Too many orders in this demo session.' [VERIFIED for 429 mention]
- `order.test.js` (+6/-5, `test.js` se rename): 429 mapping; Route ke 4 outputs; deploy ke six. [VERIFIED]
- `ci.yml`: Guard job `node --test "ops/n8n/order/*.test.js"` chalata hai (glob). [VERIFIED]
- `LEARNINGS.md` (+4, lines 78–81): CI status pehle dekho; migration list badhti hai; function replace karne se purana test toota (uuid cast); `node --test <dir>` fail hota hai, `*.test.js` glob lo. [VERIFIED lines; content from brief]
- `follow-ups.md` F67 (line 74): OpenRouter credential ki yes. F65(a) abhi "three workflows" kehta hai (stale). [VERIFIED]
- `process-trace.md` rows 142–144. [VERIFIED]
- Notebook bundle (5 files): pr-66 chapter, concepts, mental-model, my-questions, README (7 chapters). Trace rows 142–143 bundle mein. [VERIFIED]

---

## Handoff

> State: 18 posted · 0 must-fix · actor: coder, then owner decides and merges
>
> You are the developer for GoServe PR #67 (feat/46-decide-logs). Do this: (1) reply on all 18 threads in 1-2 sentences; (2) optional before merge: fix the stale counts (test-cases row "four GS workflows", F65(a) "three workflows") and assert `created: true` in the other-session cap case; (3) last step: copy the reviewer's notebook bundle (it will carry the pr-67 chapter) into `docs/pr-reviews/` and append its trace/learnings rows (path in chat); one commit; push; reply "PR #67 threads answered at <sha>"; (4) deploy nothing until the owner says "push kar do" and the OpenRouter credential exists (F67); (5) after #67 merges, start story #48 "Customer screen: menu, cart, bill, place order" (epic #36) on `feat/48-customer-screen` from `dev`, red first, unless the owner picks #47 (scorecard) first.
>
> _(PR par post hua — `satvik-jain-iitd`, APPROVE review 5511373264 with 18 inline threads, 14 Oct 2026.)_

**Owner handoff (Romanized Hindi):**

```text
State: PR #67 APPROVED (50853ce) · CI green · actor: owner

1. A42 par haan do: rule decides, Jev advises; Jev ka jawab 0.70 se upar ho to hi maana jaaye; $0.001 se mehenga Jev call ignore; 20 orders per session.
2. n8n credential `GoServe OpenRouter` banane ki haan do (Header Auth, vault key `GOSERVE_OPENROUTER_KEY`). $2 cap OpenRouter ke side par set karna.
3. "push kar do" bolo: six workflows inactive deploy honge. Activation ki yes alag se chahiye.
4. PR #67 merge karo jab ready ho.
5. Abhi bhi open: A41, F61, prod deploy twice (F65 c). Yeh owner ke faisle hain.
```
