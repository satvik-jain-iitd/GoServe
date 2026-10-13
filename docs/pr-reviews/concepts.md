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
