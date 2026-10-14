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

## PR #67 se

### Rule first, model second (shown, not trusted)
- **Kya hai:** Ek deterministic rule decide karta hai. AI (Jev) ka jawab saath mein likha jaata hai, par sirf salah ke roop mein.
- **Analogy:** Dispatcher house rule se rider bhejta hai. Salahkaar ka tip diary ke margin mein likh deta hai.
- **File:** `ops/n8n/order/code/decide_result.js` (lines 23–24: `decision` object, `chosen_pick` = rule pick).

### Decision record for later learning
- **Kya hai:** Ek row mein state, options, dono picks, status, settings version, place aur ek khaali `result` field. Result baad mein bharega.
- **Analogy:** Diary ka page jisme "kya hua" ki line abhi khaali hai.
- **File:** `ops/n8n/order/code/decide_result.js`; table `decision_log`.

### Confidence threshold (0.70) aur cost cap
- **Kya hai:** Jev ka jawab tabhi "usable" hai jab confidence 0.70 se upar ho aur cost cap (`$0.001`) ke andar ho. Warna raay rakhi jaati hai par mark hoti hai.
- **Analogy:** Salahkaar bola "pata nahi", ya uski fees zyada hain. Raay likhi, par bhejne ke kaam nahi aayi.
- **File:** `ops/n8n/order/code/decide_result.js` (line 5 THRESHOLD, line 19 statuses).

### Continue on error, sirf advice path par (B7 exception)
- **Kya hai:** Jev HTTP node error par bhi SUB ko aage chalne deta hai. Write nodes phir bhi fail-closed rehte hain.
- **Analogy:** Salahkaar late hai, dispatcher phir bhi rider bhejta hai. Register ka pen toota, to counter ruk jaata hai.
- **File:** `ops/n8n/order/build.js` (lines 101–104, `continueRegularOutput` on Ask Jev).

### Log after the answer
- **Kya hai:** MAIN pehle customer ko jawab bhejta hai (`Respond result`), phir `Log run` se SUB 14 ko log likhne bhejta hai. Logging customer ko slow nahi karti.
- **Analogy:** Pehle parcel customer ko, phir duty register mein line.
- **File:** `ops/n8n/order/build.js` (lines 196–198); `ops/n8n/order/code/log_run.js`.

