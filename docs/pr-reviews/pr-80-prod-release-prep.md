# PR #80 — feat(ops): prod database script, prod keys and release checklist

- **Branch:** `feat/78-prod-release-prep` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #78 "Production release prep" (epic #38), first slice
- **Status:** MERGED into dev `a5e0ab0` on 14 Oct 2026 18:51Z (APPROVE review 5523006987, head `c31ff96`, CI green); 12 threads answered and resolved [VERIFIED]
- **Files:** 12 · **Lines:** +225 / -6 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5523006987 (APPROVE), 12 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/80

> Ek nayi hotel ki building, abhi khaali. Yeh PR us building ka work order likhti hai: fit-out crew pehle order padh kar sunaati hai, owner dastakhat karta hai, phir kamre ek ek karke bante hain.

---

## Overall review

## 1. Ek-line logline
> `Release prep PR: prod Supabase ke liye ek script (pehle dry run, owner ki haan ke baad apply), prod build ke liye PROD_VITE_* keys, aur release ka run sheet.`

## 2. Big Picture (Story & Goal)
- Story #78 "Production release prep", epic #38. Is PR mein pehla slice hai: S1 (prod database) aur S2 ke build keys. [VERIFIED]
- S2 ka release PR aur S3 ke prod workflows baad ke slices hain. [VERIFIED]
- Issue ka wada (S1): prod Supabase khaali ho, script ka dry run ho, owner ki haan aaye, phir migrations 0001–0007 order mein chalen, 7 tables (issue ke hisaab se), security rules, 10 dishes, aur anonymous sign-in on. [VERIFIED brief]
- Script yeh sab karti hai, aur fake API par test hui hai. Asli apply owner ki haan ke baad hoga, abhi nahi hua. [VERIFIED]
- Kis ke liye: owner ko ek safe release milta hai, aur coder ko ek run sheet jisme har step ka O (owner) ya A (agent) likha hai. [VERIFIED brief]

## 3. Yeh ab aaya kyun? (Context)
- Prod Supabase project `vpuumnslnionplrxmqlf` ka naam "GoServe" hai (ap-south-1, healthy). Abhi usmein 0 tables hain, aur anonymous sign-in OFF hai. [VERIFIED dry run]
- Dev project `tmxyizmkpwwfyazvrfhw` ka naam "goserve-dev" hai. [VERIFIED]
- Pehle prod build ko koi VITE key nahi milti thi. Is PR se pehle deploy-app.yml mein VITE keys hi nahi the. [VERIFIED brief]
- Prod migrations ka kaam pehle F63 mein tha. Ab woh release checklist mein hai. [VERIFIED brief]
- PR #79 pehle merge ho chuka hai (`f1f5058`). Uske 9 threads answered hain. Uska verify_live fix is PR mein hai. [VERIFIED]

## 4. Real-Life Analogy
Hotel ki nayi building ka opening. Fit-out crew kamre banati hai. Owner pehle order par sign karta hai.

1. Nayi building = prod Supabase, abhi khaali.
2. Fit-out crew ka work order = `scripts/release_db.py`.
3. Order ko pehle sab ke saamne padh kar sunana = dry run. Kuch likha nahi jaata, sirf plan dikhta hai.
4. Owner ka dastakhat = owner ka "yes" jo `--apply` se pehle chahiye.
5. Jis deewar mein wiring pehle se hai, uspar drill nahi = agar app ke tables pehle se hain to refuse.
6. Handover ki ginti = 10 dishes menu board par, 8 kamre, 6 darwaze ke niyam, aur guest-entry on.
7. Naye building ki apni chaabi ring = `PROD_VITE_*` secrets. Training hotel ki ring kabhi nahi chhoti.
8. Opening-day run sheet = `docs/release-checklist.md`, har line ke aage O ya A.
9. Inspector ab drawers bhi kholta hai = `verify_live.js` ab node parameters bhi milata hai.

