# Concepts

Har naya technical word yahan. Simple Hindi mein. Ek line ka "yeh kya hai", ek line ka analogy.

## PR #58 se

### PWA (Progressive Web App)
- **Kya hai:** Ek website jo phone par app ki tarah install ho jaati hai (home screen icon, full screen, offline).
- **Analogy:** Ek dukaan ka shutter — wahi dukaan, par ghar par bhi khul jaaye.
- **Kyun matter karta hai:** Customer ko app store ki zarurat nahi; ek codebase sabke liye (ADR-006).

### Service Worker
- **Kya hai:** Background mein chalne wala script jo files cache karta hai aur offline chalata hai.
- **Analogy:** Dukaan ka night guard — jab dukaan band ho, tab bhi kaam chalta rahe.
- **Kyun matter karta hai:** Offline first. `autoUpdate` isi se juda risk deta hai (F59).

### Web App Manifest
- **Kya hai:** Ek JSON file jo app ki identity batati hai — naam, icon, colour, launch style.
- **Analogy:** Dukaan ka hoarding spec sheet.
- **File:** `app/src/pwa-manifest.ts` → build par `manifest.webmanifest`.

### Design Token
- **Kya hai:** Colour/spacing/type ki ek central value (jaise deepGreen ka hex), jise code poore project mein use karta hai.
- **Analogy:** Approved paint catalogue — sab rooms ek hi catalogue se rangeen.
- **Kyun matter karta hai:** Rebranding ek jagah se ho jaati hai. Drift tab hota hai jab CSS aur JSON alag ho jaayein — isliye drift-guard test.

### Build / Bundler (Vite)
- **Kya hai:** Tool jo aapke chhote code files ko pack karke browser-ready bundle banata hai.
- **Analogy:** Factory ki assembly line — kachcha maal andar, ready product bahar.

### Unit test vs E2E test
- **Unit test:** Ek chhote hisse ka scale (jaise "yeh colour tokens mein hai?"). Fast, yahan Vitest.
- **E2E test:** Mystery shopper jaisa — poora flow real browser mein (app khulti hai? offline chalti hai?). Yahan Playwright.

### React component / Entry point
- **Component:** UI ka ek tukda (jaise `App` = welcome board).
- **Entry point:** Wo file jo app ko chalu karti hai (`main.tsx` = switchboard; `index.html` = main door).

### Lockfile (`package-lock.json`)
- **Kya hai:** Exact record — kaunsi dependency kis exact version aur hash par.
- **Analogy:** Material ka pakka receipt. `npm ci` isi receipt se sab dobara laata hai (reproducible build).

## PR #59 se

### CI (Continuous Integration)
- **Kya hai:** Har code change par automatic checks chalna (lint, test, build) — GitHub Actions par.
- **Analogy:** Har delivery se pehle factory ka final quality gate.
- **File:** `.github/workflows/ci.yml`.

### Pre-commit hook
- **Kya hai:** Commit hone se **pehle** chalne wala local check. Fail = commit ruk gaya.
- **Analogy:** Ghar se nikalne se pehle jeb ka check.
- **File:** `.pre-commit-config.yaml` (chalata hai `guard.py` + `check_msg_file.py`).

### Conventional Commits
- **Kya hai:** Commit message ka fixed format — `type(scope): text` (jaise `feat(app): add cart`).
- **Analogy:** Parcel par standard shipping label.
- **File:** `COMMIT_GUIDELINES.md` + `guard.py` ka `MESSAGE` regex.

### Guard (rules-as-code)
- **Kya hai:** Repo ke rules (secret, size, markers, message) ek script mein likhna.
- **Analogy:** Inspector ka printed checklist — yaad rakhna nahi, padh lena.
- **File:** `scripts/guard.py`.

### PR size limit
- **Kya hai:** Ek PR mein max 50 files.
- **Analogy:** Ek baar mein ek truck se zyada maal nahi.
- **File:** `guard.py` ka `check_count`.

## PR #62 se

### Path filter (`paths:`)
- **Kya hai:** Workflow sirf tab chalta hai jab push mein listed folder ya file badli ho.
- **Analogy:** Rule board par likha hai "sirf kitchen ke order, counter (site/) ke nahi".
- **File:** `.github/workflows/deploy-dev.yml` lines 6–8.

