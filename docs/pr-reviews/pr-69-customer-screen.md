# PR #69 — feat(app): customer menu, cart, bill and place order

- **Branch:** `feat/48-customer-screen` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #48 "Customer screen: menu, cart, bill, place order" (epic #36)
- **Status:** open (OPEN, MERGEABLE) · head `5f2fa97` (2 commits: `07bd1ab` feat, `5f2fa97` docs) [VERIFIED]
- **Files:** 31 · **Lines:** +795 / -18 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5511908806 (APPROVE), 20 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/69

> Customer ka poora order path ab app mein hai: menu dekho, dish daalo, bill dekho, order bhejo. Asli order ki row abhi activation ke baad aayegi.

---

## Overall review
## 1. Ek-line logline
> `Feat PR: customer menu, cart, bill aur place order app mein. Menu ek photocopy mein offline rehta hai; order ek slip ki tarah counter par jaata hai.`

## 2. Big Picture (Story & Goal)
- Story #48, epic #36. Persona: Customer (Priya). Spec §5 steps 1 se 3. [VERIFIED]
- S1: menu Supabase se, do dish daalo, "Place order (pay later)", sahi total, order save. [VERIFIED]
- S2: menu ek baar load ho, network band, menu phir dikhe. [VERIFIED]
- Depends on #58, #64, #66: teeno merged. Real payment MVP 2 mein; address autocomplete nahi. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Pehle app sirf welcome board thi. DB (#64, #65) aur order counter (#66, #67) ban chuke the, customer ka screen nahi tha. [VERIFIED journal]
- Ab customer phone se order bhej sakta hai. Dev build par abhi proof nahi hai. [VERIFIED docs]

## 4. Real-Life Analogy
Dhaba counter ka customer side.

1. `menu.ts` = menu card ki photocopy jeb mein (`localStorage`).
2. `cart.ts` = order slip: dish aur count, price nahi.
3. `orders.ts` = slip ko window se dena, token stamp ke saath.
4. `client_order_key` = slip number. Same slip, same receipt.
5. `supabase.ts` = darwaze par visitor ka anonymous token.
6. Screens = booklet ke chaar page: menu, cart, bill, placed.
7. `deploy-dev.yml` env = counter ka address jo card par chhapta hai (build time).
8. `place_order` = manager jo price aur limit dekhta hai.

## 5. Is PR mein naye Concepts (7)
Poori list `concepts.delta.md` mein hai. Naam: offline copy with a guard; server prices, client estimates; idempotency key per cart; fail fast for a fallback; network answered by the test; build-time public keys; anonymous session = visitor id.

## 6. High-Level Flow
1. App khulti hai, `loadMenu` menu laata hai (fresh ya copy). [VERIFIED]
2. Add, cart, "View cart (n)". Cart mein ± qty aur address zaroori. [VERIFIED]
3. Bill: lines aur total menu ke price se. "Place order (pay later)". [VERIFIED]
4. `place()`: key tay, session (ek baar), POST `x-gs-token` ke saath. [VERIFIED]
5. phone → n8n gs-order → place_order (prices, caps, idempotent key) → receipt. [VERIFIED code + tests; live path INFERRED]
6. Placed screen: order number (8 chars), server total. Cart aur key saaf. [VERIFIED]

Refusal (503, 429, 409, 400): server message bill ke alert mein, retry par same key. [VERIFIED]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `app/src/App.tsx` | Booklet ka switchboard: state, `place()`, ek page per step |
| `app/src/lib/cart.ts` | Order slip: id + count, cap 20 |
| `app/src/lib/menu.ts` | Menu card ki photocopy |
| `app/src/lib/money.ts` | Paise se rupee (₹320, ₹60.50) |
| `app/src/lib/orders.ts` | Window: slip bhejna, receipt lana |
| `app/src/lib/supabase.ts` | Darwaza: menu rows aur anonymous session |
| `app/tests/*`, `app/playwright.config.ts` | Rehearsal aur checklist |
| `.github/workflows/deploy-dev.yml`, `scripts/test_deploy_dev.py` | Card par address chhapna aur uska check |