## 5. Is PR mein naye Concepts (6)
- **Dry run by default:** script pehle sirf plan chhapti hai. Likhne ke liye `--apply` chahiye.
- **Refuse the wrong target:** likhne se pehle dev ref aur existing tables ko mana karna. Crew galat building mein nahi jaati.
- **Handover counts:** release ke baad ginti karo (dishes, tables, rules, setting). Kam ho to fail karo.
- **Separate key rings:** prod ke secrets ke alag naam. Build galti se dev ki chaabi nahi lega.
- **Fake API in tests:** test ek nakli API se chalta hai, jo har call yaad rakhta hai. Network nahi.
- **Run sheet with roles:** har step ke aage O ya A. Kuch apne aap nahi chalta.

Poori entries `concepts.delta.md` mein hain.

## 6. High-Level Flow
Journey: naye building ka opening, order se lekar guest tak.

1. Owner step 1: Cloudflare Pages mein project `goserve-app` banata hai (Direct Upload, production branch `main`, koi custom domain nahi). Yeh owner ka click hai. [VERIFIED brief]
2. Agent dry run: `release_db.py` ref, table count, sign-in state aur plan chhapta hai. Kuch likha nahi jaata. [VERIFIED]
3. Owner "yes" bolta hai. [brief]
4. `--apply`: pehle check karta hai ki app ke tables nahi hain. Phir 7 migration files order mein, har file ek API call mein. Phir sign-in on. Phir ginti 10 / 8 / 6 aur sign-in check. Sab theek ho to "Checks passed". [VERIFIED code read]
5. Baad ke slices: prod workflow copy (S3), PROD secrets (step 4, step 5 se pehle), phir release PR (S2). Release par `deploy-app.yml` PROD keys se build karta hai, phir `goserve-app` par deploy. Check: 200, menu, /health, ek order. [brief]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `scripts/release_db.py` (new) | Fit-out crew ka work order: prod migrations, sign-in, checks. Dry run default, do refusals. +66 |
| `scripts/test_release_db.py` (new) | Crew ke kaam ki checklist, fake API se, bina network. +89 |
| `scripts/test_deploy_app.py` | Test: prod build PROD_VITE_* padhe, plain VITE_* kabhi nahi. +6 |
| `.github/workflows/deploy-app.yml` | Build step par chaar PROD_VITE_* lines. +6 |
| `docs/release-checklist.md` (new) | Opening-day run sheet: 7 steps, O/A, rollback. +31 |
| `ops/n8n/order/verify_live.js` | Node parameters aur credentials bhi compare, asli deploy-time values se. User-agent comment. +10/-3 |
| `ops/n8n/order/scorecard.test.js` | Tiling assert ek exact date se. +1/-1 |
| `docs/assumptions.md`, `docs/follow-ups.md`, `docs/tests/test-cases.md`, `docs/process-trace.md`, `docs/LEARNINGS.md` | Docs: A51, F63 (moved), F80 a–d, 7 test rows, trace rows, LEARNINGS lines. |

Ponytail: custom domain nahi, migration ledger nahi, CI mein migration nahi. [VERIFIED brief]

## 8. Pieces aapas mein kaise baat karte hain
```
release_db.py
  -> Management API /database/query (ek call per migration file, sorted order)
  -> Management API auth config (anonymous sign-in on)
  -> checks: dishes 10, tables 8, policies 6, sign-in on

deploy-app.yml (Build step)
  <- PROD_VITE_SUPABASE_URL, PROD_VITE_ANON_KEY, PROD_VITE_ORDER_URL, PROD_VITE_DEMO_TOKEN
  -> pages deploy dist --project-name=goserve-app --branch=main

test_deploy_app.py -> PROD names assert karta hai; plain secrets.VITE_* nahi bacha
verify_live.js -> vault ke values memory mein -> 10 GS workflows compare
```
- Naam `PROD_VITE_*` ke saath Build step ko milte hain; dev ke `VITE_*` secrets se alag. [VERIFIED]
- Doosre kaam (jaise `/projects/{ref}` ka naam check) abhi code mein nahi hai. Yeh should-fix hai. [VERIFIED brief]

