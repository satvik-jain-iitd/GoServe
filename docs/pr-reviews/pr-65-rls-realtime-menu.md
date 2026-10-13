# PR #65 — feat(db): row level security, Realtime and the Delhi sample menu

- **Branch:** `feat/44-rls-realtime-menu` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** #44 "Row level security, Realtime and the Delhi sample menu" (epic #34)
- **State:** **MERGED** — `dev` (2026-10-14, by `satvik-jain-iitd`, merge commit `e7f1f2b`), head `4bf41e1`, approved in review 5510638686
- **Files:** 10 · **Lines:** +288 / -2 (1 commit: `f715c62` feat(db)) (review ke baad: fix commit 4bf41e1, 5 integration tests)
- **Reviewer:** satvik-jain-iitd
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/65

> Dhaba ka register ab taale aur ghanti ke saath aata hai: har page par taala, sirf sahi chaabi se padhna, aur nayi parchi par sirf us customer ki ghanti.

---

## Overall review

## 1. Ek-line logline

> `Feat PR: goserve-dev ke 7 tables par taala (RLS) lagta hai, har browser ko ek anonymous token number milta hai, Realtime ghanti bajata hai, aur 10 Delhi dishes ka menu aata hai.`

## 2. Big Picture (Story & Goal)

- Story #44 "Row level security, Realtime and the Delhi sample menu", epic #34. [VERIFIED]
- Persona: customer aur kitchen. [VERIFIED]
- Build design §3, §5 aur §8 item 4 se judi hai. [VERIFIED]
- Story ke teen scenarios: S1 (customer ke sessions ek-dusre se alag rehte hain), S2 (live event 2 second ke andar), S3 (menu 8–10 Delhi dishes, free-licence photos). [VERIFIED]
- Pichhla PR: #64 (schema), merged `7563b8b`. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)