### Per-session cap (429)
- **Kya hai:** Ek session ke 20 orders ke baad naya order 429 se ruk jaata hai. Retry (same key) chalta hai. Reset = nayi session (story #52).
- **Analogy:** Ek customer ka token limit. Counter kehta hai "bahut ho gaya". Purani parchi pe purana order mil jaata hai.
- **File:** `app/supabase/migrations/0004_session_order_cap.sql` (line 52); `shape.js` (429 mapping).

### Red first for workflow code
- **Kya hai:** Workflow code (n8n) ke tests pehle likhe gaye aur laal dekhe gaye, phir code aaya. 34 node tests mein se 15 pehle fail hue.
- **Analogy:** Alarm pehle test hua, phir dukaan khuli. Pata chalta hai alarm kaam karta hai ya nahi.
- **File:** `ops/n8n/order/decide.test.js` (line 1; PR body ke mutabik).

### Deploy refuses without its credential
- **Kya hai:** Deploy script pehle check karta hai ki zaroori credential (`GoServe OpenRouter`) hai ya nahi. Nahi hai to apply refuse karta hai, kuch nahi likhta.
- **Analogy:** Delivery van key ke bina nahi nikalti.
- **File:** `ops/n8n/order/deploy.js` (line 40 lookup, line 52 refuse).

## PR #68 se

### Deployed vs active
- **Kya hai:** Workflow n8n par ho sakta hai aur phir bhi sunta nahi. Deploy matlab saaman rakh diya. Active matlab shutter uthana.
- **Analogy:** Shutter band dhaba. Saaman andar hai, par shutter neeche hai.
- **File:** `docs/integrations/n8n-order-workflows.md` (registry, line 10).

### Read-back check
- **Kya hai:** Deploy ke baad workflow ko dobara GET karke compare karte hain. Sirf "PUT ho gaya" kaafi nahi.
- **Analogy:** Register ki entry dobara padhna, taaki pata chale jo likha wahi likha hai.
- **File:** `ops/n8n/order/deploy.js` (trace row 150).

### Two registers for one haan
- **Kya hai:** Ek faisla do jagah likha gaya, kyunki owner ne do chats mein haan kaha. Dono rows ek hi baat hain.
- **Analogy:** Do kamron mein ek hi baat, dono register mein likhi.
- **File:** `docs/process-trace.md` (rows 146, 149).

## PR #69 se" section jodo. Format waisa hi jo PR #68 mein hai.

## PR #69 se

### Offline copy with a guard
- **Kya hai:** Menu ki aakhri achhi copy phone mein rehti hai. Khaali ya kharab jawab copy ko kabhi nahi badalta.
- **Analogy:** Menu card ki photocopy jeb mein. Counter band ho to copy padh lo, par copy ko kisi ki galat parchi se phaadna nahi.
- **File:** `app/src/lib/menu.ts` (line 21).

### Server prices, client estimates
- **Kya hai:** Phone slip par sirf dish aur count likhta hai. Total phone dikhata hai (card se), par receipt ka total server deta hai.
- **Analogy:** Order slip par price nahi likhi. Price counter ka manager tay karta hai.
- **File:** `app/src/lib/cart.ts` (line 20); `app/src/screens/PlacedScreen.tsx` (line 9).

### Idempotency key per cart
- **Kya hai:** Same cart ka same key hai, to server ek hi order banata hai. Cart badle to naya key banta hai.
- **Analogy:** Slip number. Wahi slip do baar aaye to wahi receipt; badli slip ka naya number.
- **File:** `app/src/App.tsx` (lines 38–40).

### Fail fast for a fallback
- **Kya hai:** Retry band aur 4 s ka timeout, taaki saved copy seconds mein dikhe.
- **Analogy:** Band window par der tak mat khade raho, jeb mein copy hai.
- **File:** `app/src/lib/supabase.ts` (lines 15–20).

### Network answered by the test
- **Kya hai:** Playwright test Supabase aur n8n ka jawab khud deta hai. Isliye test wahi check karta hai jo phone bhejta hai.
- **Analogy:** Rehearsal ek stand-in counter ke saath.
- **File:** `app/tests/e2e/customer.spec.ts` (lines 18–39).

### Build-time public keys
- **Kya hai:** `VITE_*` values build ke time JS mein chhap jaati hain. Koi bhi unhe padh sakta hai. Isliye yeh public by design hain (ADR-009).
- **Analogy:** Counter ka address card par chhapa hai. Chhupaya nahi jaata, bas dev aur prod card alag hote hain.
- **File:** `.github/workflows/deploy-dev.yml` (lines 32–36).

### Anonymous session = visitor id
- **Kya hai:** Supabase phone ko ek anonymous id deta hai. Yahi id session hai, aur Supabase client use phone ki localStorage mein rakhta hai (ADR-010).
- **Analogy:** Darwaze par visitor ka token. Naam nahi, bas parchi ka malik pehchaan.
- **File:** `app/src/lib/supabase.ts` (lines 24–31).

## PR #70 se

### Read then listen, then read again
- **Kya hai:** Pehle list copy karo, phir live feed suno, aur subscription pakki hone ke baad ek baar phir copy karo. Beech ka gap band ho jaata hai.
- **Analogy:** Register copy karo, ghanti par khade ho, phir ek baar aur copy karo.
- **File:** `app/src/lib/live.ts` (line 20); `app/src/App.tsx` (line 55).

### Later stamp wins
- **Kya hai:** Ek hi order do baar aaye to server ka `updated_at` decide karta hai ki kaunsa copy jeetega. Phone ki ghadi nahi.
- **Analogy:** Slip par jo aakhri stamp hai, woh sach hai.
- **File:** `app/src/lib/kitchen.ts` (lines 24–28).

### Next-step table
- **Kya hai:** Ek chhota map: har status ke liye ek hi agla step. Aakhri kitchen step ke baad koi button nahi.
- **Analogy:** Board par lagi niyam ki card.
- **File:** `app/src/lib/kitchen.ts` (lines 10–15).

### Actor is self-declared
- **Kya hai:** Status call mein `actor: "kitchen"` phone bhejta hai. Server order, session aur step check karta hai, par yeh nahi ki kisne tap kiya.
- **Analogy:** Jiske paas stamp hai, woh cook ke naam se sign kar sakta hai.
- **File:** `app/src/lib/orders.ts` (line 51); `guard_status.js`.

### Stand-in socket
- **Kya hai:** E2E test Realtime server ka kaam khud karta hai (Phoenix v2 frames). Isliye live behaviour Supabase ke bina chalta hai.
- **Analogy:** Rehearsal mein director ghanti bajata hai.
- **File:** `app/tests/e2e/kitchen.spec.ts` (lines 45–60).

### Rehearsal leaves marks
- **Kya hai:** Integration test asli dev database par likhta hai. Jo rows likhi gayi, woh design se frozen hain aur mitti nahi.
- **Analogy:** Aisi slips jo phaadi nahi ja sakti.
- **File:** `app/tests/integration/kitchen.test.ts` (line 37).

### One booklet, two covers
- **Kya hai:** Customer aur kitchen dono ek app mein hain, role tabs se. Ek browser = ek session (ADR-010, A44).
- **Analogy:** Ek booklet, do cover: ek hi kitab, do taraf se padhi jaati hai.
- **File:** `app/src/App.tsx` (line 119).

## PR #71 se

### Event, not status
- **Kya hai:** Kuch baatein order ke saath note hoti hain, step nahi (jaise "rider raasta mein hai"). Inka alag write path aur alag rules hote hain: sirf ek baar, sirf sadak par.
- **Analogy:** Stamp aur margin note mein fark: stamp slip ki haalat badalta hai, note sirf bata deta hai.
- **File:** `app/supabase/migrations/0005_rider_event.sql` (lines 4–27).

### Row lock makes the once-check safe
- **Kya hai:** Order ki row par lock lagta hai, to do taps ek ke baad ek chalte hain. "Pehle se hai to mana karo" wala check race se nahi tootta.
- **Analogy:** Slip par ek waqt mein ek hi pen.
- **File:** `app/supabase/migrations/0005_rider_event.sql` (lines 13, 20).

### One hook, three rooms
- **Kya hai:** Live order list ek hi state hai, jo us screen ke liye chalu hoti hai jisko chahiye (kitchen, rider, customer placed step).
- **Analogy:** Ek board boy, jo kamra khula ho wahin sunta hai.
- **File:** `app/src/lib/useLiveOrders.ts` (line 13).

### Progress strip from a status list
- **Kya hai:** Ek ordered list se har box ka haal (done, current, todo) nikalta hai. List badli to strip apne aap badal jaati hai.
- **Analogy:** Chhe box ki strip, ek hi box roshan.
- **File:** `app/src/lib/kitchen.ts` (lines 41–45).

### Phone memory vs server truth
- **Kya hai:** Phone ek Set mein yaad rakhta hai ki Arriving tap ho gaya. Server ka "already done" hi asli sach hai.
- **Analogy:** Rider ki diary mein likha hai, par dhaba ka register hi pakka hai.
- **File:** `app/src/App.tsx` (line 50); F72 b.

### Moving the bar in the same PR
- **Kya hai:** Ek limit test (node cap 15) isi PR mein 20 kiya gaya. Rulebook mein yeh allowed hai, par zor se bolna chahiye.
- **Analogy:** Board par likha "15 darwaze" repaint karke "20" kar dena.
- **File:** `ops/n8n/order/order.test.js` (line 134).

### Gate clerk on names
- **Kya hai:** Commit subject ki lambai CI check karta hai. Code kitna bhi sahi ho, 72 se lamba naam fail hota hai.
- **Analogy:** Gate clerk badge ki length naapta hai.
- **File:** `scripts/guard.py` (line 48).


### Link as the key
- **Kya hai:** Session ka random uuid hi lock hai. Jiske paas link hai, woh us session ko padh aur reset kar sakta hai.
- **Analogy:** Hotel ki chaabi ki ek copy dost ko dena.
- **File:** ADR-011, `app/src/lib/session.ts`; PR #72.

### Security definer function in a read rule
- **Kya hai:** Ek function jo owner ke rights se chalta hai, taaki read rule woh table padh sake jo phone khud nahi padh sakta.
- **Analogy:** Doorman guest list dekhta hai, jo aap khud nahi dekh sakte.
- **File:** `app/supabase/migrations/0006_demo_sessions.sql` (line 13); PR #72.

### A door in a frozen table
- **Kya hai:** Order events freeze hain. DELETE ka trigger tabhi jaane deta hai jab ek transaction-local flag on ho, aur woh flag sirf reset ke andar on hota hai.
- **Analogy:** Housekeeping ki master key, jo sirf tab chalti hai jab housekeeping kamre mein ho.
- **File:** `app/supabase/migrations/0006_demo_sessions.sql` (line 44); PR #72.

### Unfilterable deletes
- **Kya hai:** Realtime DELETE ko column se filter nahi kar sakta. Sirf id jaati hai, aur har screen sunta hai.
- **Analogy:** Lobby mein shor: "room 12 saaf hua". Aapko tabhi fark padta hai jab aapke paas room 12 ki slip ho.
- **File:** `app/src/lib/live.ts` (line 22); PR #72.

### Gate before the live list
- **Kya hai:** `ready` flag live list ko tab tak rokta hai jab tak join khatam na ho. Isse galat room se subscribe nahi hota.
- **Analogy:** Board tab tak nahi lagta jab tak receptionist guest ka naam guest list se na mila le.
- **File:** `app/src/App.tsx` (line 37); PR #72.

### Dry run by default
- **Kya hai:** Cleanup script pehle sirf ginti karta hai. `--apply` ke bina kuch nahi hatata, aur dev ke alawa kisi project ko nahi chhuta.
- **Analogy:** Housekeeping pehle room ka list banati hai, phir master key kholti hai.
- **File:** `scripts/clear_dev.py`; PR #72.


## concepts.md delta (source PR #73)

### Advice vs decision in one row
- **Kya hai:** `rule_pick` chunav karta hai. `jev` sirf salah hai, jisme `agrees` aur `confidence` hote hain. Screen dono ko saaf likhti hai.
- **Analogy:** House rule porter chunta hai; concierge sirf salah deta hai.
- **File:** `app/src/lib/ops.ts` (line 30); PR #73.

### Ask once, even on failure
- **Kya hai:** `asked` set ek ref mein rehta hai. Refused call ke baad bhi order ko dobara nahi poochha jaata, to loop nahi banta.
- **Analogy:** Concierge ko ek baar ghanti bajao; line busy ho to dobara mat bajao.
- **File:** `app/src/lib/useOps.ts` (line 13); PR #73.

### Count without rows
- **Kya hai:** `count: "exact"` ke saath `limit 50` lagane par total header se aata hai, rows sirf 50 aati hain.
- **Analogy:** Ledger ka page count, pages nahi.
- **File:** `app/src/lib/ops.ts` (line 60); PR #73.

### Two clocks
- **Kya hai:** "Order to this screen" device ki clock se server ka `created_at` ghataata hai. Negative number 0 ban jaata hai (F75 b).
- **Analogy:** Slip par likha time vs desk ki wall clock.
- **File:** `app/src/lib/useLiveOrders.ts` (line 33); PR #73.

### Read rule added later
- **Kya hai:** Table pehle lock hota hai (koi policy nahi). Har story ek darwaza kholti hai. 0007 ne `decision_log` aur `run_log` ke liye do darwaze kholey.
- **Analogy:** Ledger back office se lobby mein aata hai, ek guest per room.
- **File:** `app/supabase/migrations/0007_ops_read.sql` (line 5); PR #73.

### Seen-then-gone
- **Kya hai:** Ref yaad rakhta hai ki tracked order list mein tha. Isse khali pehla load reset nahi samjha jaata.
- **Analogy:** Receipt desk: slip gayab hua to menu par wapas.
- **File:** `app/src/App.tsx` (line 45); PR #73.
