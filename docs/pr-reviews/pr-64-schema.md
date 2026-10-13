# PR #64 — feat(db): 7 tables, legal-status rule and one-order-per-key

- **Branch:** `feat/43-schema` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** #43 "Schema: 7 tables and the legal-status rule" (epic #34)
- **State:** **APPROVED** — head `a3131f5` (2026-10-14, review 5510476987 by `satvik-jain-iitd`), merge pending (rebase + notebook bundle first)
- **Files:** 6 · **Lines:** +169 / -0 (2 commits: `524f942` feat(db), `a3131f5` docs A41)
- **Reviewer:** satvik-jain-iitd
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/64

> Dhaba ka register. Is PR ne 7 naye page chhape, ek head waiter lagaya jo galat step ko mana kare, aur ek token number jo same order ko do baar likhne se roke.

---

## Overall review

## 1. Ek-line logline

> `Schema PR: goserve-dev database mein 7 tables, ek status rule (order ek step aage hi chale) aur ek unique key (same token do baar = ek order) lagta hai.`

## 2. Big Picture (Story & Goal)

- Story #43 "Schema: 7 tables and the legal-status rule", epic #34. [VERIFIED]
- Persona: kitchen (rasoi wali side ka user). [VERIFIED]
- Build design §5 (`docs/architecture/mvp0-build-design.md`) se judi hai: 7 tables, "har table mein kitchen_id aur session_id", aur "database khud galat step ko reject karta hai". [VERIFIED]
- Story ke teen scenarios: S1 (7 tables, dono columns ke saath), S2 (galat step DB rokta hai), S3 (retry se ek hi order bante hai). [VERIFIED]
- Depends on: Supabase dev project (ready). [VERIFIED]
- Iske upar aage ki stories baithengi: #44 (RLS, Realtime, Delhi menu), #45 (place-order), #49 (kitchen screen). [VERIFIED from brief questions]

## 3. Yeh ab aaya kyun? (Context)

- Pehle: goserve-dev mein `public` schema khaali tha — koi table nahi (red-first `relation "kitchens" does not exist` isi liye aaya). Ab: 7 tables + 2 triggers. [VERIFIED]
- Abhi `goserve-dev` par 7 public tables hain, 2 triggers hain, aur indexes sirf primary key aur 2 unique keys ke hain. [VERIFIED by live query]
- Kitchens, orders, order_events aur params ki row count 0 hai. [VERIFIED by live query]
- Is PR se unlock hota hai: order ka rule ek hi jagah, database mein. Build design ke hisaab se har client yahi rule maanega. [VERIFIED design text; "ek hi jagah" INFERRED]
- Iske bina: har app ya workflow apna rule likhta. [INFERRED]

## 4. Real-Life Analogy

Poori PR ek roadside dhaba ka register (kitaab) hai. Har table ek page hai, har row ek entry hai.

1. Register = database `goserve-dev` (Supabase).
2. Dhaba ka apna naam wala page = `kitchens`.
3. Rate card = `menu_items` (price paise mein, poora number; available ya nahi).
4. Order ka page = `orders` (ek line ek order; phone ka token number = `client_order_key`).
5. Carbon-copy diary = `order_events` (har step ek baar likha jaata hai, kabhi mitta nahi).
6. Manager ke decision notes = `decision_log`.
7. Duty log = `run_log` (kaunsa helper chala, kitna time laga, kitna kharcha hua).
8. Settings wala page, version ke saath = `params` (purani settings record mein rehti hain).
9. Head waiter = function `orders_check_status`, jo trigger `orders_status_rule` se chalta hai: order ek step aage, skip ya peeche nahi.
10. Carbon-copy ka guard = function `order_events_frozen`, jo trigger `order_events_no_change` se chalta hai: likha hua badalna ya mitana mana.
11. Token number = `unique (session_id, client_order_key)`: same token = same order.
12. Din ka register = `session_id` (har demo session ka alag register; reset = naya din).
13. Kaun sa dhaba = `kitchen_id` (aaj ek hi).
14. Auditor ki pencil entry = `scripts/test_schema.py`: test entries likhta hai, phir rollback se mita deta hai.
15. Printer = `scripts/apply_migration.py`: blank pages database par chhapta hai.

## 5. Is PR mein naye Concepts (8)

