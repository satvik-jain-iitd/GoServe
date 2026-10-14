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
| Q31 | Row 150 mein n8n login vault mein nahi hai, isliye canvas ka editor look nahi hua (B12.6). Owner six canvases khud dekhega, ya n8n login vault mein jaayega taaki agent dekhe? Activation se pehle yeh check chahiye. | PR #68 / docs/process-trace.md line 158 (Top-3) | nahi | abhi nahi | open |
