# PR #82 — feat(ops): release script checks the prod project name

- **Branch:** `feat/78-release-db-name-check` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** Follow-up to #78 (PR #80), no new story
- **Status:** MERGED into dev `72c1905` on 15 Oct 2026; APPROVED on the fix commit `663e9b7` (review 5527949300; the cf CLI cache file is out and `.cloudflare/` ignored; first COMMENT review 5526170555 on `988fa41`); 6 threads answered and resolved [VERIFIED]
- **Files:** 8 · **Lines:** +50 / -9 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5526170555 (COMMENT), 6 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/82

> Hotel ki naam-patti wala check: crew pehle building ka naam padh kar sunaati hai, aur galat naam par darwaza nahi khulta. Par visitor badge lobby ki mez par chhoda gaya hai, aur woh pehle hatana hai.

---

## Overall review

## 1. Ek-line logline
> `Fix PR: release script pehle prod project ka naam padhta hai, "GoServe" na mile to ruk jaata hai; ek cf cache file bhi PR mein aa gayi hai.`

## 2. Big Picture (Story & Goal)
- Yeh PR #78 ka follow-up hai, PR #80 ke should-fix ke liye: dry run mein naam dikhna chahiye. Nayi story nahi. [VERIFIED brief]
- Product level par owner ka yes ab naam ke saath jaata hai, sirf ref ke saath nahi. [VERIFIED code read]

## 3. Yeh ab aaya kyun? (Context)
- PR #80 ke 12 threads answered aur resolved hain; is PR ke baad koi PR #80 should-fix nahi bachta. [VERIFIED]
- Is PR mein do record commits bhi hain: Pages project exists (`cd2de47`) aur prod database set up (`988fa41`). [VERIFIED]

## 4. Real-Life Analogy
Hotel ka opening-day check. Ek naam-patti, ek run sheet, ek visitor badge.

1. Naam check = crew building ki naam-patti padh kar sunaati hai ("GoServe"); galat naam par darwaza band.
2. Dry run ki line `Prod project 'GoServe' (ref)` = run sheet par naam likha hai, owner ke sign se pehle.
3. Cache file = visitor badge jo lobby ki mez par chhoda gaya; isme account number aur owner ka email hai.

## 5. Is PR mein naye Concepts (3)
- **A name next to the id:** owner ka yes naam ke saamne diya jaata hai; id akele se woh nahi hai.
- **Tool caches do not belong in git:** CLI tools cache account data working folder mein likh dete hain; pehle run se pehle ignore karo.
- **Throwaway user for a security test:** ek guest pass se test, phir delete, aur count zero.

Poori entries `concepts.delta.md` mein hain.

## 6. High-Level Flow
Journey: ek dry run, naam-patti se run sheet tak.

1. `release_db.py`: vault URL se ref lo → dev ref ho to refuse → project ka naam padho → "GoServe" na ho ya "dev" ho to refuse → tables aur auth padho → plan naam ke saath chhapo → ruk jao (dry run) ya apply karo. [VERIFIED code read]
2. 15 Oct: owner ne named dry run par yes diya; apply chala; 10 / 8 / 6 check hue; ek throwaway anonymous user ne rules test kiye aur delete hua. [VERIFIED rows; INFERRED runs]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `scripts/release_db.py` | Naam-patti padhne wala gate: `project_name` ref se naam leta hai, galat naam par refuse karta hai · +8/-1 |
| `scripts/test_release_db.py` | Fake crew: naam "GoServe" bolta hai; naya test "Some other project" aur "goserve-dev" ko refuse karta hai · +21/-2 |
| `.cloudflare/cache/cloudflare-account.json` (new) | Visitor badge: `cf` CLI ka cache, account id aur email ke saath; repo mein nahi hona chahiye · +6 · must-fix |
| docs (`docs/release-checklist.md`, `docs/follow-ups.md`, `docs/tests/test-cases.md`) | Run sheet ki rows: state table, F61 band, F82 a–d, apply row Pass, prod security row aur name row |

## 8. Pieces aapas mein kaise baat karte hain
- `release_db.py`: `project_name(ref)` dry run aur apply dono mein naam check karta hai, kisi read ya write se pehle. [VERIFIED code read]
- Test: fake project naam "GoServe" deta hai; dry-run test mein `project_name` read-only calls ki list mein hai. [VERIFIED]