### Concurrency group + cancel-in-progress
- **Kya hai:** Ek group mein ek samay par ek hi run. Naya run chalu ho to purana cancel ho sakta hai.
- **Analogy:** Ek hi delivery boy; naya order purane ko replace karta hai.
- **File:** `.github/workflows/deploy-dev.yml` lines 12–14.

### workflow_dispatch
- **Kya hai:** GitHub Actions tab mein manual "Run workflow" button.
- **Analogy:** Manager haath se dispatch bulaye.
- **File:** `.github/workflows/deploy-dev.yml` line 9.

### Prebuilt output (`.vercel/output`, Build Output API)
- **Kya hai:** Ek fixed folder shape (`static/` + `config.json`) jise Vercel bina dobara build kiye serve karta hai.
- **Analogy:** Vercel ka standard dabba. Packing hamari, delivery unki.
- **File:** `.github/workflows/deploy-dev.yml` lines 40–47.

### Repo secrets as env
- **Kya hai:** `secrets.X` ko job ya step ke `env` mein daalna, taaki CLI padh sake. Values log mein nahi dikhti.
- **Analogy:** Delivery boy ka ID card jeb mein, parchi par nahi likha.
- **File:** `.github/workflows/deploy-dev.yml` lines 20–23.

### Testing config as text
- **Kya hai:** Test YAML ko ek string ki tarah padhta hai aur phrases regex se check karta hai. Yeh board ka sahi hona check karta hai, delivery ka nahi.
- **Analogy:** Inspector board padhta hai, khana nahi chakhta.
- **File:** `scripts/test_deploy_dev.py`.

## PR #63 se

### Cloudflare Pages Direct Upload (`pages deploy`)
- **Kya hai:** CI app ko build karta hai, phir ek folder upload karta hai. Pages use seedha serve karta hai. Cloudflare ki taraf koi Git link nahi hai.
- **Analogy:** Hum khud pack karke delivery boy ko dete hain. Woh sirf pahunchata hai.
- **File:** `.github/workflows/deploy-app.yml` lines 38–44.

### `--branch=main` = production deployment
- **Kya hai:** Pages mein production branch ke deploy live maane jaate hain. Doosri branch ke naam preview ban jaate hain.
- **Analogy:** Label par "real customer" likha hai, "sample" nahi.
- **File:** `.github/workflows/deploy-app.yml` line 44.

### Release branch as a packing list
- **Kya hai:** `main` par sirf listed paths dev se aate hain (`docs/PLAN.md` §2). Jo list mein nahi, woh kabhi `main` tak nahi pahunchta.
- **Analogy:** Van ki packing list. Jo list mein nahi, woh van mein nahi.
- **File:** `docs/PLAN.md` §2 (is PR ke diff mein nahi, par is PR ka must-fix hai).

### Mirror workflow
- **Kya hai:** Ek kaam karne wala workflow copy karke sirf address aur folder badalna. Sasta aur safe, par do boards alag ho sakte hain.
- **Analogy:** Do shops ka ek hi rule board. Ek badla, doosra purana reh gaya.
- **File:** `.github/workflows/deploy-app.yml` vs `.github/workflows/deploy.yml`.

### Negative test (neighbour guard)
- **Kya hai:** Ek test jo woh file padhta hai jo is PR ne nahi badli, taaki proof ho ki woh same hai.
- **Analogy:** Inspector showroom ka board bhi check karta hai.
- **File:** `scripts/test_deploy_app.py` lines 23–27.

## PR #64 se

### Migration
- **Kya hai:** Ek SQL file jo database ki shape badalti hai. Numbered hai, taaki ek ke baad ek chale.
- **Analogy:** Register ke naye page ka print.
- **File:** `app/supabase/migrations/0001_schema.sql`

### Trigger
- **Kya hai:** Woh code jo database khud chalata hai, jab koi row badalti hai. App ko yaad nahi rakhna padta.
- **Analogy:** Head waiter jo har entry se pehle check karta hai.
- **File:** `0001_schema.sql` lines 74–96 (`orders_status_rule`, `order_events_no_change`).

