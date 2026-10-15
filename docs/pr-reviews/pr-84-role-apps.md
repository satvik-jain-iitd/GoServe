# PR #84 — feat(app): role apps as separate installable PWAs on one origin

- **Branch:** `feat/83-role-apps` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #83 "Role apps (customer, kitchen, rider, ops) as separate installable PWAs, one device first", slice 1 (of 2)
- **Status:** MERGED into dev `cd63172` (APPROVE review 5526171584 on `4f926bf`; the coder merged dev in to resolve four docs conflicts, no code change; CI green); threads answered and resolved [VERIFIED]
- **Files:** 15 · **Lines:** +216 / -14 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5526171584 (APPROVE), 10 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/84

> Ek hotel ke chaar darwaze. Har darwaze ki apni naam ki takhti aur apni chaabi, par andar ek hi building aur ek hi staff register.

---

## Overall review

## 1. Ek-line logline
> `Role apps PR: ek hi codebase, ek hi origin par chaar installable apps (customer, kitchen, rider, ops). Address se app chunta jaata hai, aur `/` par demo console wahi rehta hai.`

## 2. Big Picture (Story & Goal)
- Story #83 "Role apps ... one device first", owner ki direction 15 Oct, aur rule 9 (ek codebase, PWA first). Yeh slice 1 hai, slice 2 baad mein. [VERIFIED]
- Chaar role (customer, kitchen, rider, ops) ko alag installable app chahiye, par code copy nahi hona chahiye. [VERIFIED]
- Story ke teen S: S1 ek device par teen apps ek session share karte hain. S2 har app apne aap install ho sakta hai (own address, title, manifest). S3 alag devices join link se judte hain. [VERIFIED]
- Kis ke liye: guest (customer), kitchen staff, rider, aur manager (ops). [VERIFIED]
- Real-phone install check is PR mein nahi hai. Woh #56 mein hoga. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Pehle: ek hi console `/` par, paanch tabs aur tools ke saath. [VERIFIED]
- Is PR se: `/customer/`, `/kitchen/`, `/rider/`, `/ops/` ke apne address hain. [VERIFIED]
- ADR ke hisaab se `/` 18 Oct ke demo ke liye waisa hi rehta hai. [VERIFIED]
- Iske bina kya nahi ho sakta tha: brief mein nahi tha.

## 4. Real-Life Analogy
Ek hotel, chaar darwaze, ek building.

1. Building = ek codebase, ek build, ek origin, ek service worker. [VERIFIED]
2. Guests ka darwaza = `/customer/` wala app.
3. Kitchen ka darwaza = `/kitchen/` wala app.
4. Riders ka darwaza = `/rider/` wala app.
5. Manager ka darwaza = `/ops/` wala app.
6. Naam ki takhti (name plate) = app ka title, jaise "GoServe Kitchen".
7. Chaabi (key card) = manifest. Har darwaze ki apni `id`, `scope`, `start_url`.
8. Staff register = browser storage aur ek anonymous session. Ek phone ke andar sab darwaze ek hi register dekhte hain.
9. Lobby = `/` wala console. Yahan saare darwaze ki list aur drill switches (DemoBar) hain.
10. `lock` = darwaza jo sirf ek kamre mein khulta hai. Na corridor map (tabs), na drill switches.
11. Naam ki takhti script se lagana, darwaza khulne ke baad = manifest swap after load. Phone ka installer ise abhi padhega, yeh asli phone check hai.
12. iPhone = har darwaze ka apna staff register. Andar aane ka raasta join link hai.

## 5. Is PR mein naye Concepts (6)
- **One origin, several apps:** address app chunta hai. Storage, service worker aur session ek origin par share hote hain. Kyun: "one device" isi se banta hai. Analogy: ek building, chaar darwaze.
- **Manifest = install identity:** `id`, `scope`, `start_url` ek app ko doosre se alag karte hain. Kyun: chaar install ek phone par tabhi ban sakte hain. Analogy: chaabi ka card.
- **Lock a shell to one room:** ek prop console ko ek screen wala app bana deta hai. Kyun: same code, koi copy nahi. Analogy: ek kamre ka darwaza.
- **Build-time file emit:** chhota plugin build ke waqt chaar manifest files likhta hai. Analogy: construction ke waqt chaar naam ki takhtiyan pehle se bana kar rakhna.
- **Swapping the manifest after load:** page khulne ke baad manifest link badalna. Chrome install ka check kab padhta hai, yeh soft spot hai. Analogy: darwaza khulne ke baad takhti lagana.
- **Count the sign-ins:** e2e "ek session" ko signup calls gin kar prove karta hai, storage padh kar nahi. Analogy: register mein entries ginna.

