# PR #62 — ci: deploy app/ to Vercel dev on push to dev

- **Branch:** `feat/41-dev-deploy` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** #41 "Dev deploy: push to dev publishes to Vercel goserve-app-dev" (epic #33, MVP 0)
- **State:** **OPEN** — `f3b70b4d` (2026-10-13)
- **Files:** 6 · **Lines:** +80 / -1 (1 commit)
- **Reviewer:** satvik-jain-iitd
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/62

> Tiffin service ki tarah: kitchen (`app/`) mein khana bane, pack ho, aur ek test customer ke address par pahunche. Yeh PR wahi delivery rule likhti hai.

---

## Overall review

## 1. Ek-line logline

> `Dev deploy: dev branch par app/ badle to app Vercel ke dev site par apne-aap publish ho jaata hai.`

## 2. Big Picture (Story & Goal)

- Story #41 (epic #33, MVP 0) ka kaam: jab `dev` par `app/` badle, to Vercel project `goserve-app-dev` par naya build pahunche. [VERIFIED]
- Persona: owner. Owner dev site khol kar dekhta hai ki naya app kaisa dikh raha hai.
- Yeh ADR-008 ko poora karta hai: dev site Vercel par, prod site Cloudflare par (prod = story #42, is PR mein nahi). [VERIFIED]
- Tiffin mein: kitchen ke andar ka order ab seedha test customer tak jaata hai, haath se nahi.

## 3. Yeh ab aaya kyun? (Context)

- Pehle: `ci.yml` sirf check karta tha (site, app, guard). Koi deploy job nahi tha. PR #59 ke baad ki mental-model note mein yeh likha hai. [VERIFIED]
- ADR-008 ke hisaab se: Vercel GitHub app ka link nahi hoga. Deploy GitHub Actions se hoga, Vercel CLI ke through. [VERIFIED]
- Is PR se unlock hota hai: owner ko ek stable dev URL milta hai. Iske bina har check ke liye manual kaam chahiye.
- Iske bina nahi ho sakta tha: dev URL ka koi auto-update.

## 4. Real-Life Analogy

Poori PR ek tiffin service ka setup hai.

1. Cloud kitchen = repo aur CI.
2. Dispatch rule board (kitchen ki deewar par) = `.github/workflows/deploy-dev.yml`.
3. Rule "sirf kitchen ke order par" = `paths:` filter (`app/**`).
4. Khana pakana = `npm ci` aur `npm run build`.
5. Standard dabba mein packing = `.vercel/output/` (static + config.json).
6. Delivery boy = Vercel CLI.
7. Delivery boy ka ID card = tiin secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).
8. Ek hi delivery boy ek samay par = `concurrency` block.
9. Tasting customer ka address = Vercel project `goserve-app-dev`.
10. Inspector jo rule board padhta hai, khana nahi chakhta = `scripts/test_deploy_dev.py`.
11. Register ki entries = `docs/tests/test-cases.md`, `docs/follow-ups.md`, `docs/process-trace.md`, `docs/LEARNINGS.md`.

## 5. Is PR mein naye Concepts (6)

- **Path filter (`paths:`)** — workflow sirf tab chale jab push mein listed folder badla ho. Kyun matter karta hai: galat trigger = bina wajah deploy. Real-life: "sirf kitchen ke order".
- **Concurrency group + cancel-in-progress** — ek samay par ek hi run. Naya run purane ko rok deta hai. Real-life: ek hi delivery boy.
- **`workflow_dispatch`** — GitHub ke Actions tab mein manual "Run workflow" button. Real-life: manager ka haath se bheja gaya order.
- **Prebuilt output (`.vercel/output`)** — ek fixed folder shape jo Vercel bina dobara build kiye serve karta hai. Real-life: standard dabba.
- **Repo secrets as env** — secrets ko job ke environment mein daalna. Real-life: delivery boy ka ID card.
- **Testing config as text** — test YAML file ko text ki tarah padhta hai aur phrases check karta hai. Yeh sirf board ka sahi hona check karta hai, delivery ka nahi. Real-life: inspector board padhta hai.

(Har concept ki detail `concepts.delta.md` mein hai.)

## 6. High-Level Flow

Journey: order kitchen se nikal kar test customer tak.

