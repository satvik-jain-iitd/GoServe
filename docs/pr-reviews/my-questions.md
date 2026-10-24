# My Questions

Apne sawaal yahan. Status: **open** (jawab nahi mila) / **answered** / **dropped**.

## PR #58 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q1 | `main.tsx` aur `App.tsx` mein farak kya hai? | PR #58 / main.tsx, App.tsx | haan | `main.tsx` = switchboard (app start). `App.tsx` = welcome board (andar ka UI). | answered |
| Q2 | Service worker kaam kya karta hai? | PR #58 / vite.config.ts | haan | Background helper — files cache + offline chalata hai. | answered |
| Q3 | Design token "single source of truth" kaise enforced? | PR #58 / tokens.test.ts | haan | `design/tokens.json` se colours aate hain + drift-guard test pakadta hai. | answered |
| Q4 | Ek PWA char roles — bundle bada nahi hoga? | PR #58 / App.tsx | nahi | F59/aage ke chapters — code-splitting ka plan. | open |
| Q5 | `autoUpdate` ke beech order reload ho jaye to? | PR #58 / vite.config.ts | nahi | Follow-up F59 (due before story #48). | open |
| Q6 | Supabase/auth kahan baithega? | PR #58 / (ADR-009) | nahi | ADR-009 chahiye. | open |
| Q7 | iOS install test kaise hoga jab Playwright na kar sake? | PR #58 / playwright.config.ts | haan | Manual test row F60 (owner iPhone par). | answered |
| Q8 | Kyun kuch jaan-boojh kar nahi banaya (router, screens)? | PR #58 / (scope) | haan | Ponytail rule — sirf zaroori code; screens apni stories mein. | answered |

## PR #59 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q9 | Pre-commit aur CI guard mein farak kya hai? | PR #59 / ci.yml | haan | pre-commit = local, commit se pehle; CI = remote, push ke baad. Dono `guard.py` chalate hain. | answered |
| Q10 | Secret regex saare secrets pakadta hai? | PR #59 / guard.py | haan | Nahi — ~80% by design. JWT pattern Supabase cover karta hai; Stripe `sk_live_` add hua. Naya format = ek regex + ek test. | answered |
| Q11 | Guard direct push par chalta hai? | PR #59 / ci.yml | haan | Nahi — files/msg steps sirf `pull_request` par. Intended: ruleset push block karta hai, isliye har change PR se aata hai. | answered |
| Q12 | Guard khud ko kaun check karta hai? | PR #59 / guard.py | haan | `test_guard_passes_on_itself` add hua — har `scripts/*.py` par guard chalata hai. (Par test delete hone par koi flag nahi — aadha band hua.) | answered |

## PR #62 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q13 | Dono tests YAML ka text padhte hain. Agar `.vercel/output` ka shape galat ho to kaunsa test laal hoga? Smoke check (URL 200) CI mein kab aayega? | PR #62 / scripts/test_deploy_dev.py | haan | Galat shape pehle real deploy par fail hoga, test mein nahi. URL-200 smoke check pehli real URL ke baad add hoga. | answered |
| Q14 | `vercel@latest` ki jagah major version pin karna behtar hai? | PR #62 / .github/workflows/deploy-dev.yml | haan | `vercel@64` pin ho gaya (0630677, line 47). Naya major ab jaan-boojh kar bump hoga; test pin check karta hai. | answered |
| Q15 | `paths` mein `design/tokens.json` kyun nahi, jabki app build use import karta hai? | PR #62 / .github/workflows/deploy-dev.yml | haan | Sahi tha. `pwa-manifest.ts` tokens.json import karta hai. 0630677 mein `design/tokens.json` paths mein add hua, test check karta hai. | answered |
| Q16 | Secrets job-level `env` mein hain; sirf Deploy step par rakhna safer nahi? | PR #62 / .github/workflows/deploy-dev.yml | haan | Haan. 0630677 mein teeno secrets sirf Deploy step par hain; `npm ci` inhe nahi dekhta. | answered |