- Pehle (PR #64 ke baad): register bina taale ke tha. Koi policy nahi, koi Realtime publication nahi, aur tables khaali. [VERIFIED from chapter 5 scope list]
- Is PR se unlock hota hai: app anon key se menu padh sake, apni parchi dekh sake, aur live ghanti sun sake. Teeno kaam taale ke andar. [INFERRED from story text]
- Iske bina: ya app kuch nahi padh paati, ya sab kuch sabko dikhta. Dono galat hain. [INFERRED]

## 4. Real-Life Analogy

Poori PR ek dhaba ka register hai, jispar ab taala aur ghanti lagi hai.

1. Register par taala = RLS (`enable row level security`), har table par.
2. Chaabi = policy. Policy batati hai kaun si row kisko khulti hai.
3. Rate card deewar par = `menu_read` aur `kitchen_read`. Koi bhi padh sakta hai (anon + authenticated).
4. Apni parchi khud dekho = `orders_own_session` aur `events_own_session`. Sirf wahi customer jiska token number (`auth.uid()`) row ke `session_id` se match kare.
5. Customer register mein nahi likhta = koi insert, update ya delete policy nahi. Sirf service role likhta hai (n8n, manager ka pen).
6. Counter par token number = anonymous sign-in. Browser ko naam dene bina token milta hai. Yahi token session id hai.
7. Ghanti = Realtime publication (`orders`, `order_events`). Nayi parchi aate hi bajti hai, aur ghanti bhi taale ka lihaaz karti hai: sirf apni parchi par.
8. Pehla page bhara = seed. Ek kitchen, 10 dishes, photo Wikimedia Commons se, aur har photo ke saath credit.
9. Do mystery customers = `supabase.test.ts`. Check karte hain ki A, B ki parchi nahi dekh sakta, aur stopwatch se ghanti ka time naapte hain.

## 5. Is PR mein naye Concepts (8)

- **Row Level Security (RLS)** — har row par taala; policies batati hain kaun kya dekhe. Real-life: taala har page par, chaabi policy.
- **Policy roles anon vs authenticated** — `anon` = public key, bina login. `authenticated` = koi bhi logged-in user, anonymous sign-in wale bhi. Real-life: raahgir vs token-wala customer.
- **Anonymous sign-in** — bina naam ka login. Supabase ek user id deta hai, wahi session id ban jaata hai (ADR-010). Real-life: counter par token number.
- **Deny by default** — RLS on aur policy nahi = koi nahi padh sakta (service role ke alawa). Real-life: page taale mein, chaabi kata hi nahi.
- **Service role** — server wali chaabi, jo RLS ko bypass karti hai. Browser mein kabhi nahi, CI mein kabhi nahi. Real-life: manager ka pen.
- **Realtime publication** — woh tables jinke changes Postgres broadcast karta hai. Supabase unhe subscribed clients tak pahunchata hai, RLS ke saath. Real-life: ghanti jo sirf tumhari parchi par bajti hai.
- **Hot-linking with credit** — photo kisi aur ke server se load hoti hai. CC licence mein credit dikhana padta hai. Real-life: udhaar ki tasveer, naam ke saath.
- **ADR** — ek chhota record: faisla, rejected options, aur nateeje. Real-life: dhaba ka faisla register.

(Har concept ki detail `concepts.delta.md` mein hai.)

## 6. High-Level Flow

Journey: browser se parchi tak, aur wapas ghanti tak.

1. Browser app kholta hai → `signInAnonymously()` → Supabase user id deta hai → yahi session id. [VERIFIED from brief flow]
2. App menu padhti hai (public policy). [VERIFIED]
3. App Realtime par subscribe karti hai: orders aur order_events, filter + RLS `auth.uid()` se. [VERIFIED]
4. n8n (service role) order insert karta hai, us session ke `session_id` ke saath. [VERIFIED from ADR-010; n8n write path abhi nahi bana, story #45]
5. Ghanti sirf us session ki screen par bajti hai (insert se 2 s ke andar, test mein dekha). [VERIFIED in test]
6. App apne orders aur events padhti hai. Logs aur params sirf service role ke liye. [VERIFIED]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/supabase/migrations/0002_rls_realtime_menu.sql` | Taala wala page: RLS on, chaabiyan (policies), ghanti list, aur pehla page bharne ka seed |
| `app/tests/integration/supabase.test.ts` | Do mystery customers aur stopwatch: check karta hai ki parchi chhupi hai aur ghanti 2 s mein bajti hai |
| `app/vitest.integration.config.ts` | Alag board: sirf integration test ki files pakadta hai |
| `app/package.json` | Menu card: naya `test:integration` command, aur Supabase client ki entry |
| `app/package-lock.json` | Lock file: Supabase client ki exact versions (+117) |
| `docs/decisions/ADR-010-session-id-is-the-anonymous-user-id.md` | Decision slip: session id = anonymous user id. Status "Proposed" |
| `docs/LEARNINGS.md` | Sabak ki diary: 2 nayi lines |
| `docs/follow-ups.md` | To-do list: F63 (prod ke liye) update |
| `docs/process-trace.md` | Daily diary: row 133 |
| `docs/tests/test-cases.md` | Test register: 4 nayi rows |

## 8. Pieces aapas mein kaise baat karte hain

Text map (koi code is map ko run nahi karta):

- `0002_rls_realtime_menu.sql` → 7 tables par RLS. Policies: `menu_read`, `kitchen_read` (public); `orders_own_session`, `events_own_session` (authenticated, `auth.uid()`). Publication `supabase_realtime` = orders, order_events. [VERIFIED]
- `supabase.test.ts` → anon client (sign-in karta hai) aur admin client (service role). [VERIFIED]
- ADR-010 → session id = `auth.uid()`. Wajah: Realtime header nahi padh sakta. [VERIFIED]
- `package.json` → `test:integration` → `vitest.integration.config.ts` → `tests/integration/**`. [VERIFIED]
- CI App job sirf `tests/unit/**` chalata hai, integration nahi. [VERIFIED]

## 9. Pehle se kya badla

- 10 files, +288 / -2. [VERIFIED]
- Naya: 0002 migration (+35), supabase.test.ts (+89), vitest.integration.config.ts (+5), ADR-010 (+31). [VERIFIED]
- Badla: `package.json` +3/-1 (`verify` script ki line par comma aaya, naya `test:integration` script juda). `package-lock.json` +117 (Supabase client ki entries). [VERIFIED counts]
- Docs: LEARNINGS +2, F63 update, process-trace row 133, test-cases +4 rows. [VERIFIED]
- Before (PR #64 ke baad): RLS off, koi policy nahi, koi Realtime publication nahi, tables khaali.
- After (live goserve-dev, reviewer ka query): RLS on 7 tables; 4 policies; Realtime on orders aur order_events; kitchens 1, menu_items 10, orders 0, order_events 0. Indexes nahi badle. [VERIFIED by query]
- Auth config: anonymous sign-in on, captcha off, rate limit 30 per hour per IP. [VERIFIED by query]

## 10. Macro Risks & Downstream Impact

Ranked. Har risk ke saath kitna bada hai, aur kya check karna hai.

1. **Two-device demo tootega.** Session per browser hai. Customer ka phone aur kitchen ka laptop alag sessions honge, to kitchen ko kuch nahi dikhega. Bada: high for demo. Check: #56 demo checklist, ya session code ka raasta. [VERIFIED ADR-010 line 30 aur design §2; two-device effect INFERRED, confidence high]
2. **Anonymous users jama honge.** Dev par 21 hain. Har test run 5 aur banata hai. Koi cleanup nahi. [VERIFIED count]
3. **Prod par abuse ka raasta.** Koi bhi anonymous users bana sakta hai (rate limit 30 per hour per IP, captcha off). Demo ke liye theek. F63 decide kare: captcha (Turnstile) ya limit. [VERIFIED config; risk INFERRED]
4. **CI integration test skip karta hai** (keys nahi). Reviewer ka local run hi proof hai. Service role key kabhi CI mein nahi jaani chahiye. [VERIFIED]
5. **Bina sign-in ke anon key se khaali list aati hai, error nahi.** `orders` select = 0 rows. App "sign-in nahi hua" aur "koi order nahi" mein farak nahi kar paegi, jab tak session check na kare. [VERIFIED policy roles; app effect INFERRED]
6. **SUBSCRIBED ke pehle ek second ka event miss ho sakta hai.** Test 1.5 s wait karta hai. App subscribe ke baad ek baar `select` (reconcile) kare, to safe. [VERIFIED LEARNINGS + test line 68]
7. **Hot-linked photos.** 10 ke 10 URL aaj 200 dete hain. Commons slow ho sakta hai ya file badal sakti hai. Credit stored hai, abhi dikhta nahi. #54 self-host kar sakta hai. [VERIFIED URLs today]
8. **Seed migration ke andar hai.** Prod par bhi yahi menu aur prices jaayenge (F63). Prices coder ka andaza hain. Prod menu badalna ho to nayi migration chahiye. [VERIFIED]
9. **`order_events` par `session_id` index nahi.** RLS aur Realtime filter table scan karenge. Demo ke liye theek. [VERIFIED indexes]
10. **n8n `session_id` request se set karta hai.** Galat id = order kisi aur ki screen par. Write path story #45 mein hai, uska apna test chahiye. [VERIFIED ADR-010 item 5]
11. **Ops data ka read rule nahi.** `decision_log`, `run_log`, `params` sirf service role padh sakta hai. Ops screen (#51) ko n8n ke through ya baad ki policy se data lena hoga. [VERIFIED]
12. **Project config repo ke bahar hai.** Anonymous sign-in dev mein haath se on hua. F63 mein likha hai, script nahi hai. [VERIFIED]

Downstream: #45 (place-order), #48 (customer screen), #49 (kitchen screen), #51 (ops), #54 (self-host photos), #56 (demo checklist), F63 (prod release). [VERIFIED from brief]

## 11. Jo jaan-boojh kar NAHI hai (Scope)

- Real logins. Wajah: MVP 1 ke liye; ponytail; ADR-010 ka consequence. [VERIFIED]
- Phone ke liye write rules (insert, update, delete policy). Wajah: ADR-009 aur ADR-010: phone kabhi nahi likhta. [VERIFIED]
- Indexes PK aur unique ke alawa. Wajah: demo scale. [VERIFIED]
- Self-hosted photos. Wajah: #54 tab, agar Commons slow ho. [VERIFIED]
- Captcha aur anonymous-user cleanup. Wajah: story mein nahi; follow-ups mein. [VERIFIED]

Samajhne wali baat: "nahi banaya" bhi ek design decision hai. Phone ko write rule na dena, sabse bada faisla hai.

## 12. Testing Story

- **Red-first:** PR body mein `AuthApiError: Anonymous sign-ins are disabled` aur `Tests 4 failed (4)`. Matlab test pehle chala, sign-in band tha. [VERIFIED from PR body]
- **Green:** coder ke 4 passed (do baar chalaya). Reviewer ne `npm run test:integration` chalaya: `Tests 4 passed (4)`, 8.02 s. [VERIFIED]
- **S1 isolation:** A aur B sign in karte hain, service role se order insert hota hai, A sirf apni row dekhta hai. [VERIFIED]
- **S1 no-write:** signed-in anonymous user insert kare to error aata hai. [VERIFIED]
- **S2 live:** channel subscribe, 1.5 s wait, insert, aur event 2 s ke andar. [VERIFIED]
- **S3 menu:** 8 se 10 dishes, har ek ka https photo aur credit. [VERIFIED]
- **Cleanup:** orders key se delete hote hain. Anonymous users nahi hatte. [VERIFIED]
- **Nahi tested:** bare anon key (bina sign-in); `order_events` policy (koi event row nahi); Realtime on order_events; CI mein kuch bhi. [VERIFIED]
- **CI:** Site, App, Guard head par pass. Integration test CI mein skip. [VERIFIED]
- **Test-cases:** 4 rows "Pass (local only; CI skips, no keys)". [VERIFIED]

## 13. Trade-offs & Alternatives

| Option chuna | Kyun | Kya chhoda |
|---|---|---|
| Anonymous sign-in as session | Realtime header nahi padh sakta; ek rule reads aur live events dono ke liye | Readable session code; cross-device session |
| Deny-by-default + read-only policies | ADR-009: server likhta hai, phone padhta hai | Offline-first writes from phone |
| Seed in migration | Ek apply step | Alag menus per environment |
| Hot-link Commons | Demo ke liye zero setup | Speed aur availability par control |
| Integration tests local only | Secrets CI mein nahi | Automatic regression checks |

## 14. Patterns is PR se

- **Taala har page par (RLS on + deny by default):** entry `0002_rls_realtime_menu.sql` lines 6–12; line 19 par comment.
- **Chaabi = policy:** `orders_own_session` lines 17–18.
- **Rate card deewar par (public read):** lines 15–16.
- **Token number = session (anonymous sign-in):** `supabase.test.ts` lines 16–21.
- **Ghanti = Realtime publication:** line 21.
- **Do mystery customers (isolation test):** `supabase.test.ts` S1 lines 35–43.
- **Stopwatch ke pehle settle (wait after SUBSCRIBED):** test line 68.
- **Credit saath mein (photo + licence):** seed lines 25–35.

## 15. AI-Review Lens

- **Trust karna safe:** policy set ADR-009 aur ADR-010 se match karta hai (live check bhi). Logs par deny-by-default. Alag vitest config. Har dish ke saath licence credit. [VERIFIED]
- **Interrogate karo:** test ka apna footprint (anonymous users). "Anon key cannot write" asal mein kya test karta hai. One-device assumption. Prod abuse ka raasta. Config jo repo ke bahar haath se hua. [VERIFIED]
- **Confident but risky:** "Dev clean hai" tables ke liye sach hai, auth.users ke liye nahi. 21 anonymous users bache hain. PR body sirf woh ginta hai jo test delete karta hai. [VERIFIED]

## 16. Questions

**Top-3 abhi poocho:**

1. (Risk, `0002_rls_realtime_menu.sql` line 17) `orders_own_session` sirf `authenticated` ke liye hai. Bina sign-in, bare anon key se `orders` select khaali aata hai, error nahi. App kaise farak batayegi "sign-in nahi hua" aur "koi order nahi"? #48 mein pehle session check, phir read, yahi plan hai?
2. (Testability, `supabase.test.ts` line 11) Har run 5 anonymous users banata hai aur delete nahi karta. Dev par abhi 21 hain. `afterAll` mein `admin.auth.admin.deleteUser(...)`, ya Supabase ka suggested cleanup (anonymous users N din baad delete)? Kaunsa, aur kab?
3. (Assumptions, `ADR-010-session-id-is-the-anonymous-user-id.md` line 30) Demo ek device + split view par hai, theek. Par agar demo do device par ho (founder ka phone = customer, laptop = kitchen), kitchen ko 0 orders dikhenge. Yeh limitation #56 ki demo checklist mein likhi hai? Ya URL mein session code share karne ka raasta chahiye?

<details><summary>Poora question bank (17, 8 categories mein)</summary>

### 1 Purpose
- `0002_rls_realtime_menu.sql` line 26: photos hot-linked, `image_credit` UI mein kahan dikhega (#48)? Demo-day par Commons slow ho to #54 ka trigger kya hai?
- `ADR-010-session-id-is-the-anonymous-user-id.md` line 5: "Proposed, owner merge se confirm". Prod par Turnstile captcha chahiye ya limit kaafi?

### 2 Understanding
- `0002_rls_realtime_menu.sql` line 19: `decision_log`, `run_log`, `params` sirf service role padhta hai. Ops screen (#51) ka data phone tak kaise aayega: n8n se, ya baad mein read policy?
- `supabase.test.ts` line 45: "anon key cannot write" signed-in anonymous user se test karta hai. Bina sign-in wala insert bhi blocked hai, par test nahi karta. Naam badlein ya ek chhota case jodein?
- `docs/LEARNINGS.md` line 70: "Realtime checks row rules with the login token only" Supabase ka documented rule hai ya humne test se paaya? Docs link ke saath Tier A source likhenge?

### 3 Assumptions
- `0002_rls_realtime_menu.sql` line 15: `menu_read` aur `kitchen_read` `using (true)`. Menu aur credit text anon key wale kisi ko bhi dikhega. Prod mein bhi public rahega, ya kitchen se bandhna hai?
- `ADR-010-session-id-is-the-anonymous-user-id.md` line 30 (TOP-3): kitchen aur rider views ek browser session share karte hain. Do device demo mein kitchen ko 0 orders dikhenge.

### 4 Risk
- `0002_rls_realtime_menu.sql` line 17 (TOP-1): bina sign-in, bare anon key se `orders` select 0 rows. App kaise jaanegi?
- `supabase.test.ts` line 68: 1.5 s wait ke baad bhi SUBSCRIBED ke pehle ka event miss ho sakta hai. App mein subscribe ke baad ek reconcile `select` rakhenge (#48/#49)?

### 5 Alternatives
- `0002_rls_realtime_menu.sql` line 23: seed migration ke andar hai, to prod par bhi yahi menu aur prices. Alag `seed.sql` kyun nahi?
- `supabase.test.ts` line 8: service role sirf vault mein, CI mein nahi (sahi). Aage S1 aur S3 sirf anon key + ek seeded order se chal sakte hain, taaki CI mein anon-key-only run ho sake?

### 6 Impact
- `0002_rls_realtime_menu.sql` line 21: Realtime RLS maanta hai (test ne dikhaya). Par `order_events` par `session_id` index nahi. Index kab (#49/#50)?
- `supabase.test.ts` line 25: `insertOrder` service role se, RLS bypass. n8n bhi aise likhega aur `session_id` request se set karega. Galat session_id = order kisi aur ko dikhe. Yeh test #45 mein hoga?

### 7 Testability
- `supabase.test.ts` line 11 (TOP-2): local 4 passed, 8 s. Anonymous users jama hote hain. Cleanup kaunsa, kab?
- `docs/tests/test-cases.md` line 42: S2 "within 2 seconds" insert se measure hota hai. Row mein "from insert" likhein?

### 8 Future
- `0002_rls_realtime_menu.sql` line 4: `0001` nahi chhua, naya column `0002` mein (sahi). "Purani migration kabhi nahi badalti" rule kahin likha hai (PLAN/LEARNINGS)?
- `docs/follow-ups.md` line 70: F63 ab 2 migrations + auth config ki release-day checklist hai. Alag `docs/release-checklist.md` banayein?

</details>

**Self-check (3 sawaal, khud se poochho):**

- Taala (RLS) aur chaabi (policy) mein farak ek line mein kya hai?
- Token number (anonymous user id) kahan se aata hai, aur kahan jaata hai?
- Dev "clean" kis maayne mein hai, aur kis maayne mein nahi?

---

## Files (ek-ek)

### `app/supabase/migrations/0002_rls_realtime_menu.sql` (+35)

**1. Job:** Taala wala page. 7 tables par RLS on, chaabiyan (policies), ghanti list (Realtime), aur pehla page bharne ka seed. Real-life: register par taala lagana aur pehle page par naam likhna. [VERIFIED]

**2. Kahan fit hai:** Yeh migration goserve-dev par apply hoti hai. App phone se Supabase ko seedha padhti hai (ADR-009). Flow ke steps 2 se 6 tak isi par chalte hain. n8n isme likhta hai (service role). [VERIFIED]

**3. Walkthrough:** Pehle 7 register pages par taala lagta hai. Phir teen chaabiyan: rate card sab padh sakte hain, apni parchi sirf wahi customer padhta hai, aur ghanti bhi unhi ki bajti hai. Aakhir mein ek kitchen aur 10 dishes register mein likhe jaate hain. [VERIFIED]

**4. Block-level reading:**
- Lines 6–12: "7 pages par taala" (enable RLS). Real-life: register par taala.
- Lines 15–16: "rate card deewar par". Public read.
- Lines 17–18: "apni parchi khud dekho". Own-session read.
- Line 19: comment. Ops pages (decision_log, run_log, params) ki koi chaabi nahi.
- Line 21: ghanti list (Realtime publication).
- Line 23: kitchen seed, fixed id.
- Lines 25–35: 10 dishes, har ek ka naam, price, photo, aur credit.
[VERIFIED from brief line map]

**5. Function / block level:** SQL file mein functions nahi hain. Line 4 menu_items mein 2 columns jodta hai (`image_url`, `image_credit`). Baaki sab blocks hain: taala, chaabiyan, ghanti, aur seed. [VERIFIED]

**6. Data ki journey:** Migration file (text) → apply → goserve-dev par policies, publication, aur seed rows. Phone padhta hai, n8n likhta hai. Live counts: kitchens 1, menu_items 10. [VERIFIED for counts; flow INFERRED]

**7. Connections map:** `0002` ← `supabase.test.ts` (test ise jaanchta hai). ADR-009 aur ADR-010 ke rules isi mein likhe gaye. `0001_schema.sql` (PR #64) isme nahi badli. [VERIFIED]

**8. Concepts:** RLS, Policy roles, Deny by default, Service role, Realtime publication, Hot-linking with credit (detail `concepts.delta.md`).

**9. Red flags & edge cases:**
- Bina sign-in ke anon key se khaali list (line 17). Serious: medium-high. Confidence high on policy; app effect INFERRED. [VERIFIED policy]
- Menu public hai (line 15). Serious: low for demo; prod par decision. [VERIFIED]
- Ops data ka read rule nahi (line 19). Serious: medium. [VERIFIED]
- `order_events` par `session_id` index nahi (line 21). Serious: low. [VERIFIED indexes]
- Seed migration ke andar (line 23). Prod par same menu, prices coder ka andaza. Serious: medium. [VERIFIED]
- Hot-linked photos (line 26). Serious: low-medium. 10 ke 10 URL 200 aaj. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264591230 -->
> **Top-3** — `orders_own_session` sirf `authenticated` ke liye hai (anonymous sign-in ke baad role `authenticated` hi hota hai, isliye test pass). Par bina sign-in, bare anon key se `orders` select → 0 rows, koi error nahi. App ko kaise pata chalega "sign-in hua hi nahi" vs "koi order nahi"? #48 mein pehle session check, phir read — plan hai?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan. #48 mein app pehle sign-in karegi aur session milne ke baad hi orders padhegi, isliye "sign-in nahi hua" kabhi "koi order nahi" nahi dikhega.
- **Lesson:** Pehle sign-in, phir read: khaali list ka matlab "sign-in nahi hua" kabhi nahi hona chahiye.

<!-- gh-comment-id: 4264591239 -->
> `menu_read`/`kitchen_read` `using (true)` — menu (aur credit text) internet par anon key wale kisi ko bhi dikhega. Demo ke liye theek; prod mein bhi menu public hi rahega (restaurant ka menu public hota hai), ya kitchen_id/session se bandhna hai?
- **Status:** answered
- **Reply (klickbae8yt-star):** Menu public rahega, jaise asli restaurant ka menu. Orders aur events hi private hain.
- **Lesson:** Menu public hota hai by nature; private cheez order hai.

<!-- gh-comment-id: 4264591247 -->
> decision_log/run_log/params: RLS on, koi policy nahi → sirf service role padhega. Ops screen (#51) ko AI suggestion aur metrics phone par dikhane hain — woh data phone tak kaise aayega: n8n se, ya baad mein ek read policy?
- **Status:** answered
- **Reply (klickbae8yt-star):** Abhi n8n ke through (workflow numbers return karega). Agar screen ko live data chahiye, to #51 mein ops ke liye read rule jodenge.
- **Lesson:** Ops data n8n se jaata hai, jab tak koi screen use live na maange.

<!-- gh-comment-id: 4264591254 -->
> Realtime bhi RLS maanta hai (test ne dikhaya, acha). Par `order_events` par `session_id` index nahi (dev par sirf pkey). Har event par filter scan — demo scale theek, index kab (#49/#50)?
- **Status:** answered
- **Reply (klickbae8yt-star):** Demo mein kuch hi rows hain. Index kitchen screen (#49) ke saath aayega, agar query slow ho. F64 mein logged.
- **Lesson:** Index tab lagao jab query slow ho, pehle nahi (F64).

<!-- gh-comment-id: 4264591258 -->
> Seed (kitchen + 10 dishes) migration ke andar hai, to prod par bhi yahi menu aur yahi prices jaayenge (F63). Alag `seed.sql` kyun nahi, taaki prod menu alag ho sake bina nayi migration ke?
- **Status:** answered
- **Reply (klickbae8yt-star):** Sahi baat. Demo ke liye ek file simple hai. F64(c) mein likha hai: prod ko alag menu chahiye to seed.sql banega.
- **Lesson:** Demo ke liye ek file; prod ka alag menu ho to seed file (F64 c).

<!-- gh-comment-id: 4264591265 -->
> Photos Commons se hot-linked. Maine 10/10 URL check kiye: sab 200 aaj. CC BY-SA mein credit dikhana zaroori hai — `image_credit` UI mein kahan dikhega (#48)? Aur demo-day par Commons slow ho to #54 self-host ka trigger kya hai — ek baar pehle se copy kar lena sasta nahi?
- **Status:** answered
- **Reply (klickbae8yt-star):** Credit dish screen par dikhega (#48, F64 e). Self-host ka trigger: founder ke Android check mein photo slow lage to #54 mein copy karenge.
- **Lesson:** Credit screen par dikhta hai; photo slow lage to self-host (F64 e).

<!-- gh-comment-id: 4264591277 -->
> `0001` ko edit nahi kiya, naya column `0002` mein — sahi. "Purani migration kabhi nahi badalti" rule kahin likha hai (PLAN/LEARNINGS)? Ek line chahiye taaki agla model `0001` na chhede.
- **Status:** answered
- **Reply (klickbae8yt-star):** Rule maan liya: lagu ho chuki migration kabhi edit nahi hoti, badlav nayi file mein jaata hai. Agle docs change mein LEARNINGS mein ek line jodunga.
- **Lesson:** Lagu migration kabhi edit nahi hoti; badlav nayi file hai.

**11. Testability:** S1 aur S2 ke tests isi policy aur publication par chalte hain. S3 ka test seed par chalta hai. Test nahi hai: bare anon key (bina sign-in), `order_events` policy (koi event row nahi), Realtime on order_events. [VERIFIED]

### `app/tests/integration/supabase.test.ts` (+89)

**1. Job:** Do mystery customers aur stopwatch. Check karta hai: S1 isolation, S1 no-write, S2 ghanti 2 s mein, S3 menu 8–10 dishes photo aur credit ke saath. [VERIFIED]

**2. Kahan fit hai:** `npm run test:integration` se chalta hai (`vitest.integration.config.ts`). CI mein skip hota hai (keys nahi). Goserve-dev ke saath baat karta hai. [VERIFIED]

**3. Walkthrough:** Pehle check hota hai ki keys hain ya nahi. Keys nahi to poori file skip. Phir do customers sign in karte hain. Service role se order insert hota hai, aur A sirf apni row dekhta hai. Phir "no write" check. Phir channel subscribe, 1.5 s ruk kar insert, aur stopwatch. Aakhir mein menu check, aur `afterAll` test ke orders delete karta hai. [VERIFIED]

**4. Function-by-function:**
- `describe.skipIf` (line 11): keys nahi to test skip. Real-life: chaabi nahi, to register nahi khulega.
- `admin` client (line 12): service role wala client. Real-life: manager ka pen.
- `newSession()` (lines 16–21): anon client banata hai, sign-in karta hai, user id return karta hai. Real-life: counter par token.
- `insertOrder()` (lines 23–29): service role se order daalta hai, aur keys yaad rakhta hai. Real-life: manager ka entry.
- `afterAll` (lines 31–33): test ke orders key se delete karta hai. Anonymous users nahi hatata. Yeh rollback nahi hai, delete hai.
- S1 isolation (lines 35–43), no-write (lines 45–51), S2 live (lines 53–76), S3 menu (lines 78–88). [VERIFIED]

**5. Block-level reading:** Env keys (lines 6–8) = "chaabi ka dabba", vault se aati hain. Admin client = manager ka pen. [VERIFIED]

**6. Data ki journey:** Env keys → do clients → fake orders aur sessions → assertions (pass ya fail) → cleanup (sirf orders). Anonymous users wahin reh jaate hain. [VERIFIED]

**7. Connections map:** test → Supabase goserve-dev. Test `0002` ki policies ko indirectly check karta hai. ADR-010 ka `newSession` rule isi mein hai. [VERIFIED]

**8. Concepts:** Anonymous sign-in, Service role, Realtime publication (detail `concepts.delta.md`). Yeh test rollback wala test nahi hai; delete karta hai.

**9. Red flags & edge cases:**
- Anonymous users jama (lines 31–33). Serious: medium. 21 ab. [VERIFIED count]
- 1.5 s wait (line 68) timing par tiki hai. Slow machine par flake ho sakta hai. Serious: low-medium. [INFERRED]
- Service role key (line 8) test mein hai. CI mein kabhi nahi, theek. Serious: high if leaks. [VERIFIED no CI key]
- S2 insert se measure hota hai, subscribe se nahi (line 68). Serious: low, label ka sawaal. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264591286 -->
> **Top-3** — Maine local chalaya: 4 passed, 8 s. Har run 5 anonymous users banata hai aur delete nahi karta — dev par abhi 21 hain (pehla 13 Oct 22:02). `afterAll` mein `admin.auth.admin.deleteUser(...)`, ya Supabase ka suggested cleanup (anonymous users N din baad delete) — kaunsa, kab?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** 4bf41e1 mein fix: test apne anonymous users `afterAll` mein delete karta hai. Dev par 21 purane users bhi purge kiye, ab live count 0 hai.
- **Lesson:** "Saaf" ka matlab har store ginna hai, sirf tables nahi. Ab test wahi karta hai.

<!-- gh-comment-id: 4264591295 -->
> "the anon key cannot write" asal mein signed-in anonymous user se insert try karta hai (stronger case, acha). Bare anon key (bina sign-in) se insert bhi blocked hai (koi insert policy nahi), par test nahi. Naam badlo ya ek aur chhota case?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** 4bf41e1 mein: purana test ab 'a signed-in session cannot write either' naam se hai. Naya case bare anon key ke liye hai (write blocked, read khaali). 5 tests pass.
- **Lesson:** Test ka naam wahi ho jo woh asal mein check karta hai. Kamzor case bhi cover karo.

<!-- gh-comment-id: 4264591303 -->
> 1.5 s wait after SUBSCRIBED (LEARNINGS mein likha, acha). App screen khulte hi subscribe karegi, order baad mein — theek. Par subscribe ke pehle second mein aaya event miss hoga; app mein subscribe ke baad ek baar `select` (reconcile) rakhoge (#48/#49)?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan. Subscribe ke baad app ek select chalayegi, taaki pehle second mein chhoota event bhi mil jaaye. F64(f) mein #48/#49 ke liye logged.
- **Lesson:** Pehle subscribe, phir ek select: pehle second ka chhoota event pakdo (F64 f).

<!-- gh-comment-id: 4264591311 -->
> `insertOrder` service role se, RLS bypass — n8n bhi aise hi likhega aur `session_id` request se set karega (ADR-010 §5). Galat session_id = order kisi aur ko dikhe. n8n side ka yeh test #45 mein hoga?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan. n8n side ka test (sahi session_id chalta hai, galat reject hota hai) #45 mein likhunga.
- **Lesson:** Write path ka test writer ke saath rehta hai (#45).

<!-- gh-comment-id: 4264591319 -->
> Service role key sirf vault se, kabhi CI mein nahi — sahi. Kya aage S1/S3 sirf anon key + ek seeded order se chal sakte hain (service role sirf seed step mein), taaki ek din CI mein anon-key-only run ho sake?
- **Status:** answered
- **Reply (klickbae8yt-star):** Baad mein possible hai: service role se seed karo, phir checks sirf anon key se. MVP 0 ke liye zaroori nahi.
- **Lesson:** Anon-key-only checks baad mein; abhi nahi (MVP 0).

**11. Testability:** 4 tests. Coder ne 2 baar chalaya (4 passed), reviewer ne 8.02 s mein. CI mein nahi chalta. Test nahi hai: bare anon key, `order_events` ki policy. [VERIFIED]

### `docs/decisions/ADR-010-session-id-is-the-anonymous-user-id.md` (+31)

**1. Job:** Decision slip. Faisla: session id = Supabase anonymous user id (`auth.uid()`). Real-life: dhaba ka faisla register. [VERIFIED]

**2. Kahan fit hai:** ADR-009 se judi hai. `0002` ki policies aur test isi par chalte hain. n8n ko session_id isi se set karna hai. [VERIFIED]

**3. Walkthrough:** Context (lines 13–15): Realtime sirf login token se RLS check karta hai, custom header nahi padh sakta. Decision (lines 19–24): anonymous sign-in = session id; phone kabhi nahi likhta; n8n service role se likhta hai aur session_id set karta hai; dev mein anonymous sign-in on hai, prod par pehli release ke time (F63). Consequences (lines 28–31): kitchen aur rider views ek browser session share karte hain. [VERIFIED]

**4. Block-level reading:** Status line 5 ("Proposed") = register ka status tag. Decision items 19–24 = numbered rules. Item 5 = n8n session_id. [VERIFIED]

**5. Data ki journey:** Browser → sign-in → user id → session id → har row ka `session_id`. [VERIFIED]

**6. Connections map:** `0002` policies (`auth.uid()`), `supabase.test.ts` (`newSession`), F63 (prod), #45 (n8n), #56 (demo). [VERIFIED]

**7. Concepts:** Anonymous sign-in, ADR (detail `concepts.delta.md`).

**8. Red flags:**
- Do device demo (line 30). Serious: high for demo. Effect INFERRED, confidence high. [VERIFIED ADR text]
- Captcha off, rate limit 30/h/IP (line 5 aur dev config). Serious: medium. [VERIFIED config]

**9. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264591326 -->
> "Proposed, owner confirms by merging" — owner se chat mein poochh raha hoon. Prod ke liye anonymous sign-in on karna F63 mein hai; abhi rate limit 30/hr/IP aur captcha off (dev config dekha). Prod par Turnstile captcha chahiye ya demo ke liye limit kaafi?
- **Status:** answered
- **Reply (klickbae8yt-star):** ADR 'Proposed' rahega jab tak owner merge nahi karta. Prod ke liye captcha owner ka sawaal hai; F64(b) mein logged.
- **Lesson:** Owner ne PR #65 merge kiya, to ADR-010 accepted hai. Prod captcha abhi khula hai (F64 b).

<!-- gh-comment-id: 4264591335 -->
> **Top-3** — "kitchen and rider views run in the same browser, so they share the session" — demo script §2 ek device + split view hai, theek. Par agar demo do device par ho (founder ka Android = customer, laptop = kitchen), kitchen ko 0 orders dikhenge. Yeh limitation #56 ki demo checklist mein likhi hai? Ya URL mein session code share karne ka raasta chahiye?
- **Status:** answered
- **Reply (klickbae8yt-star):** Ek asli limit: do device par do sessions. Yeh #56 demo checklist mein jaayega (F64 d). URL mein session code baad ka option hai.
- **Lesson:** Do device = do sessions; demo ek device + split view par (F64 d).

**10. Testability:** ADR ko test nahi karta. Proof test aur policies ka match hai (ADR ke items ko test check karta hai). [INFERRED]

**11. Concepts / next:** Next story #45 aur #56 par asar. Pehli release par F63. [VERIFIED from brief]

### `docs/tests/test-cases.md` (+4 rows)

**1. Job:** Test register. Rows 42–45: 4 nayi integration rows. [VERIFIED]

**2. Kahan fit hai:** Test register ki tail. Rows `supabase.test.ts` ki 4 tests se judi hain. [VERIFIED]

**3. Walkthrough:** Har row ek test ka naam, status, aur label hai. Label ab "Pass (local only; CI skips, no keys)". [VERIFIED]

**9. Red flags:** S2 "within 2 seconds" insert se napa jata hai, subscribe se nahi. Demo par subscribe-to-event 3.5 s dikhe to koi confuse ho sakta hai. Serious: low. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264591343 -->
> Chaaron rows "Pass (local only)" — #64 ka sabak laga, acha. S2 "within 2 seconds" insert se measure hota hai, subscribe se nahi — row mein "from insert" likh dein taaki demo par subscribe-to-event 3.5 s dekh kar koi confused na ho?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** 4bf41e1 mein kiya: test-cases row mein ab 'of the insert' likha hai.
- **Lesson:** Batao ki clock kya napta hai.

**11. Testability:** Rows ka proof reviewer ka local run hai. CI mein proof nahi. [VERIFIED]

### `docs/follow-ups.md` (F63, line 70)

**1. Job:** To-do list. F63 ab release-day ki checklist ban rahi hai: 2 migrations aur auth config. [VERIFIED]

**2. Kahan fit hai:** Line 70. Pehli release par prod ke liye kaam yahin se milega. [VERIFIED]

**9. Red flags:** Ek to-do list mein release ke kaam daba rehte hain. Pehli release par bhool sakte hain. Serious: medium. [INFERRED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264591354 -->
> F63 ab 2 migrations + auth config = release-day checklist ban rahi hai. Alag `docs/release-checklist.md` pehli release se pehle banayein, F63 ko wahan le jaayein?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan. F64(a) kehta hai: pehli release se pehle `docs/release-checklist.md` banao, aur F63 wahan le jao.
- **Lesson:** Pehli release se pehle release checklist doc (F64 a).

**11. Testability:** Docs hai, test nahi. Brief mein iske liye koi test nahi. [VERIFIED]

### `docs/LEARNINGS.md` (+2, lines 70–71)

**1. Job:** Sabak ki diary. Do nayi lines: Realtime row rules login token se check karta hai; `SUBSCRIBED` ka matlab "sun raha hai" nahi hai, tests mein ~1 s ruko. [VERIFIED]

**2. Kahan fit hai:** Line 70. Har sabak ek galti ya seekh hai. [VERIFIED]

**9. Red flags:** Pehli line Supabase ka documented rule hai ya humara test se nikla hua, abhi likha nahi. Serious: low-medium. [VERIFIED: source not in brief; INFERRED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264591361 -->
> "Realtime checks row rules with the login token only" — yeh Supabase ka documented behaviour hai ya test se paaya? Tier A source (docs link) LEARNINGS mein add karoge, taaki yeh "hamara anubhav" se "unka rule" bane?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Yeh humne test se paaya, kisi doc mein nahi padha. 4bf41e1 mein LEARNINGS line badli: 'test ne paaya' likha, docs link baaki hai (F64 g).
- **Lesson:** Alag rakho: 'humne paaya' aur 'unhone likha'.

**11. Testability:** Sabak ka proof test hai (line 68 ke aas-paas). [INFERRED]

### Baaki files (koi question nahi)

- `app/vitest.integration.config.ts` (+5): alag config. Include `tests/integration/**/*.test.ts`, node environment. Yeh unit run se integration test ko alag rakhta hai. [VERIFIED]
- `app/package.json` (+3/-1): naya script `test:integration` aur `@supabase/supabase-js` devDependency. Badli line: `verify` script ke baad comma, phir naya `test:integration` script.
- `app/package-lock.json` (+117): Supabase client ki lock entries. Bada diff, par logic nahi. [VERIFIED count]
- `docs/process-trace.md` (+1 row, row 133): daily diary ki entry. [VERIFIED]

---

## Handoff

> State: 17 posted · 0 must-fix · actor: coder, then owner merges
>
> You are the developer for GoServe PR #65 (feat/44-rls-realtime-menu). Do this: (1) reply on all 17 threads in 1-2 sentences; (2) optional before merge: delete the anonymous users the test creates (`afterAll`) or log cleanup as F64; (3) last step: copy the reviewer's notebook bundle (it now carries the #64 and #65 chapters) into `docs/pr-reviews/` and append its trace/learnings rows (path in chat); one commit; push; reply "PR #65 ready to merge at <sha>"; (4) continue development: open the release PR once the owner confirms the Pages project; after #65 merges, start story #45 "Place order and change status workflows (MAIN 01, SUB 11, SUB 12)" (epic #34) on `feat/45-order-workflows` from `dev`; read the n8n rulebook and load the canvas-layout skill first; owner yes before activation.
>
> _(PR par post hua — `satvik-jain-iitd`, APPROVE review 5510638686 with 17 inline threads, 14 Oct 2026.)_

- **Dev reply:** "PR #65 ready to merge at 4bf41e1"
- **Verified:** 17 answered · 4 fixed (4bf41e1) · anonymous users 0 live · merged e7f1f2b [VERIFIED]
- **Approved:** review 5510638686 (satvik-jain-iitd); merged by the owner

**Owner handoff (Romanized Hindi):**

```text
State: PR #65 merged (e7f1f2b) · actor: owner

1. Kuch merge nahi karna. PR #65 pehle hi merge ho chuka hai.
2. A41 (6 steps, no cancel) abhi open hai. Iska faisla aapka hai.
3. Pages project F61 abhi pending hai. Release PR se pehle ise banana hai.
4. Prod captcha (F64 b) aapka call hai. Default: demo ke liye 30/hr/IP rate limit rakhein.
```

**Coder paste-block (English):**

```text
State: PR #65 merged (e7f1f2b) · actor: coder

You are the developer for GoServe story #45 "Place order and change status workflows (MAIN 01, SUB 11, SUB 12)", epic #34. Do this:
1. Start story #45 on feat/45-order-workflows from dev.
2. Read the n8n rulebook and load the canvas-layout skill first.
3. Owner yes before activation.
4. In this PR, set ADR-010 status to Accepted (owner, 14 Oct 2026, by merging PR #65).
5. Copy the notebook bundle (pr-65 chapter and journals) as the last step: /private/tmp/claude-501/-Users-satvikjain-Documents-GoServe/aa3d69ad-418a-46fc-b6e5-07aa857fd7f3/scratchpad/tpm/bundle/docs/ into docs/pr-reviews/.
6. Push, then reply "PR #66 ready for review at <sha>".
```

## What happened after review

- **Review comments post hue:** 14 Oct 2026, `satvik-jain-iitd` ne 17 sawaal post kiye (review 5510638686).
- **Replies:** 17 ke 17 jawab `klickbae8yt-star` se. **17 answered**, 0 open. [VERIFIED]
- **Fix commit:** `4bf41e1`. 4 cheezein badli:
  1. Test apne anonymous users `afterAll` mein delete karta hai. Dev par 21 purane users purge hue, live count ab 0.
  2. Test ka naam badla ('a signed-in session cannot write either'). Naya case: bare anon key, write blocked, read khaali. 5 tests pass.
  3. `docs/tests/test-cases.md` row: "of the insert" likha.
  4. `docs/LEARNINGS.md` line: "test ne paaya" likha; docs link baaki hai (F64 g).
- **F64 (a to g) logged:** (a) release checklist doc, (b) prod ke liye captcha decision, (c) `seed.sql`, (d) two-device limit #56 checklist mein, (e) credit dish screen par, (f) subscribe ke baad reconcile select, (g) Realtime docs link.
- **Merge:** `e7f1f2b` owner (satvik-jain-iitd) ne kiya. Merge se ADR-010 accepted hai; status line dev par abhi "Proposed" hai, PR #66 mein update hoga. [VERIFIED]
- **Notebook:** pr-65 chapter aur #65 journal deltas PR #66 ke saath jaayenge, kyunki bundle coder ne copy kiya tha tab yeh chapter exist hi nahi karta tha. [VERIFIED]

## Reviewer's take (mere thoughts)

- **Kya achha raha:** 17 mein se 4 jawab ne code badla. Baaki 13 mein ya seedha reason diya, ya risk F64 mein naam se likh diya. [VERIFIED]
- **Big lesson:** "Saaf" ka matlab har store ginna hai. Tables saaf the, par `auth.users` mein 21 anonymous users the. Ek live query ne yeh pakda. Diff mein yeh nahi dikhta tha. [VERIFIED]
- **Reader ka sawaal:** Top-3 ke cleanup sawaal ne ek cleanup aur ek naya test case banwaya (bina sign-in wali anon key). Sawaal ka kaam yahi hai: risk ko khule mein laana. [VERIFIED]
- **Live system dekho:** PR body sirf woh ginti thi jo test delete karta tha. Review mein diff ke saath dev ka live count bhi check karo. [VERIFIED]
- **Owner ke faisle:** captcha (F64 b) aur two-device limit (F64 d) code ke sawaal nahi, product ke faisle hain. Inhe owner ke saath khula rakho. [INFERRED]