## 9. Pehle se kya badla
- 8 files, +50 / -9. Code mein `release_db.py` +8/-1 aur test +21/-2; ek nayi cache file +6 (must-fix); baaki docs. [VERIFIED]
- Teen commits: `769acdf` (name check), `cd2de47` (Pages project exists), `988fa41` (prod database set up). [VERIFIED]
- Reviewer ne `988fa41` par Python 11/11 chalaya. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Cache file repo mein.** Account id aur owner ka email plain text mein; account id GitHub secret `CLOUDFLARE_ACCOUNT_ID` mein bhi hai. Impact: rule 15 toota; direct harm kam (account id token nahi hai), par bad habit. Check: `.cloudflare/cache/cloudflare-account.json` aur `.gitignore` (usmein `.cloudflare` nahi). [VERIFIED diff, .gitignore]
2. **Substring naam check.** "goserve" ho aur "dev" na ho, to "GoServe staging" pass karega. Impact: aaj koi nahi (do projects). Check: `scripts/release_db.py` line 49. [VERIFIED]
3. **Prod ab schema aur 10 dishes rakhta hai.** Prod anonymous sign-in on hai, 30/hour/IP limit ke saath, captcha nahi (F80 e). Impact: pilot tak accepted. Check: test-cases rows. [VERIFIED rows]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Migration ledger. Kyun: F80 d.
- Captcha on prod sign-in. Kyun: F80 e, pilot se pehle.

## 12. Testing Story
- Red pehle: 7 mein se 1 test code se pehle fail hua. [VERIFIED quote, INFERRED run]
- Reviewer ne `988fa41` par Python 11/11 chalaya. [VERIFIED]
- Live: apply aur prod security test coder ki rows mein hain, owner ke yes ke saath. [VERIFIED rows; INFERRED runs]

## 13. Trade-offs & Alternatives
| Chuna | Kyun | Chhoda |
|---|---|---|
| Substring naam check | do projects, ek line | exactness |
| Record commits isi PR mein | PR chhota rakhna | kuch nahi |

## 14. Patterns is PR se
- **Guard before side effects:** refusal dry run aur apply dono mein, kisi read ya write se pehle. `scripts/release_db.py`.
- **Print the name in the plan:** owner ka yes naam ke saamne ho. Dry run line `Prod project 'GoServe' (ref)`.

## 15. AI-Review Lens
- **Trust:** refusal (dry run aur apply dono mein test hua), chhapa hua naam, aur 10 / 8 / 6 result. [VERIFIED]
- **Interrogate:** dot-folder mein koi bhi cheez jo CLI ne likhi; kya `guard.py` ko `.cloudflare/` pata hona chahiye.

## 16. Questions
- **Top abhi poocho:** teen sawaal: cache file (Security), naam ka substring check (Understanding), aur prod `place_order` 404 ya 403 (Docs).
- **Poora bank:** 6 sawaal, comment blocks mein, question order mein (neeche).

## 17. Self-check (light, 2)
- Cache file mein kaun si do cheezein hain, aur woh repo mein kyun nahi honi chahiye? (TOP-1.)
- `release_db.py` naam kab padhta hai, aur kis cheez se pehle? Galat naam par kya hota hai? (TOP-2.)

---

## Comment blocks (6 posted, review 5526170555, har block mein GitHub id)

<!-- gh-comment-id: 4277469850 --> `.cloudflare/cache/cloudflare-account.json:3` · Security · **Top-3**
> Yeh `cf` CLI ka cache hai (owner ke `cf auth login` ke baad bana): Cloudflare account id aur owner ka email plain text mein. Token nahi hai, par rule 15: account id aur personal data repo mein nahi (wahi id `CLOUDFLARE_ACCOUNT_ID` secret mein hai). Must-fix: file ko PR se hatao (`git rm --cached`), `.cloudflare/` ko `.gitignore` mein daalo; ho sake to `guard.py` mein pattern bhi, taaki pre-commit agli baar pakde.
- **Reply (klickbae8yt-star):** Done. The file is out of the index and `.cloudflare/` is in `.gitignore` (commit on this branch). It held only the account id, the account name and the owner's email, no token. A pattern in `guard.py` is logged as F85 and comes in the next PR.
- **Status:** answered

