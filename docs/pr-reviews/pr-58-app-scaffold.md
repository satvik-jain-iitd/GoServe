# PR #58 — feat(app): scaffold React, Vite, TypeScript PWA with design tokens

- **Branch:** `feat/39-app-scaffold` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** #39 (epic #33)
- **State:** MERGED (13 Oct 2026)
- **Merge commit:** `bcd14d4`
- **Files:** 21 · **Lines:** +7243 / -0
- **Reviewer:** satvik-jain-iitd (review + merge account)
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/58

> Yeh GoServe ka **pehla code PR** hai. Isse pehle sirf docs/planning aur investor site thi.

---

## Overall review

### 1. Ek-line logline
GoServe app ka khaali dhaancha — React + Vite + TypeScript + PWA + theme colours — taaki aage ke saare screens iske upar bane.

### 2. Big Picture (Story & Goal)
Product level par yeh PR ek naya hissa kholti hai: **`app/` folder**, yaani asli product app. Pehle sirf `site/` (investor doorway) thi. Ab ek hi PWA banegi jo customer, kitchen, rider, aur ops — chaaron use karegi (ADR-006). Yeh PR function nahi deti; yeh **neev** deti hai.

### 3. Yeh ab aaya kyun? (Context)
Story #39 ki Definition of Ready poori ho gayi thi. Owner ne "start" bola. Is PR ke bina koi screen, koi login, koi order nahi ban sakta — kyunki app ka dhaancha hi nahi tha. Iske turant baad wali story #40 (CI guard) isi ke upar aati hai.

### 4. Real-Life Analogy
Ek naya restaurant kholna:
- `index.html` = building ka main door frame + bahar ka nameplate.
- `main.tsx` = main switchboard — current on karte hi sab chalu.
- `App.tsx` = andar ka welcome board (dukaan abhi khaali hai).
- `tokens.css` / `design/tokens.json` = approved paint catalogue.
- `pwa-manifest.ts` = dukaan ka identity card / hoarding spec.
- `vite.config.ts` = factory ki assembly line (sab pack ho kar bahar jaata hai).
- Service worker = night guard jo dukaan band hone par bhi kaam chalata hai (offline).
- Tests = quality inspector ka checklist.

### 5. Is PR mein naye Concepts
- **PWA (Progressive Web App)** — ek website jo phone par app ki tarah install hoti hai. Real life: ek dukaan ka shutter jo ghar par bhi kaam kare.
- **Service worker** — background helper jo app ka data cache karta hai, offline chalu rakhta hai. Real life: dukaan ka night guard.
- **Web App Manifest** — app ki identity card (naam, icon, colour, launch style). Real life: hoarding ki spec sheet.
- **Design token** — colour/spacing ki central setting. Real life: approved paint catalogue.
- **Build / Bundler (Vite)** — saara code chhote files se ek pack banata hai. Real life: factory packaging line.
- **Unit test vs E2E test** — unit = ek part ka scale; e2e = mystery shopper ka poora visit.

### 6. High-Level Flow
1. User URL kholta hai → browser sabse pehle `index.html` load karta hai.
2. `index.html` `main.tsx` ko chalu karta hai (script module).
3. `main.tsx` do CSS files load karta hai: `tokens.css` (colours) phir `app.css` (layout).
4. `main.tsx` HTML mein `id="root"` wala khaali container dhoondta hai.
5. `App` component us container mein render hota hai → screen par "GoServe" + tagline.
6. Background mein service worker register hota hai → app offline-installable ban jaati hai.
7. Build ke waqt `vite.config.ts` `pwa-manifest.ts` + icons ko use kar ke `manifest.webmanifest` aur `sw.js` banata hai.

### 7. The Cast (files ka role)
| File | Role |
|---|---|
| `app/index.html` | Main door frame + nameplate (pehle load hone wali file) |
| `app/src/main.tsx` | Switchboard — CSS + App ko jodta hai |
| `app/src/App.tsx` | Welcome board (abhi khaali) |
| `app/src/pwa-manifest.ts` | Identity card data |
| `app/src/styles/tokens.css` | Paint catalogue (colours + type + spacing) |
| `app/src/styles/app.css` | Basic layout paint |
| `app/vite.config.ts` | Assembly line (build + PWA) |
| `app/vitest.config.ts` | Unit test desk |
| `app/playwright.config.ts` | E2E test track |
| `app/tsconfig.json` | Code rules ka manual |
| `app/package.json` | Dukaan ki shopping list |
| `app/package-lock.json` | Exact material receipt (versions + hashes) |
| `app/tests/unit/manifest.test.ts` | Manifest inspector |
| `app/tests/unit/tokens.test.ts` | Colour drift inspector |
| `app/tests/e2e/app.spec.ts` | Mystery shopper |
| `app/public/icons/*` | App ke do icons (192, 512) |
| `app/README.md` | Dukaan ka instruction card |
| `docs/follow-ups.md`, `docs/process-trace.md`, `docs/tests/test-cases.md` | Project ke record updates |