Poori entries `concepts.delta.md` mein hain.

## 6. High-Level Flow
Journey: browser ke address se darwaze tak, phir kamre tak.

1. Browser `/kitchen/` kholta hai. `main.tsx` address se role padhta hai: kitchen. [VERIFIED]
2. Manifest link script se badalta hai, `/manifests/kitchen.webmanifest` par. Title "GoServe Kitchen" ban jaata hai. [VERIFIED]
3. `<App lock="kitchen">` render hota hai. Sirf kitchen screen, live list chalu, same storage, same anonymous session. [VERIFIED]
4. `/` par koi role nahi. Console khulta hai: paanch tabs aur DemoBar, jaise pehle. [VERIFIED]
5. Build par plugin chaar manifest files likhta hai. Ek service worker sab ke liye. [VERIFIED]
6. Doosra device: `/kitchen/?join=<id>` par `join_session` RPC us session ko padhta hai. URL `/kitchen/` par saaf hota hai. [VERIFIED]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/src/lib/roles.ts` (new) | Chaar apps ki list, aur address se app chunne ka function (`roleFromPath`). +9 |
| `app/src/main.tsx` | Darwaza ka guard: address padh kar role chunta hai, manifest badalta hai, title lagata hai, App ko `lock` ke saath render karta hai. +12/-1 |
| `app/src/App.tsx` | `lock` prop: shuru ka role, tabs chhupana, DemoBar chhupana, h1 mein title. Baaki App wahi. +7/-6 |
| `app/src/pwa-manifest.ts` | Har app ki chaabi-card: `roleManifest(role)` naam, `id`, `scope`, `start_url`. Console ka `start_url` `/` hai. +9/-2 |
| `app/vite.config.ts` | Build ka chhota plugin: chaar manifest files banata hai. VitePWA wahi rehta hai. +12/-3 |
| `app/tests/e2e/apps.spec.ts` (new, 7) | Chaaro darwaze ke 7 checks: har app, console, manifest, ek session, kitchen tap, join. |
| `app/tests/unit/roles.test.ts` (new, 5) | Address matching, look-alike addresses, chaar manifest, standalone, icons. |
| `app/tests/e2e/helpers.ts` | `signups` ko ginta hai. |
| `docs/decisions/ADR-013-role-apps-on-one-origin.md` (new) | Faisla: ek origin, ek build, `/` console wahi. |
| `docs/assumptions.md`, `docs/follow-ups.md`, `docs/ideas.md`, `docs/tests/test-cases.md` | A52, F83, ID093, 5 test rows. |

## 8. Pieces aapas mein kaise baat karte hain

```
browser address
  -> roles.ts (roleFromPath: role ya null)
  -> main.tsx (role ke hisaab se)
       -> manifest link = /manifests/<role>.webmanifest
       -> title
       -> App lock=<role>
build time
  -> vite.config.ts plugin role-manifests -> 4 manifest files
  -> VitePWA -> ek service worker (sab ke liye)