- **Migration** — database ki shape badalne wali SQL file, number se order mein. Real-life: register ke naye page ka print.
- **Trigger** — woh code jo database khud chalata hai, row badalne se pehle ya baad mein. Real-life: head waiter.
- **CHECK constraint** — column mein allowed values ki list. Real-life: rate card par sirf allowed status.
- **Unique key as idempotency** — same client key do baar aaye to ek hi row bane. Real-life: token number.
- **Append-only table** — row add ho sakti hai, edit ya delete nahi. Real-life: carbon copy.
- **Row Level Security (RLS), off today** — database rule jo tay kare kaunsi row kaunsi key dekh sakti hai. Abhi off hai. Real-life: register bina taale ke.
- **Integration test with rollback** — test jo asli database se baat karta hai, phir apne sab writes undo kar deta hai. Real-life: auditor ki pencil entry.
- **Management API token** — ek token jo Supabase account par kuch bhi kar sakta hai; yahan sirf SQL chalane ke liye. Real-life: master chaabi.

(Har concept ki detail `concepts.delta.md` mein hai.)

## 6. High-Level Flow

Journey: ek schema file dhaba ke register tak pahunchti hai, aur test uski jaanch karta hai.

1. Coder vault ke token se `apply_migration.py tmxyizmkpwwfyazvrfhw 0001_schema.sql` chalata hai. (Printer ko kaam diya.)
2. Management API goserve-dev par SQL chalata hai. Result: 7 tables + 2 triggers. (Blank pages chhap gaye.)
3. `test_schema.py` ek transaction kholta hai, ek kitchen aur ek order seed karta hai, galat aur sahi steps daalta hai, same token dobara daalta hai, phir rollback karta hai. (Auditor pencil se likh ke mita deta hai.)
4. Dev par rows 0 rehti hain. (Register saaf.) [VERIFIED by reviewer query]
5. Baad mein (story #44): RLS, Realtime, menu seed; app aur n8n orders aur events likhenge; prod par same file pehli release par aayegi, haath se apply hogi. [INFERRED from brief plan]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/supabase/migrations/0001_schema.sql` | Blank register: 7 pages, head waiter aur carbon-copy guard lagaye |
| `scripts/test_schema.py` | Auditor: pencil se entries, phir rollback se mita deta hai |
| `scripts/apply_migration.py` | Printer: SQL file ko database par chhapta hai |
| `docs/assumptions.md` | Assumption book: A41 (order steps) owner ke confirm ke intezaar mein |
| `docs/tests/test-cases.md` | Test register: S1, S2, S3 ki rows |
| `docs/process-trace.md` | Daily diary: rows 127 aur 128 |

## 8. Pieces aapas mein kaise baat karte hain

Text map (koi code is map ko run nahi karta):

- `apply_migration.py` → Management API SQL endpoint → goserve-dev database (`0001_schema.sql` ke statements). [VERIFIED]
- `test_schema.py` → same SQL endpoint (helper `sql()`), ek hi request mein `begin ... rollback`. [VERIFIED]
- `0001_schema.sql`: 7 tables → `orders` par trigger `orders_status_rule` → function `orders_check_status`. `order_events` par trigger `order_events_no_change` → function `order_events_frozen`. [VERIFIED]
- Foreign keys: `orders.kitchen_id` → kitchens; `order_events.order_id` → orders; `decision_log.order_id` (nullable) → orders. [VERIFIED for order_events line 36; others from brief]
- App aur n8n: abhi koi connection nahi (story #44 se). [VERIFIED]

## 9. Pehle se kya badla

- 6 files, +169 / -0. Ek bhi line delete nahi hui, koi purani line nahi badli. [VERIFIED]
- `0001_schema.sql` +99: 7 tables, status rule, frozen events. [VERIFIED]
- `test_schema.py` +52: 3 integration tests. [VERIFIED]
- `apply_migration.py` +12: SQL file bhejne ka script. [VERIFIED]
- Docs: `assumptions.md` +1 (A41), `test-cases.md` +3, `process-trace.md` +2. [VERIFIED]
- Live dev par: 7 tables, 2 triggers, 0 rows. [VERIFIED]

## 10. Macro Risks & Downstream Impact

Ranked. Har risk ke saath kitna bada hai aur kya check karna hai.

1. **RLS off.** Live check mein `relrowsecurity false` dikha. Live check `orders` aur `kitchens` par hua; baaki 5 tables bhi usi file se bani hain aur Postgres mein nayi table par RLS default off hota hai, to wahi haal [INFERRED, high]. Exposure (anon key se sab padh-likh sakna) INFERRED hai, Supabase ke default par based, confidence high. Aaj asar nahi (app Supabase use nahi karta, tables khaali hain). Check: anon key #44 se pehle app mein wire na ho. [VERIFIED for live flag; exposure INFERRED]
2. **CI schema test skip karta hai** (token nahi). Green PR schema ke baare mein kuch nahi kehta. Reviewer ka local run hi proof hai. `test-cases.md` mein "local only" nahi likha. [VERIFIED]
3. **Un-filtered updates in test** (line 39, `update orders set status='accepted'` bina `where`). Safe sirf isliye hai ki poora batch ek request mein, ek transaction mein chalta hai. Agar API kabhi autocommit kare to dev ki saari orders badal jayengi. Failure mode INFERRED. Ek `where id = ...` ye dependency hata deta hai. [VERIFIED code]
4. **Status list do jagah hai** (CHECK lines 24–25 aur trigger ka `steps` array line 76). Drift ho sakta hai. `array_position` unknown status par NULL deta hai, to trigger chup rehta hai aur sirf CHECK rokta hai. Aaj dono lists same hain, isliye kaam karta hai. [VERIFIED]
5. **Koi migration ledger nahi, koi transaction wrap nahi** (`apply_migration.py`). Dobara chalao to "already exists". Aadha fail file dev ko aadha badal sakti hai. Prod apply haath se hoga, uske liye checklist row nahi. [VERIFIED]
6. **FK columns par index nahi** (`orders.kitchen_id`, `order_events.order_id`). Demo ke liye theek. Kitchen screen (#49) ko `orders(kitchen_id, status)` chahiye hoga. [VERIFIED live index list]
7. **`order_events` ko abhi koi nahi likhta.** Status trigger event nahi daalta. History app ya n8n ki yaad par tiki hai. [VERIFIED]
8. **`order_events_frozen` truncate ko nahi rokta.** Alag truncate trigger chahiye. Session reset (#52) ko bhi raasta chahiye. [VERIFIED trigger definition; truncate behaviour Postgres ka standard, brief ke hisaab se]
9. **Management token = master key**, migration aur test dono mein. Kam blast radius wala raasta: DB password + psql, ya service role. Token repo mein nahi hai. [VERIFIED no secret in diff]
10. **Dev `REF` hardcoded test mein** (line 6). Galti se prod ref aaye to test prod par chalega (rollback ke saath phir bhi). [VERIFIED]
11. **A41 owner ne confirm nahi kiya** (no cancel; rider steps events mein). Product decision open hai. [VERIFIED]
12. **Rebase pending** merge se pehle (branch #62/#63 se pehle cut hua tha). [VERIFIED]

Downstream: #44 (RLS, Realtime, menu), #45 (place-order), #49 (kitchen screen), #52 (session reset). [VERIFIED from brief questions]

## 11. Jo jaan-boojh kar NAHI hai (Scope)

- RLS, Realtime, Delhi menu seed. Wajah: story #44. [VERIFIED]
- Cancel status. Wajah: A41 (owner confirm karega); ponytail. [VERIFIED]
- Partitioning, soft deletes. Wajah: ponytail (brief mein is ka extra reason nahi hai). [VERIFIED]
- Indexes PK aur unique ke alawa. Wajah: demo scale; screen stories ke saath aayenge. [VERIFIED]
- Migration ledger ya Supabase CLI. Wajah: ponytail; aaj ek hi file hai. [VERIFIED]

Samajhne wali baat: "nahi banaya" bhi ek design decision hai. Cancel aur ledger ka na hona, dono hi sawaal bante hain.

## 12. Testing Story

- **Red-first:** PR body mein `relation "kitchens" does not exist` aur `FAILED (failures=3)`. Matlab test pehle chala, schema se pehle. [VERIFIED from PR body; not re-run]
- **Green:** coder ka `Ran 3 tests in 5.325s OK`. Reviewer ne dobara chalaya: `Ran 3 tests in 4.464s OK`. Chalne ke baad dev par kitchens, orders, order_events, params sab 0 rows. [VERIFIED]
- **S1:** information_schema check, 7 naam, dono columns (kitchens ko kitchen_id se chhoot). [VERIFIED live]
- **S2:** teen cases: skip (placed → ready) error deta hai; peeche jaana error deta hai; poora sahi raasta error nahi deta. [VERIFIED by test + live trigger]
- **S3:** same token dobara `on conflict do nothing` ke saath, count 1. [VERIFIED live unique index]
- **Story match:** teeno S scenarios cover. Extra: `order_events` frozen, `updated_at` trigger se set hota hai, `params` unique (session_id, key, version), `apply_migration.py`. Story ka kuch chhoot nahi raha. [VERIFIED]
- **Nahi tested:** plain insert ka retry par clean error; `order_events` freeze; `updated_at` bump; CI mein kuch bhi. [VERIFIED: not in test file]
- **test-cases rows:** 3 Pass (integration, local only). Par row mein "local only" nahi likha. [VERIFIED]

## 13. Trade-offs & Alternatives

| Option chuna | Kyun | Kya chhoda |
|---|---|---|
| Trigger database mein | Build design §5: "database khud reject karta hai"; ek jagah, har client maanega | Status list SQL mein rehti hai (aaj do copies) |
| `items jsonb` | 7-table design, demo scope | SQL se order lines par seedha query |
| Management API SQL endpoint (migration aur test) | 12 lines, install nahi, token vault mein pehle se | Ledger, dry run, scoped credentials |
| Integration test with rollback | Asli trigger ka proof | CI coverage (CI mein token nahi) |
| Identity bigint (logs), uuid (business rows) | Logs append-only aur local; orders ko client-made ids chahiye | Koi bada nahi (brief: "fine") |

## 14. Patterns is PR se

- **Register page per table:** ek table = ek page. Entry: `0001_schema.sql` lines 4–71.
- **Head waiter (DB rule):** rule database trigger mein, app mein nahi. Entry: `orders_check_status`, lines 74–87.
- **Carbon copy (append-only):** likha hua badal nahi sakta. Entry: `order_events_frozen`, lines 89–96.
- **Idempotency through unique key:** retry safe, token number se. Entry: line 31.
- **Integration test with rollback:** asli DB, koi nishaan nahi. Entry: `test_schema.py` `sql()` helper lines 10–20.
- **Printer script:** SQL file ko DB par bhejne ka ek chhota runner. Entry: `apply_migration.py`.

## 15. AI-Review Lens

- **Trust karna safe:** table shapes design §5 se match karte hain; paise integer mein; status par CHECK; unique key retries ke liye; append-only trigger; rollback test ka pattern (verified clean). [VERIFIED]
- **Interrogate karo:**
  - (a) Green CI actually kya cover karta hai? Yahan kuch nahi.
  - (b) Status list do jagah kyun hai?
  - (c) `order_events` ko kaun likhega?
  - (d) Un-filtered updates (line 39).
  - (e) Master-key token.
  - (f) "Prod gets the same file" ka mechanism kya hai? Koi nahi likha.
- **Confident but risky:** "dev par 0 rows bache" sach hai (verified). Par yeh sirf isliye sach hai kyunki ek request = ek transaction. Yeh API ki baat kisi ne likhi nahi hai. [INFERRED from brief AI-review]

## 16. Questions

**Top-3 abhi poocho:**

1. (Purpose, `0001_schema.sql` line 76) Status list do jagah hai: CHECK (lines 24–25) aur trigger ka `steps` array. Dono drift kar sakte hain. Ek jagah kyun nahi? Aur unknown status par `array_position` NULL deta hai, trigger chup rehta hai, sirf CHECK rokta hai — yeh jaan-boojh kar?
2. (Testability, `scripts/test_schema.py` line 2) CI mein yeh test skip hota hai (token nahi), to green CI schema ke baare mein kuch nahi kehta. Maine local chala ke verify kiya (3 OK, dev 0 rows). Aage: dev ke liye ek limited token CI secret mein, ya test-cases mein saaf "Pass (local only, CI skipped)"?
3. (Risk, `scripts/test_schema.py` line 39) `update orders set status='accepted'` bina `where` — sirf rollback ke bharose. Agar Management API kabhi transaction na maane (autocommit/pooler), to dev ki saari orders badal jaayengi. `where id='...a1'` ek line hai — add karoge (quick commit before merge theek hai)?

<details><summary>Poora question bank (18, 8 categories mein)</summary>

### 1 Purpose
- `0001_schema.sql` line 76 (TOP-1): status list do jagah kyun, aur unknown status par trigger chup kyun.
- `docs/assumptions.md` line 51: A41, 6 steps, cancel nahi; demo script mein cancel hai kya?

### 2 Understanding
- `0001_schema.sql` line 26: `items jsonb` par kitchen screen (#49) ke liye "kaunsi dish kitni baar" kaise nikalega?
- `scripts/test_schema.py` line 47: `on conflict do nothing` ke saath, app ko chup ok chahiye ya error?
- `scripts/apply_migration.py` line 12: sirf 200 chars output; aadhi chali file ka pata kaise chale; `begin ... commit` wrap?

### 3 Assumptions
- `0001_schema.sql` line 36: `order_events` kaun likhta hai; trigger hi kyun nahi likhta?
- `scripts/test_schema.py` line 6: `REF` hardcoded; env var se behtar?

### 4 Risk
- `0001_schema.sql` line 4: RLS off; anon key #44 se pehle app mein nahi; tab tak dev khaali?
- `scripts/test_schema.py` line 39 (TOP-3): un-filtered update; `where id` add karoge?
- `scripts/apply_migration.py` line 10: Management token master key hai; DB password + psql ya service role kam risky?

### 5 Alternatives
- `0001_schema.sql` line 95: `truncate` nahi rokta; session reset (#52) mein history kaise saaf hogi?
- `scripts/apply_migration.py` line 2: Supabase CLI kyun nahi; 12 lines ka reason record ho?

### 6 Impact
- `0001_schema.sql` line 21: FK columns par index nahi; index kis story ke saath, #49?
- `docs/tests/test-cases.md` line 33: "Pass" CI skip ke saath; "local only" likhna sach nahi?

### 7 Testability
- `scripts/test_schema.py` line 2 (TOP-2): green CI schema ke baare mein kuch nahi kehta; limited token ya "local only" label?
- `scripts/test_schema.py` line 32: kitchens ko kitchen_id se chhoot; design doc mein bhi likha jaaye?

### 8 Future
- `0001_schema.sql` line 1: naming aur koi ledger nahi; dobara apply = "already exists"; prod par kaun, kab, kaise apply karega?
- `docs/process-trace.md` line 130: "Prod gets the same file" ka manual step release checklist mein kahan hai?

</details>

**Self-check (3 sawaal, khud se poochho):**

- Head waiter (trigger) kya rokta hai, aur kya nahi rokta?
- Green CI is PR ke baare mein kya kehta hai?
- Register bina taale (RLS off) ka matlab aaj kya hai, aur #44 ke baad?

---

## Files (ek-ek)

### `app/supabase/migrations/0001_schema.sql` (+99)

**1. Job:** Blank register ke 7 page chhapna, aur do guard lagana: head waiter (status rule) aur carbon-copy guard (events freeze). Real-life: register ka pehla print. [VERIFIED]

**2. Kahan fit hai:** Printer (`apply_migration.py`) ise goserve-dev par chalata hai. Test (`test_schema.py`) isi ke tables aur triggers ko check karta hai. App aur n8n abhi ise nahi chhute. Flow ka step 2 (7 tables + 2 triggers). [VERIFIED]

**3. Walkthrough:** Pehle 7 pages bante hain: dhaba ka naam, rate card, order page, carbon-copy diary, manager ke notes, duty log, settings. Phir order page par teen rules lagte hain. Ek: status sirf allowed list mein. Do: status ek step aage hi badle, warna head waiter mana kare. Teen: carbon-copy diary par update aur delete mana. Aur har order ka token number (`client_order_key`) ek session mein ek hi baar aata hai.

**4. Function-by-function:**
- **Table blocks (lines 4–71):** 7 table ki definitions. Real-life: 7 register pages. Kitchens 4–8, menu_items 10–17, orders 19–32, order_events 34–42, decision_log 44–50, run_log 52–61, params 63–71. [VERIFIED]
- **`orders_check_status` (lines 74–84):** head waiter. Steps list (line 76) mein position dekhta hai. Naya status purane se ek step aage nahi hai to error (line 80). Har sahi badlav par `updated_at` time bharta hai (line 82). Real-life: order ko ek seedhi lakeer par chalana. [VERIFIED]
- **Trigger `orders_status_rule` (lines 86–87):** head waiter ko orders table par lagata hai. Chalne ka waqt (row badalne par) naam aur S2 se INFERRED. [INFERRED]
- **`order_events_frozen` (lines 90–93):** carbon-copy guard. Update aur delete par error. Real-life: diary mein pen ki jagah. [VERIFIED]
- **Trigger `order_events_no_change` (lines 95–96):** guard ko order_events par lagata hai. [VERIFIED]

**5. Block-level reading:**
- CHECK status list (lines 24–25) = "rate card par allowed status".
- `client_order_key` aur unique key (line 31) = "token number ka register".
- `items jsonb` (line 26) = "order ki lines ek paper slip mein".
- FK `order_id` (line 36) = "carbon copy kis order ki hai, uska number".

**6. Data ki journey:** Order ki ek row (token + status placed) → har status badlav head waiter check karta hai → aaj koi event nahi likhta → baad mein event ek diary line banega, jo kabhi nahi mitega. [VERIFIED for "aaj"; future INFERRED]

**7. Connections map:** `orders.kitchen_id` → kitchens; `order_events.order_id` → orders; `decision_log.order_id` (nullable) → orders. Test aur printer is file ko padhte hain, import nahi karte. [VERIFIED]

**8. Concepts:** Migration, Trigger, CHECK constraint, Unique key as idempotency, Append-only table, RLS off (detail `concepts.delta.md`).

**9. Red flags & edge cases:**
- RLS off (live). Aaj asar nahi, #44 se pehle anon key na lage. Serious: high. [VERIFIED flag; exposure INFERRED]
- Status list do copies (lines 24–25, 76). Drift ka risk. Serious: medium. [VERIFIED]
- `order_events` ko koi nahi likhta. History app ki yaad par. Serious: medium. [VERIFIED]
- `order_events_frozen` truncate nahi rokta. Serious: low-medium. [VERIFIED trigger definition]
- FK par index nahi. Demo mein theek. Serious: low. [VERIFIED live index list]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264451018 -->
> **Top-3** — Status list do jagah hai: CHECK (lines 24–25) aur trigger ka `steps` array. Dono drift kar sakte hain. Ek jagah (Postgres enum, ya ek chhota `order_steps` table jisse dono padhen) kyun nahi? Aur unknown status par `array_position` NULL deta hai, trigger chup rehta hai, sirf CHECK rokta hai — yeh jaan-boojh kar?
- **Status:** open

<!-- gh-comment-id: 4264451021 -->
> Saari tables `public` mein, RLS off (maine dev par dekha: `relrowsecurity false`). Supabase API se anon key wala koi bhi sab padh/likh sakta hai jab tak #44 RLS na laaye. App mein anon key #44 se pehle wire nahi hogi — confirm? Aur tab tak dev tables khaali rahengi?
- **Status:** open

<!-- gh-comment-id: 4264451031 -->
> `items jsonb` — order ki lines ek JSON mein, alag `order_items` table nahi. Design §5 ke 7 tables se match hai. Par kitchen screen (#49) ko "kaunsi dish kitni baar" chahiye hoga — JSON se nikalna theek rahega, ya tab table banegi?
- **Status:** open

<!-- gh-comment-id: 4264451039 -->
> `order_events` kaun likhta hai? Status trigger khud event insert nahi karta, to app/n8n ko yaad se likhna hoga. History guaranteed chahiye to trigger hi event likhe — kyun nahi chuna?
- **Status:** open

<!-- gh-comment-id: 4264451044 -->
> FK columns (`orders.kitchen_id`, `order_events.order_id`) par index nahi (dev par sirf pkey + unique dikhe). Kitchen screen `where kitchen_id=? and status in (...)` chalayegi. Demo ke liye theek — index kis story ke saath aayega, #49?
- **Status:** open

<!-- gh-comment-id: 4264451059 -->
> `order_events_frozen` update/delete rokta hai, par `truncate` nahi (uske liye alag trigger chahiye). Session reset (#52) mein ek session ki history kaise saaf hogi — delete to blocked hai?
- **Status:** open

<!-- gh-comment-id: 4264451073 -->
> `0001_schema.sql` naming aur koi ledger nahi: dobara apply = "already exists". Supabase CLI `<timestamp>_name.sql` + ledger rakhta hai. Prod par pehli release par kaun, kab, kaise apply karega — ek follow-up row (F) aur release checklist line chahiye?
- **Status:** open

**11. Testability:** Teen S scenarios ke tests isi file ke tables par chalte hain. Test nahi hai: `order_events` freeze, `updated_at` bump, plain insert ka retry. Brief mein inke liye koi posted question nahi hai; agle PR ke liye note.

### `scripts/test_schema.py` (+52)

**1. Job:** Auditor. Pencil se entries likhta hai, check karta hai, phir mita deta hai. Real-life: auditor ki pencil entry. [VERIFIED]

**2. Kahan fit hai:** Coder ya reviewer locally chalata hai. CI mein token nahi, to skip hota hai. Target: goserve-dev, SQL endpoint se. `REF` hardcoded line 6. [VERIFIED]

**3. Walkthrough:** Pehle dhaba ka register dekhta hai ki 7 pages hain (S1). Phir ek fake kitchen aur ek fake order daalta hai. Galat step daalta hai (error), peeche jaane ki koshish (error), phir sahi raasta (chalta hai). Phir same token dobara (count 1). Sab ek transaction mein, end mein rollback. [VERIFIED]

**4. Function-by-function:**
- **`sql()` helper (lines 10–20):** SQL text ko Management API ko ek request mein bhejta hai. Real-life: auditor ka runner, sab pages ek parcel mein. [VERIFIED]
- **SEED / ORDER fixtures (lines 23–24):** ek fake dhaba aur ek fake order slip. [VERIFIED]
- **`skipUnless` (line 27):** token nahi to test skip. Real-life: chaabi nahi, to register nahi khulega. [VERIFIED]
- **S1 (lines 29–34):** information_schema se table aur column naam padhta hai. `having count(*)=2 or table_name='kitchens'` (line 32) kitchens ko kitchen_id se chhoot deta hai. [VERIFIED]
- **S2 (lines 36–44):** line 37 placed → ready skip; lines 39–41 ready → placed wapas (updates bina `where`, line 39); lines 42–44 sahi raasta. [VERIFIED]
- **S3 (lines 46–49):** insert `on conflict (session_id, client_order_key) do nothing` (line 47); count 1. [VERIFIED]

**5. Block-level reading:** SEED aur ORDER = "fake entries ki slip". `skipUnless` = "chaabi check". Ek `assert` = "exact phrase card".

**6. Data ki journey:** SQL text → API → result rows → pass ya fail. Fake data transaction ke bahar nahi jaata. [VERIFIED; "bahar nahi jaata" relies on rollback, INFERRED from brief]

**7. Connections map:** test → Management API → goserve-dev (0001 file ke tables). CI mein yeh skip hota hai. [VERIFIED]

**8. Concepts:** Integration test with rollback, Management API token (detail `concepts.delta.md`).

**9. Red flags & edge cases:**
- Un-filtered updates (line 39). Serious: medium. Safe sirf ek request = ek transaction par. [VERIFIED code; failure mode INFERRED]
- CI mein skip. Serious: medium. [VERIFIED]
- `REF` hardcoded (line 6). Serious: low-medium. [VERIFIED]
- Kitchens ki exception (line 32). Serious: low. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264451084 -->
> **Top-3** — CI mein yeh test skip hota hai (token nahi), to green CI schema ke baare mein kuch nahi kehta. Maine local chala ke verify kiya (3 OK, dev 0 rows). Aage: dev ke liye ek limited token CI secret mein, ya test-cases mein saaf "Pass (local only, CI skipped)"?
- **Status:** open

<!-- gh-comment-id: 4264451088 -->
> **Top-3** — `update orders set status='accepted'` bina `where` — sirf rollback ke bharose. Agar Management API kabhi transaction na maane (autocommit/pooler), to dev ki saari orders badal jaayengi. `where id='...a1'` ek line hai — add karoge (quick commit before merge theek hai)?
- **Status:** open

<!-- gh-comment-id: 4264451100 -->
> S3 `on conflict ... do nothing` ke saath insert karta hai. Agar app seedha insert kare, retry par unique error aayega — row phir bhi ek. App ko kaunsa behaviour chahiye: chup ok ya error? Yeh kahan decide hoga (#45 place-order workflow)?
- **Status:** open

<!-- gh-comment-id: 4264451112 -->
> `REF` hardcoded = goserve-dev. Galti se prod ref aa gaya to test prod par chalega (rollback ke saath, phir bhi). Env var (`SUPABASE_GOSERVE_DEV_REF`) se lena behtar?
- **Status:** open

<!-- gh-comment-id: 4264451126 -->
> S1 mein `or table_name='kitchens'` — kitchens ko `kitchen_id` se chhoot. Design kehta hai "every table has kitchen_id and session_id"; kitchens ki exception design doc mein likh dein taaki test aur doc ek baat kahein?
- **Status:** open

**11. Testability:** Yeh file khud test hai: 3 tests. Green sirf local par hai. CI mein yeh kabhi nahi chalta jab tak token na mile. [VERIFIED]

### `scripts/apply_migration.py` (+12)

**1. Job:** Printer. SQL file ko Management API ke zariye database par bhejta hai. Real-life: printer jo blank pages chhapta hai. [VERIFIED]

**2. Kahan fit hai:** Coder ise chalata hai, `apply_migration.py <ref> 0001_schema.sql`. Vault ka Management token line 10 par use hota hai. Output sirf pehle 200 characters. [VERIFIED]

**3. Walkthrough:** File padhta hai, Management API ko POST karta hai, jawab ke pehle 200 characters print karta hai. Transaction wrap nahi, ledger nahi. [VERIFIED]

**4. Function-by-function:**
- **Request (line 10):** SQL file project ref ke URL par bhejta hai, token ke saath. Real-life: printer ko kaam ka order + master chaabi. [VERIFIED]
- **Output (line 12):** 200 characters print. Error par traceback. Real-life: printer ki chhoti slip. [VERIFIED]

**5. Block-level reading:** Line 2 ka note kehta hai: test ko `SUPABASE_ACCESS_TOKEN` chahiye (vault `02_databases.env`), token na ho to skip (CI mein yahi hota hai). [VERIFIED]

**6. Data ki journey:** SQL file (text) → POST → API jawab → 200 characters print. [VERIFIED]

**7. Connections map:** `0001_schema.sql` → printer → Management API → goserve-dev. [VERIFIED]

**8. Concepts:** Migration, Management API token (detail `concepts.delta.md`).

**9. Red flags & edge cases:**
- Management token master key hai. Serious: high. [VERIFIED]
- Transaction wrap nahi; aadha fail file aadha badal sakti hai. Serious: medium. [VERIFIED]
- Ledger nahi; dobara chalane par "already exists". Serious: medium. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264451136 -->
> Yeh Management access token hai — project banane/mitane tak sab kar sakta hai. Migration ke liye DB password + psql, ya service role, kam risky nahi? Vault mein `SUPABASE_GOSERVE_DEV_DB_PASSWORD` already hai.
- **Status:** open

<!-- gh-comment-id: 4264451145 -->
> Output ke sirf 200 chars, error par traceback. Multi-statement file aadhi chal gayi to kaise pata? File ko `begin; ... commit;` mein wrap karna chahiye taaki ya sab lage ya kuch nahi?
- **Status:** open

<!-- gh-comment-id: 4264451150 -->
> Supabase CLI (`supabase db push`) yahi kaam ledger ke saath karta hai. 12-line script kyun — install/auth ka jhanjhat, account rule, ya ponytail? Reason record ho jaye.
- **Status:** open

**11. Testability:** Is script ka koi test nahi hai. Chalne ka proof coder ka run hai (brief ke hisaab se). Brief mein is ke liye koi posted question nahi hai; agle PR ke liye note. [VERIFIED: no test in diff]

### `docs/assumptions.md` (+1)

**1. Job:** Assumption book ki ek line: A41, order steps. [VERIFIED]

**2. Kahan fit hai:** Line 51. Schema ke `orders` steps isi par tike hain. [VERIFIED]

**3. Walkthrough:** A41 kehta hai: 6 steps (placed, accepted, preparing, ready, out_for_delivery, delivered), ek step aage, koi cancel nahi; rider assigned aur arriving events hain, statuses nahi. Status: "Open: owner to confirm". [VERIFIED]

**9. Red flags:** Owner ka confirm pending; product decision. Serious: medium. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264451155 -->
> A41: 6 steps, cancel nahi, rider assigned/arriving events mein. Demo script (design §2) mein cancel aata hai kya? Owner ka confirm chahiye — main chat mein poochh raha hoon; tum A41 ko "Confirmed" tab karna.
- **Status:** open

**11. Testability:** Assumption ko test nahi karta; owner ka yes hi proof hai. [INFERRED]

### `docs/tests/test-cases.md` (+3)

**1. Job:** Test register. Rows 33–35: S1, S2, S3, "Integration (goserve-dev)". [VERIFIED]

**2. Kahan fit hai:** Test register ki tail, `test_schema.py` ki rows. [VERIFIED]

**9. Red flags:** Row "Pass" likhti hai, par CI skip karta hai. Serious: medium. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264451162 -->
> "Integration (goserve-dev) · Pass" — par CI skip karta hai. "Pass (local only; CI skipped, no token)" likhna zyada sach? Warna koi CI green dekh kar maan lega.
- **Status:** open

**11. Testability:** Rows ka proof `test_schema.py` ka local run hai. [VERIFIED]

### `docs/process-trace.md` (+2)

**1. Job:** Daily diary. Rows 127 (PR #63 fixes) aur 128 (story #43). Real-life: delivery diary ki entry. [VERIFIED]

**2. Kahan fit hai:** Line 130 par prod ka sawaal. [VERIFIED]

**9. Red flags:** "Prod gets the same file" ka koi mechanism nahi; ek manual step. Serious: medium. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264451169 -->
> "Prod gets the same file at the first release" — release PR `app/` le jaata hai, par migration apply koi workflow nahi karta. Pehli release ke din ki checklist mein yeh manual step kahan likha hai?
- **Status:** open

**11. Testability:** Log ko kaun check karta hai, yeh sawaal hai. [INFERRED]

---

## Handoff

> State: 18 posted · 0 must-fix · actor: coder, then owner merges
>
> You are the developer for GoServe PR #64 (feat/43-schema). Do this: (1) rebase on `dev`; (2) optional quick fixes before merge: `where id = '...a1'` on the un-filtered updates in `scripts/test_schema.py` line 39; mark the three `docs/tests/test-cases.md` rows "Pass (local only; CI skips, no token)"; (3) reply on all 18 threads in 1-2 sentences; (4) last step: copy the reviewer's notebook bundle into `docs/pr-reviews/` and append its trace/learnings rows (path in chat); one commit; push; reply "PR #64 ready to merge at <sha>"; (5) continue development: open the release PR once the owner confirms the Pages project exists; after #64 merges, start story #44 "Row level security, Realtime and the Delhi sample menu" (epic #34) on `feat/44-rls-realtime-menu` from `dev`.
>
> _(PR par post hua — `satvik-jain-iitd`, APPROVE review 5510476987 with 18 inline threads, 14 Oct 2026.)_

**Owner handoff (Romanized Hindi):**

```text
State: PR #64 approved, merge pending · actor: owner

1. A41 confirm karo: order steps placed, accepted, preparing, ready, out_for_delivery, delivered; ek step aage; cancel demo mein chahiye ya nahi. Chat mein ha ya na likho.
2. Coder ka "PR #64 ready to merge at <sha>" aane ke baad PR #64 ko merge karo: feat/43-schema → dev. Merge ke baad branch delete kar do.
3. Pages project `goserve-app` (F61) abhi pending hai. Release PR se pehle ise banao, production branch `main` rakh ke.
```