## PR #63 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q17 | Release list (PLAN.md §2, CLAUDE.md rule 17) mein `app` aur `scripts` kyun nahi? Pehli release par deploy fail nahi hoga? | PR #63 / .github/workflows/deploy-app.yml | haan | Haan. `app` aur `scripts` dono release line mein hain (PLAN.md section 2, CLAUDE.md rule 17), 4b77e65 mein. Naya test inhe guard karta hai. | answered |
| Q18 | Pages project `goserve-app` exist nahi karta to CI fail karega ya auto-create karega? F61 kab karna hai? | PR #63 / .github/workflows/deploy-app.yml | haan | Non-interactive wrangler project nahi banata, fail karta hai. Owner F61 ke tahat project pehle banayega, isliye pehla run fail nahi hoga. | answered |
| Q19 | S1 negative check ka trailing space `goserve` ko kuch cases mein miss karta hai? Regex behtar hai? | PR #63 / scripts/test_deploy_app.py | haan | Achha pakda. 4b77e65 mein test `--project-name=goserve(?!-app)` check karta hai; line ke end wala case bhi nahi chhootega. | answered |

## PR #64 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q20 | Status list do jagah kyun hai (CHECK aur trigger ka `steps` array)? Dono drift kar sakte hain. Unknown status par trigger chup kyun? | PR #64 / app/supabase/migrations/0001_schema.sql | nahi | - | open |
| Q21 | CI mein schema test skip hota hai. Green CI schema ke baare mein kya kehta hai? Dev ke liye limited token kab, ya test-cases mein "local only" label? | PR #64 / scripts/test_schema.py | nahi | - | open |
| Q22 | Un-filtered `update orders` (bina `where`) sirf rollback ke bharose hai. Agar transaction na maane to dev ki orders badal jayengi. `where id` ek line hai, kab add karoge? | PR #64 / scripts/test_schema.py | nahi | - | open |

## PR #65 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q23 | Bina sign-in ke anon key se `orders` select 0 rows deta hai, error nahi. App "sign-in nahi hua" aur "koi order nahi" mein kaise farak karegi? | PR #65 / app/supabase/migrations/0002_rls_realtime_menu.sql | haan | Haan. #48 mein app pehle sign-in karegi aur session milne ke baad hi orders padhegi. Isliye "sign-in nahi hua" kabhi "koi order nahi" nahi dikhega. | answered |
| Q24 | Har test run 5 anonymous users banata hai aur delete nahi karta (dev par 21). `afterAll` mein delete karenge, ya Supabase ka cleanup? Kaunsa, kab? | PR #65 / app/tests/integration/supabase.test.ts | haan | 4bf41e1 mein test apne anonymous users `afterAll` mein delete karta hai. Dev par 21 purane purge hue, live count 0. | answered |
| Q25 | Do device par demo (customer ka phone, kitchen ka laptop) mein kitchen ko 0 orders dikhenge. Yeh #56 checklist mein hai, ya session code share karne ka raasta chahiye? | PR #65 / docs/decisions/ADR-010-session-id-is-the-anonymous-user-id.md | haan | Do device = do sessions, yeh real limit hai. Demo ek device + split view par hai; limit #56 checklist mein hai (F64 d). URL mein session code baad ka option hai. | answered |

## PR #66 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q26 | Activation se pehle error alert workflow chahiye (rulebook 84 / 95.14). #46 ke saath banayein, ya is PR ke follow-up mein? Recommendation kya hai? | PR #66 / ops/n8n/order/build.js | haan | `GS ERR 00 Alert` (Telegram owner ko) ddb12f1 mein bana. Teeno order workflows ise `errorWorkflow` set karte hain; abhi deploy nahi hua, `deploy.js` pehle daalega. | answered |
| Q27 | n8n tests code ke saath likhe gaye, red nahi dekhe. 3 mutations kahin likhe jaayein, aur SUB 13/14 par red-first wapas? | PR #66 / ops/n8n/order/test.js | haan | ddb12f1 mein 3 mutations `test.js` ke header mein likhe. SUB 13 aur 14 red-first se shuru honge. | answered |
| Q28 | `from test_schema import` sirf discover mein chalta hai. Run line ko `sys.path` se theek karein, ya Run line ko discover wali karein? | PR #66 / scripts/test_order_rpc.py | haan | ddb12f1 mein import se pehle `sys.path.insert` laga; Run line ab chalti hai (7 tests OK). | answered |

## PR #67 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q29 | Riders list phone se aata hai, to rule phone ke state par chalta hai. A42 mein trust-boundary line add karein? Pilot se pehle riders table ya server state chahiye? | PR #67 / ops/n8n/order/code/decide_guard.js line 15 (Top-3) | haan | A42 mein trust-boundary line jodi (d1b2f62): `free` flag aur distance phone ki baat hain, demo ke liye theek. Server state F68(e), pilot se pehle. | answered |
| Q30 | Jev busy rider ko 0.9 se chune to `jev_status: 'ok'`, `agrees: false` likha jaata hai. Training labels ke liye alag `guard_failed` status rakhein? | PR #67 / ops/n8n/order/code/decide_result.js line 19 (Top-3) | haan | Haan, alag `guard_failed` status F68(a) mein logged hai. Abhi woh `ok` + `agrees: false` hi likhta hai. | answered |