### CHECK constraint
- **Kya hai:** Column mein allowed values ki list. Bahar ki value aaye to database insert hi nahi karta.
- **Analogy:** Rate card par sirf allowed status likhe hain.
- **File:** `0001_schema.sql` lines 24–25.

### Unique key as idempotency
- **Kya hai:** Ek key (session + client order key) par unique rule. Same key dobara aaye to nayi row nahi banti. Retry safe ho jaata hai.
- **Analogy:** Token number. Same token = same order.
- **File:** `0001_schema.sql` line 31.

### Append-only table
- **Kya hai:** Table mein row add ho sakti hai, par edit ya delete nahi. Database trigger yeh rokta hai.
- **Analogy:** Carbon copy. Likha gaya, to likha gaya.
- **File:** `0001_schema.sql` lines 89–96 (`order_events_frozen`).

### Row Level Security (RLS), off today
- **Kya hai:** Database rule jo tay karta hai kaunsi row kaunsi key dekh ya badal sakti hai. Abhi off hai. Off ho to anon key se sab dikhta hai.
- **Analogy:** Register bina taale ke. Koi bhi pages khol le.
- **File:** Is PR mein nahi. Story #44 mein aayega.

### Integration test with rollback
- **Kya hai:** Test jo asli database se baat karta hai, phir apne sab writes undo kar deta hai. Database par koi nishaan nahi bachta.
- **Analogy:** Auditor ki pencil entry. Check ke baad rubber se mita di.
- **File:** `scripts/test_schema.py`.

### Management API token
- **Kya hai:** Ek token jo Supabase account par kuch bhi kar sakta hai (project banana, mitana). Yahan sirf SQL chalane ke liye use hota hai.
- **Analogy:** Master chaabi. Ek hi chaabi sab kholti hai, isliye sambhal ke rakho.
- **File:** `scripts/apply_migration.py` line 10.

## PR #65 se

### Row Level Security (RLS)
- **Kya hai:** Database ka taala. Har row par check hota hai: kaun si row kaun dekh ya badal sakta hai. Policies batati hain kaun si chaabi kaun si row kholti hai.
- **Analogy:** Dhaba ke register par taala har page par. Chaabi = policy.
- **File:** `app/supabase/migrations/0002_rls_realtime_menu.sql` lines 6–18.

### Policy roles (anon vs authenticated)
- **Kya hai:** `anon` = public key wala koi bhi, bina login. `authenticated` = koi bhi logged-in user, anonymous sign-in wale bhi.
- **Analogy:** Raahgir vs token-wala customer. Raahgir sirf rate card padh sakta hai; token-wala apni parchi.
- **File:** `0002_rls_realtime_menu.sql` lines 15–18.

### Anonymous sign-in
- **Kya hai:** Bina naam ka login. Supabase ek user id deta hai, aur wahi session id ban jaata hai (ADR-010).
- **Analogy:** Counter par token number.
- **File:** `app/tests/integration/supabase.test.ts` lines 16–21.

### Deny by default
- **Kya hai:** RLS on hai aur koi policy nahi, to koi nahi padh sakta (service role ke alawa).
- **Analogy:** Page taale mein, aur chaabi kati hi nahi.
- **File:** `0002_rls_realtime_menu.sql` line 19.

### Service role
- **Kya hai:** Server wali chaabi jo RLS ko bypass karti hai. Browser mein kabhi nahi, CI mein kabhi nahi.
- **Analogy:** Manager ka pen.
- **File:** `app/tests/integration/supabase.test.ts` line 8.

### Realtime publication
- **Kya hai:** Woh tables jinke changes Postgres broadcast karta hai. Supabase unhe subscribed clients tak pahunchata hai, RLS ke saath.
- **Analogy:** Ghanti jo sirf tumhari parchi par bajti hai.
- **File:** `0002_rls_realtime_menu.sql` line 21.

### Hot-linking with credit
- **Kya hai:** Photo kisi aur ke server se load hoti hai. CC licence mein credit dikhana zaroori hai.
- **Analogy:** Udhaar ki tasveer, naam ke saath.
- **File:** `0002_rls_realtime_menu.sql` lines 25–35.

