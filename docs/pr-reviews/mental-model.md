# Mental Model

System ka ek-page picture. Har chapter ke baad update karta hoon.

_Last updated: PR #67 (approved, `d1b2f62`); PRs #62–#66 merged; owner said haan to A41, A42, credential, push_

## GoServe — ab tak ki tasveer

```
[ GitHub repo ]
     |
     |--- site/          → investor site (letsdwelo.in, "goserve" Pages project)
     |--- design/        → tokens.json  (colours ka single source of truth)
     |--- docs/          → plan, decisions, follow-ups, test-cases, pr-reviews
     |--- scripts/       → guard.py  (repo rules ka checklist)         ← PR #59
     |                    test_schema.py (auditor: DB rules ka test, rollback)  ← PR #64
     |                    apply_migration.py (printer: SQL file DB par bhejta hai)  ← PR #64
     |                    test_order_rpc.py (6 DB tests, begin…rollback)  ← PR #66
     |--- .github/       → ci.yml  (site + app + guard jobs)           ← PR #59
     |                    deploy-dev.yml (push to dev → Vercel dev)   ← PR #62
     |                    deploy-app.yml (push to main → Cloudflare Pages goserve-app, prod) ← PR #63
     |--- app/           → PRODUCT APP  (PR #58 se shuru)
                          |
                          ├─ index.html      (main door)
                          ├─ src/main.tsx    (switchboard)
                          ├─ src/App.tsx     (welcome board — abhi khaali)
                          ├─ src/pwa-manifest.ts  (identity card, colours ← tokens.json)
                          ├─ src/styles/tokens.css + app.css (paint)
                          ├─ vite.config.ts  (assembly line + PWA)
                          ├─ tests/          (unit + e2e)
                          ├─ tests/integration/supabase.test.ts  (do mystery customers + ghanti ka stopwatch)  ← PR #65
                          ├─ vitest.integration.config.ts  ← PR #65
                          ├─ supabase/migrations/0001_schema.sql  (7 tables + 2 triggers)  ← PR #64
                          ├─ supabase/migrations/0002_rls_realtime_menu.sql  (RLS + Realtime + seed)  ← PR #65
                          ├─ supabase/migrations/0003_order_functions.sql  (place_order, change_status = manager)  ← PR #66
                          └─ supabase/migrations/0004_session_order_cap.sql  (place_order + session cap 20 → 429)  ← PR #67
     |--- ops/n8n/       → lib/layout.js + layout_checks.js  (deewar chart: positions + checks)  ← PR #66
     |                    order/build.js  (blueprint: GS MAIN 01 + SUB 11 + SUB 12)  ← PR #66
     |                    order/code/*.js  (token check, guards, shape)  ← PR #66
     |                    order/code/decide_guard.js, decide_result.js, decide_done.js  (dispatcher: rule, Jev advice, diary)  ← PR #67
     |                    order/code/guard_log.js, log_done.js, log_run.js  (duty register: run_log)  ← PR #67
     |                    order/order.test.js (18 tests) + order/decide.test.js (15 tests, red first)  ← PR #66/#67
     |--- docs/integrations/n8n-order-workflows.md  (contract + registry)  ← PR #66

[ pre-commit ] ──> guard.py (local, commit se pehle)   ← PR #59
[ CI ]         ──> site + app + guard jobs (remote, push ke baad)  ← PR #59
```

## Data (Supabase goserve-dev) — PR #64, taale PR #65 se

Dhaba ka register: 7 pages, goserve-dev database mein. Ab taale (RLS) ke saath.

- **kitchens** — dhaba ka naam wala page. Public read (anon + authenticated). Ab 1 kitchen.
- **menu_items** — rate card (price paise mein, photo + credit). Public read. Ab 10 Delhi dishes.
- **orders** — order page, token number `client_order_key`. Sirf apni session ki row (`session_id = auth.uid()`). Likhta sirf service role (n8n).
- **order_events** — carbon-copy diary, kabhi mitta nahi. Sirf apni session ki row. Likhta sirf service role.
- **decision_log** — manager ke decision notes. Service role only.
- **run_log** — duty log. Service role only.
- **params** — settings page, version ke saath. Service role only.

Realtime (ghanti) on `orders`, `order_events` — RLS maanti hai.

[VERIFIED by live query, 14 Oct: RLS on 7 tables, 4 read policies, 0 write policies; kitchens 1, menu_items 10, orders 0, order_events 0]

## Order path (n8n + database) — PR #66, built, not deployed

Dhaba counter: phone = customer, n8n = counter boy, database function = manager.