## PR #68 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q31 | Row 150 mein n8n login vault mein nahi hai, isliye canvas ka editor look nahi hua (B12.6). Owner six canvases khud dekhega, ya n8n login vault mein jaayega taaki agent dekhe? Activation se pehle yeh check chahiye. | PR #68 / docs/process-trace.md line 158 (Top-3) | haan | Owner editor mein 6 canvases dekhe ya n8n login vault mein; activation se pehle. | answered |

## PR #69 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q32 | Ek order bana, par jawab phone tak nahi aaya. Cart badal kar retry kare to naya key, doosra order. Pilot ke liye "reply lost" plan kya hoga: pehle apni session ke `orders` padhna, phir naya key? | PR #69 / app/src/App.tsx line 39 (Top-3) | nahi | _(PR #69 sync ke baad bharega)_ | open |
| Q33 | Ek phone ek session hamesha hai. 20 orders ke baad 429 jab tak site data clear na ho. Reset ka raasta (story #52) se pehle kya hai? | PR #69 / app/src/lib/supabase.ts line 28 (Top-3) | nahi | _(PR #69 sync ke baad bharega)_ | open |
| Q34 | `VITE_DEMO_TOKEN` build mein jaata hai, dev JS mein koi bhi padh sakta hai. A43 ya kisi assumption row mein yeh baat likhi hai? | PR #69 / .github/workflows/deploy-dev.yml line 36 (Top-3) | nahi | _(PR #69 sync ke baad bharega)_ | open |

## PR #70 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q35 | Kitchen tap demo token ke saath `actor: "kitchen"` bhejta hai. Server sirf order, session aur step dekhta hai. Matlab token wala koi bhi kitchen ban kar status badal sakta hai. A44 mein yeh line jodo, aur kitchen login MVP 1 mein? | PR #70 / app/src/App.tsx line 70 (Top-3) | nahi | _(PR #70 sync ke baad bharega)_ | open |
| Q36 | Har integration run goserve-dev par 2+ orders aur events chhod deta hai. Cleanup ke liye protection trigger off karna padega (F71). Alternative: test rows ko tag rakho aur story #52 mein dry-run wala `clear_dev.py`. Kaunsa? | PR #70 / app/tests/integration/kitchen.test.ts line 37 (Top-3) | nahi | _(PR #70 sync ke baad bharega)_ | open |
| Q37 | Kitchen = isi browser ka session. Customer phone aur kitchen tablet par demo nahi chalega. 18 Oct demo ek device split view hai ya do device? Agar do, to #52 ko #50 se pehle lena hoga. | PR #70 / app/src/App.tsx line 42 (Top-3) | nahi | _(PR #70 sync ke baad bharega)_ | open |

## PR #71 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q38 | Guard CI laal hai: commit `af59a6e` ka subject 73 characters hai (limit 72). Subject chhota karo aur force-push karo; yeh ek hi must-fix hai. | PR #71 / docs/process-trace.md line 162 (Top-3) | nahi | _(PR #71 sync ke baad bharega)_ | open |
| Q39 | Arriving tap customer ko nahi dikhta (A45). Demo mein iska fayda kya hai: sirf `order_events` row, tracker par ek line, ya ops screen (#51)? | PR #71 / app/src/lib/kitchen.ts line 36 (Top-3) | nahi | _(PR #71 sync ke baad bharega)_ | open |
| Q40 | Node cap 15 → 20 isi PR mein hua. Agla action 20 chhu lega: MAIN 01 split karein ya 20 par rukein? | PR #71 / ops/n8n/order/order.test.js line 134 (Top-3) | nahi | _(PR #71 sync ke baad bharega)_ | open |
| Q41 | Jiske paas join link hai, woh session reset bhi kar sakta hai. Pilot se pehle invite ek baar wala code hoga, ya sirf host reset karega? | PR #72 / app/supabase/migrations/0006_demo_sessions.sql line 34 (Top-3) | Resolved: no | Answer: pending | open |
| Q42 | Ek integration test joined device ke liye Realtime aur RLS ko prove karta hai (2 s). Woh dobara chala nahi. Activation ke baad live row ka execution id aur time kaun likhega? | PR #72 / app/tests/integration/supabase.test.ts line 120 (Top-3) | Resolved: no | Answer: pending | open |
| Q43 | Dusra device reset kare to customer ka Placed screen purana tracker kyon dikhata rehta hai? Kya `placed` state bhi clear honi chahiye? | PR #72 / app/src/App.tsx line 139 (Top-3) | Resolved: no | Answer: pending | open |
| Q44 | Decide call refuse ho to slip hamesha "Asking for a suggestion…" kyon dikhata hai, aur kya slip par reason nahi dikhna chahiye? Failed ids ka set rakhna hai ya F75 mein rehne dena hai? | PR #73 / app/src/screens/OpsScreen.tsx line 26 (Top-3) | Resolved: no | Answer: pending | open |
| Q45 | A47 ke teen hisse kaun se hain, aur owner ki haan kis par chahiye: ops tab, metrics ki definition, ya "charts nahi"? Kya A47 aur ADR-012 par owner se alag haan chahiye? | PR #73 / docs/assumptions.md line 57 (Top-3) | Resolved: no | Answer: pending | open |
| Q46 | Do device par Ready order ke liye do `decide` call ho sakte hain. 18 Oct par kitchen device Ops kholega? Agar haan, `unique (order_id)` DB rule abhi lagega ya F75 mein rahega? | PR #73 / app/src/lib/useOps.ts line 26 (Top-3) | Resolved: no | Answer: pending | open |
| Q47 | A48 ke teen hisse kaun se hain, aur owner ki haan kis par chahiye: link kholne par, har open ya "Run again" par, ya alerting par? Bina rate limit ke khule page ko kill switch ke siwa kya rokta hai? | PR #74 / docs/assumptions.md line 58 (Top-3) | Resolved: no | Answer: pending | open |
| Q48 | Health page par 404 ka note "workflow band hai" kab sach hai? Live row mein yeh ek baar dekha jayega, kill switch on karke aur inactive workflow par? | PR #74 / app/src/lib/health.ts line 39 (Top-3) | Resolved: no | Answer: pending | open |
| Q49 | Jev ka 3 second ka time out aaye to health par "jev_error" dikhega ya "jev_bad_reply"? Yeh live mein ek baar kaise dekhenge? | PR #74 / ops/n8n/order/build.js line 157 (Top-3) | Resolved: no | Answer: pending | open |
| Q50 | Server 503 ya 404 par loop har 2 s wahi call kyun bhejta hai, aur sirf network error par offline kyun jaata hai? Ek line ka fix is PR mein ho sakta hai? | PR #75 / app/src/App.tsx line 135 (Top-3) | Resolved: no | Answer: pending | open |
| Q51 | Demo mein Ops ka live data band kyun nahi hota, aur Ops tab khula ho to asli decide call kaise ja sakti hai? | PR #75 / app/src/App.tsx line 47 (Top-3) | Resolved: no | Answer: pending | open |
| Q52 | A49 mein online mode session ke har open order ko chalata hai, sirf sabse naye ko nahi: kya owner yeh chahta hai, ya doc mein kuch aur likhna chahiye? | PR #75 / docs/assumptions.md line 59 (Top-3) | Resolved: no | Answer: pending | open |
| Q53 | 21:00 ke baad ki rows kisi card mein nahi aati: owner `since = now − 24 h` (head "last 24 hours") chunega ya cron 23:55? | PR #76 / ops/n8n/order/code/score_window.js line 6 (Top-3) | Resolved: no | Answer: pending | open |
| Q54 | Runs ke saath Cost alag set par hai (health checks cost mein, runs mein nahi; fail hua decide run cost mein): cost non-health rows par hi ho, ya label "all calls incl. health"? | PR #76 / ops/n8n/order/code/score_summary.js line 18 (Top-3) | Resolved: no | Answer: pending | open |
| Q55 | A50 par owner ki haan ya na: ek plain Telegram message 21:00 India time par, pure system ki aaj ki rows, sirf numbers, sirf goserve-dev? | PR #76 / docs/assumptions.md line 60 (Top-3) | Resolved: no | Answer: pending | open |
| Q56 | Stage par refusal do jagah dikhe (DemoBar ka note aur kitchen, rider, ops ka screen error): theek hai, ya in teen tab par note chhupana chahiye? Owner ka call. | PR #77 / app/src/App.tsx line 138 (Top-3) | Resolved: no | Answer: pending | open |
| Q57 | `verify_live.js` mein "same" sirf naam, position, links dekhta hai; node `parameters` (Code source, URL, credential id) nahi. Kya agle PR mein `[n.name, n.type, n.parameters]` compare hoga? | PR #79 / ops/n8n/order/verify_live.js line 16 (Top-3) | Resolved: no | Answer: pending | open |
| Q58 | Rolling 24 h card: 21:00 se 21:00 tak. Manual "Execute workflow" beech mein chalaya to overlapping card banega. Head mein time likha hai, to kya yeh kaafi hai? | PR #79 / ops/n8n/order/code/score_window.js line 6 (Top-3) | Resolved: no | Answer: pending | open |
| Q59 | A50 par owner ki haan ya na: rolling 24 h, ek plain Telegram message 21:00 India time par, pure system ki rows, sirf numbers, sirf goserve-dev? | PR #79 / docs/assumptions.md line 60 (Top-3) | Resolved: no | Answer: pending | open |
| Q60 | Dry run sirf ref chhapta hai, naam nahi. Owner ka yes ek naam ke saamne ho: GET `/projects/{ref}` se naam lo, "GoServe" na mile to refuse. Galat vault line par doosra project bhi chal jaayega. | PR #80 / scripts/release_db.py line 44 (Top-3) | Resolved: no | Answer: pending | open |
| Q61 | Har file ek `/database/query` call hai, transaction nahi. File ke beech fail hua to prod aadha rehta hai (checklist: schema reset karke phir chalao). Yeh wahi raasta hai jo dev par `apply_migration.py` ne liya tha? Multi-statement file is endpoint se chali thi; live apply hi pakka karega. | PR #80 / scripts/release_db.py line 51 (Top-3) | Resolved: no | Answer: pending | open |
| Q62 | A51 ka order: Pages project, prod DB script, prod workflow copy, PROD secrets, release PR, check. Har prod write se pehle owner ka yes. Owner se: order theek, aur A51 par haan ya na? | PR #80 / docs/assumptions.md line 61 (Top-3) | Resolved: no | Answer: pending | open |
| Q63 | Pehle chat line par prompt bhejte the; asli call ne bataya Jev sirf decisions desk par sunta hai: `state` + typed `questions`, typed `answers` wapas, koi reason text nahi. Criteria mein sirf "Rider r1." likha hai; distance/trips state mein hain, to Jev state se padhta hai, criteria se nahi? Theek? | PR #81 / ops/n8n/order/code/decide_guard.js line 24 (Top-3) | Resolved: no | Answer: pending | open |
| Q64 | Pehle read-back par `back.active` = fail. Ab `wasActive` yaad rakhta hai: jo pehle se active tha, uspar PUT chal sakta hai. Yaani deploy ab live active workflow ko beech demo mein badal sakta hai: "push kar do" ka matlab ab "live par turant" hai. Owner ko yeh pata ho. | PR #81 / ops/n8n/order/deploy.js line 69 (Top-3) | Resolved: no | Answer: pending | open |
| Q65 | Activation: is n8n version mein MAIN tab tak publish nahi hota jab tak uske SUB publish na hon, to "activate" = dason, SUB pehle. Owner: A46–A50 "Confirmed 15 Oct" sahi? | PR #81 / docs/integrations/n8n-order-workflows.md line 109 (Top-3) | Resolved: no | Answer: pending | open |
| Q66 | `.cloudflare/cache/cloudflare-account.json` mein account id aur owner ka email kyun? Rule 15 ke hisaab se repo mein nahi; file hatao aur `.cloudflare/` ignore karo. | PR #82 / `.cloudflare/cache/cloudflare-account.json` line 3 (Top-3) | Resolved: no | Answer: pending | open |
| Q67 | Naam ka check substring hai ("goserve" ho, "dev" na ho): "GoServe staging" bhi pass karega. Aaj do project hain; kya exact naam chahiye? | PR #82 / `scripts/release_db.py` line 49 (Top-3) | Resolved: no | Answer: pending | open |
| Q68 | Prod par `place_order` 404 kyun, 403 nahi? Function anon ko grant nahi, to PostgREST 404 deta hai: sahi padha? | PR #82 / `docs/tests/test-cases.md` line 130 (Top-3) | Resolved: no | Answer: pending | open |
| Q69 | A52: chaar app ek origin par, Android par ek session share, iPhone par alag storage (join link). Owner ki haan ya na, aur ADR-013 merge se accept. | PR #84 / docs/assumptions.md line 62 (Top-3) | Resolved: no | Answer: pending | open |
| Q70 | Manifest page load ke baad badalta hai. Phone par kitchen app ko console wali identity mili to fallback kya hoga (har app ka apna HTML entry)? Abhi theek, #56 mein check. | PR #84 / app/src/main.tsx line 14 (Top-3) | Resolved: no | Answer: pending | open |
| Q71 | Address se app chunne ka niyam (exact, lower-case). `/`, `/health`, `/kitchenette`, `/Kitchen/` par console. Kya yahi "one device" ka raaz hai? | PR #84 / app/src/lib/roles.ts line 7 (Top-3) | Resolved: no | Answer: pending | open |
| Q72 | ENVS table: dev aur prod ki har alag cheez ek jagah (URL var, credential naam, token var, naam ka mark). `orderFor('prod')` nau (alert nahi), ERR 00 shared aur dev se pehle hona chahiye. Reviewer ne dry run chalaya: nau "update", kuch active nahi; verify_live prod: nau parameters=same, inactive. Yaani jo commit hai wahi prod par hai, covers ke saath. | PR #85 / ops/n8n/order/deploy.js line 17 (Top-3) | Resolved: no | Answer: pending | open |
| Q73 | Sirf alert share hota hai (ek bot, ek chat; message mein naam "... PROD"). Baaki sab alag: path `gs-order-prod`, apna webhookId, prod credential, prod token. Owner: ek bell dono buildings ke liye theek hai (F82 c)? Aur MAIN 90 PROD activate karoge to roz do card aayenge (F84 b): prod card chahiye ya nahi? | PR #85 / ops/n8n/order/build.js line 312 (Top-3) | Resolved: no | Answer: pending | open |
| Q74 | Step 3 done: credential `GoServe Supabase prod` + nau PROD workflows inactive (tumhara "haan"). Ab baaki: step 4 PROD secrets (tumhara yes; `PROD_VITE_ORDER_URL` = prod webhook), step 5 release PR, step 6 check, aur prod "activate" pehle prod order se pehle. 18 Oct ka demo dev par hai, to prod activate release ke paas hi karna. | PR #85 / docs/release-checklist.md line 21 (Top-3) | Resolved: no | Answer: pending | open |
| Q75 | Cache file wapas aayi (account id + email). Branch #82 ke `.gitignore` se pehle kati gayi, `git add -A` ne phir utha li (hotel: wahi badge lobby mez par). Guard ne pakdi, CI red. Fix: `git rm --cached` + dev par rebase + push; local file bhi hatao ya ignored rakho. | PR #86 / `.cloudflare/cache/cloudflare-account.json` line 3 (Top-3) | Resolved: no | Answer: pending | open |
| Q76 | `BLOCKED_PATH` (hotel: doorman badge ko shape se rokta hai): `.cloudflare/`, `.wrangler/`, `.env`, `.env.*` (`.env.example` chhod kar), size aur secret scan se pehle. Cache file mein token nahi, to content scan use pass karta; path hi pehchan hai. Kya yeh rule sahi jagah par hai? | PR #86 / `scripts/guard.py` line 19 (Top-3) | Resolved: no | Answer: pending | open |
| Q77 | forgetMe `localStorage.clear()` sab mitata hai: theme pin aur offline feedback queue bhi (FeedbackSheet usi localStorage se flush karta hai). Phone offline tha aur ek feedback pending tha, to woh chala jayega. Theek hai, ya pehle flush, phir wipe? | PR #220 / `app/src/App.tsx` line 411 (Top-3) | Resolved: no | Answer: pending | open |
| Q78 | Har slip par current area ka kitchenName dikhta hai (F142.6). Customer area badle to purani slips galat kitchen dikhayengi. Pilot ek kitchen hai to abhi theek; order row mein kitchen naam kab aayega, aur tab tak yeh line hatana safe nahi? | PR #220 / `app/src/screens/OrdersScreen.tsx` line 38 (Top-3) | Resolved: no | Answer: pending | open |
| Q79 | Rule 5: red test pehle, failure PR mein paste. PR body mein red paste nahi hai, sirf "9 tests". Pehla red run kahan hai? Agla PR body mein paste karo. | PR #220 / `app/tests/e2e/account.spec.ts` line 1 (Top-3) | Resolved: no | Answer: pending | open |