### ADR (Architecture Decision Record)
- **Kya hai:** Ek chhota record: faisla, rejected options, aur nateeje.
- **Analogy:** Dhaba ka faisla register.
- **File:** `docs/decisions/ADR-010-session-id-is-the-anonymous-user-id.md`.

## PR #66 se

### RPC (remote procedure call) through PostgREST
- **Kya hai:** `POST /rest/v1/rpc/<function>` se database ka function chalta hai. n8n seedha SQL nahi likhta, function ko bulata hai.
- **Analogy:** Counter boy manager se ek sawaal poochta hai, aur manager hi register likhta hai.
- **File:** `ops/n8n/order/build.js` line 41 (HTTP Request node).

### Transactional function
- **Kya hai:** Ek function ke andar sab likhna ek saath chalta hai. Koi ek step fail ho to sab undo ho jaata hai.
- **Analogy:** Register aur carbon copy ek hi haath se, ek hi baar mein.
- **File:** `app/supabase/migrations/0003_order_functions.sql` lines 5–59.

### MAIN / SUB workflows (B11)
- **Kya hai:** MAIN workflow trigger aur routing sambhalta hai. Har SUB ek hi kaam karta hai aur MAIN use id se bulata hai.
- **Analogy:** Counter boy aur do helpers. Counter boy sawaal sunta hai, helper kaam karta hai.
- **File:** `ops/n8n/order/build.js` (MAIN nodes lines 89–112, `callSub` lines 80–84).

### Execute Workflow Trigger with defined inputs
- **Kya hai:** SUB apne fields pehle se declare karta hai. n8n check karta hai ki sahi fields aayi hain ya nahi.
- **Analogy:** Helper ka printed slip format: khaane ke blank khaane bharne hi hain.
- **File:** `ops/n8n/order/build.js` line 36.

### callerPolicy
- **Kya hai:** Sirf listed workflows hi is SUB ko bula sakte hain. Baaki sab ke calls n8n rok deta hai.
- **Analogy:** Sirf counter boy helpers ko bula sakta hai. Customer seedha helper ko nahi bula sakta.
- **File:** `ops/n8n/order/build.js` line 59 (`workflowsFromAList`, `callerIds`).

### Kill switch checked twice (rulebook 95.15)
- **Kya hai:** "Orders band hain" ka check MAIN mein bhi hai aur har write SUB mein bhi. Ek jagah bypass ho to doosri jagah rok leta hai.
- **Analogy:** "Orders paused" board counter par bhi, aur kitchen ke darwaze par bhi.
- **File:** `ops/n8n/order/build.js` line 97 (MAIN), `ops/n8n/order/code/guard_place.js` and `guard_status.js` (SUB).

### neverError + fullResponse
- **Kya hai:** HTTP node error phenkne ki jagah status code aur body deta hai. Isse SUB khud decide karta hai ki jawab kaisa jaaye.
- **Analogy:** Helper jawab padh kar apna reply card likhta hai, bina chillaye.
- **File:** `ops/n8n/order/build.js` line 43; mapping in `ops/n8n/order/code/shape.js`.

### Mutation check
- **Kya hai:** Code ko jaan-boojh kar todna (jaise 409 ko 200 karna) aur dekhna ki test laal hota hai. Ye proof hai ki test asli cheez pakadta hai.
- **Analogy:** Alarm test karne ke liye darwaza khol kar dekhna ki bell bajti hai.
- **File:** `docs/LEARNINGS.md` line 74; PR #66 body.

### Sticky-note layout as code (B12)
- **Kya hai:** Workflow ke boxes aur positions code se bante hain, haath se nahi. Tests geometry check karte hain (overlap, gap, left-to-right).
- **Analogy:** Kitchen ki deewar par chart, chhapa hua. Koi haath se nahi khinchta.
- **File:** `ops/n8n/lib/layout.js` and `ops/n8n/lib/layout_checks.js`.

### Commit subject limit (72)
- **Kya hai:** Commit ki pehli line 72 characters se lambi ho to Guard CI use fail karta hai. Merge se pehle CI green chahiye.
- **Analogy:** Register ki column ki chaudai. Lamba header column se bahar jaata hai.
- **File:** `.github/workflows/ci.yml` (Guard job); commit `53dbce7` (77 chars).
