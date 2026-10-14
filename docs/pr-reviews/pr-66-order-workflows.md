# PR #66 — feat(n8n): order database functions and order workflows (built, not deployed)

- **Branch:** `feat/45-order-workflows` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** #45 "Place order and change status workflows (MAIN 01, SUB 11, SUB 12)" (epic #35)
- **State:** **APPROVED** — head `ddb12f1` (2026-10-14, review 5511133380 by `satvik-jain-iitd`), CI green, merge pending
- **Review:** 5510948755 by `satvik-jain-iitd` — verdict needs-fix (3 small) → fixed in ddb12f1
- **Files:** 22 (6 of them notebook files under `docs/pr-reviews/`) · **Lines:** +1325 / -17 (review ke baad: 24 files; fix commit ddb12f1 rebased into one commit, subject 60 chars)
- **Reviewer:** satvik-jain-iitd
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/66

> Dhaba ka counter ab order khud nahi likhta. Counter par n8n khada hai (counter boy), aur register manager ke haath mein hai: database ke do functions, jo order aur carbon copy ek hi baar mein likhte hain.

---

## Overall review

## 1. Ek-line logline

> `Feat PR: phone ka order n8n counter se hokar database ke do functions tak jaata hai, jo order aur event ek saath likhte hain. Sab kuch built hai, par abhi deploy nahi hua, aur CI laal hai.`

## 2. Big Picture (Story & Goal)

- Story #45 "Place order and change status workflows (MAIN 01, SUB 11, SUB 12)", epic #35. [VERIFIED]
- Persona: customer aur kitchen. Spec §6.2 aur §6.3, aur build design §6 se judi hai. [VERIFIED]
- Depends on: data layer stories. Owner ki yes activation se pehle chahiye. [VERIFIED]
- S1 place order: valid token → ek `orders` row + `order.placed` event. Bad token → 401. [VERIFIED]
- S2 change status: `accepted`, `preparing`, `ready` har ek event likhta hai. Galat step → error, aur kuch nahi likha jaata. [VERIFIED for error; "writes nothing" by construction, not asserted]
- S3 kill switch: writes band, saaf message ke saath. [VERIFIED tests]

## 3. Yeh ab aaya kyun? (Context)

