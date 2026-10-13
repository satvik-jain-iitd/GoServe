# PR #63 — ci: publish app/ to Cloudflare Pages goserve-app on main

- **Branch:** `feat/42-prod-deploy` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** #42 "Prod deploy: main publishes to Cloudflare Pages goserve-app" (epic #33, MVP 0)
- **State:** **APPROVED** — head `4b77e65` (2026-10-14, review 5510392206 by `satvik-jain-iitd`), merge pending
- **Files:** 5 · **Lines:** +81 / -0 (1 commit) (review ke baad: fix commit 4b77e65, 7 files)
- **Reviewer:** satvik-jain-iitd
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/63

> Tiffin service ka doosra address. PR #62 test customer (dev, Vercel) ke liye tha. Yeh PR real customers (prod, Cloudflare Pages) ke liye rule likhti hai. Same kitchen, alag delivery company, alag rule board.

---

## Overall review

## 1. Ek-line logline

> `Prod deploy: main par app/ badle to app Cloudflare Pages ke goserve-app par jaaye, par release ki packing list mein app abhi nahi hai.`

## 2. Big Picture (Story & Goal)

- Story #42 (epic #33, MVP 0): jab `main` par `app/` badle, to Pages project `goserve-app` par naya build pahunche. [VERIFIED]
- Persona: founder, demo dikhata hai. [VERIFIED]
- Serves ADR-001, ADR-008 aur rule 18. [VERIFIED from brief]
- Depend karta hai: scaffold story, aur code-only release branch (PLAN.md §2). [VERIFIED]
- Tiffin mein: kitchen ka khana ab real customers ke address tak bhi rule se pahunchna chahiye.

## 3. Yeh ab aaya kyun? (Context)

- Pehle: `main` par sirf investor site ka deploy tha (`deploy.yml`, project `goserve`, letsdwelo.in). [VERIFIED]
- Aaj `main` par yeh hai: `.github` (ci.yml, deploy.yml), `.gitignore`, `README.md`, `design`, `ops`, `site`. Koi `app/` nahi, koi `scripts/` nahi. [VERIFIED `git ls-tree origin/main`]
- Is PR se unlock hota hai: ek prod deploy rule file (`deploy-app.yml`). Story ke hisaab se yeh release PR ke `main` par merge hone par chalegi. [VERIFIED from story; release flow INFERRED]
- Iske bina: `goserve-app.pages.dev` par koi app nahi aata. Abhi yeh 522 hai, kyunki koi deployment nahi hai. [VERIFIED]

## 4. Real-Life Analogy

Poori PR ek tiffin service ka doosra address set karna hai.

1. Wahi kitchen (`app/`) = repo ka app folder.
2. Doosre address ka rule board = `.github/workflows/deploy-app.yml`.
3. "Sirf kitchen ke order par" = `paths:` (`app/**`, `design/tokens.json`, aur file khud).
4. Khana pakana = `npm ci` aur `npm run build` in `app/`.
5. Delivery boy ka ID card = do secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) jo `wrangler-action` ko diye jaate hain.
6. Address label = `--project-name=goserve-app`.
7. "Yeh real customer ki delivery hai" = `--branch=main`.
8. Showroom ka purana rule board = `deploy.yml` (investor site). Ise chhoona nahi hai.
9. Inspector = `scripts/test_deploy_app.py`.
10. Van jo dev kitchen se main tak khana le jaati hai = release branch (PLAN.md §2). Iski packing list mein aaj `app` nahi hai.

## 5. Is PR mein naye Concepts (5)

- **Cloudflare Pages Direct Upload (`pages deploy`)** — CI app build karta hai, phir folder upload karta hai. Pages use seedha serve karta hai. Real-life: hum khud pack karke delivery boy ko dete hain.
- **`--branch=main` = production** — Pages mein production branch ke deploy live maane jaate hain. Real-life: label par "real customer", "sample" nahi.
- **Release branch as a packing list** — `main` par sirf listed paths dev se aate hain. Jo list mein nahi, woh kabhi nahi pahunchta. Real-life: van ki packing list.
- **Mirror workflow** — ek kaam karne wala rule board copy karke sirf address badla. Sasta aur safe, par do boards alag ho sakte hain. Real-life: do shops ka ek hi rule board.
- **Negative test (neighbour guard)** — test ek aisi file padhta hai jo is PR ne nahi badli, taaki proof ho ki woh same hai. Real-life: inspector showroom ka board bhi check karta hai.

(Har concept ki detail `concepts.delta.md` mein hai.)

## 6. High-Level Flow

Journey: order kitchen se nikal kar real customer tak.

1. Release PR `main` mein merge hota hai, jo `app/**`, `design/tokens.json` ya workflow file badalta hai. (Tiffin: release van khana main tak laati hai.) Yeh step tab tak nahi hota jab tak release list mein `app` na ho (Risk 1).
2. Job `pages` shuru hota hai. Ek samay par ek hi run; naya run purana cancel karta hai. (Ek delivery boy.)
3. Checkout, Node 22, npm cache. (Kitchen ka saman.)
4. `npm ci` aur `npm run build` in `app/`, output `app/dist`. (Cooking.)
5. wrangler-action `dist` ko Pages project `goserve-app` par upload karta hai, branch `main` = production. (Dabba delivery boy ko.)
6. `goserve-app.pages.dev` naya build serve karta hai. Abhi yeh 522 hai, kyunki koi deployment nahi hai. (Customer ko khana milta hai.) [VERIFIED by reading the file; step 1 blocked per Verdict]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `.github/workflows/deploy-app.yml` | Rule board for real customers: `main` par publish karo |
| `scripts/test_deploy_app.py` | Inspector: naya board sahi address deta hai, aur purana showroom board chhoota nahi |
| `docs/tests/test-cases.md` | Test register: S1, S2 Pass; URL row Pending |
| `docs/follow-ups.md` | F61: Pages project banana owner ka kaam |
| `docs/process-trace.md` | Daily log: row 126 |