## 9. Pehle se kya badla
- +225 / -6 in 12 files. Naye files: `release_db.py`, `test_release_db.py`, `release-checklist.md`. [VERIFIED]
- deploy-app.yml ka Build step ab PROD keys padhta hai. Pehle koi VITE key nahi thi. [VERIFIED brief]
- `app/` mein koi file nahi badli. [VERIFIED reviewer]
- Reviewer ke dry run mein prod par 0 tables aur sign-in OFF dikha. Kuch likha nahi gaya. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Dry run sirf ref dikhata hai, naam nahi.** Owner ki haan ek ref par hogi. Galat vault line par doosra project bhi chal jaayega, aur dono guards use nahi rokenge (sirf dev ref mana hai). Impact: migrations galat project par. Check: `release_db.py` line 44; aaj ka ref "GoServe" hai. [VERIFIED]
2. **Koi transaction nahi.** Har file ek call hai. Beech mein fail ho to prod aadha rehta hai. Checklist ka jawab: schema reset owner ki haan se, phir dobara chalao. Impact: theek jab tak prod mein data nahi (F80 d). Check: `release_db.py` line 51; checklist line 30. [VERIFIED]
3. **Secrets se pehle push.** `main` par push step 4 se pehle ho to app khali keys se banega ("missing Supabase keys" page). Aaj koi PROD_VITE_* secret nahi hai. Impact: pehla prod page toota hua. Check: deploy-app.yml line 36; `gh secret list`. [VERIFIED]
4. **Multi-statement file assumption.** Pura migration file ek API call mein chalega, yeh dev jaisa maana gaya hai. Impact: `--apply` par surprise. Script pehli error par ruk jaati hai aur file ka naam batati hai. Check: F63, `apply_migration.py`. [INFERRED]
5. **Vault file shell mein source hoti hai.** `set -a; . 02_databases.env` se us file ki har key session ke environment mein aa jaati hai. Impact: sirf local; kuch print nahi hota. Check: checklist line 20. [VERIFIED]
6. **Activation abhi nahi hui.** Owner ne "activate" keh diya hai, coder agla step karega. Impact: koi nahi; sirf order of events. Check: verify_live active=false x10. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Live `--apply`. Kyun: owner ki haan dry run ke output par chahiye. [VERIFIED brief]
- Prod workflow copy aur `deploy.js --env prod`. Kyun: slice S3 (F80 c). [VERIFIED brief]
- Release PR to main. Kyun: slice S2, step 1 se 4 ke baad. [VERIFIED brief]
- Migration ledger. Kyun: ponytail; F80 d jab prod mein data ho. [VERIFIED brief]
- Custom domain. Kyun: story ka ponytail note. [VERIFIED brief]

## 12. Testing Story
- Red pehle: PR body ke hisaab se `test_release_db.py` "no module" par fail hua, aur `test_deploy_app.py` PROD_VITE_SUPABASE_URL par. [VERIFIED quote, INFERRED run]
- Reviewer ne `c31ff96` par dobara chalaya: Python 10/10 (`test_release_db.py` 6, `test_deploy_app.py` 4), node 62/62. [VERIFIED]
- Dry run prod par (sirf padhne wala): 0 tables, sign-in OFF. verify_live parameters: dason same. [VERIFIED]
- Success numbers (10 / 8 / 6) dev par aaj ke count se match karte hain. [VERIFIED]
- Test ye dekhta hai: dev ref mana, files sorted, dry run sirf SELECT + auth GET, existing table par refuse bina create ke, apply = files, phir auth, phir checks. Network nahi. [VERIFIED]
- Covered nahi: poori file ek call mein (live nahi chala); live apply; Pages project (owner ka click); PROD secrets. [VERIFIED brief]

## 13. Trade-offs & Alternatives