### 8. Pieces aapas mein kaise baat karte hain
- `index.html` → `main.tsx` (script module).
- `main.tsx` → `tokens.css`, `app.css`, `App`.
- `vite.config.ts` → `pwa-manifest.ts` (manifest banane ke liye).
- `pwa-manifest.ts` → `design/tokens.json` (colours isse aate hain).
- Tests → source files + `design/tokens.json` (verify karne ke liye).

### 9. Pehle se kya badla
+7243 / -0, 21 files — sab **naya** (deletions zero). Bade hisse:
- `app/package-lock.json` akela +6862 lines (dependency receipt).
- `app/src/styles/tokens.css` +102 (paint catalogue).
- 2 icons (binary, 0 lines).
- 3 project docs update hue (follow-ups, process-trace, test-cases) — is PR ka record.

### 10. Macro Risks & Downstream Impact
- **Design token lock-in:** agar `tokens.css` aur `tokens.json` drift karein, aage ki saari screens galat colour dikhayengi. Isliye drift-guard test rakha gaya.
- **Service worker caching:** `registerType: "autoUpdate"` silently app ko refresh kar deta hai. Active order ke beech reload ho sakta hai. Follow-up **F59**.
- **Ek PWA, char roles:** future mein bundle bada (bloated) ho sakta hai agar role-wise code-splitting na ho.
- **Lockfile bhaari deps:** Playwright + Vitest + Babel ek saath → CI time badh sakta hai (CI job ~45s, PR #59).

### 11. Jo jaan-boojh kar NAHI hai (Scope)
Ponytail rule: sirf zaroori code. Is PR mein **jaan-boojh kar** nahi hai:
- Router / screens (stories #48-#52).
- Supabase client, login (bottleneck ke liye ADR-009).
- Capacitor (PWA pehle).
- Deploy step (alag story).
Yeh "kya nahi banaya" bhi ek design decision hai — bloat se bachav.

### 12. Testing Story
**Red first** (pehle fail hone ka proof): `npx vitest run` → "Cannot find module '../../src/pwa-manifest'" aur "ENOENT tokens.css". Phir code likha, phir green.
- **Unit (Vitest):** 5 tests. `manifest.test.ts` (installable, icons disk par, token colours, index.html match) + `tokens.test.ts` (CSS mein saare colours hain, aur ulta check bhi).
- **E2E (Playwright, Pixel 7):** 4 tests. App khulti hai, manifest linked+served hai, service worker register hota hai, aur **offline** mein app shell load hota hai.
Story #39 ke scenarios S1 (build + install) aur S2 (colours from tokens).

### 13. Trade-offs & Alternatives
| Decision | Kyun | Chhoda kya |
|---|---|---|
| Ek hi PWA, char roles | Ek codebase, ek deploy | Role-wise code-splitting ki tension (future) |
| `design/tokens.json` source | Colour ek jagah se sab | Har app ko copy + drift-guard test rakhna padta hai |
| Relative imports | Abhi chhota | Path alias (`@/`) baad mein |
| Vite | Fast build, PWA plugin | — |
| `autoUpdate` | Zero-touch updates | Silent reload risk (F59) |

### 14. Patterns is PR se
- **Entry point pattern** — `main.tsx` app ko start karta hai.
- **Config file / settings sheet** — `vite/vitest/playwright/tsconfig` = ruleset.
- **Single source of truth + drift guard** — tokens.json, aur test jo drift pakadta hai.
- **Test as checklist (red first)** — pehle fail, phir pass.
- **PWA install + offline** — manifest + service worker.

### 15. AI-Review Lens
- **Trust kar sakte ho:** scaffolding, idiomatic React/Vite setup, test setup — standard aur safe.
- **Interrogate karo:** `autoUpdate` ka silent reload; `document.getElementById("root")!` par non-null assertion; `index.html` mein hardcoded `#45654E`; icon ka `maskable` na hona; lockfile ki reproducibility (`npm ci`).
- PM ka checklist: story match (haan, sirf scaffold), scope (kuch speculative nahi), blast radius (tokens + SW), failure modes (offline, cache), reversibility (naya folder, easy undo).

### 16. Questions
> **Top 3 abhi poocho**

1. **(Product)** Ek hi PWA char roles ke liye — heavy features aane par bundle size/performance plan kya hai?
2. **(Risk)** `autoUpdate` chupke reload karta hai — active order ke beech reload na ho, uska plan? (F59)
3. **(Understanding)** `design/tokens.json` ko single source of truth kaise enforce kiya gaya, aur drift kaise pakda jaata hai?

<details><summary>Poora question bank (33 sawaal — files ke saath post hue)</summary>

**Purpose / Product**
- Router aur role-wise (Customer/Kitchen/Rider) UI switchers kab aayenge? — App.tsx
- Ek app char roles ke liye bundle bada na ho, plan? — App.tsx

**Understanding**
- `main.tsx` mein providers (Auth/Router/Supabase) aage yahan hi wrap honge ya alag file? — main.tsx
- Icon paths absolute kyun (leading `/`)? — manifest.test.ts
- Test folder `tests/unit` fixed kyun? Co-located tests skip ho jayenge? — vitest.config.ts

**Assumptions**
- `document.getElementById("root")!` par root missing ho to? — main.tsx
- `index.html` theme-color hardcoded — tokens se sync kaise? — index.html

**Risk / Edge**
- Error boundary chahiye (white-screen se bachne ke liye)? — App.tsx
- Offline readiness ka actual test add karein? (kya hua: haan) — app.spec.ts
- iOS notch / status-bar tags chahiye? — index.html
- Android maskable icon chahiye? — pwa-manifest.ts
- Shorthand (`#fff`) / hsl aaye to test fragile? — tokens.test.ts
- WebKit/Safari test coverage? — playwright.config.ts

**Alternatives**
- Manifest colours tokens.json se import karein (hardcode na karein)? — pwa-manifest.ts
- Manifest link index.html mein explicit lagayein? — index.html
- CSS token parser use karein? — tokens.test.ts

**Impact**
- Lockfile 6.8k lines — CI/deploy time audit? — package-lock.json
- Non-colour tokens (type/spacing/radius) ka verification? — tokens.test.ts

**Testability**
- Coverage threshold lagayein? — vitest.config.ts
- `navigator.serviceWorker.ready` par explicit timeout? — app.spec.ts

**Future**
- `autoUpdate` ke liye update toast/prompt? (kya hua: F59) — vite.config.ts
- `includeAssets` match broaden karein (svg/webp)? (kya hua: haan) — vite.config.ts
- Path aliases (`@/`) abhi add karein? — tsconfig.json
- `allowImportingTsExtensions` se koi issue? — tsconfig.json
- `skipLibCheck` theek hai? — tsconfig.json
- `start_url` mein utm param? — pwa-manifest.ts

</details>

### 17. Self-check (halka)
1. Bina file kholé bata sakte ho: `main.tsx` aur `App.tsx` mein farak kya hai?
2. Is PR ke baad system mein ek naya kaunsa hissa juda? (jawab: `app/` PWA skeleton)
3. `service worker` ko apne kisi doosre project mein kahan use karoge?

---

## Files (ek-ek)

> Neeche har file ka kaam, flow, red flags, aur us par post hue comments + replies.
> Config/test files par chhota format; logic wali files par poora function-by-function.

### `app/src/App.tsx`

**1. File ka job:** App ka main welcome screen — abhi sirf brand naam aur tagline dikhata hai.

**2. Kahan fit hai:** `main.tsx` ise render karta hai. Baaki saare future screens isi ke andar mount honge.

**3. Plain-English walkthrough:** Jab app chalti hai, yeh ek `<main>` box banati hai jisme "GoServe" heading aur ek line tagline daalti hai. Bas.

**4. Function-by-function**
- **`App()`**
  - Kya karta hai: ek main container banata hai → heading `GoServe` → paragraph tagline.
  - Input & Output: koi input nahi → UI (screen) return.
  - Kaun call karta hai: `main.tsx`. Yeh kya call karti hai: kuch nahi.
  - Micro analogy: dukaan ke bahar ka welcome board.
  - Why not simpler? Isse simple kuch nahi ho sakta.
  - Watch-outs: sab users ko same static text; koi role/routing nahi.

**5. Block-level:** koi config nahi.
**6. Data journey:** koi data nahi — pure static.
**7. Connections:** andar aata hai `main.tsx` se; bahar jaata hai browser DOM ko.
**8. Concepts:** React component, JSX.
**9. Red Flags:** hardcoded text; koi error boundary nahi; koi safe-area padding nahi.

**Inline comments (posted by satvik-jain-iitd):**
<!-- gh-comment-id: 4261614048 -->
> "Router/layout switchers kab aayenge?" · "Error Boundary chahiye?"
- **Status:** answered
- **Reply (klickbae8yt-star):** Router abhi jaan-boojh kar nahi; screens #48-#52 mein aayenge, pehli do-screen story par router. Error boundary bhi defer — abhi crash karne wala kuch nahi (ponytail). Pehli data-loading screen par aayega.
- **Lesson:** "Abhi nahi" bhi ek decision hai — speculative code se bacho.

---

### `app/src/main.tsx`

**1. File ka job:** Application ka ignition key — CSS load, root dhoondhna, App mount karna.

**2. Kahan fit hai:** `index.html` ise chalu karta hai; yeh `App` ko `#root` mein daalta hai.

**3. Walkthrough:** Pehle `tokens.css` + `app.css` load → HTML mein `root` container dhoondho → React ko `StrictMode` (extra checks) ke saath start karo → `App` render.

**4. Function-by-function**
- **`createRoot(...).render(...)`**
  - Steps: CSS imports → `root` element pakdo → StrictMode ke andar App render.
  - I/O: DOM root + components andar → live UI bahar.
  - Micro analogy: switchboard — current connect karke screen on.
  - Why not simpler? Yeh React ka standard entry hai.
  - Watch-outs: `root` na mile to crash (`!` non-null assertion); CSS import order matter karta hai.

**9. Red Flags:** `document.getElementById("root")!` — root missing par white screen.
**8. Concepts:** entry point, StrictMode, mount, non-null assertion.

**Inline comments (posted):**
<!-- gh-comment-id: 4261623453 -->
> "`root` missing par graceful fallback?" · "Providers yahan honge ya `providers.tsx`?"
- **Status:** answered
- **Reply:** Root missing par React khud clear error deta hai, custom fallback se fayda nahi — no change. Providers `main.tsx` mein rahenge jab tak do se zyada na hon; phir `providers.tsx`. Pehla provider (#48) par decide hoga.
- **Lesson:** framework ka default error kaafi ho to extra code na badhao.

---

### `app/src/pwa-manifest.ts`

**1. File ka job:** PWA ki identity card — naam, colours, launch style, icons.
**2. Kahan fit hai:** `vite.config.ts` ise import karke `manifest.webmanifest` banata hai.
**3. Walkthrough:** Ek object export karta hai: naam/description, `start_url=/`, `display=standalone` (bina browser bar), theme/background colours **tokens.json se**, aur do icons.
**5. Block-level (settings sheet):** `name`, `short_name`, `start_url`, `display`, `theme_color = tokens.color.core.deepGreen`, `background_color = tokens.color.core.cream`, `icons[]`.
**9. Red Flags:** `maskable` icon nahi (Android crop ho sakta hai); colours tokens par depend (ab).
**8. Concepts:** manifest, standalone display, installability, maskable icon.

**Inline comments (posted):**
<!-- gh-comment-id: 4261631267 -->
> "Colours tokens.json se import karein?" · "Android maskable icon?" · "`start_url` mein utm param?"
- **Status:** answered (2 done, 1 deferred)
- **Reply:** Haan — `theme_color`/`background_color` ab `design/tokens.json` se (deepGreen, cream); test check karta hai. Maskable abhi nahi — logo mein safe-zone padding nahi, crop hoga; **F58**. utm param nahi — cached start URL badal jaata, abhi analytics bhi nahi.
- **Lesson:** "single source of truth" (tokens) ko code-level pe enforce karo, sirf niyat se nahi.

---

### `app/index.html`

**1. File ka job:** HTML entry point / skeleton — browser ka pehla document.
**3. Walkthrough:** Mobile viewport set → theme-color + icons attach → khaali `#root` container → `main.tsx` script chalu.
**5. Block-level:** `<meta viewport>`, `<meta theme-color content="#45654E">`, `apple-touch-icon`, `icon`, `<div id="root">`, `<script type="module">`.
**9. Red Flags:** theme-color hardcoded `#45654E`; manifest link explicit nahi (plugin inject karta hai).

**Inline comments (posted):**
<!-- gh-comment-id: 4261659720 -->
> "theme-color dynamically populate?" · "manifest link explicit?" · "iOS status-bar/apple-touch-icon?"
- **Status:** answered
- **Reply:** theme-color literal rakha (inject karne ke liye plugin chahiye); ab ek test hai jo drift par fail karta hai (manifest tokens.json se aata hai). Manifest link plugin inject karta hai aur e2e proof hai. apple-touch-icon add kar diya (owner iPhone par test karta hai). Status-bar style abhi nahi — real screen ke saath.
- **Lesson:** jab value hardcode karni pade, to ek test se usse source-of-truth se bandh do.

---

### `app/vite.config.ts`

**1. File ka job:** Build engine ka control sheet (assembly line).
**5. Block-level:** `plugins: [react(), VitePWA({ registerType: "autoUpdate", manifest, includeAssets: ["icons/*"] })]`.
**9. Red Flags:** `autoUpdate` silent reload; `includeAssets` pattern.

**Inline comments (posted):**
<!-- gh-comment-id: 4261703009 -->
> "autoUpdate ke liye update toast/prompt?" · "includeAssets broaden?" · "alias/chunk splitting?"
- **Status:** answered
- **Reply:** Update toast matter karta hai jab checkout/order tracking aayen — **F59** (due before #48). `includeAssets` `icons/*` kar diya (svg/webp cover). Alias/chunk abhi nahi (bundle 70 KB gzip).
- **Lesson:** PWA auto-update UX ek real product risk hai, sirf technical detail nahi.

---

### `app/vitest.config.ts`

**1. File ka job:** Unit test desk — kaunse tests kahan, kis environment mein.
**5. Block-level:** `include: ["tests/unit/**/*.test.ts"]`, `environment: "node"`.
**9. Red Flags:** `node` env mein browser APIs nahi milte (component tests aage jsdom maangenge).

**Inline comments (posted):**
<!-- gh-comment-id: 4261709864 -->
> "jsdom/happy-dom switch?" · "coverage threshold?" · "test folder intentional?"
- **Status:** answered
- **Reply:** Abhi `node`; pehli component test par jsdom ya per-file docblock. Coverage threshold abhi nahi (tests scenario-driven). Folder intentional — tests `tests/unit`+`tests/e2e` mein taaqi har test kisi story se link ho.

---

### `app/playwright.config.ts`

**1. File ka job:** E2E test track — browser automation settings.
**5. Block-level:** `testDir ./tests/e2e`, CI par 1 retry, `forbidOnly` CI par, `baseURL localhost:4173`, project = Chromium Pixel 7, `webServer` build+preview, timeout 120s.
**9. Red Flags:** sirf Chromium Pixel 7 (iOS WebKit nahi); timeout.

**Inline comments (posted):**
<!-- gh-comment-id: 4261686519 -->
> "WebKit/Mobile Safari add?" · "120s timeout enough?" · "reuseExistingServer?"
- **Status:** answered
- **Reply:** WebKit/iOS — Playwright Add-to-Home-Screen test nahi kar sakta, owner ka iPhone check manual row (**F60**). Timeout 120s kaafi (build ~2s). `reuseExistingServer` local true, CI false — CI par port clash nahi.
- **Lesson:** kuch cheezein (jaise iPhone install) automation se bahar hain — manual test row rakho.

---

### `app/tsconfig.json`

**1. File ka job:** TypeScript compiler ka rulebook.
**5. Block-level:** `target ES2022`, `strict true`, `noEmit`, `skipLibCheck`, `allowImportingTsExtensions`, `types: [vite/client, vite-plugin-pwa/client, node]`, `include: [src, tests, *.ts]`.
**9. Red Flags:** path aliases nahi.

**Inline comments (posted):**
<!-- gh-comment-id: 4261695367 -->
> "path aliases?" · "allowImportingTsExtensions issue?" · "skipLibCheck?"
- **Status:** answered
- **Reply:** Aliases nahi — relative imports theek; deep import ugly hone par `@/`. `allowImportingTsExtensions` sirf `vite.config.ts` ke liye; tests/build pass. `skipLibCheck` standard — sirf libraries ke `.d.ts` skip karta hai, hamara code nahi.

---

### `app/tests/unit/manifest.test.ts`

**1. File ka job:** Manifest inspector — installability + icons + token colours.
**3. Walkthrough / tests:** (1) name/standalone/start_url. (2) 192+512 icons + disk par exist. (3) colours sirf tokens ke. (4) colours exactly deepGreen/cream. (5) `index.html` theme-color manifest se match + apple-touch-icon.
**9. Red Flags:** leading-slash regex strict; maskable check nahi.

**Inline comments (posted):**
<!-- gh-comment-id: 4261645928 -->
> "status colours include karein?" · "leading slash assumption?" · "maskable purpose check?"
- **Status:** answered
- **Reply:** Status colours already `tokens.test.ts` (dusra test) mein covered; yeh file core+supporting check karti hai. Leading slash design se absolute — strict form hi contract. Maskable check **F58** ke saath.

---

### `app/tests/unit/tokens.test.ts`

**1. File ka job:** Colour drift inspector — CSS aur tokens.json match karein.
**3. Walkthrough / tests:** (1) har core+supporting colour CSS mein. (2) har order status colour CSS mein. (3) **reverse** — CSS mein koi aisa colour nahi jo tokens.json mein na ho.
**9. Red Flags:** string `.toContain()` fragile (shorthand/hsl); sirf colour tokens check.

**Inline comments (posted):**
<!-- gh-comment-id: 4261652435 -->
> "reverse check?" · "CSS parser?" · "non-colour tokens?"
- **Status:** answered (1 done, 2 deferred)
- **Reply:** Reverse check add kar diya. Shorthand/hsl nahi chahiye (file site se copy, full hex). CSS parser extra weight, fayda nahi. Non-colour tokens (type/spacing/radius) jab koi screen unhe use karegi.
- **Lesson:** drift-guard test **dono taraf** check kare — warna rogue colour chhupa reh jaata hai.

---

### `app/tests/e2e/app.spec.ts`

**1. File ka job:** Mystery shopper — real browser mein app ka poora flow.
**3. Walkthrough / tests:** (1) app khulti hai + heading dikhti hai. (2) manifest linked aur served (200). (3) service worker active. (4) **offline** ke baad bhi shell dikhti hai.
**9. Red Flags:** pehle offline test nahi tha (feedback ke baad aaya).

**Inline comments (posted):**
<!-- gh-comment-id: 4261639499 -->
> "offline readiness test?" · "iOS coverage?" · "explicit timeout?"
- **Status:** answered (1 done)
- **Reply:** Offline test add kar diya (`setOffline` + reload + shell visible). WebKit/iOS — **F60** manual. Timeout Playwright ka 30s default kaafi (e2e ~10s).

---

### `app/package.json` / `app/package-lock.json`

**1. Job:** shopping list (package.json) + exact material receipt (lockfile).
**5. Block-level:** scripts (`dev`, `build`, `test`, `test:e2e`, `verify`), deps (react 19), devDeps (vite 8, typescript 7, vitest 5, playwright, vite-plugin-pwa 2).
**9. Red Flags:** lockfile +6862 lines; caret ranges (`^`) drift kar sakte hain.

**Inline comments (posted `package-lock.json`):**
<!-- gh-comment-id: 4261671901 -->
> "CI/deploy time audit?" · "`npm ci` use karenge?"
- **Status:** answered
- **Reply:** App CI job ~45s (PR #59). Haan, CI `npm ci` use karta hai (aur deploys bhi).

---

### Docs updates: `docs/follow-ups.md`, `docs/process-trace.md`, `docs/tests/test-cases.md`
- `test-cases.md`: 8 lines — is PR ke unit/e2e tests story #39 se link hue.
- `follow-ups.md`: **F58** (maskable icon), **F59** (PWA update prompt), **F60** (WebKit/iOS manual test) — teeno is review se nikle.
- `process-trace.md`: 2 lines — story #39 ka record.

---

## What happened after review

- **Review comments post hue:** 13 Oct 2026, ~17:01–17:11 (by satvik-jain-iitd) — 12 files par 33 questions.
- **Replies:** klickbae8yt-star ne ~17:14 par 12 replies diye.
- **Follow-up commit (review ke baad):** `95316a8` — "manifest colours from tokens, touch icon, offline test, stricter token test". Files: `pwa-manifest.ts`, `index.html`, `app.spec.ts`, `manifest.test.ts`, `tokens.test.ts`, `vite.config.ts`, `tsconfig.json`, + follow-ups/test-cases.
- **Result:** 3 questions ne seedha code badla (manifest colours, apple-touch-icon, offline test, stricter token test). Baaki 3 future items ban gaye: **F58, F59, F60**.
- **Merge:** `bcd14d4` (13 Oct 2026, 17:16).
- **Is chapter ka big lesson:** ek accha review sawaal → turant code change **ya** ek registered follow-up. Kuch nahi girtा. Yeh "AI-code review" ka asli tarika hai.