Note: is PR mein `docs/PLAN.md` aur `CLAUDE.md` nahi hain. Woh release list rakhte hain, aur usay fix karna hai (Risk 1).

## 8. Pieces aapas mein kaise baat karte hain

Text map (koi code run nahi hota, sirf dependencies):

- `main` par merge → `deploy-app.yml` (trigger) → job `pages` → `app/` aur `design/tokens.json` (build input) → `app/dist` → wrangler-action → Pages project `goserve-app`.
- Do secrets → wrangler-action `with:` inputs.
- `scripts/test_deploy_app.py` → `deploy-app.yml` aur `deploy.yml` dono ko text ki tarah padhta hai (kuch chalata nahi).
- Release branch (PLAN.md §2, aur CLAUDE.md rule 17) → `main` ka packing list. Yeh PR mein nahi hai, par is PR ko chalne ke liye zaroori hai.
- CI Guard job (promoted `ci.yml`) → `scripts/guard.py` aur `scripts` ke tests. [VERIFIED ci.yml on dev]

## 9. Pehle se kya badla

- 5 files, +81 / -0, ek commit `fd29487`. [VERIFIED]
- Naya: `deploy-app.yml` (+44), `test_deploy_app.py` (+32). Docs mein chhoti entries: `test-cases.md` (+3), `follow-ups.md` (+1), `process-trace.md` (+1). [VERIFIED]
- `deploy.yml` (investor site) ko nahi chheda gaya. [VERIFIED]
- App code nahi badla. [VERIFIED from file list]

## 10. Macro Risks & Downstream Impact

**Reviewer verdict: needs-fix.** Must-fix: release packing list mein `app` aur `scripts` add karo. [VERIFIED from brief]

1. **Release list mein `app` aur `scripts` nahi.** `docs/PLAN.md` §2 (checkout line) aur `CLAUDE.md` rule 17 mein yeh paths nahi hain. Pehli release par workflow file `main` par aati hai, run chalta hai, aur `npm ci` `app/` mein fail hota hai (folder hi nahi hai). Promoted `ci.yml` Guard job ko `scripts/guard.py` chahiye. Impact: prod deploy kabhi nahi chalega; release PR ka CI fail hoga. Fix: dono paths list mein add karo (docs). [VERIFIED main tree aur PLAN text; failure mode INFERRED, high confidence]
2. **Pages project `goserve-app` shayad nahi hai.** CI non-interactive hai. Project missing ho to run "Project not found" se fail hoga, auto-create nahi. Owner ek baar banaye (F61). [INFERRED 0.8; existence UNVERIFIED]
3. **Text tests phir se.** Asli proof pehli release aur URL 200 hai. [VERIFIED]
4. **Merge conflict with PR #62.** Dono PR `process-trace.md` aur `test-cases.md` ke same tail mein rows jodte hain. `dev` row 120 par khatam hota hai. #62 rows 121–124 jodta hai. Yeh PR row 126 ko rebase ke baad 125 karega. [VERIFIED]
5. **S1 negative check mein trailing space.** `assertNotIn("--project-name=goserve ", ...)` `goserve` ko line ke end par ya `goserve"` par miss kar sakta hai. Weak guard. Fix: regex `--project-name=goserve\b` ya `goserve(?!-app)`. [VERIFIED line 20]
6. **`cancel-in-progress` prod par.** Do release ek saath aaye to pehli cancel hogi. Pages purana complete deploy live rakhta hai, to half site nahi dikhega. One-founder cadence ke liye fine. [INFERRED 0.8]
7. **S2 test `deploy.yml` ke text se judi hai.** Site workflow mein koi bhi legit change (comment bhi) jo `app/` string jodta hai ya project flag badalta hai, test ko laal karega. Yeh rule 18 ka pehra hai. Coder ko pata hona chahiye. [VERIFIED]
8. **`--branch=main` production tabhi hai jab Pages project ka production branch `main` ho.** Direct Upload project ka default `main` hai ya nahi, yeh unverified hai. Nahi to yeh preview ban jayega. [INFERRED 0.6]
9. **Do boards drift kar sakte hain** (`deploy.yml` vs `deploy-app.yml`). Koi test node version ya action version same hone ko check nahi karta. Low. [VERIFIED: no such test]

## 11. Jo jaan-boojh kar NAHI hai (Scope)

- Custom domain app ke liye: story ka ponytail; ADR-003 ka temporary domain; abhi `goserve-app.pages.dev`.
- Project auto-create: ponytail; owner ek baar karega (F61).
- Preview deploy har PR par Cloudflare par: dev Vercel par hai (ADR-008).
- URL ka smoke test CI mein: pehli release tak pending; manual row cover karta hai.

Samajhne wali baat: "nahi banaya" bhi design decision hai. Yeh PR chhoti hai, aur investor site (letsdwelo.in) ko nahi chhoti: `deploy.yml` untouched hai.

