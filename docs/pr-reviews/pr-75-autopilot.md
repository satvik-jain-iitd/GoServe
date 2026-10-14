# PR #75 — feat(app): autopilot with an offline demo story

- **Branch:** `feat/53-autopilot` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #53 "Autopilot that works in airplane mode" (epic #37)
- **Status:** MERGED into dev `35f78cd` on 14 Oct 2026 15:10Z (APPROVE review 5520018160, head `d8e1ce8`, CI green); 20 threads answered and resolved [VERIFIED]
- **Files:** 15 · **Lines:** +288 / -12 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5520018160 (APPROVE), 20 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/75

> Ek hotel ka "drill" switch: raat ka manager ek guest ki poori stay khud chala deta hai. Yeh PR wahi switch banati hai. Phone line na ho to switch cardboard guest ka rehearsal chalata hai.

---

## Overall review

## 1. Ek-line logline
> `Autopilot PR: ek button do tarah se chalta hai. Internet ho to session ka naya order kitchen aur rider ke asli desks se 2 s par guzarta hai. Airplane mode ho to ek sample order local par chalta hai, "Offline demo" ke banner ke saath.`

## 2. Big Picture (Story & Goal)
- Story #53 "Autopilot that works in airplane mode", epic #37 (safety net, §3). [VERIFIED brief]
- S1 (offline): `navigator.onLine` false par local sample order Placed se Delivered tak har 2 s chalta hai. Customer, kitchen, rider aur ops screens sab follow karte hain. Kuch server tak nahi jaata. [VERIFIED brief]
- S2 (online): session ka sabse naya open order kitchen phir rider ke asli calls se aage badhta hai, aur Delivered par ruk jaata hai. Koi order na ho to "Place an order first." dikhta hai. [VERIFIED brief]
- Kis ke liye: founder, jo demo chalata hai. Hotel mein yeh woh manager hai jo guest ke aane se pehle drill karta hai. [VERIFIED brief]
- Missing: story ke Gherkin se kuch nahi chhoota. Android airplane-mode check #56 mein hai (F77 a). [VERIFIED brief]

## 3. Yeh ab aaya kyun? (Context)
- Pichla PR #74 merge ho chuka hai (`fd6dfdc`). Uske 20 threads answered aur resolved hain. [VERIFIED brief]
- Iske bina, internet ya server band hone par stage ka demo ruk jaata. Hotel mein jaise phone line band ho to drill nahi hoti. [INFERRED]
- Coder ka docs commit `14659a5` F76 e–f aur run_log ke `unknown` note jodta hai. Notebook chapter 15 is PR mein nahi hai. Woh "notebook filed" ke baad aayega. [VERIFIED brief]

## 4. Real-Life Analogy
Hotel ka drill. Manager ek guest ki stay khud chala kar dikhata hai.

1. `DemoBar` Autopilot button = front desk ka switch: "drill chalao".
2. `toggleAuto` = switch dabne par manager tay karta hai: phone line hai to asli drill, nahi to cardboard guest.
3. `startOffline` = cardboard guest ko laana: sample slip har board par lagana, aur receipt desk kholna.
4. `tick` (online) = manager asli slip ko har desk par le jaata hai: pehle kitchen, phir rider, har 2 s par.
5. `nextAutoAction` = drill card: slip ki stamp dekh kar batata hai agla desk kaun sa hai.
6. `latest` ref = manager ka clipboard: hamesha aaj ke boards, photocopy nahi.
7. `act` demo mein = sirf local copy par stamp. Koi bahar ka message nahi jaata.
8. `AUTOPILOT_MS` = metronome: stage par 2 s, rehearsal (test) mein 300 ms.
9. OpsScreen "Sample numbers" = sticker: "yeh board rehearsal ke numbers dikhata hai".

## 5. Is PR mein naye Concepts (6)
Poori list `concepts.delta.md` mein hai: Two modes behind one button · A ref as a clipboard · Return the error code, not just show it · Next-step table · Build-time knob for pace · Two doors for offline detection. [VERIFIED brief]