- Phone parchi deta hai (`POST /webhook/gs-order`, header `x-gs-token`).
- Counter boy (GS MAIN 01) token dekhta hai, "orders paused" board (kill switch) dekhta hai, action ke hisaab se helper ko bhejta hai.
- Helper (GS SUB 11 place / SUB 12 status) board dobara dekhta hai, parchi check karta hai, manager ko ek hi call karta hai (`/rest/v1/rpc/place_order|change_status`, service role).
- Manager order aur carbon copy ek saath likhta hai, ya kuch nahi. Price rate card se, parchi se nahi.
- Helper reply card banata hai (201/200/400/404/409/429/503/502), counter boy wahi customer ko deta hai.
- **Dispatcher (GS SUB 13 Decide, PR #67):** bahar khade riders dekhta hai (free? trips? distance?), house rule se pick karta hai, 900 ms mein salahkaar (Jev) se poochhta hai. Dono raay `decision_log` diary mein; bhejta rule ka rider hi.
- **Duty register (GS SUB 14 Write logs):** jawab jaane ke baad ek line `run_log` mein: action, time, settings version, cost, error.
- **Token limit (429):** ek session ke 20 orders ke baad "bahut ho gaya". Retry chalta hai; reset = nayi session.

_Status: 6 workflows built (ERR 00, SUB 11–14, MAIN 01), tests green (node 34, DB 9). n8n par deploy nahi hua (VERIFIED). Owner ka A42 + OpenRouter credential + "push kar do" pending; activation alag yes. Live proof pending._

## Flow (ek code change)
1. Dev commit → pre-commit hook (guard files + message).
2. Push → PR → CI chalta hai (site, app, guard jobs).
3. Sab green → merge → dev.
4. Merge to dev (`app/` badla ho) → deploy to Vercel dev (`deploy-dev.yml`, PR #62).
5. Release PR → `main` → deploy to Cloudflare Pages prod (`deploy-app.yml`, PR #63). Tiffin: van khana main tak laati hai, ab real customer ka address.
6. Browser → anonymous sign-in → session id → menu read → Realtime subscribe → n8n writes order (service role) → ghanti (PR #65).
7. App chalane par: index.html → main.tsx → App → service worker (offline).

## Yeh PR ke baad kya samajh aaya
- **Do layer ka check:** pre-commit (ghar par) + CI (factory gate). Defense in depth.
- **Rules-as-code:** repo ke rules `guard.py` mein likhe — yaad rakhne ki zarurat nahi.
- Guard **secrets ko dhoondhta hai** par sirf kuch known patterns. Review ke baad Stripe `sk_live_` add hua; Supabase keys JWT pattern se cover. Naya format aa to ek regex + ek test.
- Guard khud par pass karta hai (`test_guard_passes_on_itself`), aur ab ek test doc/regex drift bhi pakadta hai — par agar koi test *delete* kar de to koi flag nahi karta.
- `guard` job ke file/message checks sirf **PR** par chalte hain, direct push par nahi.
- **Deploy ek alag rule board hai** (PR #62): `deploy-dev.yml` CI se alag file hai. CI check karta hai, yeh deliver karta hai.
- **Tiffin ka rule:** sirf `app/` ke order par deploy chalta hai (`paths:`), counter (`site/`) par nahi. `design/tokens.json` bhi ab list mein hai (0630677), kyunki app build usse rang leta hai.
- **Secrets ka ID card:** teeno secrets ab sirf Deploy step par hain (0630677). `npm ci` jaise steps inhe nahi dekhte.
- **Packing ka pin:** Vercel CLI `vercel@64` par pinned hai (0630677). Naya major ab accident nahi, ek faisla hai.
- **Ek hi delivery boy:** `concurrency` naye run se purana cancel karta hai, isliye do deploy ek saath nahi chalte.
- **Green test sirf board check karta hai:** test file ko text ki tarah padhta hai. Asli proof pehle merge ke baad ka run hai.
- **Do address, do rule board** (PR #63): dev (Vercel, PR #62) aur prod (Cloudflare, PR #63). Dono ek hi kitchen (`app/`) se khana lete hain.
- **Release ki packing list ek doc hai, code nahi:** `docs/PLAN.md` §2 aur `CLAUDE.md` rule 17 mein `app` aur `scripts` nahi the. Review ke sawaal se mila; 4b77e65 mein list fix hui aur ab ek test (`test_release_list_carries_the_app_and_its_guard`) use pakadta hai.
- **Investor site ka board chhoota nahi:** `deploy.yml` (letsdwelo.in) PR #63 mein nahi badla. S2 test yeh text se dekhta hai.
- **Head waiter database mein hai** (PR #64): order ek step aage hi chalta hai. Skip ya peeche jaana DB khud rokta hai, app ke bharose nahi.
- **Token number retry ko safe rakhta hai:** same session aur same client key do baar aaye to ek hi order bachta hai.
- **RLS abhi off hai:** register bina taale ke. Story #44 se pehle anon key app mein nahi jaani chahiye.
- **CI schema test skip karta hai:** green CI schema ke baare mein kuch nahi kehta. Local run hi proof hai.
- **Events ko abhi koi nahi likhta:** carbon copy ka guard hai, par diary mein entry koi nahi daalta.
- **RLS = taala, policy = chaabi** (PR #65). Taala on hona kaafi nahi; policy tay karti hai kaun kya dekhe. Logs par koi chaabi nahi = sirf service role.
- **Anonymous user id = session.** Counter par token number milta hai, naam nahi. Wahi parchi ka malik hai (ADR-010).
- **Realtime RLS ko maanta hai.** Ghanti sirf apni parchi par bajti hai; test mein insert se 2 s ke andar.
- **Dev "clean" ka matlab har store.** Orders 0, events 0 — aur review ke baad anonymous users bhi 0 (test ab khud delete karta hai, 4bf41e1).
- **DB kaam karta hai, n8n patla counter hai** (PR #66). Order aur price ka sach SQL function mein; n8n atomic multi-table write nahi kar sakta (ADR-007/009).
- **MAIN / SUB pattern (B11) + callerPolicy.** Counter boy trigger sambhalta hai, helper ek kaam, sirf listed workflows helper ko bula sakte hain. Kill switch do baar (95.15).
- **CI laal = gate ka kaam.** 77-char commit subject Guard ne pakda (review ke baad 60 chars, green). Guard hum par bhi chalta hai; CI status PR body se pehle padho.
- **Tests green, par kuch deploy nahi.** Live webhook call (401/201/200/409/503) abhi nahi hui; asli proof pending.
- **Rule decides, adviser shown** (PR #67): dispatcher rule se bhejta hai; Jev ki raay diary mein dikhti hai, faisla nahi badalti.
- **Decision diary baad mein sikhane ke liye:** har decision ka ek row, dono raay + khaali "kya hua" line. Yahi label data banega (Laya, MVP 1).
- **Log jawab ke baad:** customer ko pehle jawab, phir register. Logging order ko slow nahi karti.
- **Cap ek brake hai:** 20 orders per session; race ka chhota gap khula.
- **Red first workflow code par bhi chala:** 15 tests pehle laal, phir code.

## Abhi bhi andhera (jawab nahi mila)
- Kaun `order_events` likhega: app, n8n, ya trigger? (Abhi koi nahi.)
- Cancel: A41 ke hisaab se nahi; owner confirm karega.
- Migration ledger: dobara chalane par "already exists". Prod par kaun, kab apply karega — checklist row nahi (F63).
- Do-device demo: session browser ke saath hai; kitchen doosre device par 0 orders dekhegi. Demo ek device + split view par (ADR-010).
- Prod par captcha chahiye ya nahi (F63). Abhi rate limit 30/hour/IP.
- Ops data (`decision_log`, `run_log`, `params`) phone tak kaise aayega: n8n se, ya read policy se?
- Error alert: `GS ERR 00 Alert` ban gaya (ddb12f1), deploy pending. Activation se pehle per-session cap (F66 c).
- Rate limit public webhook par (F65 d, ADR-009): kaun, kab?
- Config (kill switch, token) `params` se kab padhega; abhi hardcoded, badalne ke liye PUT (B13.1, #46).
- Prod: same build do baar deploy ya copy (F65 c)? Reviewer: do baar deploy. Owner ka faisla.
- Retry mein badla cart: key per cart (#48) ya 409?
- Riders phone se aate hain (A42). Pilot se pehle riders table / server state chahiye.
- Jev ka reply shape live test nahi hua (`usage.cost`, JSON reply stub). Row 76 pending deploy.
- `guard_failed` status (Jev busy rider chune): abhi `ok` + `agrees:false`; F68 a mein.
- Router / screens ka shape (aage ke chapters).
- Supabase aur auth kahan baithenge (ADR-009).
- Role-wise code-splitting ka plan.

## Abhi kya NAHI hai
- Phone ke liye write rules nahi (phone kabhi nahi likhta, ADR-009/010). Real logins: MVP 1. Self-hosted photos: #54. Indexes PK/unique ke alawa: screen stories ke saath.
- 6 workflows n8n par deploy/active nahi (owner: A42, OpenRouter credential F67, "push kar do"; activation alag yes). Live rows pending. MAIN 90 scorecard = #47. Riders table nahi (A42). Laya = MVP 1.
- Koi login, koi order, koi payment, koi kitchen/rider screen.
- Dev deploy job hai (PR #62, merged). Prod deploy workflow hai (PR #63, open), par `main` par `app/` abhi nahi hai. Release list fix ho gayi (4b77e65); pehli release PR ke baad app prod par aayega. `goserve-app.pages.dev` abhi 522 hai.