## 12. Testing Story

- **Red-first:** PR body mein `FileNotFoundError: .github/workflows/deploy-app.yml` aur `FAILED (errors=2)` hai. Matlab test pehle chala, workflow file se pehle. [VERIFIED from PR body; reviewer ne dobara nahi chalaya]
- **Green:** PR body mein `Ran 11 tests in 0.029s OK`. [VERIFIED from PR body]
- **Local:** `python3 -m unittest scripts/test_deploy_app.py` → OK (2 tests). [VERIFIED]
- **CI:** App pass, Guard pass. Site fetch ke time chal raha tha. [VERIFIED]
- **Story match:**
  - S1 (`app/` main par → `goserve-app`; URL 200): trigger, paths, project, secrets ka text check. URL 200 manual, pehli release tak pending. Gap: release list `app` ko main tak nahi laati (Verdict). [VERIFIED]
  - S2 (letsdwelo.in untouched): test `deploy.yml` padhta hai, `--project-name=goserve --branch=main` aur `app/` nahi. [VERIFIED]
- **Nahi tested:** project exist karta hai ya nahi; upload chalta hai ya nahi; URL 200 (manual); release list poori hai ya nahi (Risk 1, aaj koi test nahi pakad sakta).
- **test-cases.md rows:** 2 Pass + 1 Pending.

## 13. Trade-offs & Alternatives