- Pehle (PR #64, #65 ke baad): register (tables), taala (RLS) aur menu the. n8n par sirf do website-form workflows the: `GoServe — Pre-Registration Capture` aur `GoServe — Investor Contact`. Order likhne ka raasta nahi tha. [VERIFIED live n8n list]
- Is PR se unlock hota hai: phone ek POST bhejta hai, n8n usse database function tak le jaata hai, aur order + event ek saath likhe jaate hain. [VERIFIED code]
- Iske bina: phone order nahi bhej sakta, aur kitchen ko kuch nahi dikhta. [INFERRED from S1/S2]
- Abhi kya baaki hai: 3 workflows n8n par nahi hain. Functions goserve-dev database par hain. [VERIFIED]

## 4. Real-Life Analogy

Poori PR ek dhaba ka counter hai, jahan register manager ke paas hai.

1. Phone = customer, jo counter par parchi deta hai (`POST /webhook/gs-order`, header `x-gs-token`, body `{action, ...}`).
2. `GS MAIN 01 Order API` = counter boy. Demo pass check karta hai, "orders paused" board dekhta hai, parchi ka `action` padh kar sahi helper ko bhejta hai.
3. `GS SUB 11 Place order` aur `GS SUB 12 Change status` = do helpers. Har ek board dobara dekhta hai, parchi bhari hai ya nahi check karta hai, manager se ek hi sawaal poochta hai, aur customer ke liye reply card likhta hai.
4. `place_order` aur `change_status` (SQL) = manager. Price rate card se nikalta hai (parchi se nahi). Order aur carbon copy ek saath likhta hai, ya bilkul nahi. Same token number par dobara aaye to purana order wapas deta hai.
5. Database ka head waiter (trigger from PR #64) = galat step register mein nahi likhne deta.
6. `callerPolicy` = sirf counter boy helpers ko bula sakta hai. Service-role-only EXECUTE = sirf manager ka pen likhta hai.
7. `shape.js` = helper ka reply card: 201, 200, 400, 404, 409, 503, 502. Manager ke kachche shabd bahar nahi jaate.
8. Sticky-note layout = kitchen ki deewar par chart: ek box per step, bayein se daayein, koi overlap nahi. Tests chart ko check karte hain.
9. Commit subject 72 se lamba = slip ka header register ki column se bahar. Guard (CI gate) use wapas bhej deta hai.

## 5. Is PR mein naye Concepts (10)

Har concept ki detail `concepts.delta.md` mein hai.

- **RPC through PostgREST** — `POST /rest/v1/rpc/<function>` se database function chalta hai. Real-life: counter boy manager se sawaal poochta hai.
- **Transactional function** — order aur event ek saath, ya kuch nahi. Real-life: register aur carbon copy ek hi haath se.
- **MAIN / SUB workflows (B11)** — MAIN trigger aur routing sambhalta hai, SUB ek kaam karta hai. Real-life: counter boy aur do helpers.
- **Execute Workflow Trigger with defined inputs** — SUB apne fields declare karta hai. Real-life: helper ka printed slip format.
- **callerPolicy** — sirf listed workflows SUB ko bula sakte hain. Real-life: sirf counter boy helpers ko bulaye.
- **Kill switch checked twice (95.15)** — MAIN par aur har write SUB par. Real-life: "orders paused" board counter par aur kitchen ke darwaze par.
- **neverError + fullResponse** — HTTP node error phenkne ki jagah status code deta hai, taaki SUB use map kar sake. Real-life: helper jawab padh kar reply card likhta hai.
- **Mutation check** — jaan-boojh kar code todh kar dekhna ki test laal hota hai. Real-life: alarm test karne ke liye darwaza khol kar dekhna.
- **Sticky-note layout as code (B12)** — positions build se aate hain, tests geometry check karte hain. Real-life: deewar ka chart chhapa hua, haath se nahi banaya.
- **Commit subject limit (72)** — Guard lamba subject bounce karta hai, aur merge se pehle CI green chahiye. Real-life: register ki column ki chaudai.

## 6. High-Level Flow

Journey: phone se register tak, aur wapas jawab tak.

1. Phone `POST /webhook/gs-order` bhejta hai (header `x-gs-token`, body `{action, ...}`). [VERIFIED]
2. MAIN Config `kill_switch`, `demo_token`, `supabase_url` jodta hai. [VERIFIED]
3. Check token (Code node). Galat token → 401. [VERIFIED]
4. Kill switch on? → 503. [VERIFIED]
5. Route by action. Galat action → 400. [VERIFIED]
6. SUB 11 ya SUB 12 ko id se bulaya jaata hai, declared fields ke saath. [VERIFIED]
7. SUB Guard: kill switch dobara, shape check. Galat parchi → 400 ya 503 wapas. [VERIFIED]
8. HTTP Request `POST /rest/v1/rpc/place_order` ya `change_status`, service-role credential ke saath. [VERIFIED]
9. Function order + event ek transaction mein likhta hai, ya error phenkta hai. [VERIFIED by DB test]
10. Shape result 201/200/400/404/409/502 mein badalta hai. [VERIFIED]
11. MAIN `Respond result` status code ke saath jawab bhejta hai. [VERIFIED wiring test]

Ye sab abhi n8n par nahi hai (live check). Deploy aur activation owner ki yes ke baad.

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/supabase/migrations/0003_order_functions.sql` | Manager ka register: `place_order` aur `change_status` functions, aur unka grant (sirf service role) |
| `ops/n8n/order/build.js` | Blueprint printer: MAIN aur do SUB ke nodes, edges aur settings, sab ek script se |
| `ops/n8n/order/code/check_token.js` | Counter boy ka demo pass check |
| `ops/n8n/order/code/guard_place.js` | Helper 11 ka darwaza-check: kill switch, lambai, items 1–20 |
| `ops/n8n/order/code/guard_status.js` | Helper 12 ka darwaza-check: kill switch, order id ka format, actor list |
| `ops/n8n/order/code/shape.js` | Reply card maker: manager ke jawab ko 201/200/400/404/409/502 mein badalta hai |
| `ops/n8n/order/test.js` | Checklist: 14 tests, n8n ke code aur wiring ke liye |
| `ops/n8n/lib/layout.js` | Kitchen deewar chart ka painter: positions aur sticky notes |
| `ops/n8n/lib/layout_checks.js` | Chart inspector: overlap, gap, left-to-right check |
| `scripts/test_order_rpc.py` | Manager ke register ka auditor: 6 integration tests, har ek begin…rollback mein |
| `docs/integrations/n8n-order-workflows.md` | Registry card: 3 workflows, contract, answer codes |
| `docs/follow-ups.md` | To-do list: F65 naya; F63 mein 0003 chahiye |
| `docs/tests/test-cases.md` | Test register: 10 nayi rows (46–55) |
| `docs/LEARNINGS.md` | Sabak ki diary: 4 nayi lines (74–77) |
| `docs/decisions/ADR-010-session-id-is-the-anonymous-user-id.md` | Decision slip: status ab "Accepted" |
| `docs/process-trace.md` | Daily diary: rows 137–140 |
| `.github/workflows/ci.yml` | Gate ka register: Guard job mein node tests ka step (line 84) |

## 8. Pieces aapas mein kaise baat karte hain

Text map (koi code is map ko run nahi karta):

- `build.js` → banata hai: MAIN (12 nodes), SUB 11 (`place`), SUB 12 (`status`). [VERIFIED]
- MAIN → `callSub` → SUB 11 / SUB 12 (id se, declared fields ke saath). [VERIFIED]
- SUB → `guard_*.js` (check) → HTTP → `place_order` / `change_status` (SQL, `0003`) → `shape.js` → wapas MAIN. [VERIFIED wiring test]
- `check_token.js` → MAIN ke Check token node ke andar. [VERIFIED]
- `test.js` → `build.js` aur code files ko padhta hai, 14 tests. [VERIFIED]
- `test_order_rpc.py` → database par chalta hai (Management API). [VERIFIED]
- `ci.yml` Guard job → `node --test ops/n8n/order/test.js`. [VERIFIED]

## 9. Pehle se kya badla

- 22 files, +1325 / -17, 2 commits. [VERIFIED]
- Naya: `0003` migration (+93), `build.js` (+131), code files (`check_token.js` +7, `guard_place.js` +11, `guard_status.js` +12, `shape.js` +14), `test.js` (+137), layout lib (`layout.js` +69, `layout_checks.js` +76), `test_order_rpc.py` (+63), integrations doc (+73). [VERIFIED counts]
- Badla: `ci.yml` +3, `follow-ups.md` (F65), `LEARNINGS.md` +4, `test-cases.md` +10 rows, process-trace rows, ADR-010 status. [VERIFIED]
- Notebook bundle: 6 files under `docs/pr-reviews/` (pr-65 chapter, journals, README). [VERIFIED]
- Before: database mein tables, RLS aur menu the. Order likhne ka raasta nahi tha. n8n par sirf 2 website workflows.
- After: database mein 2 functions (live goserve-dev par, `EXECUTE` sirf `postgres` aur `service_role` ko; `SECURITY INVOKER`). Orders 0, events 0 (reviewer ke run ke baad). n8n par credential `GoServe Supabase dev` bana (docs ke hisaab se; n8n par dobara check nahi kiya), lekin 3 workflows nahi hain. Code branch mein 3 workflows taiyar, deploy nahi. [VERIFIED by query; credential INFERRED from docs]

## 10. Macro Risks & Downstream Impact

Ranked. Har risk ke saath kitna bada, aur kya check karna hai.

1. **CI laal: commit subject 77 > 72** (Guard). Merge band jab tak subject nahi badlega. Bada: high. Check: CI green. [VERIFIED]
2. **Koi `errorWorkflow` nahi** (rulebook 84 / 95.14). Fail hone par owner ko kuch pata nahi chalega. GoServe ka error alert hi nahi hai. Activation se pehle zaroori (F65 b). Bada: high before activation. [VERIFIED]
3. **Public webhook par rate limit nahi** (F65 d; ADR-009 throttle maangta hai). `allowedOrigins '*'` aur demo token app bundle mein. Koi bhi `place_order` spam kar sakta hai. Brake sirf kill switch hai, jo PUT se badlta hai. Bada: high before activation. [VERIFIED code; abuse INFERRED]
4. **Kill switch aur token Config mein hardcoded** (build.js line 91). Badalne ke liye redeploy. B13.1 kehta hai `params` mein ho. Demo ke liye theek. [VERIFIED]
5. **Retry mein badla cart chhup jaata hai.** Same `client_order_key` aur alag items → purana order 200 `created:false`. Phone ko pata nahi. Key per cart ho ya nahi, #48 decide karega. [VERIFIED code; effect INFERRED]
6. **`test_order_rpc.py` Run line galat.** Import sirf discover mein chalta hai. CI discover chalata hai, isliye CI pass karta hai. Misleading. [VERIFIED]
7. **"writes nothing" assert nahi hota.** Test ka naam bada hai, check kam. Guarantee statement-atomicity se aata hai. [VERIFIED]
8. **F63 mein `0003` nahi.** Prod par tables aur RLS honge, functions nahi. Har order call 404 hoga. Bada: high at prod release. [VERIFIED F63 text]
9. **Do layer validation drift.** n8n guard (items ≤ 20 lines, actor list, lengths) aur function (qty 1–20 per line, lines cap nahi, actor koi bhi text). Service-role se seedha call n8n layer bypass karta hai. [VERIFIED]
10. **Event naam ≠ status naam** (`out_for_delivery` → `order.picked_up`). Documented, par yaad rakhna padta hai. [VERIFIED]
11. **`responseCode` expression** (`={{ $json.status_code }}`) Respond to Webhook par. Chalna chahiye, par sirf live test (row 55) proof karega. [INFERRED 0.8]
12. **Browser preflight.** Custom header OPTIONS maangta hai. n8n jawab na de to token body mein jaana padega (F65 e). [INFERRED; coder ne flag kiya]
13. **Layout lib 3 projects mein 3 copies** (Lead Engine, Miraya port, GoServe). Ek bug yahin mila (3rd edge field). Drift ka risk. [VERIFIED LEARNINGS line 75]
14. **n8n tests red-first nahi the.** Code ke saath likhe gaye; 3 mutations se check hua, PR body mein honest likha. [VERIFIED]
15. **Guard job ka naam adhoora.** Ab node tests bhi chalte hain. Cosmetic; F57 required-check names. [VERIFIED]

Downstream: #46 (SUB 13/14) isi SUB pattern par chalega. #48 (customer screen) retry key par nirbhar hai. F63 (prod release) aur F65 (deploy) is PR par wait kar rahe hain. [VERIFIED from brief; dependency INFERRED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)

- Retry queue aur multi-kitchen routing. Wajah: story ponytail. [VERIFIED]
- Rate limit, deploy script, prod copy, error alert. Wajah: F65; owner ke faisle chahiye. [VERIFIED]
- Decide (SUB 13) aur logs (SUB 14), daily scorecard (MAIN 90). Wajah: story #46 / #47 (design §6). [VERIFIED]
- Live webhook test. Wajah: abhi kuch deploy nahi; owner ki yes pehle (A2.8). [VERIFIED]
- Config `params` se. Wajah: B13 baad mein; demo pehle. [VERIFIED]

Samajhne wali baat: "nahi banaya" bhi ek design decision hai. Rate limit aur error alert abhi nahi bane. Dono activation se pehle chahiye, isliye yeh owner ka faisla hai, coder ka nahi.

## 12. Testing Story

- **Red-first (database):** PR body mein `Ran 6 tests ... FAILED (failures=6)`. Functions nahi the, to tests pehle laal the. [VERIFIED from PR body]
- **Green (database):** `python3 -m unittest discover -s scripts -p test_order_rpc.py` vault token ke saath: `Ran 6 tests OK (10 s)`. Reviewer ne chalaya. [VERIFIED]
- **Green (n8n):** `node --test ops/n8n/order/test.js` → pass 14, fail 0. Reviewer ne chalaya. [VERIFIED]
- **Red-first (n8n):** NAHI. Tests code ke saath likhe gaye. 3 mutations (409→200, kill switch hataya, gap 200→100) se check hua; har ek ne test pakda. [VERIFIED PR body + LEARNINGS]
- **Run line jhoot:** `python3 -m unittest scripts/test_order_rpc.py` → `ModuleNotFoundError: No module named 'test_schema'`. [VERIFIED]
- **CI:** Site pass, App pass, Guard FAIL. Guard log: `commit subject over 72 characters: 77`. Node tests Guard job ke andar pass hue (14/0), phir subject check fail hua. [VERIFIED log]
- **Covered:** token cases, action whitelist, kill switch dono SUB mein, guard shapes, answer mapping (raw DB text nahi), wiring (ids, declared fields, order), safety (callerPolicy, no secrets ya project ref in build), names, layout ×3. DB: place + retry + price + counts, bad items/address, 3 steps → 4 events, illegal step aur unknown status error, other session, phone keys cannot execute. [VERIFIED]
- **Not covered:** live 401/201/200/409/503 (deploy ke baad); "writes nothing" assertion; `errorWorkflow`; OPTIONS preflight; `responseCode` expression; actor validation in DB. [VERIFIED]
- **Test-cases:** 9 rows Pass (3 sirf local), 1 "Pending deploy" (row 55). [VERIFIED]

## 13. Trade-offs & Alternatives

| Option chuna | Kyun | Kya chhoda |
|---|---|---|
| Logic SQL functions mein, n8n patla counter | ADR-007/009; ek transaction; price menu se; n8n atomic multi-table write nahi kar sakta | Readability non-SQL readers ke liye; n8n par kam dikhta hai |
| 401 Code node se | Story 401 kehti hai | n8n header auth ka built-in (jo 403 deta) |
| Config hardcoded | Demo speed | B13 self-improvement loop abhi nahi |
| Layout lib copy | Monorepo abhi nahi | Ek single source |
| Mutation check | Tests code ke saath aaye | Saaf red-first proof (recorded) |
| `neverError` on HTTP node | Codes `shape.js` mein map, DB text bahar nahi | n8n ka apna error path (errorWorkflow 4xx/5xx par waise bhi nahi chalta) |

## 14. Patterns is PR se

- **Counter boy aur helpers (MAIN/SUB, B11):** `build.js` `sub()` aur `build()`. Ek MAIN, do SUB.
- **Manager ka register (transaction):** `0003` lines 5–59 (`place_order`). Likhna ya kuch nahi.
- **Kill switch do baar:** MAIN Config aur `guard_*.js`.
- **Reply card (shape):** `shape.js`, status code map.
- **Test as checklist:** `test.js` 14 tests, `node --test`; Code nodes `new Function('$input', ...)` stubs se.
- **Chart as code:** `ops/n8n/lib/` positions + geometry checks.
- **Grants ka taala:** `0003` lines 90–93, revoke aur grant.

## 15. AI-Review Lens

- **Trust karna safe:** SQL functions chhote, guarded aur transactional hain; grants live check hue (`postgres`, `service_role` only; SECURITY INVOKER). SUB ka shape (check → ek write → shape) B11 ke mutabik hai. Wiring aur safety tests, aur imaandar PR body. [VERIFIED]
- **Interrogate karo:** jo green tests nahi dekh sakte: kuch deploy nahi, live call nahi, errorWorkflow nahi, rate limit nahi. Run line jo chalti nahi. Test naam jo zyada vaada karta hai. Config jo PUT maangta hai. Docs row jo `0003` bhool gaya. [VERIFIED]
- **Confident but risky:** "Nothing is deployed" sach hai (n8n par check). "Tests pass" bhi sach hai. Par Guard laal hai, isliye PR abhi merge nahi ho sakta. CI status pehle padho, body baad mein. [VERIFIED]

## 16. Questions

**Top-3 abhi poocho:**

1. (Risk, `ops/n8n/order/build.js` line 32) `settings` mein `errorWorkflow` nahi hai (rulebook 84 / 95.14), kyunki GoServe ka Error Alert workflow hai hi nahi. Activation se pehle ek chhota "GS ERR 00 Alert" (Telegram to owner) banana zaroori hai. #46 ke saath, ya is PR ke follow-up mein? Tumhari recommendation?
2. (Testability, `ops/n8n/order/test.js` line 1) n8n tests code ke saath likhe gaye, red nahi dikhe. 3 mutations se check kiya. Woh teen mutations test file ke header ya `docs/tests` mein likh do, taaki agla reviewer wahi dohra sake? Aur SUB 13/14 par red-first wapas.
3. (Risk, `scripts/test_order_rpc.py` line 6) `from test_schema import` sirf `discover -s scripts` mein chalta hai. File ki Run line (`python3 -m unittest scripts/test_order_rpc.py`) `ModuleNotFoundError` deti hai. `sys.path.insert` ek line, ya Run line discover wali, kaunsa?

<details><summary>Poora question bank (20, 8 categories mein)</summary>

### 1 Purpose
- `ops/n8n/order/code/shape.js` line 6: `statusCode === 200` par `body.created` undefined → 200 ok. Agar body `{}` aaye (galat function ya url), `order: undefined` 200 chala jaayega. `order` missing par 502 safer nahi?
- `docs/integrations/n8n-order-workflows.md` line 10: Registry yahan hai (A1.3), acha. Rulebook 95.23 registry test (n8n folder vs registry): GS folder/tag abhi nahi (F65 g). Deploy ke baad registry test kaun likhega, kis story mein?

### 2 Understanding
- `ops/n8n/order/build.js` line 108: `Respond result` ka `responseCode` expression se (`={{ $json.status_code }}`). Respond to Webhook isse maanta hai? Live row 55 pending; deploy ke baad pehla check yahi ho.
- `ops/n8n/order/test.js` line 133: layout tests pass, par canvas abhi deploy nahi hua. B12.6: deploy ke baad editor mein fit-view dekhna. Yeh check kaun karega, screenshot evidence?
- `app/supabase/migrations/0003_order_functions.sql` line 48: same key → purana order, `created:false`, 200. Agar retry mein items alag hon, to purana chup-chaap wapas. Key per cart banegi (#48), ya mismatch par 409?

### 3 Assumptions
- `ops/n8n/order/build.js` line 91: `kill_switch: false`, `demo_token`, `supabase_url` Config node mein hardcoded. Badalne ke liye PUT. B13.1 kehta hai `params` table. Demo ke liye theek; `params` se Config kab padhega (#46 SUB 14 ke saath?)?
- `app/supabase/migrations/0003_order_functions.sql` line 71: `out_for_delivery` → event `order.picked_up`. Rider ke liye "picked up" sahi, par naam alag rakhne se mapping yaad rakhni padegi. Jaan-boojh kar?
- `.github/workflows/ci.yml` line 84: Guard job ab node tests bhi chalata hai. Job ka naam "Guard (secrets, size, markers, commit messages, PR size)" ab adhoora hai. Naam badlo (F57 required-check names bhi), ya alag job?

### 4 Risk
- `ops/n8n/order/build.js` line 32 (TOP-1): `errorWorkflow` nahi. Activation se pehle Error Alert workflow kab?
- `ops/n8n/order/build.js` line 90: `allowedOrigins: '*'` + header token. Token app bundle mein hoga (ADR-009, public). Rate limit nahi (F65 d). Activation se pehle n8n-level cap ya per-session cap chahiye?
- `app/supabase/migrations/0003_order_functions.sql` line 90: grants live dekhe: sirf `postgres` + `service_role`; functions SECURITY INVOKER. Agar kabhi `authenticated` ko grant mil jaaye, to RLS (sirf select policies) insert rokega. Ek test is "do taale" ko lock kare?
- `scripts/test_order_rpc.py` line 6 (TOP-3): `from test_schema import` ka Run line wala bug.

### 5 Alternatives
- `ops/n8n/order/build.js` line 61: Layout lib Lead Engine se copy (`ops/n8n/lib/`), aur yahin ek bug mila (3rd edge field). Ab 3 projects mein 3 copies. Shared package kab? F row?
- `ops/n8n/order/code/check_token.js` line 4: 401 Code node se, kyunki n8n header auth 403 deta hai. Alternative: header auth rakho aur story mein 403 maan lo. 401 zaroori tha (#48 ka client 401 par kuch alag karega)?

### 6 Impact
- `app/supabase/migrations/0003_order_functions.sql` line 86: `p_actor` DB mein kisi bhi text ke saath chalta hai (n8n guard list check karta hai). Lines cap bhi sirf n8n mein (20). Service role se seedha call n8n bypass karta hai. DB mein bhi check (actor list, lines cap)?
- `docs/tests/test-cases.md` line 55: Live row "Pending deploy". Deploy aur activation owner ke yes par. Us din 5 live calls kaun chalayega, execution ids (MAIN + SUB, 95.22) kahan record honge (A3.14)?

### 7 Testability
- `ops/n8n/order/test.js` line 1 (TOP-2): n8n tests code ke saath likhe, red nahi. 3 mutations kahin likhe jaayein.
- `scripts/test_order_rpc.py` line 44: "writes nothing" naam, par test sirf error string check karta hai. Naam theek karo, ya ek alag batch mein 409 ke baad count 1/1 check?

### 8 Future
- `app/supabase/migrations/0003_order_functions.sql` line 1: `0003` dev par apply hua; F63 abhi sirf `0001` aur `0002` list karta hai. Prod par functions na hon to har order call 404. F63 mein `0003` is PR mein add karoge?
- `docs/follow-ups.md` line 72: F65 (c) prod: copy vs switch. Build already `supabaseUrl` aur `credential` deploy-time par leta hai, to same build alag ids/credential/url se prod par. Recommendation? Owner decide karega.

</details>

**Self-check (3 sawaal, khud se poochho):**

- Counter boy (n8n) kya karta hai, aur manager (SQL function) kya karta hai, ek line mein?
- Guard CI laal kyun hai, aur usse merge par kya asar hai?
- "Nothing deployed" maine kaise verify kiya?

---

## Files (ek-ek)

### `app/supabase/migrations/0003_order_functions.sql` (+93)

**1. Job:** Manager ke register ka page. Do functions: `place_order` (order likhna) aur `change_status` (status badalna). Real-life: manager ka pen. [VERIFIED]

**2. Kahan fit hai:** n8n SUB 11 aur SUB 12 inhe HTTP POST `/rest/v1/rpc/<fn>` se bulate hain. Trigger (PR #64, `0001`) step-order rokta hai. [VERIFIED]

**3. Walkthrough:** `place_order` (lines 5–59): session aur key check (16), address (19), items array non-empty (22). Items loop (26–44): qty aur dish lookup guarded block (27–32), unknown dish ya qty 1–20 ke bahar (33–35), ek hi kitchen (36–39), price menu se (41), line snapshot naam aur price ke saath (42–43). Insert `on conflict (session_id, client_order_key) do nothing` (46–49). Retry par purana order `created:false` (51–54). Event `order.placed` (56–57). Return `{created, order}`. `change_status` (61–88): status se event ka naam map (67–73), unknown par `invalid_status` (74–76), session ke scope mein `for update` lock (78), `order_not_found` (79–81), update (84; trigger 0001 ek step enforce karta hai), event `coalesce(p_actor,'unknown')` ke saath (85–86). [VERIFIED lines from brief]

**4. Function-by-function:**
- `place_order`: input (session, key, items jsonb, address). Output `{created, order}`. Real-life: manager ka order slip check. [VERIFIED]
- `change_status`: input (order uuid, session, to, actor). Output: `{order}` (updated row).  Real-life: register mein status ki line badalna. [VERIFIED for inputs]

**5. Block-level:** Grants (lines 90–93): revoke from public, anon, authenticated; grant to service_role. Real-life: manager ke pen par sirf uska naam. [VERIFIED]

**6. Data ki journey:** items (jsonb) → validate → price menu se → order row + order_events row, ek transaction mein. [VERIFIED; flow INFERRED]

**7. Connections:** `0001` (tables, trigger), `0002` (RLS, koi insert policy nahi), n8n SUB 11 aur SUB 12 (callers), `test_order_rpc.py` (tests). [VERIFIED]

**8. Concepts:** Transactional function, RPC, Service-role-only EXECUTE (detail `concepts.delta.md`).

**9. Red flags:**
- Retry mein badla cart chhup jaata hai (line 48). Medium. Effect INFERRED.
- `p_actor` free text (line 86). Low-medium. [VERIFIED]
- Lines cap DB mein nahi, sirf n8n mein (line 36–39 ke aas-paas). Low-medium. [VERIFIED]
- `out_for_delivery` ka naam alag (line 71). Low. [VERIFIED]
- `0003` F63 mein nahi (line 1). Prod par High. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855050 -->
> `place_order` / `change_status` ke grants (lines 90–93) live par check hue: sirf `postgres` aur `service_role` ko EXECUTE. Functions SECURITY INVOKER hain. Agar kabhi `authenticated` ko galti se grant mil jaaye, to RLS (sirf select policies) insert rok dega. Do taale. Sahi samjha? Ek test is "do taale" ko lock kare?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Haan, do taale. ddb12f1 mein naya test hai: galti se `authenticated` ko grant mile, to bhi RLS write rokta hai.
- **Lesson:** Do taale, dono tested: grants aur RLS.

<!-- gh-comment-id: 4264855057 -->
> Retry: same key → purana order, `created:false`, 200. Agar retry mein items alag hon (same key, badla cart), to purana chup-chaap wapas, phone ko pata nahi. Key per cart banegi (#48), ya mismatch par 409?
- **Status:** answered
- **Reply (klickbae8yt-star):** Abhi same key purana order deta hai. Alag cart par 409 hona chahiye. Yeh #48 ke cart screen ke saath aayega, jo keys banayegi (F66 e).
- **Lesson:** Same key, alag cart = 409, baad mein (#48, F66 e).

<!-- gh-comment-id: 4264855068 -->
> `out_for_delivery` → event `order.picked_up` — ek jagah naam alag. Rider ke liye "picked up" sahi, par status aur event ka naam alag rakhne se seekhne wale ko mapping yaad rakhni padegi. Jaan-boojh kar?
- **Status:** answered
- **Reply (klickbae8yt-star):** Jaan-boojh kar. Event ke naam spec se aate hain (`order.picked_up`), status `out_for_delivery` hi rahega. Mapping contract doc mein hai.
- **Lesson:** Event naam spec se aata hai; mapping contract doc mein hai.

<!-- gh-comment-id: 4264855076 -->
> `p_actor` DB mein kisi bhi text ke saath chalta hai (n8n guard list check karta hai). Lines cap bhi sirf n8n mein (20), DB mein per-line qty cap. Service role se seedha call n8n layer bypass karta hai — DB mein bhi `check` (actor list, lines cap)?
- **Status:** answered
- **Reply (klickbae8yt-star):** Service role trusted hai, aur sirf n8n inhe call karta hai. DB already 1 se 20 per line check karta hai. Actor aur line-count checks tab jodenge jab koi aur caller aayega (F66 d).
- **Lesson:** Abhi trusted caller hai; naya caller aaye to DB checks (F66 d).

<!-- gh-comment-id: 4264855082 -->
> 0003 dev par apply hua; F63 abhi bhi sirf 0001, 0002 list karta hai. Prod par functions na hon to har order call 404. F63 mein 0003 is PR mein add karoge?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** ddb12f1 mein F63 ab `0003` bhi list karta hai.
- **Lesson:** Migration list har nayi migration ke saath badhti hai.

**11. Testability:** 6 integration tests (`test_order_rpc.py`) place, retry, price, counts, bad items, 3 steps, illegal step error, other session, phone keys cover karte hain. Test nahi hai: "writes nothing" ka assert, aur DB mein actor validation. [VERIFIED]

### `ops/n8n/order/build.js` (+131)

**1. Job:** Blueprint printer. Ek script MAIN aur do SUB ke nodes, edges, settings aur credential placeholders banati hai. Real-life: counter ka kaam-chart chhapne wali machine. [VERIFIED]

**2. Kahan fit hai:** `ops/n8n/order/`. Iska output n8n par jaana hai (deploy abhi nahi). `test.js` ise padhta hai, `lib/layout.js` isse positions deta hai. [VERIFIED]

**3. Walkthrough:** Helpers (node, codeNode, ifNode, schemaOf, connect; lines 13–30). `settings` (line 32: executionOrder v1, save all; **errorWorkflow nahi**). `sub()` (lines 35–59): Start (Execute Workflow Trigger, defined fields) → Guard (Code) → Allowed? (If) → HTTP Request POST `{{supabase_url}}/rest/v1/rpc/<fn>` (credential, fullResponse, neverError, 10 s timeout) → Shape result (Code); false branch → Return refusal (NoOp). 5 sections: RECEIVE, CHECK, WRITE, ANSWER, REFUSE. `callerPolicy workflowsFromAList`, `callerIds` = MAIN id. `finish()` (61–64): layout, aur 3rd edge field hata diya (lib use isse ai link samajhti). `build()` (66–129): placeholders (67–68); sub11, sub12 (71–78); `callSub` (80–84); MAIN nodes (89–112): Order webhook (line 90), Config (91), Check token (95), Token ok? (96), Kill switch? (97), Route (98–101), Call SUB 11 / 12 (102–107), Respond result (108), Respond 401/503/400 (109–111); edges (113–116); sections (117–126). MAIN mein 12 nodes (limit 15). [VERIFIED]

**4. Function-by-function:**
- `sub(...)`: ek SUB ka poora shape banata hai. Real-life: helper ka formaat. [VERIFIED]
- `finish(...)`: layout lagata hai aur edge field saaf karta hai. Real-life: chart ko sahi jagah par chipkana. [VERIFIED]
- `build()`: teeno workflows jodta hai. Real-life: counter ki poori setup. [VERIFIED]

**5. Block-level:** Config node (line 91) = "settings sheet": `kill_switch: false`, `demo_token`, `supabase_url`. Settings (line 32) = register ki chaabi. [VERIFIED]

**6. Data ki journey:** Parchi (webhook body) → MAIN Config jodta hai → SUB ko declared fields jaate hain → HTTP → database → shape → MAIN respond. [VERIFIED; flow INFERRED]

**7. Connections:** `test.js` (padhta hai), `lib/layout.js` (positions), `code/*.js` (Code nodes mein jaate hain), `ci.yml` (node tests). [VERIFIED]

**8. Concepts:** MAIN/SUB, Execute Workflow Trigger with defined inputs, callerPolicy, Kill switch checked twice, neverError + fullResponse (detail `concepts.delta.md`).

**9. Red flags:**
- `errorWorkflow` nahi (line 32). High before activation. [VERIFIED]
- `allowedOrigins '*'` (line 90) + token app bundle mein. High before activation. [VERIFIED code; abuse INFERRED]
- Config hardcoded (line 91). Medium. [VERIFIED]
- `responseCode` expression (line 108). Medium, live test pending. [INFERRED 0.8]
- Layout lib copy (line 61). Medium drift. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855002 -->
> **Top-3** — `settings` mein `errorWorkflow` nahi hai (rulebook 84 / 95.14), kyunki GoServe ka Error Alert workflow hai hi nahi (maine n8n par dekha: koi GS workflow nahi, sirf doosre projects ke alerts). Activation se pehle ek chhota "GS ERR 00 Alert" (Telegram to owner) banana zaroori — #46 ke saath, ya is PR ke follow-up mein? Tumhari recommendation?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** ddb12f1 mein `GS ERR 00 Alert` bana (Telegram par owner ko message). Teeno order workflows ise `errorWorkflow` set karte hain. Abhi deploy nahi hua; `deploy.js` ise sabse pehle daalega.
- **Lesson:** Activation se pehle alert workflow chahiye. Teeno usse report karte hain; alert khud ko report nahi karta.

<!-- gh-comment-id: 4264855008 -->
> `kill_switch: false`, `demo_token`, `supabase_url` Config node mein hardcoded — badalne ke liye PUT (redeploy). B13.1 kehta hai tunables `params` table mein, Config active version padhe. Demo ke liye theek; `params` se Config kab padhega — #46 SUB 14 ke saath?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan, abhi badalne ke liye redeploy. `params` se Config padhna #46 ke SUB 14 ke saath aayega (F66 b).
- **Lesson:** Hard-coded Config ek PUT door hai; `params` SUB 14 ke saath aayega (F66 b).

<!-- gh-comment-id: 4264855013 -->
> `allowedOrigins: '*'` + header token: token app bundle mein hoga (ADR-009, public). Rate limit nahi (F65 d) — koi bhi `place_order` spam kar ke dev mein rows bhar sakta hai; brake sirf kill switch (PUT chahiye). Activation se pehle n8n-level cap ya per-session cap chahiye?
- **Status:** answered
- **Reply (klickbae8yt-star):** Asli gap hai. Abhi kill switch hi brake hai. Plan: `place_order` mein per-session cap, aur activation se pehle n8n rate limit (F66 c). Activation ko rokna hai ya nahi, yeh reviewer ka faisla hai.
- **Lesson:** Public webhook ko live hone se pehle cap chahiye. Kill switch ek brake hai jo haath se dabana padta hai (F66 c).

<!-- gh-comment-id: 4264855018 -->
> `Respond result` ka `responseCode` expression se (`{{ $json.status_code }}`) — Respond to Webhook node isse maanta hai? Live row 55 pending; deploy ke baad pehla check yahi ho (401/201/200/409/503 paanch calls, execution ids record).
- **Status:** answered
- **Reply (klickbae8yt-star):** Deploy ke baad check hoga, pehle nahi. Pehla live check paanch calls hain (401, 201, 200, 409, 503), MAIN aur SUB ke execution ids ke saath (F66 g).
- **Lesson:** Live proof paanch calls aur execution ids se aata hai (F66 g).

<!-- gh-comment-id: 4264855025 -->
> Layout lib Lead Engine se copy (`ops/n8n/lib/`), aur yahin ek bug mila (3rd edge field = ai link, LEARNINGS). Ab 3 projects mein 3 copies — ek shared package (npm workspace / git submodule) kab? F row?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan, teen copies bahut hain. Shared package F66 (a) mein hai. Abhi nahi, kyunki sirf do users hain.
- **Lesson:** Teen copies ki seema hai; shared package F66 (a).

**11. Testability:** `test.js` 14 tests isi build ko padhte hain (wiring, names, layout). Live proof nahi hai (deploy ke baad). [VERIFIED]

### `ops/n8n/order/code/check_token.js` (+7)

**1. Job:** Counter boy ka demo pass check: header `x-gs-token` body ke token se match karta hai. Real-life: darwaze par pass dekhna. [VERIFIED]

**2. Kahan fit hai:** MAIN ke Check token node (line 95) mein. Token ok? (line 96) isi ka result padhta hai. [VERIFIED]

**3. Walkthrough:** Token equality, action whitelist, aur kill_switch + body ko aage bhejna. [VERIFIED]

**4. Function-by-function:** brief mein is code ke andar ke function ka naam nahi tha; logic ka kaam upar likha hai. [VERIFIED]

**5. Block-level:** Action whitelist = "allowed slip types" ki list. Real-life: counter par sirf do tarah ki parchi. [INFERRED from action whitelist]

**6. Data ki journey:** header token + body → pass ya 401. Kill switch aage jaata hai. [VERIFIED]

**7. Connections:** MAIN (line 95–96). Test: `test.js` token ke 6 cases. [VERIFIED]

**8. Concepts:** (koi naya concept nahi; token = demo pass.)

**9. Red flags:** Token app bundle mein hoga (demo token). Medium; ADR-009. [VERIFIED code; INFERRED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855123 -->
> 401 Code node se kyunki n8n header auth 403 deta hai (LEARNINGS, acha). Alternative: header auth rakho aur story mein 403 accept karo — ek built-in cheez kam hand-written. 401 zaroori tha (#48 ka client 401 par kuch alag karega)?
- **Status:** answered
- **Reply (klickbae8yt-star):** Zaroori tha. App 401 aur 403 ko alag treat karegi, aur story 401 kehti hai. Keemat ek chhota Code node hai, jiska logic unit test se dhaka hai.
- **Lesson:** 401 product ka faisla hai; ek tested Code node iski keemat hai.

**11. Testability:** `test.js` mein 6 token cases. Real 401 live check pending. [VERIFIED]

### `ops/n8n/order/code/shape.js` (+14)

**1. Job:** Reply card maker: manager ke jawab ko status code aur chhote message mein badalta hai. Real-life: helper ka reply card. [VERIFIED]

**2. Kahan fit hai:** SUB ke Shape result node mein. Output MAIN Respond result tak jaata hai. [VERIFIED]

**3. Walkthrough:** `statusCode` 200 ho to `created` dekh kar 201 ya 200. Messages 404, 409, 400 mein map hote hain. Baaki sab 502. Raw DB text kabhi bahar nahi jaata. [VERIFIED]

**4. Function-by-function:** brief mein is file ke function ka naam nahi tha; mapping upar likhi hai. [VERIFIED]

**5. Block-level:** Status map = "reply card ka chart". Real-life: ek table jisme har jawab ka code. [VERIFIED]

**6. Data ki journey:** DB jawab (status, body) → code → status_code + body. [VERIFIED]

**7. Connections:** SUB 11, SUB 12 ke Shape node; `test.js` (shape mapping tests). [VERIFIED]

**8. Concepts:** neverError + fullResponse (detail `concepts.delta.md`).

**9. Red flags:** `body` `{}` aaye to 200 chala jaata hai (line 6). Medium. [VERIFIED test line 63]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855090 -->
> `statusCode === 200` par `body.created` undefined → 200 ok (test line 63). Agar body `{}` aaye (galat function ya url), `ok:true, order: undefined` 200 chala jaayega. `order` missing par 502 safer nahi?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Sahi. ddb12f1 mein order ke bina 200 ab 502 hai, aur iska test bhi hai.
- **Lesson:** Fake success nahi: order nahi, to 200 nahi.

**11. Testability:** shape mapping tests (incl. no raw text, 502). Missing `order` case assert nahi hai. [VERIFIED]

### `ops/n8n/order/test.js` (+137)

**1. Job:** Checklist: 14 tests, n8n ke code aur wiring ke liye. Real-life: pre-flight checklist. [VERIFIED]

**2. Kahan fit hai:** CI Guard job mein chalta hai (`ci.yml` line 84). Build (`build.js`) aur code files ko padhta hai. [VERIFIED]

**3. Walkthrough:** Tests: token (6 cases), route, kill switch, place guard (7 bad cases), status guard (5 bad cases), shape mapping, wiring (MAIN→SUB ids, declared fields), wiring order after trigger, SUB check-then-write + no continueOnFail, safety (callerPolicy, placeholder token, no JWT/sk-/project ref in build), names + ≤15 nodes, layout for 3 workflows (line 133 loop). Code nodes `new Function('$input', ...)` stubs se chalte hain (rule 80). [VERIFIED]

**4. Function-by-function:** Har test ek checklist line hai. Loop (line 133) teeno workflows par layout check karta hai. [VERIFIED]

**5. Block-level:** Stubs = "dummy input" jo Code node ko diya jaata hai. [VERIFIED]

**6. Data ki journey:** build output + code files → tests → pass/fail. [VERIFIED]

**7. Connections:** `build.js`, code files, `lib/layout*.js`, `ci.yml`. [VERIFIED]

**8. Concepts:** Mutation check (detail `concepts.delta.md`).

**9. Red flags:**
- Tests code ke saath likhe gaye, red nahi dekhe (line 1). Medium. [VERIFIED PR body]
- Layout tests canvas ka live proof nahi hain (line 133). Low-medium. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855031 -->
> **Top-3** — n8n tests code ke saath likhe gaye, red nahi dikhe (PR body honest, LEARNINGS mein hai, acha). 3 mutations se check kiya — woh teen mutations test file ke header ya `docs/tests` mein likh do, taaki agla reviewer wahi dohra sake? Aur aage SUB 13/14 par red-first wapas.
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** ddb12f1 mein teeno mutations `test.js` ke header mein likh diye. SUB 13 aur SUB 14 red-first se shuru honge.
- **Lesson:** Agar tests red-first nahi the, to woh mutations likho jinhone test ko pakda.

<!-- gh-comment-id: 4264855036 -->
> Layout tests pass, par canvas abhi deploy nahi hua. B12.6: deploy ke baad editor mein fit-view dekhna. Yeh check deploy handoff mein kaun karega — screenshot evidence?
- **Status:** answered
- **Reply (klickbae8yt-star):** Deploy ke baad har canvas fit view mein kholunga, aur screenshot PR ke liye rakhunga (F66 g).
- **Lesson:** Layout tests ke saath fit-view ek nazar bhi (B12.6).

**11. Testability:** 14 tests, node `--test`, reviewer ne chalaya (pass 14). Test nahi hai: live webhook calls, `errorWorkflow`, OPTIONS preflight. [VERIFIED]

### `scripts/test_order_rpc.py` (+63)

**1. Job:** Manager ke register ka auditor: 6 integration tests, Management API se, har statement batch `begin … rollback` mein. Real-life: register ka audit, jo baad mein pen wapas kar deta hai. [VERIFIED]

**2. Kahan fit hai:** `scripts/`, DB par chalta hai. CI mein `discover` se chalta hai; `test_schema` import karta hai (line 6). [VERIFIED]

**3. Walkthrough:** place + retry + counts + price (lines 20–26); bad items/address refused (28–33); 3 steps → 4 events (35–42); illegal step aur unknown status error (44–48); other session → `order_not_found` (50–52); phone keys cannot execute (54–59). [VERIFIED]

**4. Function-by-function:** brief mein har test ka naam nahi tha; coverage upar likha hai. [VERIFIED]

**5. Block-level:** Import line 6 = "sahi folder ki chaabi". Sirf discover mein kaam karta hai. [VERIFIED]

**6. Data ki journey:** test data → begin → function call → assert → rollback (register saaf). [VERIFIED]

**7. Connections:** `0003` functions, `test_schema.py` (PR #64), vault token. [VERIFIED]

**8. Concepts:** (naye concept nahi; begin…rollback ka test register.)

**9. Red flags:**
- Run line (line 6) chalti nahi (`ModuleNotFoundError`). High for next person. [VERIFIED]
- "writes nothing" naam, check sirf error (line 44). Medium. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855042 -->
> **Top-3** — `from test_schema import` sirf `discover -s scripts` mein chalta hai. File ki Run line (`python3 -m unittest scripts/test_order_rpc.py`) `ModuleNotFoundError` deti hai (maine chalaya). `sys.path.insert` ek line, ya Run line discover wali — kaunsa?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** ddb12f1 mein import se pehle `sys.path.insert` lagaya. Ab Run line chalti hai (7 tests OK).
- **Lesson:** Run line wahi hona chahiye jo chal sake.

<!-- gh-comment-id: 4264855047 -->
> Naam "writes nothing" kehta hai par test sirf error string check karta hai. "Nothing written" statement-abort se guaranteed hai, assert nahi ho sakta (txn abort). Naam/comment theek karo, ya ek alag batch mein 409 ke baad count 1/1 check (nayi request)?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Sahi pakda. ddb12f1 mein test error ko transaction ke andar pakadta hai, phir check karta hai ki 1 event hi hai aur status `placed` hi hai.
- **Lesson:** Guarantee ko assert karo, sirf error string ko nahi.

**11. Testability:** 6 tests, ek hi file. "Writes nothing" assert nahi hai. [VERIFIED]

### `docs/integrations/n8n-order-workflows.md` (+73)

**1. Job:** Registry card: 3 workflows (Built, not deployed), kyun database kaam karta hai, phone ki call, answer codes, SUB contracts, settings aur credential record. Real-life: counter ki laminated menu card. [VERIFIED]

**2. Kahan fit hai:** `docs/integrations/`. Rulebook registry (A1.3) yahin hai. [VERIFIED]

**3. Walkthrough:** Registry table (line 10) → why → call → codes → contracts → settings → not built yet. [VERIFIED]

**4. Function-by-function:** Doc hai, function nahi. [VERIFIED]

**5. Block-level:** Answer codes table = "reply card ka chart". [VERIFIED]

**6. Data ki journey:** Doc → coder aur reviewer ke liye ek jagah. [INFERRED]

**7. Connections:** `build.js` (workflows), `shape.js` (codes), F65 (`follow-ups.md`). [VERIFIED]

**8. Concepts:** Registry (rulebook A1.3). Naya concept nahi.

**9. Red flags:** Registry test (rulebook 95.23) abhi nahi (n8n folder/tag nahi). Low-medium. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855095 -->
> Registry yahan (A1.3), acha. Rulebook 95.23 registry test (n8n folder vs registry): GS folder/tag abhi nahi (F65 g). Deploy ke baad registry test kaun likhega, kis story mein?
- **Status:** answered
- **Reply (klickbae8yt-star):** Registry test deploy ke baad aayega, GS folder ya tag ke saath (F66 f).
- **Lesson:** Registry test deploy ke baad, GS folder ya tag ke saath (F66 f).

**11. Testability:** Doc test nahi; registry test deploy ke baad. [VERIFIED]

### `docs/follow-ups.md` (F65, line 72)

**1. Job:** To-do list. F65 naya hai: deploy, activation, error alert, prod, rate limit, token preflight, deploy script, n8n folder. Real-life: owner ke faisle ki list. [VERIFIED]

**2. Kahan fit hai:** Line 72. F63 (prod release) `0003` ke bina adhoora hai. [VERIFIED]

**3. Walkthrough:** F65 (a) deploy (b) error alert (c) prod copy vs switch (d) rate limit (e) OPTIONS preflight (f) deploy script (g) n8n folder/tag. [VERIFIED]

**4. Function-by-function:** Lista hai, function nahi. [VERIFIED]

**5. Block-level:** F65 ka list = "owner ke faisle ki checklist". [VERIFIED]

**6. Data ki journey:** Decision (owner) → F65 item → deploy ya code. [INFERRED]

**7. Connections:** `build.js` (error alert, Config), `check_token.js` (preflight), F63 (prod). [VERIFIED]

**8. Concepts:** (naya concept nahi.)

**9. Red flags:** F63 mein `0003` nahi (linked to chapter risk 8). High at release. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855100 -->
> F65 (c) prod: copy ya switch. Build already `supabaseUrl` aur `credential` deploy-time par leta hai, to same build alag ids/credential/url se prod par — copy nahi, "deploy twice". Tum kya recommend karte ho? Owner decide karega.
- **Status:** answered
- **Reply (klickbae8yt-star):** Mera sujhav: do baar deploy. Build url, credential aur ids deploy ke waqt leta hai, to prod par wahi build alag values ke saath chalega. Owner pehli release se pehle faisla karega.
- **Lesson:** Prod = wahi build, doosri values ke saath, do baar deploy.

**11. Testability:** Docs hai, test nahi. [VERIFIED]

### `docs/tests/test-cases.md` (+10 rows, 46–55)

**1. Job:** Test register. 10 nayi rows: 9 Pass (3 sirf local), 1 "Pending deploy" (row 55). [VERIFIED]

**2. Kahan fit hai:** Test register ki tail. Rows node aur DB tests se judi hain. [VERIFIED]

**3. Walkthrough:** Har row ek test ka naam aur status. Row 55 live webhook calls ke liye hai. [VERIFIED]

**4. Function-by-function:** Table hai. [VERIFIED]

**5. Block-level:** Status column = "pass / pending" ka tag. [VERIFIED]

**6. Data ki journey:** Test run → row status. [INFERRED]

**7. Connections:** `test.js`, `test_order_rpc.py`. [VERIFIED]

**8. Concepts:** (naya concept nahi.)

**9. Red flags:** Row 55 pending; live proof nahi. Medium. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855106 -->
> Live row "Pending deploy": deploy + activation owner ke yes par. Us din 5 live calls kaun chalayega, execution ids (MAIN + SUB, 95.22) kahan record honge (A3.14 evidence)?
- **Status:** answered
- **Reply (klickbae8yt-star):** Deploy ke din agent owner ki yes par paanch live calls chalayega. MAIN aur SUB ke execution ids test-cases row mein jaayenge (F66 g).
- **Lesson:** Deploy ke din paanch calls, ids test row mein (F66 g).

**11. Testability:** Row 55 ka proof deploy ke baad hi aayega. [VERIFIED]

### `.github/workflows/ci.yml` (+3, line 84)

**1. Job:** Gate ka register. Guard job mein naya step: `node --test ops/n8n/order/test.js`. Real-life: gate par ek aur check-list. [VERIFIED]

**2. Kahan fit hai:** Guard job. Node tests yahan chalte hain. [VERIFIED]

**3. Walkthrough:** Guard job pehle node tests chalata hai, phir commit subject check. Subject 77 chars par fail hua. [VERIFIED log]

**4. Function-by-function:** YAML step hai. [VERIFIED]

**5. Block-level:** Step = "ek aur box gate par". [VERIFIED]

**6. Data ki journey:** Commit → Guard → pass/fail. [VERIFIED]

**7. Connections:** `test.js`, `guard.py` (commit message check). [VERIFIED]

**8. Concepts:** Commit subject limit (72) (detail `concepts.delta.md`).

**9. Red flags:** Job ka naam adhoora (line 84). Cosmetic. [VERIFIED]

**10. Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264855116 -->
> Guard job ab node tests bhi chalata hai — job ka naam "Guard (secrets, size, markers, commit messages, PR size)" ab adhoora. Naam badlo (F57 required-check names bhi) ya alag job?
- **Status:** answered
- **Reply (klickbae8yt-star):** Naam wahi rakhunga, kyunki owner ne ise required check banaya hai (F57). Naam badalne se rule toot jaata. Nayi job baad mein aa sakti hai.
- **Lesson:** Required-check ka naam sthir rakho; nayi job baad mein.

**11. Testability:** Step ka proof Guard run hai; woh abhi laal hai (subject ki wajah se). [VERIFIED]

### Baaki files (koi question nahi)

- `ops/n8n/order/code/guard_place.js` (+11): SUB 11 ka darwaza-check. Kill switch 503; text lengths 64/64/300; items 1–20 → 400; `rpc_body` banata hai. [VERIFIED]
- `ops/n8n/order/code/guard_status.js` (+12): SUB 12 ka darwaza-check. Kill switch; order id uuid format; actors customer/kitchen/rider/ops; `rpc_body`. [VERIFIED]
- `ops/n8n/lib/layout.js` (+69): kitchen deewar chart ka painter. Positions aur sticky notes. Lead Engine ka port. [VERIFIED]
- `ops/n8n/lib/layout_checks.js` (+76): chart inspector. Overlap, 160 px gap, text band, left-to-right, no link through a box, row alignment. [VERIFIED]
- `docs/LEARNINGS.md` (+4, lines 74–77): sabak: mutation check, 401 Code node se, layout lib ka 3rd edge field bug. [VERIFIED lines; content INFERRED from brief]
- `docs/decisions/ADR-010-session-id-is-the-anonymous-user-id.md`: status "Proposed" se "Accepted (owner, 14 Oct 2026, by merging PR #65)". [VERIFIED]
- `docs/process-trace.md`: rows 137–140. Row 137–138 notebook bundle, row 140 credential record. Row 139 = story #45 first pass (functions red-first then green, n8n build + 14 tests, mutation check, nothing deployed). [VERIFIED]
- Notebook bundle (`docs/pr-reviews/`): `pr-65-rls-realtime-menu.md` (chapter), `README.md`, `concepts.md`, `mental-model.md`, `my-questions.md`, aur `pr-64-schema.md` ke journal updates (6 files total: pr-65 chapter, README, concepts, mental-model, my-questions, plus the #64 rows).

---

## Handoff

> State: 20 posted · 3 must-fix · actor: coder
>
> You are the developer for GoServe PR #66 (feat/45-order-workflows). Do this: (1) the Guard job is red: commit 53dbce7's subject is 77 chars (limit 72); reword it (e.g. "feat(n8n): order functions and order workflows, not deployed") by rebase/amend and force-push; (2) add `0003_order_functions.sql` to F63 in `docs/follow-ups.md`; (3) make the Run line of `scripts/test_order_rpc.py` true (sys.path insert before the `test_schema` import, or document the discover command); (4) reply on all 20 threads in 1-2 sentences; (5) push and reply "PR #66 threads answered at <sha>"; (6) while waiting: build (do not deploy) a small GS error-alert workflow and the deploy script (F65 b, f); after #66 merges, start story #46 "Decide and logs workflows (SUB 13, SUB 14)" (epic #35) on `feat/46-decide-logs` from `dev`. Nothing is deployed or activated without the owner's yes.
>
> _(PR par post hua — `satvik-jain-iitd`, review 5510948755 with 20 inline threads, 14 Oct 2026.)_

- **Dev reply:** "PR #66 threads answered at ddb12f1"
- **Verified:** 20 answered · 7 fixed (ddb12f1) · node 18/18 pass · DB 7/7 · CI green (Site, App, Guard) · no GS workflow on n8n [VERIFIED]
- **Approved:** review 5511133380 (satvik-jain-iitd); handoff comment 6157146482

**Owner handoff (Romanized Hindi):**

```text
State: PR #66 APPROVED (ddb12f1) · CI green · actor: owner

1. PR #66 merge karo (squash).
2. Merge ke baad "push kar do" bolo. Tab 4 workflows inactive deploy honge: GS ERR 00 Alert, GS SUB 11, GS SUB 12, GS MAIN 01.
3. Activation ke liye alag yes chahiye. Yeh tabhi jab per-session cap land ho jaaye (coder aur reviewer dono yahi maante hain).
4. Prod = deploy twice (coder aur reviewer dono agree). Owner pehli release se pehle decide karega.
5. A41 aur F61 abhi open hain. A41 ki detail A41 = 6 order steps (placed, accepted, preparing, ready, out_for_delivery, delivered), cancel nahi.
```

**Coder paste-block (English):**

```text
State: PR #66 APPROVED (ddb12f1) · actor: coder

You are the developer for GoServe story #46 "Decide and logs workflows (SUB 13, SUB 14)", epic #35. Do this:
1. After PR #66 merges, branch feat/46-decide-logs from dev.
2. Red first: write failing tests, paste the failure in the PR.
3. Early: add the per-session cap for place_order (migration 0004 plus its test), so activation can follow.
4. Activation waits for the owner's yes.
5. Last step: copy the notebook bundle, including the pr-66 chapter, from /private/tmp/claude-501/-Users-satvikjain-Documents-GoServe/aa3d69ad-418a-46fc-b6e5-07aa857fd7f3/scratchpad/tpm/bundle/docs/ into docs/pr-reviews/.
6. Push, then reply "PR #67 ready for review at <sha>".
```

## What happened after review

- **Sawaal post hue:** 14 Oct 2026, `satvik-jain-iitd` ne 20 sawaal post kiye (review 5510948755). [VERIFIED]
- **Jawab:** 20 ke 20 jawab `klickbae8yt-star` se. **20 answered**, 0 open. [VERIFIED]
- **Fix commit `ddb12f1`** (ek commit mein rebase, subject 60 chars). 7 fixes:
  1. `GS ERR 00 Alert` workflow bana (Telegram owner ko). `errorWorkflow` MAIN 01, SUB 11 aur SUB 12 par laga.
  2. Teen mutations `test.js` ke header mein likhe.
  3. `sys.path.insert` import se pehle; Run line ab chalti hai (7 tests OK).
  4. "writes nothing" test ab error transaction ke andar pakadta hai, phir 1 event aur status `placed` check karta hai.
  5. Naya test: grant galti se `authenticated` ko mile, to bhi RLS write rokta hai.
  6. F63 mein `0003_order_functions.sql` jodi.
  7. Shape: order ke bina 200 ab 502 hai, test ke saath.
- **Naya kaam, kuch deploy nahi:** `deploy.js` (dry run default; `--apply` shells banata hai, phir ERR 00, SUB 11, SUB 12, MAIN 01 par PUT). Test guard karta hai ki yeh activate ya delete nahi karta. F66 a–g logged, 3 naye test-cases rows. [VERIFIED]
- **n8n par abhi kuch nahi:** koi `GS *` workflow nahi, sirf dry run. [VERIFIED]
- **Status:** APPROVED (review 5511133380 by `satvik-jain-iitd`), CI green, merge pending. [VERIFIED]
- **Notebook:** pr-66 chapter PR #67 ke saath jaayega. [VERIFIED]

## Reviewer's take (mere thoughts)

- **CI pehle, body baad mein.** PR body "tests pass" keh rahi thi, par Guard laal tha. Merge ka faisla CI status se hota hai. [VERIFIED]
- **Gate ne apna kaam kiya.** 77 characters ka subject 72 par bounce hua. Dhaba ke register ki column bhar gayi thi, to register ne hi roka. Gate ko bura mat maano; woh coder ko bachata hai. [VERIFIED]
- **"Built, not deployed" n8n par dekha gaya.** Claim tabhi maani gayi jab instance par GS workflow ki list khaali mili. Kisi ki baat par bharosa nahi. [VERIFIED]
- **Reader ke sawaal ne kaam banaya.** Ek sawaal ne GS ERR 00 Alert banwaya. Ek ne deploy script ko safer kiya. Do ne tests ko sharper kiya: "writes nothing" aur "200 bina order ke". [VERIFIED]
- **Owner ke faisle abhi khule hain.** A41, F61 aur prod par deploy twice (F65 c). Yeh code ke sawaal nahi, owner ke faisle hain. [INFERRED]