| Chuna | Chhoda | Kyun | Gave up |
|---|---|---|---|
| Management API SQL endpoint | Supabase CLI | CLI login nahi chahiye; dev jaisa raasta; 66 lines | Migration ledger aur transaction (F80 d) |
| Ek script: migrations + auth setting + checks | Teen alag scripts | Ek dry run, ek yes | Kuch nahi aaj |
| `PROD_VITE_*` naam | GitHub environments | Chaar secret naam, koi naya concept nahi | GitHub environment protection rules |
| Owner ka Direct Upload Pages project | Agent ka banaya project | Cloudflare token vault mein nahi (F61) | Agent se project banana |

## 14. Patterns is PR se
- **Dry run by default:** plan pehle, likhna baad mein, beech mein owner ki haan. Crew ka work order padhna. — `scripts/release_db.py`.
- **Refuse the wrong target:** dev ref aur existing tables par likhna mana. Galat building mein drill nahi. — `scripts/release_db.py` line 40, 48.
- **Handover counts:** ginti 10 / 8 / 6 + sign-in. Kam ho to zor se fail. — `scripts/release_db.py` line 57.
- **Separate key rings:** `PROD_VITE_*` naam alag. — `.github/workflows/deploy-app.yml` line 36.
- **Fake API in tests:** har call record, order aur read-only check, network nahi. — `scripts/test_release_db.py` line 12.
- **Run sheet with roles:** O/A har line par. — `docs/release-checklist.md` line 3.

## 15. AI-Review Lens
- **Trust:** do refusals aur call order (fake API par test hua); dry run (reviewer ne chalaya); ginti (dev se match); prod ref (reviewer ne lookup kiya); PROD key naam (assert hue). [VERIFIED brief]
- **Interrogate:** ref ke saath naam, owner ki haan se pehle; multi-statement assumption; step 4 aur step 5 ka order release din par. [VERIFIED brief]

## 16. Questions
- **Top-3 abhi poocho:**
  1. `scripts/release_db.py` line 44: dry run sirf ref dikhata hai. Naam bhi chahiye, `--apply` se pehle.
  2. `scripts/release_db.py` line 51: har file ek call, transaction nahi. Multi-statement file ka live test kab hoga?
  3. `docs/assumptions.md` line 61: A51 ka order, aur owner ki haan ya na.
- **Poora bank:** comment blocks mein 12 sawaal, question order mein (neeche).

## 17. Self-check (light, 2-3)
- `--apply` se pehle dry run ke output mein kaun si cheez tum ko naam ke saath chahiye? (TOP-1.)
- `--apply` beech mein fail ho jaye to prod ki haalat kya hogi, aur kaun faisla karega? (TOP-2.)
- Secrets (step 4) release PR (step 5) se pehle kyun? (Security sawaal.)

---

## Comment blocks (12 posted, review 5523006987, har block mein GitHub id)

<!-- gh-comment-id: 4274905754 --> `scripts/release_db.py:44` · Risk · **Top-3**
> Dry run sirf ref chhapta hai (`vpuumnslnionplrxmqlf`), naam nahi. Owner ka "yes" ek naam ke saamne hona chahiye: ek GET `/projects/{ref}` se naam lo, "GoServe" na mile to refuse. Reviewer ne aaj dekha: yeh ref "GoServe" (ap-south-1) hai, dev `tmxyizmkpwwfyazvrfhw` "goserve-dev". Guards abhi sirf dev ref ko mana karte hain; galat vault line par doosra project bhi chal jaayega. `--apply` se pehle ek line.
- **Reply (klickbae8yt-star):** Done on the next branch. The script now asks for the project name and prints it. It refuses a name that does not say GoServe, or that says dev, in a dry run and in an apply, before any write. The real prod project answers "GoServe".
- **Status:** answered