## 6. High-Level Flow
Journey: drill card ek guest ki slip ko desks se guzaarta hai. Offline mein slip cardboard ki hoti hai.

1. Tap Autopilot → `toggleAuto`: already on hai to stop (demo bhi band, sample order saaf). `navigator.onLine` false hai to `startOffline`. Warna `setAuto(true)`. [VERIFIED brief]
2. Online loop: 2 s baad `tick` clipboard padhta hai. List load ho rahi ho to wait. Newest open order mile to `nextAutoAction`, phir `act`, phir asli `changeStatus` / `addEvent` MAIN 01 se. Saved copy merge hoti hai, 2 s wait, phir repeat. Delivered par stop. Koi order na ho to "Place an order first.". [VERIFIED brief]
3. Fallback: `act` ko `network` mile to `startOffline` chalta hai, aur loop local copy ke saath chalta rehta hai. Koi order na ho aur list read fail ho to bhi `startOffline`. [VERIFIED brief]
4. Offline: live hook band, `orders = [sample]`, tracker Placed par, role customer, banner on. Har tick `act` local status aage badhata hai (Arriving = local `arrived` set) Delivered tak. Ops tab sample Ready ke baad `demoDecisions()` dikhata hai, numbers sample mark ke saath. [VERIFIED brief]
5. Dobara tap → demo off, orders clear, menu wapas. Live hook wapas aata hai aur asli list reload karta hai. [VERIFIED brief]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `app/src/App.tsx` | Manager ka board room: `auto` / `demo` / `autoNote` state, live hook band in demo, `act`, autopilot loop, `startOffline`, `toggleAuto`, "Offline demo" banner. +85/-6 |
| `app/src/lib/autopilot.ts` (new) | Drill card aur cardboard guest: `AUTOPILOT_MS`, `nextAutoAction`, `DEMO_ORDER_ID`, `demoOrder`, `DEMO_DECISION`, `demoDecisions`. +31 |
| `app/src/screens/DemoBar.tsx` | Front desk ka switch: Autopilot button (`aria-pressed`) aur `autoNote` line. +4/-2 |
| `app/src/screens/OpsScreen.tsx` | Sticker: `sample` prop, "Sample numbers (offline demo)." +3/-1 |
| `app/src/vite-env.d.ts` | Type ka chhota card: `VITE_AUTOPILOT_MS`. +1 |
| `app/playwright.config.ts` | Test build ka metronome: `VITE_AUTOPILOT_MS=300`. +1/-1 |
| `app/tests/unit/autopilot.test.ts` (new) | Six-step walk, Delivered ke baad kuch nahi, Arriving ek baar, sample order ka shape. +47 |
| `app/tests/e2e/autopilot.spec.ts` (new) | 8 rehearsal: S1 aur S2 ke poore walk, fallback, ruk jaana. +100 |

## 8. Pieces aapas mein kaise baat karte hain
```
DemoBar.tsx (Autopilot button) ──> App.tsx toggleAuto
App.tsx ──> lib/autopilot.ts (AUTOPILOT_MS, nextAutoAction, demoOrder, demoDecisions)
App.tsx online ──> MAIN 01 (changeStatus, addEvent)
App.tsx offline ──> local copy only (kuch nahi bheja)
App.tsx ──> OpsScreen.tsx (sample numbers)
```

## 9. Pehle se kya badla
- +288 / -12 in 15 files. Do commits: `14659a5` (docs) aur `d8e1ce8` (feat). [VERIFIED brief]
- Naye: `autopilot.ts`, `autopilot.test.ts`, `autopilot.spec.ts`. [VERIFIED brief]
- Badla: `App.tsx`, `DemoBar.tsx`, `OpsScreen.tsx`, `vite-env.d.ts`, `playwright.config.ts`. [VERIFIED brief]
- Docs: A49 (open), F77 a–e, F76 e–f, test-cases 5 rows, LEARNINGS 2 rows, trace 3 rows. [VERIFIED brief]
- Koi n8n change nahi, koi migration nahi. Node tests bhi nahi chhuye. [VERIFIED brief]

