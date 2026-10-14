# Mental Model

System ka ek-page picture. Har chapter ke baad update karta hoon.

_Last updated: PR #77 merged (`d3d4cbe`); PRs #62–#77 merged; coder waits on the owner_

## GoServe — ab tak ki tasveer

```
[ GitHub repo ]
     |
     |--- site/          → investor site (letsdwelo.in, "goserve" Pages project)
     |--- design/        → tokens.json  (colours ka single source of truth)
     |--- docs/          → plan, decisions, follow-ups, test-cases, pr-reviews
     |--- scripts/       → guard.py  (repo rules ka checklist)         ← PR #59
     |                  clear_dev.py  (training hotel ki housekeeping, sirf dev, dry run default)  ← PR #72
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
                          ├─ src/App.tsx     (switchboard: menu → cart → bill → placed; place() yahin)  ← PR #69, role tabs + kitchen effect + tap() ← PR #70
                          ├─ src/lib/cart.ts     (order slip: dish id + count, cap 20)  ← PR #69
                          ├─ src/lib/menu.ts     (menu card ki photocopy, localStorage)  ← PR #69
                          ├─ src/lib/money.ts    (paise → ₹)  ← PR #69
                          ├─ src/lib/orders.ts   (window: slip bhejna, receipt lana)  ← PR #69
                          ├─ src/lib/supabase.ts (darwaza: menu rows + anonymous session)  ← PR #69
                          ├─ src/screens/        (4 pages: MenuScreen, CartScreen, BillScreen, PlacedScreen)  ← PR #69
                          ├─ src/lib/kitchen.ts  (board ke niyam: agla step, labels, later stamp jeetta)  ← PR #70
                          ├─ src/lib/live.ts     (board boy: register copy + ghanti)  ← PR #70
                          ├─ src/screens/KitchenScreen.tsx  (kitchen board: tickets, ek button per slip)  ← PR #70
                          ├─ tests/e2e/kitchen.spec.ts  (stand-in counter + stand-in ghanti)  ← PR #70
                          ├─ tests/integration/kitchen.test.ts  (rehearsal dhaba par, goserve-dev)  ← PR #70
                          ├─ src/lib/useLiveOrders.ts  (board boy: ek hook, teen kamre)  ← PR #71
                          ├─ src/lib/session.ts  (key card desk: kaunsa room, kaun sa link)  ← PR #72
                          ├─ src/lib/ops.ts, src/lib/useOps.ts  (phrase book + desk clerk: decision row → ek line, numbers)  ← PR #73
                          ├─ src/lib/health.ts  (teen checks: kitchen door, front desk line, concierge sawaal)  ← PR #74
                          ├─ src/lib/autopilot.ts  (drill card: agla desk, sample guest, metronome)  ← PR #75
                          ├─ src/screens/RiderScreen.tsx  (delivery desk: slips, teen stamp)  ← PR #71
                          ├─ src/screens/DemoBar.tsx  (front desk buttons: link copy, reset ka yes/no)  ← PR #72
                          ├─ src/screens/OpsScreen.tsx  (duty manager desk: AI salah vs rule, teen numbers)  ← PR #73
                          ├─ src/screens/HealthScreen.tsx  (/health: subah ka walk-through, teen batti)  ← PR #74
                          ├─ supabase/migrations/0005_rider_event.sql  (margin note counter: rider_event)  ← PR #71
                          ├─ supabase/migrations/0006_demo_sessions.sql  (guest list, doorman, invite, housekeeping)  ← PR #72
                          ├─ supabase/migrations/0007_ops_read.sql  (doorman: apni room ka advice + run ledger)  ← PR #73
                          ├─ tests/e2e/helpers.ts  (stand-in counter + ghanti, action ke hisaab se jawab)  ← PR #71
                          ├─ tests/e2e/rider.spec.ts  (rider: teen tap, tracker: paanch UPDATE)  ← PR #71
                          ├─ tests/e2e/split.spec.ts  (rehearsal: split, join, reset)  ← PR #72
                          ├─ tests/e2e/ops.spec.ts  (rehearsal: fake concierge, fake ledgers)  ← PR #73
                          ├─ tests/e2e/health.spec.ts  (rehearsal: all green, ek fail, galat token, Run again)  ← PR #74
                          ├─ tests/e2e/autopilot.spec.ts, tests/unit/autopilot.test.ts  (rehearsal: offline story, online chhe calls, fallback)  ← PR #75
                          ├─ ops/n8n/order: SUB 16 Health, code/health_prepare.js, code/health_result.js, health.test.js (concierge test, kuch likhta nahi)  ← PR #74
                          ├─ ops/n8n/order: MAIN 90 Daily scorecard + SUB 91 Scorecard numbers, code/score_window.js, score_summary.js, score_message.js, scorecard.test.js (raat ka auditor + ledger clerk, sirf padhta hai)  ← PR #76
                          ├─ ops/n8n/order: SUB 15 Add event, code/guard_event.js, event.test.js (margin note ki khidki)  ← PR #71
                          ├─ src/pwa-manifest.ts  (identity card, colours ← tokens.json)
                          ├─ src/styles/tokens.css + app.css (paint)
                          ├─ vite.config.ts  (assembly line + PWA)
                          ├─ tests/          (unit: cart, menu, orders = 19; e2e customer.spec.ts = 6, stand-in counter)  ← PR #69
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

_Status: 6 workflows n8n par deployed, sab inactive (ids registry mein; VERIFIED live, PR #68). Canvas look (B12.6) + activation yes pending; live rows uske baad._

## Flow (ek code change)
1. Dev commit → pre-commit hook (guard files + message).
2. Push → PR → CI chalta hai (site, app, guard jobs).
3. Sab green → merge → dev.
4. Merge to dev (`app/` badla ho) → deploy to Vercel dev (`deploy-dev.yml`, PR #62).
5. Release PR → `main` → deploy to Cloudflare Pages prod (`deploy-app.yml`, PR #63). Tiffin: van khana main tak laati hai, ab real customer ka address.
6. Browser → anonymous sign-in → session id → menu read → Realtime subscribe → n8n writes order (service role) → ghanti (PR #65).
6a. Phone → n8n gs-order (x-gs-token) → place_order (SUB 11: prices, caps, idempotent key) → receipt → Placed screen (PR #69; live row activation ke baad).
6b. Kitchen tab → fetchOrders + Realtime → merge by updated_at → tap → changeStatus → change_status (PR #70; live after activation).
6c. Rider tab → Pick up / Arriving (event, SUB 15 → `rider_event`) / Delivered → customer tracker lights six steps (PR #71; live after deploy + activation).
6d. Device B `/?join=<A>` kholta hai → `join_session(A)` guest list par naam likhta hai → B ab session A padhta hai. Reset (kisi bhi device se) → `reset_session(A)` → events, decisions, orders delete → sab khule screens DELETE sunte hain, sirf apni slips girate hain (PR #72; live two-device check after activation).
6e. Ops tab → Ready order bina decision row → ek `decide` call (teen demo riders) → SUB 13 → `decision_log` row → screen ek line ("AI suggests R2 (81%). The rule agrees.") + numbers (order to screen, decision ms, runs today) (PR #73; live after activation).
6f. Founder `/health` kholta hai → `main.tsx` HealthScreen chunta hai → Supabase ek menu row + ek `health` call → MAIN 01 → SUB 16 → Jev → teen batti OK/FAIL with ms (PR #74; SUB 16 deploy + activation pending).
6g. Autopilot tap → online: session ka newest open order har 2 s kitchen phir rider ke asli calls se aage, Delivered par ruk; offline (airplane mode): sample order local copy par "Offline demo" banner ke neeche; network fail par fallback (PR #75).
6h. Raat 21:00 (India): MAIN 90 raat ka auditor hai. Ledger clerk (SUB 91) aaj ke pages (run_log, decision_log) ginta hai, auditor tally ko slip mein likhta hai, aur Telegram se owner ke darwaze par bhejta hai. Clerk pen nahi chhoota, sirf padhta hai.
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
- **Deployed ≠ active** (PR #68): shutter band hai. Read-back check hua, par editor mein aankh se dekhna (B12.6) chhoot gaya kyunki coder ke paas n8n login nahi tha.

- **Menu ki photocopy:** achhi copy kabhi khaali jawab se nahi badalti. Offline demo isi par chalta hai (PR #69).
- **Slip par price nahi:** phone sirf dish aur count bhejta hai. Total counter (server) tay karta hai (PR #69).
- **Slip number:** same cart, same key, same order. Cart badla to naya number (PR #69).
- **Retry band, 4 s timeout:** fallback jaldi dikhta hai, par slow network par ek fail zyada (PR #69).
- **Test stand-in:** e2e Supabase aur n8n ki jagah khada hai. Yeh request ki shape pakadta hai, live counter nahi (PR #69).

- **Board boy do kaam karta hai:** pehle register copy, phir ghanti sunna, aur ghanti pakki hone ke baad ek baar aur copy (PR #70).
- **Stamp ka faisla server karta hai:** do copies mein later `updated_at` jeetta hai, phone ki ghadi nahi (PR #70).
- **Kitchen ka button ek hi hai:** agla step. Aakhri step ke baad slip waiting hai; rider (#50) use board se hatayega (PR #70).
- **Status ka sach do jagah:** kitchen labels aur customer tracker ke words alag ho sakte hain; #50 mein ek hi map (PR #70).
- **Demo token = kitchen ki chaabi:** `actor` phone ki baat hai; server order + session + step dekhta hai, tap karne wala nahi (PR #70).

- **Note aur stamp alag hain:** Arriving status nahi badalta, sirf ek margin note likhta hai (PR #71).
- **Ek ghanti, teen kamre:** ek hi live hook kitchen, rider aur customer ke beech chalta hai (PR #71).
- **Ek baar ka check DB ke lock se safe hai:** do taps ek saath aayein to doosra rukta hai (PR #71).
- **Limit bhi badalti hai:** node cap 15 → 20 isi PR mein; yeh chhupane ki cheez nahi (PR #71).
- **Commit ka naam bhi CI ka gate hai:** 73 akshar Guard ne roka, code sahi tha (PR #71).
- **Customer ko Arriving nahi dikhta:** rider ka tap sirf DB mein hai, demo ka fayda abhi saaf nahi (PR #71, A45).
- **Ek link = ek room ki chaabi:** jiske paas link hai, woh andar aata hai aur room saaf bhi kar sakta hai (PR #72, ADR-011).
- **RLS ek guest list hai:** security definer function woh list dekhta hai jo phone khud nahi dekh sakta (PR #72).
- **Reset sab screens tak shor karta hai:** har screen sirf apne slips girata hai, delete filter nahi hota (PR #72).
- **Cleanup default mein sirf ginti:** `--apply` par hi hatata hai, aur sirf dev par (PR #72, F71).
- **Salah aur faisla ek row mein:** rule chunta hai, Jev sirf salah deta hai; screen dono bolta hai (PR #73).
- **Ek baar poocho:** refused decide call loop nahi karta, par slip "Asking…" par atka rehta hai (PR #73, F75).
- **Numbers per demo hain:** "Runs today" sirf is session ka, system ka nahi (PR #73, ADR-012).
- **Taale baad mein khulte hain:** decision_log aur run_log ab apni session ke liye padhne layak (PR #73, 0007).
- **Health check ek asli sawaal hai:** ping nahi; n8n ki batti tabhi green jab token, kill switch aur workflow teeno paas (PR #74).
- **Jev ka fail hona ek result hai:** SUB 16 ka Jev node error par bhi aage badhta hai, red batti + reason (PR #74).
- **Jo raasta map par nahi, woh bhi lobby tak:** `/health` ke liye Vercel routes fallback; Cloudflare default (PR #74, F76 c).
- **Health runs `unknown` session mein:** run_log row cost ke saath, "Runs today (this demo)" mein nahi (PR #74).
- **Ek button, do mode:** asli calls (online) ya local copy (offline); demo ke waqt live list band (PR #75).
- **Ref = clipboard:** lamba timer har render par taaza state padhta hai, restart nahi (PR #75).
- **Loop kab ruke:** Delivered ya koi open order na bache; server refusal par abhi nahi rukta (PR #75, pending fix).
- **Pace build par fix:** stage 2 s, test 300 ms; chhe step = 12 s (PR #75, F77 c).
- Ek scheduled workflow ka "aaj" uski deewar ghadi (timezone setting) se tay hota hai, cron se nahi. (PR #76)
- Numbers hamesha jodi mein aate hain (runs aur errors, decisions aur agreed, cost aur per decision), taaki ek number akela achha na dikhe. (PR #76)
- Read-only clerk (SUB 91) likh nahi sakta, aur sirf auditor use bula sakta hai. Yeh design se hai. (PR #76)
- Din ki sheet ki seema hai: 21:00 ke baad ki rows aaj ke slip mein nahi aati (TOP-1, abhi khula). (PR #76)
- Ek message ko code aur wajah dono saath le jaane chahiye, warna owner ko sirf number milta hai aur kaaran nahi. (PR #77)
- Test wahan karo jahan user dekhta hai, aur cap wali read ko `order` chahiye, warna cut kaun si rows girega tay nahi hota. (PR #77)

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
- Activation nahi (owner ka "activate" chahiye, pehle canvas look). Live rows (5 calls + Jev + Jev-down) pending. MAIN 90 scorecard = #47. Riders table nahi (A42). Laya = MVP 1.
- Customer screen ab hai (menu, cart, bill, place order; PR #69, open, 5f2fa97). Asli order ki row activation ke baad aayegi.
- Kitchen (#49), rider + tracker (#50), split/join/reset (#52), ops (#51), health page (#54), autopilot (#53) merged; #75 ke do fix PR #76 mein aaye. Scorecard MAIN 90 + SUB 91 ab hai (#47, PR #76, approved, `76ed3bb`); PR #77 (approved) refusal ki wajah button ke neeche dikhata hai; 21:00 ke baad ki rows ka window gap pending (owner chune: rolling 24 h ya cron 23:55). SUB 16 + SUB 91 + MAIN 90 + MAIN 01 update deploy nahi (owner ka "push kar do"); activation nahi (owner ka "activate"; MAIN 90 = schedule): live rows aur #56 pending. Prod copy of scorecard nahi (F78 b). UptimeRobot #55 nahi; #42 prod deploy PR #63 mein ho chuka (Pages project F61 owner ka). Agla story slot abhi khaali hai, jab tak owner teen prod sawaal ka jawab nahi deta; #42 PR #63 mein ho chuka hai. Ek-decision-per-order rule nahi (F75 j), riders table nahi, Leave/QR nahi (F74), prod migrations 0006/0007 nahi (F63). Real payment nahi (MVP 2). Koi login nahi.
- Dev deploy job hai (PR #62, merged). Prod deploy workflow hai (PR #63, open), par `main` par `app/` abhi nahi hai. Release list fix ho gayi (4b77e65); pehli release PR ke baad app prod par aayega. `goserve-app.pages.dev` abhi 522 hai.