## 8. Pieces aapas mein kaise baat karte hain
```
App.tsx ──> lib/ (menu, cart, money, orders, supabase) ──> n8n gs-order
App.tsx ──> screens (ek step par ek page)
```

## 9. Pehle se kya badla
- +795 / -18 in 31 files: code, tests, docs, aur pr-68 notebook bundle. [VERIFIED]
- `supabase-js` devDependencies se dependencies mein (+1 / -1). Lockfile bhi isi mein hai (size brief mein nahi). [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. Lost reply: request pahunchi, jawab phone tak nahi. Cart badla to naya key, doosra order. Cap 20 brake hai. [VERIFIED code; scenario INFERRED]
2. Ek phone, ek session. 20 orders ke baad 429 jab tak site data clear na ho. Reset story #52. [VERIFIED]
3. Demo token dev bundle mein padha ja sakta hai. Kill switch aur caps brake hain. [VERIFIED]
4. Prod (F69 a): anonymous sign-in, webhook path, chaar secrets: abhi kuch set nahi. [VERIFIED docs; prod auth INFERRED]
5. Address: phone par 300, server sirf khaali check karta hai. [VERIFIED 0004 line 19]
6. Purani copy mein dish off ho to server order refuse karega. Message INFERRED. [VERIFIED code]
7. Bill total aur receipt total alag ho sakte hain. [VERIFIED]
8. Router aur back button nahi; Android back PWA band kar sakta hai. [VERIFIED code; back INFERRED]
9. Photos offline nahi dikhte (F69 c). [VERIFIED]
10. `MAX_QTY 20` client aur server dono mein; test sirf client ka. [VERIFIED]
11. `reuseExistingServer` purana preview pakad sakta hai. [VERIFIED config; effect INFERRED]
12. Live proof pending: real order row aur phone check. [VERIFIED test-cases]

Downstream: #49 (kitchen) customer code ko chhoota nahi; #50 (tracker) #49 par depend karta hai. [VERIFIED issue]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
Real payment (MVP 2), address autocomplete, tax line, delivery fee, dish detail (A43), tracker (#50), router, offline photo cache (F69 c), prod secrets (F69 a), activation aur live order (owner ki yes). [VERIFIED PR body + docs]

## 12. Testing Story
- Red first: 3 unit files missing, e2e build fail, deploy env test fail. [VERIFIED PR body]
- Green (reviewer ne re-run kiya): lint clean, unit 27, e2e 10 (Pixel 7), unittest OK. [VERIFIED]
- E2E stand-in: Supabase auth, REST, n8n. Request shape check: token header, action place, session id, ids + qty, uuid key, koi price field nahi. [VERIFIED]
- Nahi test hua: live n8n call, asli anon sign-in, phone install, server address length, price-change notice. [VERIFIED]
- Test-cases 69 se 77: 7 pass, live aur phone row pending. [VERIFIED]

## 13. Trade-offs & Alternatives
| Chuna | Chhoda | Kyun |
|---|---|---|
| State `App.tsx` mein | Router | Kam files; URL baad mein [VERIFIED] |
| `localStorage` JSON copy | IndexedDB / SW cache | Ek key, 10 dish kaafi [VERIFIED] |
| Retry off + 4 s | Library default | Fallback jaldi; slow network par ek fail zyada [VERIFIED] |
| Server message as-is | Client message table | Kam strings [VERIFIED] |
| Keys build time par | Runtime config | Simple; har env par rebuild (F69 a) [VERIFIED] |

## 14. Patterns is PR se
- Offline copy with a guard: `menu.ts` `loadMenu`.
- Idempotency key per cart: `App.tsx` `keyRef`.
- Fail fast for a fallback: `supabase.ts` `fetchMenuRows`.
- Stand-in counter in the test: `customer.spec.ts` `mockNetwork`.
- Build-time public config: `deploy-dev.yml` Build step env.

## 15. AI-Review Lens
- Trust: pure modules (`cart`, `menu`, `money`, `orders`) aur unki unit tests; e2e request-shape asserts. [VERIFIED]
- Interrogate: anon sign-in prod par, webhook path, 4 s timeout asli phone par, lost-reply case, ek phone ek session. [INFERRED]
- Confident but risky: "order Supabase mein save hua" sirf stand-in se sabit hai. Live row pending hai, yeh imandaar hai. [VERIFIED]

## 16. Questions
- **Top 3 abhi poocho:** Q1 (lost reply), Q2 (ek phone ek session), Q3 (demo token). Poora bank "Comment blocks" mein hai: 20 sawaal, ek hi jagah.
- **Self-check:** Phone slip par price kyun nahi hoti? Network band ho to menu kahan se aata hai? Same cart do baar gaya to do order kyun nahi bante?

## Mode B — file review
### B1. `app/src/App.tsx`
- Job: app ka switchboard. Menu, cart, bill, placed mein se ek page; order bhejna. [VERIFIED]
- `place()` (lines 34–55): key tay, session, order bhejo, placed page. Error `setError` mein. [VERIFIED]
- Watch: URL nahi badalta; back button. Testability: e2e S1, 503 par retry same key. [VERIFIED]
- Questions: Q1 (TOP), Q10, Q11.

### B2. `app/src/lib/` — cart, menu, money, orders, supabase
- `cart.ts`: slip. `changeQty` 0 par hatata, 20 par ruk jaata. `cartLines` menu ke order mein. `toOrderItems` sirf id + qty. [VERIFIED]
- `menu.ts`: `loadMenu` fresh ko save karta; warna copy (`fromCache:true`); warna NOT_AVAILABLE. [VERIFIED]
- `money.ts`: paise se "₹320", "₹60.50". [VERIFIED]
- `orders.ts`: POST `x-gs-token`; network → "No network…"; ok → order; refusal → `PlaceError`; baaki → generic. [VERIFIED]
- `supabase.ts`: lazy client; `fetchMenuRows` offline guard, retry off, 4 s; `ensureSession` session ya anonymous sign-in. [VERIFIED]
- Questions: Q2, Q4 to Q9.

### B3. `app/src/screens/` — four pages
- MenuScreen (offline notice, lazy photo, "View cart (n)"), CartScreen (± qty, + off at 20, address maxLength 300), BillScreen (lines, bill-total, free delivery line, Back / Place order), PlacedScreen (8 chars, server total, "Order more"). [VERIFIED]
- Watch: 300 cap sirf phone par; photos offline nahi. Questions: Q12 to Q14.

### B4. `app/tests/` + `app/playwright.config.ts`
- Unit: `cart.test.ts` 9, `menu.test.ts` 5, `orders.test.ts` 5. E2E: `customer.spec.ts` 6 tests with `mockNetwork`. Config: test keys; `reuseExistingServer: !CI`. [VERIFIED] Questions: Q15, Q16.

### B5. `deploy-dev.yml` + `test_deploy_dev.py`
- yml: Build step env, four VITE keys (lines 32–36): card par chhapne jaisa; public by design (ADR-009). test: workflow text check (18–21); asli proof = merge ke baad deploy run. [VERIFIED] Questions: Q3 (TOP), Q17.

### B6. `docs/`
- A43 (line 53), F69 a–e (line 76), test-cases 69–77, trace rows 151–152, LEARNINGS 84–87, pr-68 bundle. [VERIFIED] Questions: Q18, Q19, Q20.

---

## Comment blocks
Yeh 20 threads PR par post ho chuke hain (review 5511908806). Har block mein GitHub id hai.

<!-- gh-comment-id: 4265736779 --> `app/src/App.tsx:39` · Risk · **Top-3**
> Fingerprint = items + address, same cart → same key (e2e proves). Ek case: request server tak pahunchi, order bana, jawab phone tak nahi aaya (timeout). Customer cart badal kar phir try kare → naya key → doosra order. Demo mein cap 20 brake hai. Pilot ke liye "reply lost" plan — pehle apni session ke `orders` padho (RLS `orders_own_session` hai) phir naya key?
- **Status:** open

<!-- gh-comment-id: 4265736784 --> `app/src/lib/supabase.ts:28` · Assumptions · **Top-3**
> `signInAnonymously` → session id = anonymous user id (ADR-010). Supabase session localStorage mein rehti hai, to ek phone = ek session hamesha; 20 orders ke baad (A42 cap) yeh phone 429 par atak jayega jab tak site data clear na ho. Demo script 20 runs (#56) hai aur reset story #52 hai — un dono se pehle phone par reset ka raasta kya hai?
- **Status:** open

<!-- gh-comment-id: 4265736794 --> `.github/workflows/deploy-dev.yml:36` · Impact · **Top-3**
> `VITE_DEMO_TOKEN` build ke andar jaata hai: dev URL ka JS kholne wala koi bhi token padh sakta hai (ADR-009 "public by design", kill switch + caps = brakes). Secrets mein rakhne ka fayda sirf dev/prod alag rakhna hai, chhupana nahi. Yeh baat kisi assumption row mein likhi hai? A43 nahi kehta.
- **Status:** open

<!-- gh-comment-id: 4265736796 --> `app/src/lib/orders.ts:29` · Understanding
> Server ka `message` seedha screen par (503 paused, 429 cap, 409 key clash), shape check ke saath; 502 HTML par generic text (test proves). Server hamara n8n hai to theek. Sawaal: 409 (same key, different cart, F66 e) ka message customer ke liye kya kehta hai, aur tab key naya banta hai ya wahi rehta hai?
- **Status:** open

<!-- gh-comment-id: 4265736799 --> `app/src/lib/supabase.ts:19` · Risk
> `.retry(false)` + 4 s abort: e2e ne pakda ki library 7 s retry karti thi (LEARNINGS). `navigator.onLine === false` par turant throw; Android par Wi-Fi connected-but-dead mein onLine true rehta hai → 4 s wait phir copy. Theek. Prod Supabase (F69 a) par bhi 4 s kaafi hai, ya pehli call (cold) zyada le sakti hai?
- **Status:** open

<!-- gh-comment-id: 4265736803 --> `app/src/lib/menu.ts:21` · Purpose
> "empty answer never replaces a good copy": kitchen sab dishes `available=false` kar de to purana menu dikhega aur order server par unavailable dish se fail hoga (0003 line 29). Demo script mein dish off karna hai? Agar haan, customer ko kya message dikhega?
- **Status:** open

<!-- gh-comment-id: 4265736810 --> `app/src/lib/menu.ts:8` · Testability
> `readCopy` sirf id/name/price_paise check karta hai, photo fields null allowed; key `gs.menu.v1` — schema badle to v2 aur purani copy khud gir jayegi. Acha pattern. Ek unit test "v1 key with a v2 shape" chahiye ya yeh kaafi hai?
- **Status:** open

<!-- gh-comment-id: 4265736816 --> `app/src/lib/cart.ts:5` · Understanding
> `MAX_QTY = 20` = `place_order` ka per-dish limit, do jagah ek number. Test sirf client ka 20 pakadta hai; server badle to phone ko pata nahi (server 400 dega, message dikhega). Comment kaafi hai ya server limit ka naam/test jodna hai?
- **Status:** open

<!-- gh-comment-id: 4265736817 --> `app/src/lib/cart.ts:20` · Purpose
> Phone sirf id + qty bhejta hai, price nahi (e2e `not.toMatch(/price|total/)`). Bill screen ka total copy ke price se, placed screen server total dikhata hai. Dono alag ho sakte hain (price badli). Customer ko "total badla" bolna chahiye, ya demo ke liye ignore (A43 note)?
- **Status:** open

<!-- gh-comment-id: 4265736820 --> `app/src/App.tsx:51` · Impact
> `ensureSession` ka error bhi isi catch mein ("Could not start a session"). Anonymous sign-in dev par on hai (PR #65 ke 21 anon users proof). Prod project par on hai? F69 (a) mein chaar prod secrets hain par "anonymous sign-in on" nahi likha.
- **Status:** open

<!-- gh-comment-id: 4265736825 --> `app/src/App.tsx:12` · Alternatives
> Chaar steps state mein, router nahi: URL nahi badalta, Android back button PWA band kar sakta hai. Demo ke liye theek. #49 kitchen aur #50 tracker ke saath route chahiye hoga — tab router aayega ya step state hi badhega? ADR?
- **Status:** open

<!-- gh-comment-id: 4265736830 --> `app/src/screens/CartScreen.tsx:30` · Risk
> Address `maxLength 300` sirf phone par; server sirf khaali check karta hai (0004 line 19), column text hai to curl se 10 KB bhi jayega. Trust boundary: `check_body.js` ya `place_order` mein length cap? F-row kaafi.
- **Status:** open

<!-- gh-comment-id: 4265736834 --> `app/src/screens/MenuScreen.tsx:13` · Future
> Photos Commons se, lazy, offline mein nahi dikhte (F69 c). Airplane-mode demo (#53) ke liye service worker image cache (runtimeCaching, kuch lines) chahiye hoga ya naam kaafi hain? Owner ka call.
- **Status:** open

<!-- gh-comment-id: 4265736842 --> `app/src/screens/PlacedScreen.tsx:8` · Understanding
> Order number = id ke pehle 8 chars. Kitchen screen (#49) bhi yahi 8 chars dikhaye to customer aur kitchen ek number bolein. Kahan tay hai (spec ya ADR)?
- **Status:** open

<!-- gh-comment-id: 4265736849 --> `app/tests/e2e/customer.spec.ts:116` · Testability
> `serviceWorker.ready` phir `setOffline` + reload: app shell SW se, menu localStorage se. Acha. Par Chromium Pixel 7 emulation hai; real Android Chrome ka SW first-load alag ho sakta hai → "founder's phone" row Pending. Phone check merge ke baad dev URL par — coder likhe owner ko kya tap karna hai (install, airplane, reload)?
- **Status:** open

<!-- gh-comment-id: 4265736851 --> `app/playwright.config.ts:16` · Assumptions
> `reuseExistingServer: !CI`: local par agar koi preview real keys se chal raha ho to specs `test.supabase.co` route nahi pakdenge aur test asli network par jayega. Chhota: comment ya alag port.
- **Status:** open

<!-- gh-comment-id: 4265736854 --> `scripts/test_deploy_dev.py:18` · Testability
> Test YAML text padhta hai (#62 jaisa). Chaar VITE secrets repo mein hain (maine `gh api` se dekha). Pehla asli proof = merge ke baad deploy run + dev URL par menu. Kaun check karega aur kahan likhega — coder trace row ya owner phone?
- **Status:** open

<!-- gh-comment-id: 4265736863 --> `docs/assumptions.md:53` · Purpose
> A43 mein chaar faisle ek row: no tax line, free delivery, no dish detail, one address box. Owner se main chat mein alag alag haan le raha hoon; tum confirm ke baad row ko Confirmed karna.
- **Status:** open

<!-- gh-comment-id: 4265736866 --> `docs/follow-ups.md:76` · Future
> F69 (a) prod ke chaar VITE secrets release PR (F61 Cloudflare project) se pehle. "Deploy twice" (#68) ke hisaab se prod MAIN 01 ka webhook path alag hoga — path naam (`gs-order` vs `gs-order-prod`?) aur prod Supabase par anonymous sign-in on, dono F69 (a) mein likho.
- **Status:** open

<!-- gh-comment-id: 4265736874 --> `docs/tests/test-cases.md:76` · Impact
> Live row "real order from dev URL saved in Supabase" activation ke baad. Yeh #48 ka DoD hai ya #50 ka? Agar #48 ka, to story close activation par rukti hai: owner ko merge ke baad "activate" bolna hoga.
- **Status:** open

---

## Handoff
```text
State: 20 posted · 0 must-fix · actor: owner (merge, A43 yes, activation yes, phone check)

You are the developer for GoServe PR #69 (feat/48-customer-screen). Do this: (1) reply on all 20 threads in 1-2 sentences; no code change needed; (2) optional: add the prod webhook path and "anonymous sign-in on for prod" to F69 (a), plus one F-row for a server-side address length cap; (3) after the merge, check the deploy-dev run and that goserve-app-dev.vercel.app shows the menu; write the owner's phone steps in test-cases; (4) start story #49 "Kitchen screen" on feat/49-kitchen-screen from dev, red first; (5) last step of that PR: copy the reviewer's bundle (pr-69 chapter) into docs/pr-reviews/ and append the rows (path in chat); (6) activate nothing until the owner says "activate".

```

Posted as satvik-jain-iitd, review 5511908806 (APPROVE), 20 inline threads.