<!-- gh-comment-id: 4274905762 --> `scripts/release_db.py:51` · Understanding · **Top-3**
> Har file ek `/database/query` call: transaction nahi, na file ke andar na files ke beech. File ke beech mein fail hua to prod aadha bana rehta hai; checklist kehta hai schema reset karke phir chalao (line 30). Khali prod par theek (F80 d). Yeh wahi raasta hai jo dev par `apply_migration.py` ne liya tha, na? Multi-statement file is endpoint se chali thi, yeh live apply hi pakka karega.
- **Reply (klickbae8yt-star):** Yes, the same road as `apply_migration.py` on dev: one call per file, no transaction by the script. A file that fails in the middle leaves prod half made, and the checklist says to reset the schema. The prod database is empty, so I accept it. The live apply is what proves it on prod. F82 (a).
- **Status:** answered

<!-- gh-comment-id: 4274905775 --> `docs/assumptions.md:61` · Assumptions · **Top-3**
> A51 ka order: Pages project (owner) → prod DB script → prod workflow copy → PROD secrets → release PR → check. Har prod write se pehle owner ka yes; secrets wala yes alag. Owner se: order theek, aur A51 par haan ya na?
- **Reply (klickbae8yt-star):** A51 was confirmed in part by the owner on 14 Oct (Pages project, prod migrations, prod workflow copy). The secrets step still needs its own yes. The order stays as written.
- **Status:** answered

<!-- gh-comment-id: 4274905781 --> `.github/workflows/deploy-app.yml:36` · Security
> PROD_VITE_* abhi repo mein nahi hain (`gh secret list`: sirf dev VITE_*). Is PR se pehle Build ko koi key hi nahi milti thi (F80 b). Agar step 4 se pehle `main` par push ho gaya to app khali keys ke saath banega: "missing Supabase keys" page. Checklist mein 4 pehle 5 baad — yahi order rakhna. Anon key public hai (design), demo token low-value (ADR-009).
- **Reply (klickbae8yt-star):** Agreed: step 4 (the secrets) comes before step 5 (the release merge). The checklist keeps that order. If `main` were pushed before the secrets exist, the app would show "missing Supabase keys".
- **Status:** answered

<!-- gh-comment-id: 4274905788 --> `scripts/release_db.py:57` · Understanding
> Handover check 10 dishes / 8 tables / 6 policies / sign-in on. Reviewer ne dev par aaj gina: 10 / 8 / 6 — match. Migrations mein 8 `create policy` hain par 0006 do ko drop karke phir banata hai, isliye 6. Issue #78 "7 tables" kehta hai, script 8 (`session_links` 0006 se): script sahi, issue purana.
- **Reply (klickbae8yt-star):** Yes. Eight tables is right (`session_links` came with 0006) and six policies, because 0006 drops two and makes them again. The issue text is old. F82 (b).
- **Status:** answered

<!-- gh-comment-id: 4274905792 --> `scripts/test_release_db.py:53` · Testing
> Fake API har call record karta hai: dry run mein sirf SELECT + get_auth, apply mein files sorted order mein phir set_auth phir check, existing table par refuse bina kisi create ke. Network nahi. Jo test nahi karta: poori file ek call mein (sawaal 2) aur asli prod. Theek?
- **Reply (klickbae8yt-star):** Yes. The test does not cover one whole file in one call, or the real prod. The live apply will, and the dry run on the real prod already ran read only.
- **Status:** answered

<!-- gh-comment-id: 4274905799 --> `ops/n8n/order/verify_live.js:22` · Ops
> Ab `[name, type, parameters, credentials]` bhi milata hai, build asli deploy-time values se (vault se memory mein, print nahi). Reviewer ne chalaya: dason parameters=same, active=false. Yaani jo commit hua wahi live hai (rulebook 97). Activate abhi nahi hua; owner ka "activate" aa chuka hai, agla kaam.
- **Reply (klickbae8yt-star):** Thanks. The check now also covers the live activation: after "activate" all ten show active=true and the same parameters.
- **Status:** answered

<!-- gh-comment-id: 4274905804 --> `docs/release-checklist.md:19` · Docs
> Step 1 owner ka: Pages → Create → Upload assets (Direct Upload), naam exactly `goserve-app`, ek khali `index.html`, production branch `main`, custom domain nahi, project `goserve` (letsdwelo.in) ko haath nahi. `deploy-app.yml` `--project-name=goserve-app --branch=main` bhejta hai, to naam exact hona zaroori. Owner: yeh click kab?
- **Reply (klickbae8yt-star):** This is the owner's click. It is in the checklist, step 1. Nothing else on prod waits for it except the release merge.
- **Status:** answered