## 10. Macro Risks & Downstream Impact
1. **Online loop non-network error par nahi ruka.** 503 (kill switch), 404 (inactive webhook), 401 ya 409 par loop alert dikhata hai aur 2 s baad wahi step dobara bhejta hai, jab tak founder tap na kare. Hotel mein: manager ek band darwaze par har 2 s dastak deta rahe. Impact: stage par paused system par har 2 s ek request. Evidence: App.tsx line 135. [VERIFIED code read; koi test server refusal nahi dekhta]
2. **`useOps` demo mein chalta hai.** Ops tab khula ho aur "wifi on, internet dead" fallback ho, to sample order Ready par asli `decide` call ja sakti hai (`DEMO_ORDER_ID` ke liye). SUB 13 order foreign key par fail karega. Error `demo ? null` se chhupa hai. Impact: ek stray call. Evidence: App.tsx line 47, useOps.ts. [INFERRED]
3. **Online loop session ke sab open orders chalata hai.** Newest pehle. Joined device ka order bhi. Ek Delivered hone ke baad agla order uthta hai; loop tab tak chalta hai jab koi open order na bache. Impact: session ka doosra order bhi move hota hai. Evidence: App.tsx line 122, `mergeOrder` sort. [VERIFIED code read]
4. **Dead internet fallback mein ~7 s.** Jab koi order na ho, supabase-js retry karta hai. Stage par founder 7 s baad banner dekhta hai. Evidence: F77 b, e2e timeout 15 s. [VERIFIED by coder's test, INFERRED timing]
5. **Pace 2 s, chhe steps = 12 s.** Script 90 s ka hai (F77 c). Check #56 mein. [VERIFIED]
6. **Offline mein sample dishes aur total fix hain, cart nahi.** Founder jo cart pehle banata hai, use alag bill dikhega. Evidence: autopilot.ts line 21. [VERIFIED]
7. **Android airplane mode check nahi hua.** E2e browser ka offline switch use karta hai, installed app nahi. Row #56 (F77 a). [VERIFIED]
8. **Online steps "kitchen" aur "rider" ek hi phone se.** Yeh A44 wala trust boundary hai: actor phone ka apna bataya hua naam hai. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Recording aur replay tools. Kyun: story ka ponytail note. [VERIFIED brief]
- Pace slider. Kyun: build-time knob ek stage ke liye kaafi hai (F77 c). [VERIFIED brief]
- Android airplane-mode check. Kyun: #56, founder ka phone. [VERIFIED brief]
- Koi n8n change. Kyun: autopilot wahi status aur event calls use karta hai. [VERIFIED brief]

## 12. Testing Story
- Red pehle (PR body se quote): `autopilot.test.ts` "Cannot find module '../../src/lib/autopilot'". Build ke dauraan e2e ne do bugs pakde, dono theek hue: sample id valid hex nahi tha, aur switch ke baad loop ruk gaya tha. [VERIFIED quote, INFERRED run]
- Tests: unit 6 (`autopilot.test.ts`), e2e 8 (`autopilot.spec.ts`). Reviewer ne dobara chalaya: tsc clean, vitest 79/79, playwright 48/48. Step time test build mein 300 ms. [VERIFIED]
- Node tests untouched, pichle head par 50/50. [VERIFIED brief]
- Covered: S1 (offline, screens follow, leave, do fallback), S2 (chhe steps, no order, stop). [VERIFIED]
- Not covered: server refusal (503/404) online loop mein. Android airplane row #56 mein pending. [VERIFIED]

## 13. Trade-offs & Alternatives
| Chuna | Chhoda | Kyun | Gave up |
|---|---|---|---|
| `setTimeout` loop ref ke saath | `setInterval` ya state machine | Ek effect, stale closure nahi, unmount par saaf ruk | Newcomer ke liye readability (clipboard trick ko comment chahiye, hai) |
| Demo = wahi asli screens, local list ke saath | Alag "demo screen" | Investor wahi asli UI dekhta hai | App mein `demo` checks bikhri (live hook, act, OpsScreen props) |
| Sample numbers sticker ke saath | Chhupana | Stage par imaandari | Kuch nahi |
| Build-time step time | Runtime setting | Ek env line | Pace badalne ke liye rebuild (F77 c) |

## 14. Patterns is PR se
- **Clipboard ref:** lamba timer hamesha taaza state padhe, bina restart ke. (manager ka clipboard) — `App.tsx` line 122.
- **Error code wapas:** `act` code deta hai, loop faisla karta hai. (front desk kaun si gadbad batata hai) — `App.tsx` line 135.
- **Next-step table:** status dekho, agla desk pehchano. (drill card) — `autopilot.ts` line 13.
- **Build-time knob:** env se pace, build par fix. (metronome) — `autopilot.ts` line 5.
- **Do darwaze:** `navigator.onLine` aur ek failed call, dono se offline maana jaata hai. — `App.tsx` line 168.

## 15. AI-Review Lens
- **Trust:** chhe calls ka sahi kram aur sahi actor (e2e exact sequence assert karta hai); offline mein "kuch nahi bheja" (assert); tap par stop.
- **Interrogate:** "stops after Delivered" (sirf jab koi open order na bache); server refusal ke beech loop (koi test nahi); Ops hook demo mein sota hai ya nahi.

## 16. Questions
- **Top-3 abhi poocho:** (1) `app/src/App.tsx` line 135, non-network error par loop; (2) `app/src/App.tsx` line 47, `useOps` demo mein; (3) `docs/assumptions.md` line 59, A49 ki haan.
- Poora bank: comment blocks mein 20 sawaal, file-wise.

## 17. Self-check
- Server 503 aaye to autopilot kitne call bhejta hai, aur kyun? (Abhi: har 2 s, tap tak. Test nahi hai.)
- "Stops after Delivered" kab sach hai? (Jab session mein koi aur open order na bache.)
- Offline demo mein kya server tak jaata hai? (Nothing sent, aur Ops hook ka sawaal khula hai.)

---

## Comment blocks (20 posted, review 5520018160, har block mein GitHub id)

<!-- gh-comment-id: 4272485326 --> `app/src/App.tsx:135` · Risk · **Top-3**
> Loop sirf `network` code par offline jaata hai; baaki code (503 kill switch, 404 inactive webhook, 401, 409) par alert dikhta hai aur 2 s baad wahi step dobara bhejta hai, jab tak founder dobara tap na kare. Dev URL par activation se pehle yahi hoga (404). PR body kehta hai "stops after Delivered". Ek line: `if (code && code !== "network") return setAuto(false);`? Is PR mein ya agle mein, coder ka call. Ek e2e: 503 reply → ek hi call.
- **Reply (klickbae8yt-star):** Fixed on the next branch (feat/47-scorecard). Any code other than a missing network stops the loop and leaves the reason on screen. The new e2e sends a 503 and sees exactly one call. It was red first.
- **Status:** answered

<!-- gh-comment-id: 4272485338 --> `app/src/App.tsx:47` · Risk · **Top-3**
> `useOps(ready && role === "ops", ...)`: offline demo mein bhi chalta hai. Airplane mode mein Supabase read fail → kuch nahi. Par "wifi on, internet dead" fallback mein read chal sakti hai aur sample order Ready par asli `decide` call `DEMO_ORDER_ID` ke liye jaayegi (SUB 13 order FK par fail). Error `demo ? null` se chhupa hai. `ready && !demo && role === "ops"` ek line?
- **Reply (klickbae8yt-star):** Fixed there too: `useOps(ready && !demo && ...)`. The new e2e makes the first step fail so the story goes offline, opens Ops, and checks no decide request leaves the phone. It was red first.
- **Status:** answered

<!-- gh-comment-id: 4272485345 --> `docs/assumptions.md:59` · Assumptions · **Top-3**
> A49: ek button, do mode. Offline = sample order, 2 s per step, teen screens follow, kuch nahi bheja; online = session ka newest open order, kitchen phir rider ke asli calls, Delivered par ruk; fallback network fail par; dobara tap = stop + sample saaf. Owner se haan ya na. Ek baat jodo: online mode session ke HAR open order ko chalayega, ek ke baad doosra (F77 e), sirf sabse naya nahi.
- **Reply (klickbae8yt-star):** Done. A49 now says the open orders run newest first, one after the other, and that it stops when no open order is left or a call is refused for a reason other than the network.
- **Status:** answered

<!-- gh-comment-id: 4272485348 --> `app/src/App.tsx:45` · Understanding
> Demo mein live hook band (`!demo`): channel band, list = sample. Demo chhodte hi hook wapas, `reload` asli list laata hai. Beech mein doosre device se aaya order miss hoga, par reload pakad lega. Sahi?
- **Reply (klickbae8yt-star):** Yes. When the demo ends the hook starts again and `reload` reads the real list, so an order that came from another device in between is picked up.
- **Status:** answered

<!-- gh-comment-id: 4272485352 --> `app/src/App.tsx:85` · Understanding
> `act` demo mein sirf local merge, `updated_at` abhi ka: `mergeOrder` ka "newer wins" rule isse pass. Event par `arrived` set, status wahi: tracker "On the way" dikhata rehta hai, phir Delivered. Customer ko Arriving yahan bhi nahi dikhta (A45, F73 e): demo script mein rider tab dikhana hoga.
- **Reply (klickbae8yt-star):** Yes. In the demo, Arriving is an event, so the customer sees On the way until Delivered (A45). The demo script has to show the rider tab for it.
- **Status:** answered

<!-- gh-comment-id: 4272485356 --> `app/src/App.tsx:122` · Understanding
> `list.find(status !== "delivered")`: list newest-first (`mergeOrder` sort), to sabse naya open order. Do open orders ho to pehla Delivered hone ke baad agla tick doosra uthayega: loop tab tak jab tak koi open na bache. Demo mein ek order hoga; par doc "stops after Delivered" ko "stops when no open order is left" karo.
- **Reply (klickbae8yt-star):** Agreed. The wording in A49 is now "stops when no open order is left".
- **Status:** answered

<!-- gh-comment-id: 4272485364 --> `app/tests/e2e/autopilot.spec.ts:95` · Understanding
> App.tsx line 124 `!order && failed`: list padh nahi paayi aur koi order nahi → offline. `failed` = `live.error`, jo pehle kisi `act` fail se bhi set ho sakta hai; par tab `order` hota hai, to shart nahi lagti. Theek. Loading par wait: `loading` true rehne par har 2 s check, kabhi band nahi: list kabhi load na ho to loop chalta rahega (bina call). Tap se ruk jaata hai: theek.
- **Reply (klickbae8yt-star):** Right. While the list is still loading, the loop only checks again every 2 seconds and sends nothing. A tap stops it.
- **Status:** answered

<!-- gh-comment-id: 4272485372 --> `app/src/App.tsx:145` · Understanding
> `startOffline`: sample order, `placed` set, step placed, role customer, `auto` on. Agar founder Kitchen tab par tha to customer par aa jaata hai: jaan-boojh kar (tracker dikhe). Theek. `keyRef` saaf nahi hota: demo ke baad asli order place kare to purana key fingerprint se compare hota hai: koi asar nahi.
- **Reply (klickbae8yt-star):** Yes, on purpose: the customer tracker is the first thing to show. The order key is not touched, so a real order after the demo is not affected.
- **Status:** answered

<!-- gh-comment-id: 4272485380 --> `app/src/App.tsx:168` · Understanding
> `navigator.onLine`: airplane mode par false, par "wifi connected, internet dead" par true (F77 b): tab fallback 7 s baad. Android installed app par `onLine` ka vyavhar e2e nahi dekhta (browser switch): #56 row. Stage par: airplane mode se pehle app khol lo (menu cache) — checklist line.
- **Reply (klickbae8yt-star):** Agreed. I added the checklist line to F77 (f): open the app online once so the menu is saved, then switch on airplane mode. The Android check is the #56 row.
- **Status:** answered

<!-- gh-comment-id: 4272485387 --> `app/src/screens/OpsScreen.tsx:33` · Understanding
> App.tsx line 252, Ops demo props: decisions tab dikhti hain jab sample Ready ya aage, numbers fixed (800 ms, 310 ms, 6 runs) with "Sample numbers" sticker. Ek sawal: sample numbers asli jaise lagte hain; investor ke saamne sticker kaafi hai ya "demo" shabd heading mein bhi?
- **Reply (klickbae8yt-star):** I kept the banner (every screen) and the sticker (ops). I added the question to F77 (g) for the owner: should "(sample)" also be in the heading?
- **Status:** answered

<!-- gh-comment-id: 4272485393 --> `app/src/lib/autopilot.ts:13` · Understanding
> `nextAutoAction`: table se agla desk. Unknown status → null (ruk). Arriving sirf jab `arrived` false: ek baar. Yeh wahi niyam hai jo rider tab ke buttons mein hai (`riderActions`): do jagah ek kahani. Ek source? Ponytail: 6 lines, rehne do, par LEARNINGS mein note.
- **Reply (klickbae8yt-star):** Agreed. I kept it as it is (ponytail) and added a LEARNINGS line: both places tell one story, and the unit test walks the whole story so a missed change shows.
- **Status:** answered

<!-- gh-comment-id: 4272485399 --> `app/src/lib/autopilot.ts:5` · Assumptions
> `AUTOPILOT_MS` build par fix (2 s, test 300 ms). 6 step = 12 s; 90 s script (F77 c). Stage par dheema chahiye to rebuild. Theek, par #56 mein ek baar asli pace dekho.
- **Reply (klickbae8yt-star):** Agreed. I will look at the real pace in #56.
- **Status:** answered

<!-- gh-comment-id: 4272485405 --> `app/src/lib/autopilot.ts:21` · Understanding
> Sample order: fixed id (valid hex, e2e ne pakda tha), do dish, total items se, session `demo`. Cart se nahi (F77 d). Address "Flat 4, Green Park, Delhi". Theek. Yeh id kabhi server tak na jaaye: TOP-2 sawal.
- **Reply (klickbae8yt-star):** That is the point of the TOP-2 question. With the ops fix above, the sample id never reaches the server, and a test checks it.
- **Status:** answered

<!-- gh-comment-id: 4272485408 --> `app/src/screens/DemoBar.tsx:46` · Understanding
> Autopilot button `aria-pressed` ke saath, `busy` se disabled nahi (reset/copy ke beech bhi dabta hai). Reset ke beech autopilot on ho to? `reset()` `setOrders([])` karta hai, loop agle tick par "no order" → stop + "Place an order first." Theek.
- **Reply (klickbae8yt-star):** Agreed. After a reset, the loop sees no order on the next step and stops with "Place an order first."
- **Status:** answered

<!-- gh-comment-id: 4272485412 --> `app/tests/e2e/autopilot.spec.ts:17` · Testing
> Offline S1: `calls.status` 0 aur `calls.decide` 0: "kuch nahi bheja" ka proof. Supabase REST calls bhi 0 hone chahiye (hook band): ek assert `net.calls.orderReads` offline ke baad nahi badha? Chhota, par "nothing sent" poora hoga.
- **Reply (klickbae8yt-star):** Done. The offline spec now also checks that the order list was not read after the phone went offline.
- **Status:** answered

<!-- gh-comment-id: 4272485415 --> `app/tests/e2e/autopilot.spec.ts:52` · Testing
> Online: chhe calls, sahi kram, sahi actor, sahi order id aur token; 900 ms baad bhi 6: ruk gaya. Acha. Nahi hai: server 503/404 ke beech loop (TOP-1). Ek spec: `state.reply = 503` → `poll` 1 call, phir 1 hi.
- **Reply (klickbae8yt-star):** Done. The new spec answers 503 and checks one call, then still one call after 1.2 seconds, and that the button is off.
- **Status:** answered

<!-- gh-comment-id: 4272485418 --> `app/tests/e2e/autopilot.spec.ts:72` · Testing
> Dobara tap → calls badhna band. Race: tap ke waqt ek call udaan mein ho to `alive` false → uska jawab merge nahi hota (`if (!alive) return`), par server par step lag chuka. Reload par dikhega. Theek, bas jaan lo.
- **Reply (klickbae8yt-star):** Yes, known. If a tap lands while a call is in the air, the server keeps that step and the screen shows it after a reload.
- **Status:** answered

<!-- gh-comment-id: 4272485426 --> `app/tests/e2e/autopilot.spec.ts:89` · Testing
> Dead server + no order: 15 s timeout, "about 7 s" retry. Yeh supabase-js ka retry hai, hamara nahi. F77 b: fail-fast chahiye to `fetchOrders` par `AbortSignal.timeout`. Stage par 7 s lamba hai: #56 decide.
- **Reply (klickbae8yt-star):** It stays in F77 (b). I will decide in #56 whether the list read should fail faster.
- **Status:** answered

<!-- gh-comment-id: 4272485434 --> `app/tests/unit/autopilot.test.ts:44` · Testing
> "defaults to 2 seconds" sirf `> 0` check karta hai. Env se 300 aaye to bhi pass. Naam ya assert badlo: `toBe(2000)` jab env na ho (vitest build mein env nahi).
- **Reply (klickbae8yt-star):** Fixed. The unit test now says `toBe(2000)`; the unit test build has no setting, so it checks the default.
- **Status:** answered

<!-- gh-comment-id: 4272485442 --> `docs/tests/test-cases.md:119` · Impact
> Live row: Android installed app, airplane mode, Autopilot → Delivered; phir online order + Autopilot → doosre device ki kitchen par chhe steps. Yeh #56 ke saath. Isi row mein 2 s pace aur 7 s fallback ka napa hua time likhna.
- **Reply (klickbae8yt-star):** Agreed. The measured pace and the fallback time go into that row in #56.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #75 approve ho chuka hai. Merge karo (feat/53-autopilot -> dev). A49 par apni haan ya na do; A46, A47, A48 bhi khule hain.
Online loop ek refused call par har 2 s retry karta hai jab tak tap na ho. Coder ek line ka fix is PR mein ya agle mein karega. "push kar do" aur "activate" alag shabd hain: abhi dono nahi bole gaye.
```

Coder paste-block (English):
```
State: 20 posted · 0 must-fix · actor: owner (merge), then coder

Developer for GoServe PR #75 (feat/53-autopilot). Do this: (1) reply on all 20 review threads by comment id, in 1-2 sentences each; (2) make the two one-line fixes: stop the online loop on any non-network error (App.tsx line 135), and keep useOps off in the offline demo (App.tsx line 47); add an e2e for a 503 reply with one call only; do them in this PR before merge or in the next, and say which in the thread; (3) after the owner merges, copy the bundle and its rows, then commit; (4) deploy nothing and activate nothing; (5) continue development: start story #47 "Daily scorecard workflow (MAIN 90)" (epic #36) on feat/47-scorecard from dev; if the owner activates first, start #56 instead.
```

posted as satvik-jain-iitd, review 5520018160 (APPROVE), 20 inline threads