<!-- gh-comment-id: 4277469852 --> `scripts/release_db.py:49` · Understanding · **Top-3**
> Ab naam padh kar check: "goserve" ho aur "dev" na ho, warna dry run aur apply dono ruk jaate hain, kisi bhi read/write se pehle. Dry run "Prod project 'GoServe' (ref)" chhapta hai: owner ka yes ab naam ke saamne. Substring check hai: "GoServe staging" bhi pass karega; aaj do hi project hain, theek.
- **Reply (klickbae8yt-star):** Yes, it is a substring check, so "GoServe staging" would pass. Today the account has only two GoServe projects, and the dev one is refused by its ref and by the word dev, so I accept it.
- **Status:** answered

<!-- gh-comment-id: 4277469861 --> `docs/tests/test-cases.md:130` · Docs · **Top-3**
> Prod security test ek throwaway anonymous user se: anon 10 dishes padhta hai, orders nahi; seedha insert 403; `place_order` phone se 404; apna `reset_session` 200; 0 users bache. Yeh row prod ke rules ka sabut hai. Ek sawaal: prod par `place_order` 404 kyun, 403 nahi? (function anon ko grant nahi, to PostgREST 404 deta hai — sahi padha?)
- **Reply (klickbae8yt-star):** Your reading is right. `place_order` is not granted to the phone roles, so PostgREST does not list it and answers 404. A direct insert is a table write that row level security refuses, so that is 403.
- **Status:** answered

<!-- gh-comment-id: 4277469866 --> `scripts/test_release_db.py:51` · Testing
> Naya test: naam padha gaya, "Some other project" par dry run aur apply dono SystemExit aur koi write nahi, "goserve-dev" bhi refuse. Dry-run test mein `project_name` read-only list mein. Theek.
- **Reply (klickbae8yt-star):** Thanks.
- **Status:** answered

<!-- gh-comment-id: 4277469871 --> `docs/release-checklist.md:11` · Docs
> Pages project `goserve-app` 12 Oct se tha (production branch main, deployment nahi); `cf pages list` se mila owner ke `cf auth login` ke baad. F61 band. 522 sirf isliye ki kuch deploy nahi hua. Ab step 4 (PROD secrets, owner ka yes) aur step 5 (release PR) baaki; aaj `gh secret list` mein PROD_* = 0.
- **Reply (klickbae8yt-star):** Right. `PROD_*` secrets are still 0; step 4 needs the owner's own yes.
- **Status:** answered

<!-- gh-comment-id: 4277469881 --> `docs/follow-ups.md:89` · Docs
> F82 c: prod copy ek hi GS ERR 00 share karegi (ek bot, ek chat; message mein workflow ka naam, PROD mark ke saath). Owner: ek alert theek hai ya alag? F82 d: release PR ke saath `clear_dev.py`, `release_db.py`, `live_check.py` main par jaayenge (rule 17 scripts/) — `live_check.py` dev par likhti hai, main par hona theek hai par naam se saaf ho ki dev-only.
- **Reply (klickbae8yt-star):** F82 (c) stays a proposal until the owner answers: one shared alert, or a second one. For (d): `live_check.py` says in its docstring that it writes to goserve-dev only and reads the dev vault names. A `--env prod` mode would write real rows to prod, so it would need its own yes; logged as F85.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #82 abhi merge mat karo; pehle coder ka fix commit (cache file hatana, `.cloudflare/` ignore karna) aane do, phir merge karo.
Saath mein faisla do: prod ke liye ek shared GS ERR 00 rakhna hai ya alag.
PROD secrets wale step ke liye agla yes tumhara chahiye.
```

Coder paste-block (English):
```
State: PR #82 NEEDS-FIX (COMMENT review 5526170555, 6 threads). Owner merges after the fix.

1. Remove `.cloudflare/cache/cloudflare-account.json` from the PR (`git rm --cached`, amend or a new commit).
2. Add `.cloudflare/` to `.gitignore`. Optional: a `guard.py` pattern for `.cloudflare/`.
3. Answer the 6 threads by id.
4. Then the PR is ready. After merge, copy the bundle and append the rows.
```

posted as satvik-jain-iitd, review 5526170555 (COMMENT), 6 inline threads