1. Coder ek PR `dev` mein merge karta hai jo `app/**` (ya workflow file) badalta hai. (Tiffin: kitchen mein naya order ready.)
2. GitHub Actions job `vercel` shuru hota hai. Ek samay par ek hi run; naya run purana cancel karta hai. (Ek delivery boy.)
3. Checkout aur Node 22 setup, npm cache ke saath. (Kitchen ka saman.)
4. `npm ci` aur `npm run build` in `app/`, output `app/dist`. (Cooking.)
5. `app/dist` ko `.vercel/output/static` mein copy, aur `config.json` mein `{"version":3}`. (Dabba packing.)
6. Vercel CLI (`vercel@latest`) prebuilt folder upload karta hai, teen secrets ke saath. (Delivery boy ID card dikhata hai.)
7. Vercel project `goserve-app-dev` dev URL par naya build serve karta hai. Vercel dobara build nahi karta, yeh `--prebuilt` ka matlab hai. (Customer ko khana milta hai.) [VERIFIED by reading the file; Vercel-side behaviour INFERRED until the first real run]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `.github/workflows/deploy-dev.yml` | Rule board: kab deploy chale, kaise pack ho, kahan bheje |
| `scripts/test_deploy_dev.py` | Inspector: rule board mein sahi baatein likhi hain ya nahi, check karta hai |
| `docs/tests/test-cases.md` | Test register: S1 aur S2 ki rows, aur manual URL check |
| `docs/follow-ups.md` | Follow-up register: F53 "In review" |
| `docs/process-trace.md` | Daily log: is story ke steps (aur ek purani PR ki row) |
| `docs/LEARNINGS.md` | Lessons book: teen nayi seekh |

## 8. Pieces aapas mein kaise baat karte hain

Text map (koi code run nahi hota, sirf dependencies):

- `dev` par push → `deploy-dev.yml` (trigger) → job `vercel` → `app/` (build input) → `app/dist` → `.vercel/output` → Vercel CLI → Vercel project `goserve-app-dev`.
- Teen secrets → job ka `env` → Deploy step (CLI inhe padhta hai).
- `scripts/test_deploy_dev.py` → `deploy-dev.yml` ko text ki tarah padhta hai (workflow ko chalata nahi).
- CI guard job → `python3 -m unittest discover -s scripts -p "test_*.py"` → yeh test har PR par chalta hai. [VERIFIED, ci.yml line 82]
- Docs files → story ka record (test register, follow-up register, daily log, lessons).

## 9. Pehle se kya badla

- 6 files, +80 / -1, ek commit `f3b70b4d`. [VERIFIED]
- Naya: `deploy-dev.yml` (+47), `test_deploy_dev.py` (+24). Docs mein chhoti entries: `test-cases.md` (+3), `process-trace.md` (+2), `LEARNINGS.md` (+3), `follow-ups.md` (+1 / -1).
- Ek row (`process-trace.md` row 121) PR #59 ki hai, is story ki nahi. Yeh sath mein aa gayi hai. [VERIFIED]
- Koi app code nahi badla. Koi existing workflow nahi badla. [VERIFIED from file list]

## 10. Macro Risks & Downstream Impact

