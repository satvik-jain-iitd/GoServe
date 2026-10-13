# PR #59 — ci: add app and guard CI jobs, pre-commit hooks and commit guidelines

- **Branch:** `feat/40-app-ci` → `dev`
- **Author:** klickbae8yt-star (development account)
- **Story / issue:** [#40](https://github.com/satvik-jain-iitd/GoServe/issues/40) (epic #33)
- **State:** **MERGED** — `fa9a345b` (2026-10-13, by `satvik-jain-iitd`)
- **Files:** 10 · **Lines:** +240 / -0 (final; review ke baad +20)
- **Reviewer:** satvik-jain-iitd
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/59

> PR #58 ne `app/` banayi. Yeh PR uske liye **automatic checking** laata hai.

---

## Overall review

### 1. Ek-line logline
Har code change par automatic checking — app ke tests chalein, aur galat cheezein (secret, bada file, merge marker, kharab commit message) block ho jaayein.

### 2. Big Picture (Story & Goal)
Product level par yeh PR **do panne** laati hai: (1) `app/` ke liye CI, aur (2) ek **guard** jo repo ke rules ko code mein badalta hai. Epic #33 (MVP 0) ke andar story #40. Persona = developer. Yeh user-facing feature nahi hai; yeh **dev team ka safety net** hai.

### 3. Yeh ab aaya kyun? (Context)
PR #58 ne app banayi, par usse koi automatic check nahi tha. Iske bina:
- Galti se koi **secret** ya **500KB file** commit ho kar main mein ja sakta hai.
- `app/` ke tests kabhi CI mein nahi chalenge.
- Branch protection ke liye koi **required check** nahi hai.
Isliye story #40: CI job + pre-commit + commit rules. (Follow-up **F57**: merge ke baad yeh checks ko required banana.)

### 4. Real-Life Analogy
Factory ka quality gate:
1. `guard.py` = inspector ka **checklist** (secret, size, markers, message).
2. `.pre-commit-config.yaml` = **ghar par** check — factory chhodne se pehle.
3. CI `guard` job = factory ka **final gate** — lock hone se pehle.
4. CI `app` job = product ke **apne tests** (lint, unit, e2e, build).
5. `test_guard.py` = inspector ka apna **training exam**.
6. `COMMIT_GUIDELINES.md` = shipping label ke rules.

### 5. Is PR mein naye Concepts
- **CI (Continuous Integration):** har change par automatic checks. *Analogy:* har delivery se pehle factory gate.
- **Pre-commit hook:** commit hone se **pehle** chalne wala local check. *Analogy:* ghar se nikalne se pehle jeb check.
- **Conventional Commits:** commit message ka fixed format (`type(scope): text`). *Analogy:* parcel par standard label.
- **Guard (rules-as-code):** repo ke rules ko script mein likhna. *Analogy:* inspector ka printed checklist.
- **PR size limit:** ek PR mein max 50 files. *Analogy:* ek baar mein ek truck se zyada maal nahi.

### 6. High-Level Flow
1. Dev `git commit` karta hai → pre-commit hook chalta hai: `guard.py files` (staged files) + `check_msg_file.py` (message). Fail = commit ruk gaya.
2. Commit push + PR open.
3. GitHub Actions CI chalta hai — teen jobs: `site`, `app`, `guard`.
4. `app` job: `npm ci` → lint (typecheck) → unit → e2e (build include) — `app/` folder mein.
5. `guard` job: guard ke unit tests → changed files check (`guard.py files`) → PR size (`guard.py count`) → commit messages (`guard.py msg`).
6. Koi job fail = required check fail = merge block (F57 ke baad).

### 7. The Cast (files ka role)
| File | Role |
|---|---|
| `scripts/guard.py` | Inspector ka checklist (files / msg / count) |
| `scripts/test_guard.py` | Inspector ka training exam (7 tests) |
| `scripts/check_msg_file.py` | Patla wrapper — commit-msg hook ke liye |
| `.pre-commit-config.yaml` | Ghar par check (local hooks) |
| `COMMIT_GUIDELINES.md` | Commit label ke rules |
| `.github/workflows/ci.yml` | Factory ka final gate (3 jobs) |
| `.gitignore` | `__pycache__/` add (Python bytecode ignore) |
| `docs/follow-ups.md` | F57 add (checks ko required banana) |
| `docs/process-trace.md` | Steps 99–100 record |
| `docs/tests/test-cases.md` | 3 nayi test rows (story #40) |

### 8. Pieces aapas mein kaise baat karte hain
- `ci.yml` (guard job) → `guard.py` chalata hai.
- `.pre-commit-config.yaml` → `guard.py files` + `check_msg_file.py`.
- `check_msg_file.py` → `guard.check_message` import karta hai.
- `test_guard.py` → `guard` ke functions test karta hai.

```
pre-commit ──> guard.py files
            └─> check_msg_file.py ──> guard.check_message
CI app job  ──> app/ (lint, unit, e2e)
CI guard job ─> guard.py (files, count, msg) + test_guard.py
```

### 9. Pehle se kya badla
+220 / -0, 10 files. Sab **naya ya addition** (deletions zero). Naya:
- `scripts/guard.py` (+68), `scripts/test_guard.py` (+50), `scripts/check_msg_file.py` (+8).
- `.pre-commit-config.yaml` (+15), `COMMIT_GUIDELINES.md` (+14).
Badla:
- `ci.yml`: 2 naye jobs (`app` +58 lines, `guard`) + `guard` job.
- `.gitignore`: `__pycache__/`.
- 3 docs: follow-ups (F57), process-trace (2 rows), test-cases (3 rows).

### 10. Macro Risks & Downstream Impact
- **Secret scan sirf kuch patterns:** `guard.py` ka SECRET regex limited hai. Ek naya secret format bina pakde nikal sakta hai. *(Top-3 risk)*
- **Guard push par skip:** `guard` job ke files/msg steps `if: pull_request` — direct push par sirf unit tests chalte hain.
- **pre-commit manual install:** hook tabhi chalta hai jab dev ne `pre-commit install` kiya ho. Naye contributor ke liye friction; CI hi asli gate hai.
- **CI time:** ab 3 jobs (site + app + guard). App job ~45s (PR note).
- **Bootstrap:** guard khud apne aap par pass karta hai, par guard KO kaun guard karta hai?

### 11. Jo jaan-boojh kar NAHI hai (Scope)
Story ka ponytail note: **matrix builds** aur **coverage gates** nahi banaye. Deliberately stdlib-only (koi `gitleaks`, koi pre-commit plugins). Koi deploy step nahi. Yeh "halka guard" ek decision hai — bhaari security tooling baad mein.

### 12. Testing Story
**Red first** (proof): `python3 -m unittest scripts/test_guard.py` → `ModuleNotFoundError: guard`, `FAILED (errors=1)`. Phir `guard.py` likha → **green**.
- **7 unit tests** (`scripts/test_guard.py`): clean file pass; secret block (OpenRouter + PRIVATE KEY); 600KB file block; merge marker block; unclosed code block block; commit messages (4 ok, 5 bad); PR size (50 ok, 51 block).
- **CI proof:** is PR ka apna CI run (job `app`, `guard`). Story #40 ke scenarios **S1** (app checks) aur **S2** (bad commits block).
- **VERIFIED:** red-first failure PR body mein paste hai; test-cases.md mein 3 rows (2 Pass, 1 "Pending first PR run").

### 13. Trade-offs & Alternatives
| Decision | Kyun | Chhoda kya |
|---|---|---|
| Stdlib-only guard | Zero dependency, har jagah chalta | gitleaks jaisi gehri secret scan nahi |
| `repo: local` hooks | No external plugin | Contributor ko `pip install pre-commit` |
| Ek `guard.py`, teen commands | Ek importable module | Teen alag CLI files zyada clean hote |
| Guard CI par + pre-commit | Defense in depth | Dono jagah rules duplicate (drift risk) |
| `COMMENT` review only | PM merge gate nahi karta | — |

### 14. Patterns is PR se
- **Rules-as-code:** repo ke rules (`CLAUDE.md` rule 12/13) ko `guard.py` mein likha. *Kahan:* `guard.py` docstring.
- **Defense in depth:** pre-commit (local) + CI (remote) — do layer. *Kahan:* `.pre-commit-config.yaml` + `ci.yml`.
- **Red-first test:** pehle fail, PR body mein failure paste. *Kahan:* `test_guard.py`.
- **Config as file:** `ci.yml`, `pre-commit-config.yaml` — sab settings ek jagah.

### 15. AI-Review Lens
- **Trust kar sakte ho:** simple stdlib guard, idiomatic GitHub Actions setup, red-first tests. Sab clean aur safe.
- **Interrogate karo:** secret regex ki coverage (sabse bada risk — ek security guard jo saare secrets nahi pakadta); guard job ka push-event skip; pre-commit install friction; guard aur doc ke rules ka drift; who-guards-the-guard.
- PM checklist: story match (haan — S1+S2), scope (matrix/coverage jaan-boojh kar nahi), blast radius (CI + saare future commits), failure modes (naya secret format, direct push), reversibility (naye files, easy undo), proof (7 tests + CI run).

### 16. Questions
> **Top 3 abhi poocho**

1. **(Risk)** Secret regex sirf kuch known patterns pakadta hai — ek naya secret format (Supabase/Stripe) bina pakde nikal jayega. Yeh guard ki sabse badi chink hai. Kaise close karenge?
2. **(Risk)** `guard` job ke file/message checks sirf `pull_request` event par chalte hain — direct push par nahi. Kya yeh intended hai?
3. **(Understanding)** Guard khud apne aap par pass karta hai, par guard KO kaun guard karta hai? Kya ek self-check test CI mein hai?

<details><summary>Poora question bank (16 sawaal — files ke saath post hue)</summary>

**Purpose / Understanding**
- Teen commands ek file mein — todhna chahiye ya nahi? — guard.py
- e2e build khud karta hai — alag build step kyun nahi? — ci.yml
- `fetch-depth: 0` kyun zaroori? — ci.yml
- Fixtures runtime tempfile mein — kyun? — test_guard.py
- `repo: local` hooks, koi external plugin nahi — kyun? — .pre-commit-config.yaml
- `check_msg_file.py` patla wrapper — kyun alag? — check_msg_file.py

**Assumptions**
- SECRET regex sirf known patterns — naye formats miss. — guard.py
- `MAX_BYTES`/`MAX_FILES` numbers kahan se? — guard.py
- Doc ke 12 types aur regex sync rahenge? — COMMIT_GUIDELINES.md

**Risk / Edge**
- MARKER sirf line-start par — indented marker chhoot jayega? — guard.py
- Guard job push par skip — intended? — ci.yml
- Sirf 2 secret patterns tested; github_pat/AKIA/JWT untested. — test_guard.py
- `exclude` regex aur CI grep — drift ho sakta hai? — .pre-commit-config.yaml
- `open(sys.argv[1])` path missing par crash. — check_msg_file.py

**Improvement / Testability**
- Guard-on-itself test CI mein? — guard.py, test_guard.py
- Step naam 'Type check' par script `lint` — confusing. — ci.yml
- pre-commit install onboarding mein likha hai? — .pre-commit-config.yaml

</details>

### 17. Self-check (halka)
1. Bina file kholé batao: pre-commit aur CI guard mein farak kya hai? (jawab: pre-commit = local, commit se pehle; CI = remote, push ke baad.)
2. Is PR ke baad system mein kya juda? (jawab: har change par automatic checking + rules-as-code guard.)
3. Ek secret format ka socho jo `SECRET` regex nahi pakdega — kya woh is guard se nikal jayega?

---

## Files (ek-ek)

### `scripts/guard.py`

**1. Job:** Repo ke rules ka checklist, code mein. Teen kaam: files / msg / count.
**2. Kahan fit hai:** CI `guard` job aur pre-commit dono ise chalate hain. Yeh `check_msg_file.py` ko bhi feed karta hai.
**3. Walkthrough:** Charge par `cmd` dekho → `files` ho to har file: 500KB? secret? merge marker? `.md` code block band? → `msg` ho to Conventional Commit check → `count` ho to 50 files check → errors print + exit code.
**4. Function-by-function**
- **`check_files(paths)`** → har path par: size, secret regex, merge marker, `.md` fence count. I/O: paths → error list. Analogy: inspector har box kholta hai. Watch-out: binary skip, sirf kuch secret patterns.
- **`check_message(msg)`** → pehli line par regex + 72 char check. Analogy: shipping label ka format. Watch-out: sirf subject check, body nahi.
- **`check_count(n)`** → 50 files se zyada par error. Analogy: ek truck mein max maal.
- **`__main__`** → `cmd` dispatch.
**5. Block-level:** `MAX_BYTES`/`MAX_FILES` settings; `SECRET`/`MARKER`/`FENCE`/`MESSAGE` regex = rules ka dil.
**6. Data:** paths ya strings andar → error strings bahar (exit code fail).
**9. Red Flags:** limited secret patterns (VERIFIED — regex mein 5 patterns); indented marker (INFERRED); 72-char message limit (VERIFIED).

**Inline comments (posted by satvik-jain-iitd):**
<!-- gh-comment-id: 4262738287 -->
> Teen commands ek file mein — todhna chahiye ya nahi?
- **Status:** answered
- **Reply (klickbae8yt-star):** Jaan-boojh kar ek file. Teen commands same limits share karte hain, CI/pre-commit ek jagah se chalate hain. ~150 lines se bada ho to todenge.
<!-- gh-comment-id: 4262738302 -->
> **Top-3** — SECRET regex sirf known patterns; naye formats miss.
- **Status:** answered → **code badla**
- **Reply:** Haan, 80% goal. Supabase keys JWT hain (pattern cover karta hai). Naya commit Stripe `sk_live_` add kiya. Naya format = ek regex + ek test line.
<!-- gh-comment-id: 4262738312 -->
> MARKER sirf line-start par — indented marker chhoot jayega?
- **Status:** answered
- **Reply:** Git marker column 0 par likhta hai, `^` sahi hai. Indented match docs ko false-flag karta (code block ke andar conflict dikhe to). Waisa hi rakha.
<!-- gh-comment-id: 4262738324 -->
> `MAX_BYTES`/`MAX_FILES` numbers kahan se?
- **Status:** answered
- **Reply:** CLAUDE.md rule 12 (50 files) aur rule 13 (500KB), PLAN.md 9.1. Andaza nahi.
<!-- gh-comment-id: 4262738333 -->
> **Top-3** — guard-on-itself test CI mein?
- **Status:** answered → **code badla**
- **Reply:** Sahi point. `test_guard_passes_on_itself` add kiya — har `scripts/*.py` par guard chalata hai. Regex dheela ho kar apne hi files par false-positive de, to CI fail. Secret tests khaali-regex bhi pakadte hain.

### `scripts/test_guard.py`

**1. Job:** Guard ka apna training exam (7 tests).
**2. Kahan fit hai:** `guard.py` ko test karta hai; CI guard job aur local `unittest` chalate hain.
**3. Walkthrough:** tempdir banao → chhoti files likho (clean, secret, bada, marker, unclosed) → `check_files` ka jawab verify karo → message + count bhi.
**4. Function-by-function**
- **`write(d, name, text, size)`** → helper: temp file banata hai. Analogy: exam ka blank answer sheet.
- **`setUp`** → har test ka fresh temp dir. Analogy: har student ki apni copy.
- **7 test methods** → ek-ek rule ka check.
**9. Red Flags:** sirf 2 secret patterns tested (VERIFIED); baaki regex branches untested.

**Inline comments (posted):**
<!-- gh-comment-id: 4262738340 -->
> Fixtures runtime tempfile mein — kyun?
- **Status:** answered
- **Reply:** Haan, repo clean. Doosri wajah: test file mein secret-jaisa string ho to guard apne hi tests ko flag kar deta (CI mein ek baar hua tha).
<!-- gh-comment-id: 4262738345 -->
> Sirf 2 secret patterns tested; baaki untested.
- **Status:** answered → **code badla**
- **Reply:** Agreed. Ab har pattern ka ek sample (Anthropic, GitHub token, GitHub PAT, AWS, Stripe, JWT). Samples parts se banti hain taaki file clean rahe.
<!-- gh-comment-id: 4262738354 -->
> Guard apne files par clean — CI mein verify hota hai?
- **Status:** answered → **code badla**
- **Reply:** Haan. `test_guard_passes_on_itself` naya hai, aur guard job har PR par saare `test_*.py` chalata hai.

### `.github/workflows/ci.yml`

**1. Job:** Factory ka final gate — teen jobs (site, app, guard).
**2. Kahan fit hai:** Har PR/push par GitHub chalata hai; `app` aur `guard` is PR se aaye.
**3. Walkthrough:** `app` job → app/ mein lint, unit, e2e. `guard` job → guard tests, changed files check, commit message check (sirf PR par).
**4. Block-level:** `on: [push, pull_request]`; `app` job `working-directory: app`; `guard` job `fetch-depth: 0`; conditional steps.
**9. Red Flags:** e2e build include (VERIFIED); guard files/msg steps PR-only (VERIFIED); fetch-depth 0 (VERIFIED); step naam 'Type check' par script `lint` (VERIFIED).

**Inline comments (posted):**
<!-- gh-comment-id: 4262738362 -->
> e2e build khud karta hai — alag build step kyun nahi?
- **Status:** answered
- **Reply:** Jaan-boojh kar, galti nahi. `playwright.config.ts` ka `webServer` app build + preview karta hai, isliye `npm run test:e2e` build kar deta hai. Doosra build step repeat hota. Step naam 'build included' kehta hai.
<!-- gh-comment-id: 4262738372 -->
> **Top-3** — guard files/msg steps push par skip — intended?
- **Status:** answered
- **Reply:** Intended. `main`/`dev` par push ruleset block karta hai, isliye har change PR se aata hai — jahan poore checks chalte hain. Push check PR run ko bas repeat karta.
<!-- gh-comment-id: 4262738381 -->
> `fetch-depth: 0` kyun zaroori? CI time par asar?
- **Status:** answered
- **Reply:** Haan, zaroori. Shallow clone mein base branch nahi hoti, `git diff base...HEAD` fail. Repo chhota hai, kuch second ka cost.
<!-- gh-comment-id: 4262738385 -->
> Step naam 'Type check' par script `lint` — confusing.
- **Status:** answered
- **Reply:** `npm run lint` = `tsc --noEmit` (type check), ESLint abhi nahi. Naam site job se copy. Asli lint step tab aayega jab story ko chahiye.

### `.pre-commit-config.yaml`

**1. Job:** Ghar par check — commit se pehle local hooks.
**2. Kahan fit hai:** `guard.py files` + `check_msg_file.py` ko git hooks se chalata hai.
**3. Walkthrough:** `guard-files` staged files par; `guard-message` commit-msg stage par. `knowledge/` aur lockfile exclude.
**9. Red Flags:** manual `pip install pre-commit` (VERIFIED); exclude regex CI grep se alag (INFERRED).

**Inline comments (posted):**
<!-- gh-comment-id: 4262738393 -->
> `repo: local` — contributor ko `pip install` chahiye; onboarding mein likha?
- **Status:** answered → **doc badla**
- **Reply:** Haan, docs mein missing tha. `COMMIT_GUIDELINES.md` mein one-line install add kiya. CI ko pre-commit nahi chahiye, to blocker nahi.
<!-- gh-comment-id: 4262738403 -->
> `exclude` regex vs CI grep — drift ho sakta hai?
- **Status:** answered
- **Reply:** Real drift risk, par tiny. Dono sirf `knowledge/` + lockfiles skip karte hain. pre-commit config shared file nahi padh sakta. Chhoda. Teesri jagah zaroorat ho to `guard.py` mein daalenge.

### `scripts/check_msg_file.py`

**1. Job:** Patla wrapper — commit-msg hook ke liye. **9. Red Flags:** `open(sys.argv[1])` path missing par crash.

**Inline comments (posted):**
<!-- gh-comment-id: 4262738412 -->
> Patla wrapper — commit-msg hook file-path deta hai, isliye alag?
- **Status:** answered
- **Reply:** Dono sahi. pre-commit file path deta hai, isliye wrapper chahiye. pre-commit hamesha real path deta hai, to hook mein missing path ho hi nahi sakta.

### `COMMIT_GUIDELINES.md`

**1. Job:** Commit label ke rules (Conventional Commits, 11 types).

**Inline comments (posted):**
<!-- gh-comment-id: 4262738420 -->
> Doc ke 12 types aur `MESSAGE` regex — hamesha sync?
- **Status:** answered → **code badla**
- **Reply:** Achha catch. Naya test `test_commit_guidelines_match_regex` doc ki type-list ko regex se compare karta hai — drift par CI fail. (Doc mein 11 types hain, 12 nahi.)

### Chhote files
- `.gitignore`: `__pycache__/` add — Python bytecode ignore. (Comment nahi — trivial.)
- `docs/follow-ups.md`: **F57** (checks ko required banana). (Comment nahi — meta.)
- `docs/process-trace.md`: steps 99–100. (Comment nahi.)
- `docs/tests/test-cases.md`: 3 test rows story #40 ke. (Comment nahi.)

---

## Handoff

State: 16 answered · 5 fixed (6c068b67) · 0 open · actor: coder → owner

You are the developer for GoServe PR #59 (ci: app + guard CI jobs, pre-commit,
commit guidelines). Every review thread is answered, and the five that needed
code are done in commit 6c068b67 (Stripe regex in guard.py, one sample per
secret pattern, guard-on-itself test, doc/regex sync test, pre-commit install
line in COMMIT_GUIDELINES.md). Do this: (1) confirm the CI checks are green on
6c068b67 and no thread is left unanswered; (2) make no further code changes on
this branch — the work is complete; (3) do not merge — the reviewer merges.
Reply in one line: "PR #59 ready to merge at 6c068b67".

_(PR par post hua — `satvik-jain-iitd`, issue comment [6154260533](https://github.com/satvik-jain-iitd/GoServe/pull/59#issuecomment-6154260533).)_

- **Dev reply:** "PR #59 ready to merge at 6c068b67" — handoff loop band (14 Oct 2026).
- **Verified:** head = `6c068b67`, teenon CI checks pass, 0 open thread. Blocked sirf `REVIEW_REQUIRED` par.
- **Approved:** `satvik-jain-iitd` (review `5509512400`) — ab `APPROVED` + `CLEAN` + `MERGEABLE`.
- **Merged:** `fa9a345b` (2026-10-13, `satvik-jain-iitd`) — `feat/40-app-ci` → `dev`. Handoff loop pura.

**Owner handoff** (outcome 3, `actor: owner`) — Romanized Hindi:

```
State: 16 answered · 5 fixed (6c068b67) · 0 open · actor: owner

PR #59 aligned hai. Reviewer account se APPROVE ho gaya (CI green, koi thread
khula nahi). Ab tum karo: (1) PR #59 merge karo (feat/40-app-ci -> dev);
(2) merge ke baad branch delete kar do; (3) phir development continue karo —
agla most critical item: story #41 "Dev deploy: push to dev publishes to Vercel
goserve-app-dev" (epic #33). Fresh branch feat/41-<slug> dev se banao. Merge SHA
bata dena.
```

---

## What happened after review

- **Review comments post hue:** 14 Oct 2026 (by `satvik-jain-iitd`) — 6 files par **16 questions**.
- **Replies:** sabhi 16 ka jawab `klickbae8yt-star` se — **16 answered** (0 open).
- **Review ke baad naya commit:** `6c068b67` — "test(ci): cover all secret patterns, guard on itself, doc/regex sync".
- **Sawaal ne seedha code badla (5 cheezein):**
  1. Stripe `sk_live_` regex mein add (guard.py).
  2. Har secret pattern ke liye ek test sample (test_guard.py).
  3. Naya test `test_guard_passes_on_itself` — guard khud par.
  4. Naya test `test_commit_guidelines_match_regex` — doc aur regex sync.
  5. `COMMIT_GUIDELINES.md` mein one-line pre-commit install.
- **Status:** **MERGED** — `fa9a345b` (`dev` par, 2026-10-13, by `satvik-jain-iitd`).
- **Is chapter ka big lesson:** ek shaant guard bhi apne aap mein ek risk hai — "kya yeh cheez jo galat ko pakadni hai, woh *saare* galat pakadti hai?" Yeh PM ka classic sawaal hai.

## Reviewer's take (mere thoughts)

**Kya achha raha:**
- Har jawab chhota, specific, aur honest tha ("80% goal", "tiny drift, leaving it"). Ek AI ne apni kamzori maani — yeh bharosa banata hai.
- 16 mein se 5 jawab ne **asli code change** laaya. Yeh review ka sabse bada proof hai: sawaal ne system better kiya.
- Usne **meri galti pakdi** (maine "12 types" kaha, sahi 11 hain) aur turant ek test likha taaki future mein drift na ho. Best kind of reviewer response.
- `test_guard_passes_on_itself` + samples "parts se banana" — yeh dikhata hai ki usne self-consistency constraint samjha (guard khud ke files par fail na ho).

**Kahan tha pushback (mere jaise manager ke liye):**
- **Push-event skip (#10):** jawab "ruleset push block karta hai" par tika hai — aur ruleset repo ke baahar hai. Agar ruleset kisi din badla, guard chupke skip kar dega. Yeh ek outside-dependency hai; note rakhna.
- **`test_commit_guidelines_match_regex` (#16):** yeh test `COMMIT_GUIDELINES.md` ko regex se padhta hai (`re.search(r"- Types: (.*)\.", doc)`). Doc ki line thodi badli (ya type mein dot aaya) to test tootega. Chhota brittleness — ek follow-up nit.
- **"Guard on itself" aadha jawab:** yeh test sirf yeh dekhta hai ki guard *kuch galat nahi kehta* (false-positive nahi). Yeh nahi dekhta ki guard *kuch pakad bhi raha hai* — woh alag secret tests karte hain. Theek hai, par "who guards the guard" poori tarah band nahi hua: koi test delete kar de to koi flag nahi karega.
- **`npm run lint` = `tsc --noEmit` (#12):** sahi, par naam gumraah karta hai. Documented hai, phir bhi ek din ESLint aane par naam badalna padega.