```

- Upar ke teer brief ke flow se hain. `main.tsx` ka `roles.ts` use karna INFERRED hai: import ki line brief mein nahi thi.
- `pwa-manifest.ts` ka `roleManifest` build plugin ke liye hai. Runtime par main.tsx file ka naam banata hai. [INFERRED]

## 9. Pehle se kya badla
- +216 / -14 in 15 files. Naye files: `roles.ts`, `apps.spec.ts`, `roles.test.ts`, ADR-013. [VERIFIED]
- Do commits: `4e51b04` (feat) aur `4f926bf` (docs quoting fix). [VERIFIED]
- App ke andar ek `lock` prop hai. Baaki App wahi: live list, join link, useOps gating. [VERIFIED]
- Console `/` pehle jaisa: paanch tabs aur tools. [VERIFIED]
- Docs mein ADR-013, A52, F83, ID093 aur 5 test rows. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Manifest page load ke baad badalta hai.** Chrome install ka faisla load ke manifest se ho sakta hai. Impact: kuch phones par ek role app ko console wali install pehchan mil sakti hai. Check: `main.tsx` line 14; ADR consequences. [VERIFIED code; INFERRED behaviour]
2. **iPhone par alag storage.** Installed app ka session doosre app se share nahi hoga. Impact: known limit (ADR-013, F83 c). Owner ka phone Android hai. Check: ADR. [INFERRED, Tier C-level claim in the ADR]
3. **`/kitchen/` ke liye host ko index.html dena hoga.** Dev par catch-all routes hain (PR #74). Pages default mein yeh karta hai. Host na kare to 404. Impact: aaj ke hosts par koi nahi. Check: `deploy-dev.yml` routes. [VERIFIED routes; INFERRED Pages]
4. **Demo tools sirf console mein.** Role app apna session link share nahi kar sakta. Impact: 18 Oct par console use hoga, to abhi koi nahi. Check: `App.tsx` line 251; F83 b/f. [VERIFIED]
5. **`roleFromPath` exact aur lower-case hai.** `/Kitchen/` par console khulta hai, 404 nahi. Impact: typed address mein capital letter ho to console khulega; yeh readable hai. Check: `roles.test.ts` line 15. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Per-role share links. Kyun: slice 2 (F83 b). [VERIFIED]
- Alag builds, store packages, role logins. Kyun: ADR-013 (MVP 1). [VERIFIED]
- Har app ke liye rang aur icon. Kyun: F83 d. [VERIFIED]
- Real-phone install check. Kyun: #56. [VERIFIED]

## 12. Testing Story
- Red pehle: PR body ke hisaab se `roles.test.ts` "Cannot find module '../../src/lib/roles'" par fail hua. E2e specs bhi usi waqt likhi gayi. [VERIFIED quote, INFERRED run]
- Reviewer ne `4f926bf` par dobara chalaya: tsc clean, vitest 84/84, playwright 57/57 (7 nayi). [VERIFIED]
- Covered: har app apni screen par. Console wahi. Manifest har app ka (fetch karke check). Ek phone = ek signup. Kitchen tap order tak pahunchta hai. Role address par join. [VERIFIED]
- Not covered: asli phone (install prompt, WebAPK storage share), iPhone, offline role address service worker se. [VERIFIED]

## 13. Trade-offs & Alternatives

| Chuna | Chhoda | Kyun | Gave up |
|---|---|---|---|
| Ek origin, path se app chunna | Chaar sub-domain ya chaar build | Ek session storage se, ek build, ek deploy. Rule 9. | Per-app origin isolation (yahan nahi chahiye) |
| Manifest script se badalna | Har app ke liye alag HTML | Ek index.html, ek SPA. Sabse chhota diff. | Install prompt par pakka yakeen (real-phone check) |
| `lock` prop | Alag screen components | Screens pehle se hain. 7 lines. | Kuch nahi |
| Console `/` par rakha | Console hatana | 18 Oct ka demo waisa rehta hai | Kuch nahi |

## 14. Patterns is PR se
- **Path picks the app:** address se ek hi app chunna. — `app/src/lib/roles.ts` (`roleFromPath`).
- **Lock a shell:** ek prop, ek kamra. — `app/src/App.tsx` (`lock`).
- **Name plate + key card:** har app ka title aur manifest. — `app/src/pwa-manifest.ts` (`roleManifest`), `app/src/main.tsx`.
- **Build-time file emit:** chhota plugin, extra files. — `app/vite.config.ts` line 10.
- **Count the sign-ins:** ek session ko signup calls se prove karna. — `app/tests/e2e/helpers.ts` line 28.

## 15. AI-Review Lens
- **Trust:** address routing (unit + e2e). Chaar manifests (test ne fetch karke dekhe). Ek signup teen apps mein. Console wahi (assert hua). [VERIFIED]
- **Interrogate:** manifest swap asli phone par. iPhone storage. Role app apna session bina console ke kaise share karega (slice 2). ADR ke platform daave (WebAPK, iPhone storage) mein source nahi hai. [VERIFIED]

## 16. Questions
- **Top-3 abhi poocho:**
  1. `docs/assumptions.md` line 62: A52. Chaar app, ek Android par ek session, iPhone par alag. Owner ki haan ya na.
  2. `app/src/main.tsx` line 14: manifest load ke baad badalta hai. Phone par console wali identity mili to kya?
  3. `app/src/lib/roles.ts` line 7: address se app chunne ka niyam. Yahi "one device" ka raaz hai?
- **Poora bank:** 10 sawaal, comment blocks mein, question order mein (neeche).

## 17. Self-check (light, 2-3)
- Ek phone par `/customer/` aur `/kitchen/` dono khule hain. Kaun sa data dono mein ek hoga, aur iPhone par kya badlega? (TOP-1.)
- `/Kitchen/` likhne par kya khulta hai, aur yeh sawaal kyun banta hai? (TOP-3.)
- Manifest load ke baad badalta hai. Phone ka installer kab padhega, aur kaunsa test yeh pakka karega? (TOP-2.)

---

## Comment blocks (10 posted, review 5526171584, har block mein GitHub id)

<!-- gh-comment-id: 4277470819 --> `docs/assumptions.md:62` · Assumptions · **Top-3**
> A52: chaar app `/customer/`, `/kitchen/`, `/rider/`, `/ops/`; `/` console wahi; `/health` wahi. Ek Android par sab ek session share karte hain (browser storage); iPhone par installed apps alag storage, join link. Same code, same build. Owner se haan ya na, aur ADR-013 merge se accept. Yeh 15 Oct ka tumhara direction tha (ID093).
- **Reply (klickbae8yt-star):** This needs the owner's own yes, apart from the merge. A52 stays Open until then; ADR-013 is accepted by the merge.
- **Status:** answered

<!-- gh-comment-id: 4277470827 --> `app/src/main.tsx:14` · Risk · **Top-3**
> Manifest link page load ke BAAD script se badalta hai (build wala hata kar `/manifests/kitchen.webmanifest`). Chrome install ka faisla kabhi load ke manifest se karta hai; ADR yeh maanta hai aur asli phone check par bhejta hai (F83 a, #56). Agar phone par kitchen app ko console wali identity mile, to fallback: har app ka apna HTML entry (build mein chaar index). Abhi theek, #56 mein dekho.
- **Reply (klickbae8yt-star):** Yes, this is the open risk. The phone check in #56 decides. If Chrome gives the kitchen app the console identity, the fallback is one HTML entry per app (four index files) in the build.
- **Status:** answered

<!-- gh-comment-id: 4277470831 --> `app/src/lib/roles.ts:7` · Understanding · **Top-3**
> Address app chunta hai: `/kitchen` ya `/kitchen/`, exact aur lower-case; `/`, `/health`, `/kitchenette`, `/Kitchen/` par null = console. Ek origin, isliye storage, service worker aur anonymous session sab apps mein ek. Yahi "one device" ka poora raaz hai: koi naya code nahi, sirf ek hi ghar ke chaar darwaze.
- **Reply (klickbae8yt-star):** Thanks.
- **Status:** answered

<!-- gh-comment-id: 4277470834 --> `app/src/App.tsx:27` · Understanding
> `lock` ek prop: shuru ka role, tabs nahi, DemoBar nahi (Autopilot/Reset/Split/link), h1 "GoServe Kitchen". Baaki App wahi (live list, join, useOps gating). "split" lock nahi ho sakta (type). Role app apna link share nahi kar sakta — slice 2 (F83 b). 18 Oct console se hoga, to theek.
- **Reply (klickbae8yt-star):** Agreed. A role app cannot share its own link yet; that is slice 2 (F83 b).
- **Status:** answered

<!-- gh-comment-id: 4277470836 --> `app/src/pwa-manifest.ts:23` · Understanding
> Har app ka manifest: naam, short_name, `id`, `scope`, `start_url` = `/<role>/`; console `start_url: "/"`. `id` alag hone se ek phone par chaar install. Assets `/assets/` scope ke bahar hain — scope sirf navigation par lagta hai, fetch par nahi, to theek. Sahi?
- **Reply (klickbae8yt-star):** Yes. The scope applies to page navigation, not to files the page loads, so `/assets/` is fine.
- **Status:** answered

<!-- gh-comment-id: 4277470838 --> `app/tests/e2e/apps.spec.ts:50` · Testing
> "One device" ka sabut: customer app order rakhta hai, kitchen aur rider app nayi pages (same browser profile) mein wahi order, `signups` abhi bhi 1, reads same session par. Browser profile = ek phone ka Chrome. Android WebAPK bhi Chrome ka storage share karta hai (ADR ka daava, source nahi): #56 mein asli phone par dekho.
- **Reply (klickbae8yt-star):** Agreed. The claim about Android is in the ADR as a claim; the phone check in #56 is its test.
- **Status:** answered

<!-- gh-comment-id: 4277470844 --> `app/vite.config.ts:10` · Ops
> Chhota plugin build par `manifests/<role>.webmanifest` chaar files likhta hai; VitePWA wahi (ek service worker, autoUpdate). `/kitchen/` path ke liye host ko index.html dena hoga: dev par catch-all routes hain (PR #74), Pages default karta hai. Offline: service worker ka navigate fallback. Prod par pehli release mein `/kitchen/` ek baar kholna checklist step 6 mein jodo.
- **Reply (klickbae8yt-star):** Agreed. I add "open `/kitchen/` once" to checklist step 6 in the next PR.
- **Status:** answered

<!-- gh-comment-id: 4277470852 --> `docs/decisions/ADR-013-role-apps-on-one-origin.md:25` · Docs
> Consequences: Android WebAPK = Chrome storage (share), iPhone = alag storage (join link), manifest swap after load (phone check), scope ke bahar link browser mein. Platform daave bina source ke hain (Tier C level): ek line mein source jodo (web.dev / MDN) ya "#56 mein check" likha rehne do. Owner ka phone Android hai.
- **Reply (klickbae8yt-star):** Agreed. I will change the ADR to say these platform behaviours are not yet sourced and are checked on the phone in #56 (next PR).
- **Status:** answered

<!-- gh-comment-id: 4277470856 --> `docs/follow-ups.md:89` · Docs
> F83: (a) phone install check #56; (b) slice 2 per-role share link; (c) iPhone join link; (d) rang/icon per app; (e) ek code, ek badlav dono jagah; (f) tools sirf console mein. (b) ke liye owner: kitchen app ke andar "share this kitchen" button chahiye, ya console se link kaafi?
- **Reply (klickbae8yt-star):** A question for the owner: a "share this kitchen" button inside the kitchen app, or is the console link enough? It is slice 2.
- **Status:** answered

<!-- gh-comment-id: 4277470860 --> `docs/tests/test-cases.md:137` · Docs
> Live row: founder ke Android par teen apps side by side, ek order sab mein, har ek ka apna install. Jab karo: kaunsa Chrome, install prompt aaya ya nahi, aur kya install ke baad bhi session share hua (WebAPK). Yahi row ADR ke daave ka asli test hai.
- **Reply (klickbae8yt-star):** Agreed. In that row I will write the Chrome version, whether the install prompt came, and whether the session was shared after install.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #84 approve ho chuka hai. Merge karo (feat/83-role-apps -> dev).
A52 par haan ya na do. ADR-013 merge se accept hoga.
Real-phone install check #56 mein hoga, aapke Android par. Slice 2 (app ke andar share link) chahiye to 18 Oct se pehle batao.
```

Coder paste-block (English):
```
PR #84 APPROVED (review 5526171584, 10 threads). Owner merges.

1. Reply on each thread by id.
2. Add a source line (web.dev / MDN) or "#56 check" to each platform claim in ADR-013.
3. After merge, copy the bundle and rows.
4. Next: #56 live runs, including the real-phone install check.
5. Slice 2 (per-role share links) only after the owner's word on A52 and slice 2.
```

posted as satvik-jain-iitd, review 5526171584, 10 inline threads