1. **Green test ≠ working deploy.** Dono tests file ka text check karte hain. CI mein Vercel CLI kabhi nahi chalta. Pehla asli proof: merge ke baad pehla run. Check: manual row in `test-cases.md`. [VERIFIED]
2. **`vercel@latest` unpinned** (line 47). Vercel CLI ka naya major ya bad npm publish bina hamare commit ke deploy todh sakta hai. Check: major version pin karna. [VERIFIED line; impact INFERRED]
3. **`paths` mein `design/tokens.json` nahi.** `app/src/pwa-manifest.ts` build time par `../../design/tokens.json` import karta hai. Sirf tokens badle to dev site purane rang dikhayegi, jab tak koi `app/**` change na ho. Check: `paths` mein add karna. [VERIFIED import; stale-site effect INFERRED, high confidence]
4. **Secrets job-level `env` mein hain** (lines 20–23). Har step inhe dekhta hai, `npm ci` bhi, jo dependencies ke install scripts chalata hai. Check: `env` ko sirf Deploy step par rakhna. [VERIFIED structure; impact INFERRED]
5. **`config.json` mein koi rewrite nahi** (line 44). Abhi app mein router nahi hai, to koi asar nahi. Jab screens ke apne URL aayenge (stories #48–#51), refresh par 404 aa sakta hai. [INFERRED on Vercel behaviour, confidence 0.8]
6. **`workflow_dispatch` button sirf tab dikhega jab file `main` par ho.** `.github/` release branch se hi `main` tak jaata hai (project rule 17). Merge ka run phir bhi chalega, kyunki file khud `paths` mein hai (line 8). [VERIFIED; GitHub rule INFERRED, confidence 0.8]
7. **`--prod` aur `VERCEL_PROJECT_ID`.** `--prod` yahan dev project ka production target hai, jo theek hai. Agar project ID kabhi prod project ka ho jaye, to dev code real customers tak ja sakta hai. File mein koi check nahi. `cancel-in-progress` upload beech mein rok sakta hai; Vercel purana complete deploy live rakhta hai (INFERRED 0.8). Risk: low.
8. **Ek row galat PR ki.** `process-trace.md` row 121 PR #59 ki hai. Nuksan nahi, par ek PR mein do stories mix hain. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)

- Preview deploy har PR ke liye: story ka ponytail note. Ek stable dev URL kaafi hai abhi.
- Production deploy Cloudflare Pages par: story #42.
- UptimeRobot monitors dev URL par: F54 / story #55, URL live hone ke baad.
- SPA rewrite rule: abhi router nahi hai (Risk 5).
- Real end-to-end deploy test CI mein: har PR par real token chahiye. Manual pehla run row cover karta hai.

Samajhne wali baat: "nahi banaya" bhi design decision hai. Yeh PR chhota rakhne ke liye bani hai.

## 12. Testing Story

- **Red-first:** PR body mein `FileNotFoundError: .github/workflows/deploy-dev.yml` aur `FAILED (errors=2)` likha hai. Matlab test pehle chala, workflow file se pehle. [VERIFIED from PR body; reviewer ne dobara nahi chalaya]
- **Green:** PR body mein `Ran 11 tests in 0.026s OK`. 11 = scripts folder ke saare tests milakar. [VERIFIED from PR body]
- **Local:** `python3 -m unittest scripts/test_deploy_dev.py` → 2 tests OK. [VERIFIED]
- **CI:** guard job discover se yeh test chalta hai. PR CI green hai: Site pass, App pass, Guard pass (3/3). [VERIFIED]
- **Story match:**
  - S1 (dev push → deploy): trigger aur deploy step ka text check. Asli "URL 200 aur installable" manual hai, pending first deploy. [VERIFIED]
  - S2 (`site/` badle to deploy nahi): `paths` mein `app/**` hai, `site/` nahi. [VERIFIED]
- **Nahi tested:** Vercel output folder accept karega ya nahi; URL 200 deta hai ya nahi; `paths` filter sach mein `site/` ko rokta hai ya nahi (GitHub par bharosa).

## 13. Trade-offs & Alternatives

| Option chuna | Kyun | Kya chhoda |
|---|---|---|
| CI mein build, Vercel ko prebuilt files | Vercel project mein root directory nahi; ek hi build; CI Node version control karta hai | Vercel ke build logs aur framework auto-detect; `.vercel/output` contract hamara |
| GitHub Actions + Vercel CLI | ADR-008 (app galat account par, Hobby plan foreign commit author block kar sakta hai) | Vercel ke auto previews aur PR comments |
| `--prod` dev project par | Ek stable dev URL owner ke liye | Har push ka alag URL |
| Text test | Sasta, token PR par nahi, red-first possible | Behaviour ka proof |
| `vercel@latest` | Zero maintenance | Reproducibility (Risk 2) |

## 14. Patterns is PR se

- **Path filter:** workflow sirf apne folder ke badlav par chale. Entry: `on:` block.
- **Concurrency guard:** ek samay par ek run. Entry: `concurrency` block.
- **Build in CI, deploy prebuilt:** build ek jagah, deploy dusri jagah. Entry: Build aur Stage steps.
- **Secrets as env:** secrets sirf zaroori step tak. Entry: job `env` (aur Risk 4).
- **Config-as-text test:** YAML ko text maan kar phrases check karo. Entry: `test_deploy_dev.py`.

## 15. AI-Review Lens

- **Trust karna safe:** checkout, setup-node cache, `npm ci` + `npm run build` standard hain, `ci.yml` ke app job jaise hi. `concurrency` block ek standard pattern hai. [VERIFIED structure]
- **Interrogate karo:**
  - (a) `.vercel/output` folder ka shape aur `{"version":3}`. Yeh Vercel ke saath ek contract hai, jise sirf pehla run prove karega.
  - (b) `vercel@latest`.
  - (c) secrets job-level par.
  - (d) kya `paths` mein woh sab hai jo build padhta hai (nahi hai: `design/tokens.json`).
  - (e) ek text test ko "Pass" kehna.
- **Confident but risky:** PR body kehti hai "Vercel does not build twice". Yeh sach hoga agar prebuilt contract maana jaye, jo pehle run tak unproven hai. Aur `test-cases.md` S1 ko "Pass" likhta hai, jabki asli S1 (URL 200) abhi pending hai. [INFERRED]

## 16. Questions

**Top-3 abhi poocho:**

1. (Testability, `scripts/test_deploy_dev.py` line 11) Dono tests sirf YAML ka text padhte hain. Agar `.vercel/output` ka shape galat ho, to kaunsa test laal hoga? Pehle real run ke baad kya hum ek "smoke" check (URL 200) CI mein daal sakte hain?
2. (Risk, `.github/workflows/deploy-dev.yml` line 47) `vercel@latest` — kal Vercel CLI ka naya major aaya to hamari deploy bina kisi commit ke toot sakti hai. Major version pin karke jaan-boojh kar bump karna behtar?
3. (Assumptions, `.github/workflows/deploy-dev.yml` line 7) `paths` mein sirf `app/**` hai, par app build `design/tokens.json` import karta hai (`pwa-manifest.ts`). Sirf tokens badle to dev site purani rahegi. `design/tokens.json` bhi `paths` mein chahiye?

<details><summary>Poora question bank (16, 8 categories mein)</summary>

### 1 Purpose
- `.github/workflows/deploy-dev.yml` line 47: `--prod` dev project ka production target hai, theek. Par agar `VERCEL_PROJECT_ID` kabhi prod project ka ho gaya, to yeh workflow `dev` ko real customers tak bhej dega. Project ka naam kahin assert ho sakta hai (jaise `vercel project ls`) ya yeh risk accept?
- `docs/process-trace.md` line 129: Row 121 PR #59 ki hai, story #41 ki nahi. Yeh is PR mein kyun aayi — bas pichhli session ka bacha hua log? Theek hai, bas samajhna chahta hoon.

### 2 Understanding
- `.github/workflows/deploy-dev.yml` line 9: `workflow_dispatch` ka button tab tak nahi dikhega jab tak yeh file `main` par nahi hai (rule 17: `.github/` release branch se jaata hai). Pehla run merge se hi trigger hoga (file khud `paths` mein hai), sahi samjha? Owner manual run kab kar payega?
- `scripts/test_deploy_dev.py` line 15: Regex `vercel(@\S+)? deploy --prebuilt --prod` exact flags se bandha hai. Agar coder `--prod` hata de (preview deploy) to test laal — yeh jaan-boojh kar lock hai?

### 3 Assumptions
- `.github/workflows/deploy-dev.yml` line 7 (TOP-3): `paths` mein sirf `app/**` hai, par app build `design/tokens.json` import karta hai (`pwa-manifest.ts`). Sirf tokens badle to dev site purani rahegi. `design/tokens.json` bhi `paths` mein chahiye?
- `docs/LEARNINGS.md` line 64: "CI only runs on PRs whose base is `main` or `dev`" — yeh `ci.yml` ke `branches:` filter se aata hai, sahi? Stacked PR (feature par feature) kabhi hamare process mein allowed hai ya sirf galti se hua tha?

### 4 Risk
- `.github/workflows/deploy-dev.yml` line 47 (TOP-2): `vercel@latest` — kal Vercel CLI ka naya major aaya to hamari deploy bina kisi commit ke toot sakti hai. Major version pin karke jaan-boojh kar bump karna behtar?
- `.github/workflows/deploy-dev.yml` line 20: Teeno secrets job-level `env` mein hain, to `npm ci` (saari dependencies ke install scripts) bhi unhe dekh sakta hai. Sirf Deploy step par `env` rakhna safer nahi?

### 5 Alternatives
- `.github/workflows/deploy-dev.yml` line 13: `cancel-in-progress: true` — agar upload beech mein cancel ho to Vercel par purana deploy hi live rahega, ya aadha site dikh sakta hai? Queue (cancel false) kyun nahi chuna?

### 6 Impact
- `scripts/test_deploy_dev.py` line 18: S2 test sirf dekhta hai ki `site/` `paths` mein nahi hai. Agar koi `paths` block hata hi de (sab push par deploy), to regex `re.search` None dega aur test crash karega, fail nahi — yeh intended hai ya assert add karna chahiye?
- `docs/follow-ups.md` line 59: F53 "In review" — merge ke baad is PR mein hi "Done" hoga ya agli PR mein? (Taaki register sach rahe.)

### 7 Testability
- `scripts/test_deploy_dev.py` line 11 (TOP-1): Dono tests sirf YAML ka text padhte hain. Agar `.vercel/output` ka shape galat ho to kaunsa test laal hoga? Pehle real run ke baad kya hum ek "smoke" check (URL 200) CI mein daal sakte hain?
- `scripts/test_deploy_dev.py` line 1: Red-first proof PR body mein hai (`FileNotFoundError`, errors=2). Yeh red run ka output kahin save hota hai ya sirf PR body mein? (notebook ke liye kaafi hai, bas confirm.)
- `docs/tests/test-cases.md` line 33: Row S1 "Pass" likhti hai, par story ka S1 "URL returns 200 and installable" bhi kehta hai, jo abhi Pending hai (row 35). Kya S1 ko "Partly (workflow check) / URL pending" likhna zyada sach hoga?

### 8 Future
- `.github/workflows/deploy-dev.yml` line 44: `config.json` mein sirf `{"version":3}` hai, koi rewrite nahi. Jab customer/kitchen screens ke apne URL aayenge (#48–#51), refresh par 404 aayega? SPA fallback kab add hoga?
- `docs/tests/test-cases.md` line 35: Manual URL check pehle deploy ke baad kaun karega aur kahan record hoga — yahi row update hogi, ya F54 ke saath UptimeRobot se automatic hoga?

</details>

**Self-check (2–3 sawaal, khud se poochho):**

- Ek line mein: yeh workflow kab chalta hai aur kab nahi?
- `--prebuilt` ka matlab apne shabdon mein?
- Green test ke baad bhi deploy kyun fail ho sakti hai?

---

## Files (ek-ek)

### `.github/workflows/deploy-dev.yml`

**1. Job:** Rule board. Likha hai: `dev` par kya push ho to deploy chalna chahiye, kaise pack karna hai, aur kis address par bhejna hai.
**2. Kahan fit hai:** Trigger = merge to `dev`. Yeh file `app/` ko input leti hai, Vercel ko output deti hai. Flow ke step 2 se 6 tak yahi karti hai (merge ke baad). Test `scripts/test_deploy_dev.py` isko text ki tarah padhta hai.
**3. Walkthrough:** Kitchen wall par rule: "Jab `app/` mein kuch badle, ya yeh board badle, tab order uthao." Phir ek hi delivery boy order uthata hai (naya order purane ko rokta hai). Phir khana pakta hai (build), dabba mein pack hota hai (prebuilt output), delivery boy ID card dikha kar Vercel ko deta hai.
**4. Function-by-function (steps = chhote kaam):**
- **Trigger (`on:`, lines 3–9):** push `dev` par, aur sirf jab `app/**` ya yeh file badle. Manual button bhi hai. Real-life: "sirf kitchen ke order par" + manager ki haath se dispatch. [VERIFIED]
- **`concurrency` (lines 12–14):** group `deploy-dev`, cancel-in-progress true. Real-life: ek delivery boy. [VERIFIED]
- **Job `vercel` (lines 17–23):** Ubuntu machine par chalta hai. Teeno secrets job ke env mein. Real-life: delivery boy ka ID card jeb mein. Red flag: Risk 4. [VERIFIED]
- **Checkout + setup-node (lines 25–31):** code uthana, Node 22, npm cache `app/package-lock.json` par. Real-life: kitchen mein saman aur gas ready. [VERIFIED]
- **Build (lines 33–37):** `npm ci`, phir `npm run build` `app/` mein. Output `app/dist`. Real-life: cooking. [VERIFIED]
- **Stage prebuilt (lines 40–44):** `.vercel/output` banao, `app/dist` ko `static/` mein copy, `config.json` = `{"version":3}`. Real-life: standard dabba packing. [VERIFIED]
- **Deploy (lines 46–47):** `npx --yes vercel@latest deploy --prebuilt --prod`. Real-life: delivery boy nikla. [VERIFIED]

**5. Block-level reading:** `on:` block ek rule board ka section hai. `concurrency` block ek "one at a time" sign hai. Secrets block ek ID card ki drawer hai.
**6. Data ki journey:** `app/` source → `app/dist` (build) → `.vercel/output/static` + `config.json` (pack) → Vercel project (serve). Har step ka output agle step ka input hai.
**7. Connections map:** GitHub merge → yeh file → `app/` → Vercel CLI → `goserve-app-dev`. Test file isko padhta hai.
**8. Concepts:** path filter, concurrency, workflow_dispatch, prebuilt output, secrets as env (detail `concepts.delta.md`).
**9. Red Flags & Edge Cases:**
- `vercel@latest` unpinned (line 47). Serious: medium. [VERIFIED line; impact INFERRED]
- `design/tokens.json` `paths` mein nahi. Serious: medium, stale dev site. [VERIFIED import; effect INFERRED]
- Secrets job-level. Serious: medium. [VERIFIED structure; impact INFERRED]
- `config.json` mein rewrite nahi (line 44). Serious: low abhi, medium jab routes aayenge. [INFERRED 0.8]
- `--prod` + project ID swap ka risk (line 47). Serious: low. [INFERRED 0.8]
- `cancel-in-progress` (line 13): upload beech mein rukna. Serious: low. [INFERRED 0.8]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264133208 -->
> **Top-3** — `vercel@latest` — kal Vercel CLI ka naya major aaya to hamari deploy bina kisi commit ke toot sakti hai. Major version pin karke jaan-boojh kar bump karna behtar?
- **Status:** open

<!-- gh-comment-id: 4264133225 -->
> **Top-3** — `paths` mein sirf `app/**` hai, par app build `design/tokens.json` import karta hai (`pwa-manifest.ts`). Sirf tokens badle to dev site purani rahegi. `design/tokens.json` bhi `paths` mein chahiye?
- **Status:** open

<!-- gh-comment-id: 4264133237 -->
> Teeno secrets job-level `env` mein hain, to `npm ci` (saari dependencies ke install scripts) bhi unhe dekh sakta hai. Sirf Deploy step par `env` rakhna safer nahi?
- **Status:** open

<!-- gh-comment-id: 4264133247 -->
> `config.json` mein sirf `{"version":3}` hai, koi rewrite nahi. Jab customer/kitchen screens ke apne URL aayenge (#48–#51), refresh par 404 aayega? SPA fallback kab add hoga?
- **Status:** open

<!-- gh-comment-id: 4264133262 -->
> `workflow_dispatch` ka button tab tak nahi dikhega jab tak yeh file `main` par nahi hai (rule 17: `.github/` release branch se jaata hai). Pehla run merge se hi trigger hoga (file khud `paths` mein hai), sahi samjha? Owner manual run kab kar payega?
- **Status:** open

<!-- gh-comment-id: 4264133276 -->
> `--prod` dev project ka production target hai, theek. Par agar `VERCEL_PROJECT_ID` kabhi prod project ka ho gaya, to yeh workflow `dev` ko real customers tak bhej dega. Project ka naam kahin assert ho sakta hai (jaise `vercel project ls`) ya yeh risk accept?
- **Status:** open

<!-- gh-comment-id: 4264133286 -->
> `cancel-in-progress: true` — agar upload beech mein cancel ho to Vercel par purana deploy hi live rahega, ya aadha site dikh sakta hai? Queue (cancel false) kyun nahi chuna?
- **Status:** open

### `scripts/test_deploy_dev.py`

**1. Job:** Inspector. Do tests jo rule board (workflow file) ko text ki tarah padhte hain aur check karte hain ki sahi baatein likhi hain.
**2. Kahan fit hai:** CI guard job `python3 -m unittest discover -s scripts -p "test_*.py"` chalata hai, to yeh har PR par chalta hai. Target: `deploy-dev.yml`. [VERIFIED]
**3. Walkthrough:** Pehla test: kya board mein `dev` trigger hai, teeno secret names hain, aur deploy command `--prebuilt --prod` ke saath hai? Doosra test: kya `paths` mein `app/**` hai aur `site/` nahi?
**4. Function-by-function:**
- **`test_s1_push_to_dev_deploys_to_vercel` (lines 11–15):** teen cheezein check: branch `dev`, teeno `secrets.<NAME>` strings, aur regex `vercel(@\S+)? deploy --prebuilt --prod`. Real-life: inspector checklist: "kya order sahi likha hai?" [VERIFIED]
- **`test_s2_site_changes_never_trigger_it` (lines 17–20):** `paths:` block nikaalta hai, check karta hai `app/**` hai aur `site/` nahi. Real-life: "kya counter (site/) ke order rule mein ghus gaye?" [VERIFIED]

**5. Block-level reading:** Regex ek "exact phrase" card hai: kaunse shabd board mein hone hi chahiye.
**6. Data ki journey:** YAML file (text) → test → pass ya fail. Koi workflow nahi chalta.
**7. Connections map:** `deploy-dev.yml` → test → CI guard job.
**8. Concepts yeh file sikhati hai:** testing config as text (concepts.delta.md).
**9. Red Flags & Edge Cases:**
- Green test ka matlab sirf "board sahi likha hai", delivery nahi. Serious: high (for trust). [VERIFIED]
- Agar `paths` block hi na ho, regex None dega. Test fail hona chahiye ya crash? Serious: low. [INFERRED: crash expected, from question in brief]
- Regex exact flags par lock hai. Serious: low. [VERIFIED regex]
- Dono tests file ka text padhte hain: Vercel output shape nahi check hota. Serious: medium. [VERIFIED]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264133198 -->
> **Top-3** — Dono tests sirf YAML ka text padhte hain. Agar `.vercel/output` ka shape galat ho to kaunsa test laal hoga? Pehle real run ke baad kya hum ek "smoke" check (URL 200) CI mein daal sakte hain?
- **Status:** open

<!-- gh-comment-id: 4264133294 -->
> Agar koi `paths` block hata hi de (sab push par deploy), to regex `re.search` None dega aur test crash karega, fail nahi — yeh intended hai ya assert add karna chahiye?
- **Status:** open

<!-- gh-comment-id: 4264133299 -->
> Regex `vercel(@\S+)? deploy --prebuilt --prod` exact flags se bandha hai. Agar coder `--prod` hata de (preview deploy) to test laal — yeh jaan-boojh kar lock hai?
- **Status:** open

<!-- gh-comment-id: 4264133309 -->
> Red-first proof PR body mein hai (`FileNotFoundError`, errors=2). Yeh red run ka output kahin save hota hai ya sirf PR body mein? (notebook ke liye kaafi hai, bas confirm.)
- **Status:** open

### `docs/tests/test-cases.md`

**1. Job:** Test register. Har test ki row: kaunsa test, kis type ka, kya status.
**2. Kahan fit hai:** Story #41 ke S1 aur S2 yahan dikhte hain. Yeh PR lines 33–35 add karti hai.
**3. Walkthrough:** S1 (unit, workflow check) = Pass. S2 (unit) = Pass. "Dev URL returns 200 and the app is installable" = Manual, Pending (pehle deploy ke baad). [VERIFIED]
**4. Red flags:** S1 "Pass" likha hai, jabki S1 ka URL wala hissa pending hai. Register sach nahi dikhta. Serious: low-medium. [VERIFIED row text; judgement INFERRED]
**5. Testability:** Manual row ka owner aur record ka tarika pehle deploy par tay hoga (question dekho).
**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264133316 -->
> Row S1 "Pass" likhti hai, par story ka S1 "URL returns 200 and installable" bhi kehta hai, jo abhi Pending hai (row 35). Kya S1 ko "Partly (workflow check) / URL pending" likhna zyada sach hoga?
- **Status:** open

<!-- gh-comment-id: 4264133325 -->
> Manual URL check pehle deploy ke baad kaun karega aur kahan record hoga — yahi row update hogi, ya F54 ke saath UptimeRobot se automatic hoga?
- **Status:** open

### `docs/follow-ups.md`

**1. Job:** Follow-up register. Woh kaam jo abhi nahi hua, lekin bhoolna nahi hai.
**2. Kahan fit hai:** F53 (dev deploy) yahan hai. Status line 59 par badla: Open → "In review".
**3. Walkthrough:** F53 ka text ab kehta hai ki workflow story #41 mein add hua hai, PR open hai. [VERIFIED]
**4. Red flags:** Merge ke baad status "In review" hi reh sakta hai agar kisi ne update na kiya. Serious: low. [INFERRED]
**5. Testability:** Register mein kya sach hai, yeh manual check hai.
**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264133337 -->
> F53 "In review" — merge ke baad is PR mein hi "Done" hoga ya agli PR mein? (Taaki register sach rahe.)
- **Status:** open

### `docs/process-trace.md`

**1. Job:** Daily log. Har step ka ek row: kya hua, kisne kiya.
**2. Kahan fit hai:** Rows 121 aur 122 is PR mein add hui hain.
**3. Walkthrough:** Row 121 PR #59 ki hai (rebase, 16 threads answered). Row 122 is story ki hai: pehle failing test, phir workflow; Vercel project mein root directory nahi hai, isliye build prebuilt stage hota hai. [VERIFIED]
**4. Red flags:** Ek PR mein do stories mix. Nuksan nahi, par log saaf nahi. Serious: low. [VERIFIED]
**5. Testability:** Log ko kaun check karta hai? Yeh question hai.
**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264133345 -->
> Row 121 PR #59 ki hai (rebase, 16 threads), story #41 ki nahi. Yeh is PR mein kyun aayi — bas pichhli session ka bacha hua log? Theek hai, bas samajhna chahta hoon.
- **Status:** open

### `docs/LEARNINGS.md`

**1. Job:** Lessons book. Teen nayi seekh.
**2. Kahan fit hai:** Lines 64–66. Future PRs ke liye guide.
**3. Walkthrough:** (a) CI sirf PR par chalta hai jiska base `main` ya `dev` ho. Feature par feature wala stacked PR par koi check nahi dikhta. (b) Secret-scanning guard apne hi tests ko flag karta hai, to test fixtures string ke tukdon se bante hain. (c) `gh auth refresh` mein account flag nahi hota: switch, refresh, phir switch back. [VERIFIED from brief text]
**4. Red flags:** Lesson (a) ka source `ci.yml` ka `branches:` filter hai. Sahi hai ya nahi, yeh confirm hona chahiye. [INFERRED]
**5. Testability:** Lessons ko practice mein check karna hai. Abhi koi test nahi.
**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264133350 -->
> "CI only runs on PRs whose base is `main` or `dev`" — yeh `ci.yml` ke `branches:` filter se aata hai, sahi? Stacked PR (feature par feature) kabhi hamare process mein allowed hai ya sirf galti se hua tha?
- **Status:** open

---

## Handoff

State: 16 posted · 0 answered · 0 fixed · 0 open-fixes · actor: coder

You are the developer for GoServe PR #62. Do this: (1) reply on every thread (ids: the 16 inline threads of this review) with a 1–2 sentence answer; (2) the three Top-3 threads may need code: (a) pin the `vercel` major version in `.github/workflows/deploy-dev.yml` line 47; (b) add `design/tokens.json` to `paths` in `.github/workflows/deploy-dev.yml` line 7; (c) move the secrets `env` to the Deploy step in `.github/workflows/deploy-dev.yml` lines 20–23, or argue why not in the thread; (3) commit the uncommitted notebook files under `docs/pr-reviews/` plus `docs/process-trace.md` row 123 on `feat/41-dev-deploy`, one commit; (4) push; (5) reply "PR #62 threads answered at <sha>"; (6) reviewer runs `/tpm sync 62`.

_(PR par post hua — `satvik-jain-iitd`, review [5510091780](https://github.com/satvik-jain-iitd/GoServe/pull/62#pullrequestreview-5510091780), 16 inline threads, 14 Oct 2026.)_