| Option chuna | Kyun | Kya chhoda |
|---|---|---|
| `deploy.yml` ka mirror | Ponytail; rule 18 ke hisaab se site job ko kabhi na chhuo | Ek shared workflow; drift ka risk |
| Direct Upload from Actions | ADR-001/008 ka pattern site already use karta hai; account alag rehte hain | Cloudflare-side build logs; automatic previews |
| `--branch=main` production | Ek live URL | Staged prod previews |
| Text tests | Sasta, red-first possible | Behaviour ka proof (same as #62) |

## 14. Patterns is PR se

- **Mirror workflow:** kaam karne wala board copy karo, sirf address badlo. Entry: `deploy-app.yml` aur `deploy.yml` ka compare.
- **Negative test (neighbour guard):** ek aisi file padho jo badli nahi, proof ke liye ki woh same hai. Entry: `test_deploy_app.py` lines 23–27.
- **Path filter aur concurrency:** #62 wale hi patterns. Entry: `on:` aur `concurrency` blocks.
- **Secrets as step inputs:** secrets sirf us step ke `with:` mein. Entry: Publish step lines 38–44.
- **Config-as-text test:** YAML ko text maan kar phrases check karo. Entry: `test_deploy_app.py`.

## 15. AI-Review Lens

- **Trust karna safe:** checkout, setup-node cache, build, aur wrangler-action@v3 ke inputs `deploy.yml` jaise hi hain. Secrets step inputs mein hain. Action major par pinned hai. [VERIFIED by reading both files]
- **Interrogate karo:**
  - (a) Jis cheez par yeh workflow depend karta hai (`app/` main par), woh kabhi sach hogi? AI ne pattern copy kiya, release list nahi dekhi.
  - (b) Trailing-space wali negative assertion.
  - (c) Pages project exist karta hai ya nahi.
  - (d) #62 ke saath conflict.
- **Confident but risky:** PR body kehti hai `goserve-app.pages.dev` release PR merge hone tak 522 rahega. Yeh sach hai. Par release ke baad bhi packing list na badli, to yeh 522 hi rahega. Story ka "Depends on: code-only release branch (PLAN.md §2)" yeh hint tha. [INFERRED]

## 16. Questions

**Top-3 abhi poocho:**

1. (Assumptions, `.github/workflows/deploy-app.yml` line 6) Yeh `app/**` par trigger hota hai, par release checklist (PLAN.md §2 ka `git checkout origin/dev --` line, aur CLAUDE.md rule 17) mein `app` hai hi nahi. `main` par aaj `app/` folder nahi hai. Pehli release par yeh run `npm ci` par fail hoga. Saath mein `scripts` bhi chahiye, kyunki promoted `ci.yml` ka Guard job `scripts/guard.py` chalata hai. Dono list mein isi PR mein add karoge?
2. (Risk, `.github/workflows/deploy-app.yml` line 44) `--project-name=goserve-app`: agar project exist nahi karta to CI (non-interactive) mein wrangler fail karega ya auto-create? Owner ko F61 kab karna hai: release se pehle, ya pehle run ke fail hone ke baad?
3. (Testability, `scripts/test_deploy_app.py` line 20) `assertNotIn("--project-name=goserve ", ...)` trailing space par tika hai. `--project-name=goserve` line ke end par ho (ya `goserve"`) to miss hoga. `goserve-app` ko chhod kar exact `goserve` pakadne ke liye regex (`--project-name=goserve\b` ya `goserve(?!-app)`) behtar?

<details><summary>Poora question bank (15, 8 categories mein)</summary>

### 1 Purpose
- `.github/workflows/deploy-app.yml` line 40: Secrets `with:` inputs mein hain, job `env` mein nahi, #62 ke fix jaisa. wrangler-action inhe sirf apne step tak rakhta hai, `npm ci` ko nahi dikhte. Sahi samjha?

### 2 Understanding
- `.github/workflows/deploy-app.yml` line 14: `cancel-in-progress: true` prod par. Do release ek saath aaye to pehli cancel. Dev ke liye accept kiya tha; prod ke liye queue (cancel false) safer nahi?
- `scripts/test_deploy_app.py` line 6: `read` helper lambda. `test_deploy_dev.py` mein alag tarika tha (`WF` path + `open`). Dono test files ek chhota shared helper le sakte hain, ya itna chhota hai ki copy theek hai?

### 3 Assumptions
- `.github/workflows/deploy-app.yml` line 6 (TOP-1): Yeh `app/**` par trigger hota hai, par release checklist mein `app` nahi hai. Pehli release par `npm ci` fail hoga. `scripts` bhi chahiye. Dono list mein isi PR mein add karoge?
- `.github/workflows/deploy-app.yml` line 44: `--branch=main` tabhi production hai jab Pages project ka production branch `main` ho. Direct Upload se bana project default `main` leta hai, ya owner ko set karna hoga? Nahi to yeh preview URL ban jayega.
- `docs/tests/test-cases.md` line 35: "Pending first release" ka matlab kab? #41 + #42 merge ke baad turant ek `release/<name>`, ya MVP 0 demo par? Owner ka call hai. Tumhara suggestion kya hai, aur release list fix uske pehle hona chahiye na?

### 4 Risk
- `.github/workflows/deploy-app.yml` line 44 (TOP-2): `--project-name=goserve-app`. Agar project exist nahi karta to CI mein wrangler fail karega ya auto-create? Owner ko F61 kab karna hai: release se pehle, ya pehle run ke fail hone ke baad?

### 5 Alternatives
- `.github/workflows/deploy-app.yml` line 38: `wrangler-action@v3` major pinned (dev wale PR mein `vercel@64` pin karna pada tha). Yeh `deploy.yml` ki copy hai. Dono boards ek jaise rahen (node version, action version), iske liye koi check hai? S2 sirf site ke project flag ko dekhta hai.

### 6 Impact
- `scripts/test_deploy_app.py` line 24: S2 `deploy.yml` ko padhta hai. Site workflow mein koi legit change (string `app/` aaye, ya project flag badle) to yeh test laal. Yeh jaan-boojh kar rule 18 ka pehra hai, aur tab test bhi saath update hoga, theek?
- `docs/process-trace.md` line 129: Row 126. `dev` abhi 120 par hai, #62 rows 121–124 add kar raha hai, aur dono PR same jagah append karte hain. #62 pehle merge hoga to yahan conflict aayega. Merge ke baad `dev` par rebase karke row 125 karoge?

### 7 Testability
- `scripts/test_deploy_app.py` line 20 (TOP-3): `assertNotIn("--project-name=goserve ", ...)` trailing space par tika hai. Regex behtar?
- `scripts/test_deploy_app.py` line 13: Dono tests phir text-only (jaise #62). Pehla asli proof pehli release ke baad 200. Dev (Vercel) aur prod (Pages) ka URL smoke check ek hi script ho sakta hai, F54 ke saath?

### 8 Future
- `.github/workflows/deploy-app.yml` line 10: `workflow_dispatch`. Yeh file release ke saath `main` par aayegi, to button turant milega (dev wale se ulta). Owner manual prod deploy kab dabayega: sirf emergency, ya har demo se pehle?
- `scripts/test_deploy_app.py` line 1: "leaves the investor site alone". Jab app ko apna domain milega (ADR-003 ke baad), kya sirf `--project-name` / domain settings badlenge, ya naya workflow? Abhi se soch rakhna chahiye?
- `docs/follow-ups.md` line 68: F61 owner ke paas hai. Reviewer ke vault mein bhi Cloudflare token nahi mila. Ek read-only Cloudflare token (`Pages: Read`) vault mein rakhein, taaki agent `cf pages deployments list` se project check kar sake, bina owner ko rokke?

</details>

**Self-check (2–3 sawaal, khud se poochho):**

- Release van ki packing list mein kya kya hai, aur kya chhoot raha hai?
- `--branch=main` ka matlab Pages ke liye?
- Yeh PR investor site (letsdwelo.in) ko kaise bachata hai?

---

## Files (ek-ek)

### `.github/workflows/deploy-app.yml`

**1. Job:** Rule board for real customers. Likha hai: `main` par kya badle to app build karna hai, kaise pack karna hai, aur kis address par bhejna hai. Tiffin: doosre address ka rule board.
**2. Kahan fit hai:** Trigger = release PR ka `main` par merge. Input = `app/` aur `design/tokens.json`. Output = Pages project `goserve-app`. Flow ke steps 2 se 5 yahin hote hain. Test `scripts/test_deploy_app.py` ise text ki tarah padhta hai.
**3. Walkthrough:** Rule: "Jab `main` par app ka khana (`app/`) ya rang ki list (`design/tokens.json`) badle, ya yeh board badle, tab order uthao." Phir ek hi delivery boy order uthata hai; naya order purane ko rokta hai. Phir khana pakta hai (build). Dabba (`dist`) Cloudflare ke delivery boy ko diya jata hai, address `goserve-app`, label "production".
**4. Function-by-function (steps = chhote kaam):**
- **Trigger (`on:`, lines 3–10):** push `main` par, sirf jab `app/**`, `design/tokens.json` ya yeh file badle. Manual button bhi (line 10). Real-life: "sirf kitchen ke order par" + manager ka haath se bheja order. [VERIFIED]
- **Comment (line 12):** likha hai ki yeh apna file aur apna project hai; `deploy.yml` nahi chhoti. [VERIFIED]
- **`concurrency` (lines 13–15):** group `deploy-app`, cancel-in-progress true. Real-life: ek delivery boy. [VERIFIED]
- **Job `pages` (lines 18–23):** Ubuntu machine, working folder `app`. Real-life: kitchen ka counter. [VERIFIED]
- **Checkout + setup-node (lines 25–31):** code uthana, Node 22, npm cache `app/package-lock.json` par. Real-life: kitchen mein saman aur gas. [VERIFIED]
- **Build (lines 33–36):** `npm ci`, phir `npm run build`. Output `app/dist`. Real-life: cooking. [VERIFIED]
- **Publish (lines 38–44):** wrangler-action@v3 ko `apiToken` aur `accountId` `with:` mein diye gaye (line 40), working folder `app`. Command: `pages deploy dist --project-name=goserve-app --branch=main`. Real-life: delivery boy ka ID card, address label, aur "yeh production hai". [VERIFIED]

**5. Block-level reading:** `on:` ek rule board ka section hai. `concurrency` ek "ek-ek karke" sign hai. `with:` delivery boy ko di gayi parchi hai, sirf usi ke liye.
**6. Data ki journey:** `app/` source → `app/dist` (build) → Pages `goserve-app` (upload, branch main = production). Har step ka output agle step ka input hai.
**7. Connections map:** release PR merge → yeh file → `app/` aur `design/tokens.json` → wrangler-action → Cloudflare Pages. Test file isko padhta hai.
**8. Concepts:** Direct Upload, `--branch=main`, mirror workflow (detail `concepts.delta.md`).
**9. Red flags & edge cases:**
- Release list mein `app` nahi. Serious: must-fix (prod deploy kabhi nahi chalega). [VERIFIED main tree + PLAN text]
- Pages project `goserve-app` exist nahi karta to run fail. Serious: medium. [INFERRED 0.8; existence UNVERIFIED]
- `--branch=main` tabhi production jab project ka production branch `main` ho. Serious: medium. [INFERRED 0.6]
- `cancel-in-progress` prod par (line 14): upload beech mein rukna. Serious: low. [INFERRED 0.8]

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264290860 -->
> **Top-3** — Yeh `app/**` par trigger hota hai, par release checklist (PLAN.md §2 ka `git checkout origin/dev --` line, aur CLAUDE.md rule 17) mein `app` hai hi nahi — `main` par aaj `app/` folder nahi hai. Pehli release par yeh run `npm ci` par fail hoga. Saath mein `scripts` bhi chahiye, kyunki promoted `ci.yml` ka Guard job `scripts/guard.py` chalata hai. Dono list mein isi PR mein add karoge?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Fix ho gaya, commit 4b77e65 mein: `app` aur `scripts` dono release line mein hain (PLAN.md section 2 aur CLAUDE.md rule 17). Naya test bhi hai, jo in dono ke bina laal hota.
- **Lesson:** Trigger tabhi sach hai jab uske inputs us branch par ho sakte hon. Workflow nahi, packing list check karo.

<!-- gh-comment-id: 4264290873 -->
> **Top-3** — `--project-name=goserve-app` — agar project exist nahi karta to CI (non-interactive) mein wrangler fail karega ya auto-create? Owner ko F61 kab karna hai: release se pehle, ya pehle run ke fail hone ke baad?
- **Status:** answered
- **Reply (klickbae8yt-star):** Non-interactive wrangler project nahi banata, fail karta hai. Owner F61 ke tahat project pehle banayega, isliye pehli release par run fail nahi hoga.
- **Lesson:** Non-interactive CI kabhi create nahi karta. Owner ek baar pehle banata hai.

<!-- gh-comment-id: 4264290879 -->
> `cancel-in-progress: true` prod par — do release ek saath aaye to pehli cancel. Dev ke liye accept kiya tha; prod ke liye queue (cancel false) safer nahi?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Sahi kaha. 4b77e65 mein `cancel-in-progress: false` hai, to do prod releases ek ke baad ek chalenge.
- **Lesson:** Prod queue karta hai, dev cancel karta hai: ek hi knob, alag risk.

<!-- gh-comment-id: 4264290891 -->
> `wrangler-action@v3` major pinned (dev wale PR mein `vercel@64` pin karna pada tha) — yeh `deploy.yml` ki copy hai. Dono boards ek jaise rahen (node version, action version), iske liye koi check hai? S2 sirf site ke project flag ko dekhta hai.
- **Status:** answered
- **Reply (klickbae8yt-star):** Abhi koi check nahi hai, aur maine add nahi kiya. Dono files chhoti hain aur PR mein review hoti hain. Drift hua to shared versions ek jagah laaunga.
- **Lesson:** Do mirror files chupchap drift karti hain. Teesri copy par dobara dekhna.

<!-- gh-comment-id: 4264290899 -->
> Secrets `with:` inputs mein hain, job `env` mein nahi — #62 ke fix jaisa. wrangler-action inhe sirf apne step tak rakhta hai, `npm ci` ko nahi dikhte — sahi samjha?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan. `wrangler-action` secrets step ke `with:` mein leta hai. `npm ci` pehle wale step mein hai aur unhe kabhi nahi dekhta.
- **Lesson:** Step inputs secrets ko utna hi tight rakhte hain jitna step env.

<!-- gh-comment-id: 4264290909 -->
> `workflow_dispatch` — yeh file release ke saath `main` par aayegi, to button turant milega (dev wale se ulta). Owner manual prod deploy kab dabayega — sirf emergency, ya har demo se pehle?
- **Status:** answered
- **Reply (klickbae8yt-star):** Zyadatar emergency ke liye, ya fail run ko dobara chalane ke liye. Button file `main` par aate hi kaam karega, par yeh normal demo routine ka hissa nahi hai.
- **Lesson:** Manual button emergency aur re-run ke liye hai, routine ke liye nahi.

<!-- gh-comment-id: 4264290915 -->
> `--branch=main` tabhi production hai jab Pages project ka production branch `main` ho. Direct Upload se bana project default `main` leta hai, ya owner ko set karna hoga? Nahi to yeh preview URL ban jayega.
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Direct Upload projects default `main` lete hain, par main check nahi kar sakta. F61 mein 'production branch `main`' jod diya hai, taaki owner project banate waqt confirm kare.
- **Lesson:** Jo default check nahi ho sakta, use insaan ki checklist line bana do.

### `scripts/test_deploy_app.py`

**1. Job:** Inspector. Do tests jo dono rule boards (naya aur showroom) ko text ki tarah padhte hain. Tiffin: inspector board padhta hai, khana nahi chakhta.
**2. Kahan fit hai:** `ci.yml` ka Guard job `unittest discover -s scripts` chalata hai. Yeh `ci.yml` dev par hai; main par yeh tab aayega jab release aayegi. Target: `deploy-app.yml` aur `deploy.yml`. [VERIFIED ci.yml on dev]
**3. Walkthrough:** Pehla test: naye board mein `main` trigger hai, paths mein `app/**` aur tokens hain, project naam `goserve-app` hai, purana `goserve` flag nahi hai, aur dono secret names hain. Doosra test: showroom ka board waisa hi hai (`--project-name=goserve --branch=main`, `app/` nahi), aur naye board ke paths mein `site/` nahi hai.
**4. Function-by-function:**
- **`read` (line 6):** kisi bhi workflow file ko text mein padhta hai. Real-life: inspector ka photocopier.
- **`test_s1_app_on_main_publishes_to_goserve_app` (lines 13–21):** check karta hai: `branches: [main]`, paths block mein `app/**` aur `design/tokens.json`, `--project-name=goserve-app`, `goserve` (trailing space ke saath) absent, aur dono secret names. [VERIFIED]
- **`test_s2_site_deploy_is_untouched` (lines 23–27):** `deploy.yml` mein `--project-name=goserve --branch=main` hai aur `app/` nahi; is workflow ke paths mein `site/` nahi. Real-life: "kya showroom ka board badla?" [VERIFIED]

**5. Block-level reading:** Ek `assertIn` ek "exact phrase card" hai: yeh shabd board mein hone hi chahiye.
**6. Data ki journey:** YAML file (text) → test → pass ya fail. Koi workflow nahi chalta.
**7. Connections map:** `deploy-app.yml` + `deploy.yml` → test → `ci.yml` Guard job.
**8. Concepts:** Negative test, testing config as text (detail `concepts.delta.md`).
**9. Red flags & edge cases:**
- Trailing space (line 20): `goserve` check kuch cases miss karta hai. Serious: low-medium. [VERIFIED line 20]
- S2 `deploy.yml` ke text se judi hai (line 24). Serious: low; rule 18 ke liye intended. [VERIFIED]
- Dono tests text-only. Cloudflare ka behaviour nahi dekhte. Serious: medium. [VERIFIED]
- `read` helper #62 wale test se alag hai (line 6). Serious: low.

**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264290923 -->
> **Top-3** — `assertNotIn("--project-name=goserve ", ...)` trailing space par tika hai — `--project-name=goserve` line ke end par ho (ya `goserve"`) to miss. `goserve-app` ko chhod kar exact `goserve` pakadne ke liye regex (`--project-name=goserve\b` ya `goserve(?!-app)`) behtar?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Achha pakda. 4b77e65 mein test ab `--project-name=goserve(?!-app)` check karta hai, to line ke end wala case bhi nahi chhootega.
- **Lesson:** Negative assertion ko boundary chahiye, trailing space nahi.

<!-- gh-comment-id: 4264290932 -->
> S2 `deploy.yml` ko padhta hai — site workflow mein koi legit change (string `app/` aaye, ya project flag badle) to yeh test laal. Yeh jaan-boojh kar rule 18 ka pehra hai, aur tab test bhi saath update hoga, theek?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan, jaan-boojh kar. Yeh rule 18 ka pehra hai. Site deploy mein asli badlav ho to yeh test usi PR mein update hoga.
- **Lesson:** Guard test ka coupling jaan-boojh kar hai. Coupling hi point hai.

<!-- gh-comment-id: 4264290941 -->
> Dono tests phir text-only (jaise #62). Pehla asli proof pehli release ke baad 200. Dev (Vercel) aur prod (Pages) ka URL smoke check ek hi script ho sakta hai, F54 ke saath?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan, smoke check hi asli proof hai. Yeh F54 (UptimeRobot) ke saath pehli release ke baad aayega, dev aur prod dono ke liye. Abhi yahan nahi bana.
- **Lesson:** Ek smoke check dev aur prod dono ke liye, F54 ke saath, pehli release ke baad.

<!-- gh-comment-id: 4264290950 -->
> `read` helper lambda — `test_deploy_dev.py` mein alag tarika tha (`WF` path + `open`). Dono test files ek chhota shared helper le sakte hain, ya itna chhota hai ki copy theek hai?
- **Status:** answered
- **Reply (klickbae8yt-star):** Copy chhoti hai, isliye chhod di. Teesra workflow test aaya to ek shared helper laaunga.
- **Lesson:** Do baar copy karo, teesri baar share karo.

<!-- gh-comment-id: 4264290957 -->
> "leaves the investor site alone" — jab app ko apna domain milega (ADR-003 ke baad), kya sirf `--project-name` / domain settings badlenge, ya naya workflow? Abhi se soch rakhna chahiye?
- **Status:** answered
- **Reply (klickbae8yt-star):** Domain badalne par Pages project ki settings badlegi, is workflow ki file nahi. Project name badla to test aur workflow dono saath badlenge.
- **Lesson:** Domain settings project mein rehti hain, workflow mein nahi.

### `docs/tests/test-cases.md`

**1. Job:** Test register. Har test ki row: kaunsa test, kis type ka, kya status. Tiffin: delivery ka register.
**2. Kahan fit hai:** Rows 33–35 is PR mein add hoti hain. Tail #62 ke saath same jagah hai. [VERIFIED]
**3. Walkthrough:** S1 (unit) = Pass. S2 (unit) = Pass. `goserve-app.pages.dev` returns 200 (aaj 522) = Manual, pehli release PR ke baad Pending. [VERIFIED]
**4. Red flags:** Manual row abhi pending hai, yeh sahi hai. Serious: low. [INFERRED]
**5. Testability:** Yeh row tab Pass hogi jab asli URL 200 dega. Manual check ka owner abhi tay nahi hai (sawaal dekho).
**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264290977 -->
> "Pending first release" — pehli release PR kab? #41 + #42 merge ke baad turant ek `release/<name>`, ya MVP 0 demo par? Owner ka call, par tumhara suggestion kya hai, aur release list fix (upar wala sawaal) uske pehle hona chahiye na?
- **Status:** answered
- **Reply (klickbae8yt-star):** Mera suggestion: #41 aur #42 merge hone ke baad, aur release list fix merge hone ke baad, turant release. Isse 18 Oct demo se pehle kai din asli deploy milenge. Yeh owner ka call hai.
- **Lesson:** Release list fix ke baad turant release. Demo se pehle din-bhar ke asli deploy.

### `docs/follow-ups.md`

**1. Job:** Follow-up register. Woh kaam jo abhi nahi hua, lekin bhoolna nahi hai. Tiffin: owner ka ek baar ka kaam, delivery address (Pages project) banana.
**2. Kahan fit hai:** F61 line 68.
**3. Walkthrough:** F61: Pages project `goserve-app` hona chahiye. Agent ke paas Cloudflare token nahi hai. Owner ek baar banaye (Pages → Create → Direct Upload), agar pehla run "project not found" bole. App sirf release PR se `main` tak pahunchta hai. [VERIFIED from brief]
**4. Red flags:** Token nahi hai, to agent project check nahi kar sakta. Serious: medium. [VERIFIED reviewer vault check]
**5. Testability:** Project ka hona sirf pehle run par pata chalega. [VERIFIED: not tested]
**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264290987 -->
> F61 owner ke paas hai. Reviewer ke vault mein bhi Cloudflare token nahi mila. Ek read-only Cloudflare token (`Pages: Read`) vault mein rakhein, taaki agent `cf pages deployments list` se project check kar sake, bina owner ko rokke?
- **Status:** answered → **code badla**
- **Reply (klickbae8yt-star):** Achha idea. 4b77e65 mein F62 jud gaya hai. Token read-only hoga, aur sirf project aur deploys check karne ke liye.
- **Lesson:** Read-only token agent ko kaam karne deta hai, bina risk badhaaye.

### `docs/process-trace.md`

**1. Job:** Daily log. Har step ki ek row. Tiffin: delivery diary ki ek entry.
**2. Kahan fit hai:** Row 126 line 129. `dev` abhi row 120 par hai.
**3. Walkthrough:** Row 126: story #42, pehle failing test, phir workflow; `deploy.yml` nahi chheda; F61 log hua. Rebase ke baad yeh row 125 hogi. [VERIFIED from brief]
**4. Red flags:** #62 ke saath row number clash aur merge conflict. Serious: low. [VERIFIED]
**5. Testability:** Log ko kaun check karta hai, yeh sawaal hai.
**10. Inline Comment Questions (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4264290963 -->
> Row 126 — `dev` abhi 120 par hai, #62 rows 121–124 add kar raha hai, aur dono PR same jagah append karte hain. #62 pehle merge hoga to yahan conflict aayega. Merge ke baad `dev` par rebase karke row 125 karoge?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan. #62 merge hone ke baad `dev` par rebase karunga aur row number tab badlunga.
- **Lesson:** Jo PRs same file mein likhte hain: rebase, renumber. Koi jadoo nahi.

---

## Handoff

> State: 15 posted · 1 must-fix · actor: coder
>
> You are the developer for GoServe PR #63 (branch feat/42-prod-deploy). Do this: (1) must-fix in this PR: add `app` and `scripts` to the release path list in `docs/PLAN.md` section 2 (the `git checkout origin/dev --` line) and `CLAUDE.md` rule 17; without them `main` never gets the app and the promoted Guard job has no `scripts/guard.py`; (2) after PR #62 merges, rebase this branch on `dev` and renumber process-trace row 126 to 125; (3) reply on all 15 review threads in 1-2 sentences; (4) push and reply "PR #63 threads answered at <sha>"; (5) continue development: start story #43 "Schema: 7 tables and the legal-status rule" (epic #34) on `feat/43-schema` from `dev` while you wait.
>
> _(PR par post hua — `satvik-jain-iitd`, review 5510284430, 15 inline threads, 14 Oct 2026.)_

- **Dev reply:** rebased on dev, new sha 4b77e65, tests pass
- **Verified:** CI green on 4b77e65 (Site, App, Guard) [VERIFIED]; 5 fixes in 4b77e65; 0 open threads; trace row stays 126 [VERIFIED]
- **Approved:** review 5510392206 (satvik-jain-iitd); handoff comment 6155893179 [VERIFIED]

**Owner handoff (Romanized Hindi):**

```text
State: PR #63 approved, merge pending · actor: owner

1. PR #63 ko squash-merge karo: feat/42-prod-deploy → dev. Merge ke baad branch delete kar do.
2. Pages project `goserve-app` banao: Cloudflare → Pages → Create → Direct Upload. Production branch `main` rakho (F61).
3. Uske baad release PR ka time hai. Coder `release/<name>` main se kholega, aur list ki paths dev se legi.
4. Release merge hone ke baad `goserve-app.pages.dev` check karo: 200 aana chahiye.
5. Dev URL (`goserve-app-dev.vercel.app`) ko phone par khol kar app install check karo. Yeh manual row update hogi.
```

**Coder paste-block (English):**

```text
State: PR #63 approved, merge pending · actor: coder

You are the developer for GoServe PR #64 (story #43, branch feat/43-schema). Do this:
1. After PR #63 merges, rebase feat/43-schema on dev.
2. Copy the notebook bundle from /private/tmp/claude-501/-Users-satvikjain-Documents-GoServe/aa3d69ad-418a-46fc-b6e5-07aa857fd7f3/scratchpad/tpm/bundle/docs/ into docs/pr-reviews/.
3. As the last step before you push PR #64, append the process-trace and LEARNINGS rows for this session.
4. Push, then reply "PR #64 ready for review at <sha>".
5. After the owner confirms the Pages project goserve-app exists, open release/<name> from main. Take these paths from dev: site app scripts design/tokens.json design/brand ops .github .gitignore README.md.
```

## What happened after review

- **Review comments post hue:** 14 Oct 2026, `satvik-jain-iitd` ne 15 questions post kiye (review 5510284430).
- **Replies:** 15 ke 15 jawab `klickbae8yt-star` se. **15 answered**, 0 open.
- **Fix commit:** `d568dee`, rebase ke baad `4b77e65` mein. 5 cheezein badli:
  1. Release list mein `app` aur `scripts` (`docs/PLAN.md` section 2, `CLAUDE.md` rule 17). Naya test: `test_release_list_carries_the_app_and_its_guard`.
  2. `cancel-in-progress: false`, taaki prod deploys queue mein chalen.
  3. F61 mein line: project banate waqt production branch `main` confirm karo.
  4. Negative check regex: `--project-name=goserve(?!-app)`.
  5. F62 follow-up mein jud gaya: read-only Cloudflare token vault ke liye.
- **Rebase:** `dev` par, #62 merge hone ke baad. Outcome ke hisaab se trace row 126 hi rahi (dev 125 tak pahunch gaya). [VERIFIED]
- **CI on 4b77e65:** Site, App, Guard green. [VERIFIED]
- **Status:** **APPROVED**, merge pending (owner karega). [VERIFIED]
- **First dev deploy (PR #62 merge):** run 38472797824, dev sha 9a59432, succeeded. `https://goserve-app-dev.vercel.app/` 200, `/manifest.webmanifest` 200 `application/manifest+json`. [VERIFIED by curl] Phone par install check: owner, manual.

## Reviewer's take (mere thoughts)

**Kya achha raha:**
- 15 mein se 5 jawab ne code badla. Baaki ya to saaf reason diya ("Copy chhoti hai, isliye chhod di"), ya risk ko naam diya.
- Coder ne Q18 par seedha kaha ki CI project nahi banata, aur owner ka step pehle rakha. Yeh sahi jagah par ek insaan ka kaam hai.

**Kahan dhyan dena hai:**
- AI ne ek chalta hua workflow copy kiya. Par kabhi nahi poochha ki uske inputs (`app/`) `main` par pahunch sakte hain ya nahi. Release ki packing list mein `app` tha hi nahi.
- Reader ke sawaal ("Dono list mein isi PR mein add karoge?") ne woh gap pakda jo koi test nahi pakad sakta tha. Ab naya test uski guard karta hai.
- Ek fark note karna hai: reply mein row number badalne ki baat thi, par outcome mein row 126 hi hai. Agle PR mein dekhna.
- F62 follow-up mein jud gaya hai. Token abhi banaya gaya hai ya nahi, yeh brief mein nahi hai.

**Big lesson:** AI ne ek chalta hua workflow copy kiya, par yeh nahi poocha ki uske inputs `main` par pahunch sakte hain ya nahi. Reader ke sawaal ne woh gap pakda jo koi test nahi pakad sakta tha. Ab ek test woh gap band rakhta hai.