<!-- gh-comment-id: 4274905812 --> `docs/release-checklist.md:23` · Docs
> Release PR: `origin/main` se branch, `origin/dev` se sirf rule-17 paths (`site app scripts design/tokens.json design/brand ops .github .gitignore README.md`). `scripts/` mein `clear_dev.py` aur `release_db.py` bhi main par jaayenge: theek, rule 17 scripts/ ko allow karta hai. `docs/` main par nahi. Sahi?
- **Reply (klickbae8yt-star):** Yes. `scripts/` is on the rule 17 list, so `clear_dev.py`, `release_db.py` and `live_check.py` go to `main` with the release PR. `docs/` does not. F82 (d).
- **Status:** answered

<!-- gh-comment-id: 4274905822 --> `docs/tests/test-cases.md:128` · Docs
> Dry run row Pass: reviewer ne dobara chalaya, 0 tables, sign-in OFF. Teen live rows pending: `--apply` (owner ka yes), release ke baad 200 + /health, prod order. Jab chalen, execution/time likho.
- **Reply (klickbae8yt-star):** Agreed. When the live rows run, I write the time and the result into them.
- **Status:** answered

<!-- gh-comment-id: 4274905827 --> `docs/follow-ups.md:87` · Docs
> F80 c: `deploy.js` dev-only hai (naam, credential, URL); prod copy ke liye `--env prod` mode, `PROD` naam, alag webhook path, credential `GoServe Supabase prod` (owner ka yes). Yeh slice S3 hai. Ek sawaal: prod MAIN 01 ka ERR 00 bhi alag, ya wahi ERR 00 dono ke liye (ek Telegram bot, rulebook B11)?
- **Reply (klickbae8yt-star):** I propose one shared GS ERR 00 for both: one bot, one chat, and the message already names the workflow. The owner can say if a second one is wanted. F82 (c).
- **Status:** answered

<!-- gh-comment-id: 4274905835 --> `docs/release-checklist.md:29` · Docs
> Rollback: Pages mein purana deployment, ya release PR revert; prod DB: schema reset owner ke yes se (data nahi hai); workflows: prod kill switch on → "Orders are paused". Demo se pehle yeh teen lines owner ko ek baar padh leni chahiye.
- **Reply (klickbae8yt-star):** Agreed. The owner should read those three lines once before the demo.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #80 approve ho chuka hai. Merge karo (feat/78-prod-release-prep -> dev). A51 par haan ya na do, aur step ka order (Pages project, dry run, --apply, secrets, release PR) theek hai ya nahi.
Cloudflare Pages project `goserve-app` banao (step 1: Direct Upload, production branch main, koi custom domain nahi) aur batao kab. Dry run ka output dekh ke --apply ki haan alag se do.
Aaj raat 21:00 ka scorecard tabhi aayega jab coder MAIN 01 + MAIN 90 activate kar de; "activate" tum keh chuke ho.
```

Coder paste-block (English):
```
PR #80 APPROVED (review 5523006987, 12 threads). Owner merges.

1. Reply on each thread by id.
2. Should-fix before --apply: the dry run prints only the ref. Print the project name too (GET /projects/{ref}), and refuse if the name does not contain "GoServe".
3. Activate MAIN 01 + MAIN 90 (owner said "activate", 15 Oct). Read the flags back, run the live rows, mark A46-A50 confirmed. Then story #56.
4. #78 steps 2-5 only after the owner's clicks and yeses. Step 1 is the owner's Pages project. Step 2 is --apply after the owner's yes on the dry run output.
5. After "notebook filed", copy the bundle (chapters 19 and 20) and rows.
```

posted as satvik-jain-iitd, review 5523006987, 12 inline threads
