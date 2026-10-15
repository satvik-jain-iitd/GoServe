# PR #85 — feat(ops): prod copy of the order workflows, deployed inactive

- **Branch:** `feat/78-prod-workflows` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #78 "Production release prep", slice S3 [VERIFIED]
- **Stacked on:** PR #81 (its first three commits are #81's) [VERIFIED]
- **Status:** MERGED into dev `674558c` (APPROVE review 5526172877 on `262f2c3`; rebased after #81, CI green); threads answered and resolved [VERIFIED]
- **Files:** 20 (own commit 8: +141 / -30) [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5526172877 (APPROVE), 9 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/85

> Hotel ki nayi building mein wahi nau desks dobara bani hain. Har desk ke naam ke aage PROD hai, apna darwaza aur apni chaabi hai. Covers abhi laage hain: kuch chalta nahi.

---

## Overall review

## 1. Ek-line logline
> `Prod copy ke nau n8n order workflows: apne address, credential aur token ke saath, deploy hue par inactive.`

## 2. Big Picture (Story & Goal)
- Story #78 "Production release prep" ka slice S3 hai. [VERIFIED]
- Story ka wada: prod copy ka apna address aur credential ho. Owner "push kar do" bole, phir "activate". Prod app ka order prod kitchen screen tak pahunche. [VERIFIED]
- Is PR mein copy aur inactive deploy hai. Activate abhi nahi hua. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Dev par das (ten) workflows active hain. Is PR se pehle prod ke liye aisi copy nahi thi. [INFERRED]
- Prod ko apne naam, credential, token aur webhook path chahiye. Yeh PR unhe banata hai. [VERIFIED]
- Yeh PR #81 ke upar stack hai. Pehle #81 merge hoga, phir yeh. [VERIFIED]

## 4. Real-Life Analogy
Hotel ki nayi building mein wahi nau desks dobara banana.

1. Nau desks = nau `... PROD` workflows. Naam ke aage PROD likha hai.
2. Naya darwaza = path `gs-order-prod`, apna webhookId.
3. Nayi building ki apni safe key = credential `GoServe Supabase prod`.
4. Apna guest pass = prod token (`GOSERVE_PROD_DEMO_TOKEN`).
5. Covers laage hue = inactive. Batti abhi nahi jalti.
6. Ek raat ki ghanti = shared ERR 00 alert. Ghanti ke note mein likha hota hai kaun si desk bole.
7. Crew ke sheet par do column = ENVS table, dev aur prod. Beech mein sirf ghanti aur concierge line (Jev) share hoti hai.
8. Ek extra auditor = MAIN 90 PROD. Agar activate hua, to yeh roz raat ek aur slip owner ke darwaze ke neeche daalega.

## 5. Is PR mein naye Concepts (4)
- **Environment table:** dev aur prod ke alag naam ek hi table mein. Code table padhta hai, kuch hard-code nahi hota.
- **Share only what is safe to share:** sirf alert aur Jev credential dono mein shared hain. Database credential, token aur webhook path alag hain.
- **Same build, different stamp:** prod set dev jaisa hi canvas hai. Farq sirf naam, path aur credential ka hai.
- **Read-back per environment:** live check bhi env flag leta hai. Activate se pehle prod ko build se milaya ja sakta hai.

Poori entries `concepts.delta.md` mein hain.

## 6. High-Level Flow
Journey: plan se copy, phir desks ek ek karke, phir inspector.

1. `deploy.js --env prod --apply` (15 Oct, owner ki "haan" se): prod credential aur shared ERR 00 dhundhta hai, phir nau desks ke shells banata hai. [VERIFIED]
2. Build `env: 'prod'` ke saath chalta hai. Har desk PUT hoti hai, phir read-back: node count, active nahi. [VERIFIED]
3. `verify_live.js --env prod`: nau live copies ko prod build se milata hai. Reviewer ne dekha: same, inactive. [VERIFIED]
4. Baad mein: owner "activate" bole, to pehle SUBs, phir MAIN 01 PROD (MAIN 90 PROD sirf agar chahiye). Phir prod app `/webhook/gs-order-prod` ko call karega. [VERIFIED]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `ops/n8n/order/build.js` | Stamp wali machine: `env` flag ko prod path, prod webhookId, " PROD" naam, shared alert. +9/-5 |
| `ops/n8n/order/deploy.js` | Crew ka sheet: ENVS table, `--env prod`, nau desks, shared alert lookup, prod token vault mein. +37/-19 |
| `ops/n8n/order/verify_live.js` | Inspector: `--env prod` se prod copies ko build se milana. +9/-6 |
| `ops/n8n/order/prod.test.js` (new, 7) | Checklist: 7 checks, bina network. +67 |
| `docs/integrations/n8n-order-workflows.md`, `docs/release-checklist.md`, `docs/follow-ups.md`, `docs/tests/test-cases.md` | Docs: PROD section ke ids, checklist step 3 done, F80 c done, F84 a–d, 3 test rows. |

## 8. Pieces aapas mein kaise baat karte hain
```
deploy.js --env prod
  -> ENVS (prod row): URL var, credential naam, token var, " PROD"
  -> build.js env 'prod' (nau desks)
  -> PUT each, read-back (count, active nahi)

verify_live.js --env prod
  -> same ENVS + vault values (memory mein, print nahi)
  -> build.js env 'prod' -> live nau se compare

prod.test.js -> build.js + deploy.js ko check karta hai
              (no dev ref, no activate, no delete)
```

## 9. Pehle se kya badla
- 20 files, is commit mein 8 files: +141 / -30. Naya file: `prod.test.js` (+67). [VERIFIED]
- `build.js` ab env flag leta hai. Dev ka output same hai: dev ke das active workflows ke parameters same hain. [VERIFIED]
- `deploy.js` mein ENVS table aur `--env prod` hai. Wasactive guard aur "never activates" wahi hain. [VERIFIED]
- Docs mein nau ids, checklist step 3 done, F84 a–d. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Prod webhook public hai, rate limit nahi.** Activate hone par yeh real database par chalega. Demo token app build mein jaayega (ADR-009). Kill switch hi stop hai. Impact: demo ke liye maana; pilot se pehle captcha/rate limit (F80 e). Check: `build.js` Config; F84 d. [VERIFIED]
2. **MAIN 90 PROD ka doosra card.** Activate hone par roz 21:00 ka doosra card aayega, prod rows abhi khaali hain. Impact: noise; owner decide karega (F84 b). Check: n8n doc line 123. [VERIFIED]
3. **Ek shared ERR 00.** Dono ke error ek jaisa dikhte hain. Sirf message mein workflow ka naam farak hai. Impact: padhne layak; owner ne abhi kuch nahi kaha (F82 c). Check: `build.js` line 312. [VERIFIED]
4. **Deploy guard sirf ERR 00 ka hona check karta hai, active hona nahi.** Aaj woh active hai. Impact: none. Check: `deploy.js` line 60. [VERIFIED]
5. **Prod credential ke paas prod service-role key hai,** n8n box par. Dev jaisa hi. Impact: F52 ke saath rotate. Check: F84 c. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Activation: owner ka "activate" chahiye, release ke paas. [VERIFIED]
- PROD_VITE_* secrets: step 4, owner ki haan chahiye. [VERIFIED]
- Doosra alert workflow: F82 c, sirf owner chahe to. [VERIFIED]
- Prod scorecard ka faisla: F84 b. [VERIFIED]

## 12. Testing Story
- Red pehle: 7 mein se 4 prod tests code se pehle fail hue. [VERIFIED quote, INFERRED run]
- Reviewer ne `262f2c3` par node 70/70 chalaya (7 naye prod tests). [VERIFIED]
- Prod dry run: nau "update", kuch activate nahi. [VERIFIED]
- Prod read-back: nau parameters same, inactive. Dev ke das active aur same. [VERIFIED]
- Covered nahi: prod webhook ka jawab (activate ke baad), aur prod order prod kitchen tak (release ke baad). [VERIFIED]

## 13. Trade-offs & Alternatives

| Chuna | Chhoda | Kyun | Gave up |
|---|---|---|---|
| Ek `build.js` env flag ke saath | Copy hui prod build | Ek canvas, ek test suite, ek diff | Kuch nahi |
| Shared ERR 00 | Do ERR 00 | Ek bot, ek chat | Alag alert routing |
| " PROD" naam ka suffix | n8n folder ya project | API mein folder nahi; naam hi registry hai | Editor mein visual grouping |

## 14. Patterns is PR se
- **Environment table:** ek table mein sab farq. Jahan: `ops/n8n/order/deploy.js` line 17.
- **Share only what is safe:** alert aur Jev credential shared, baaki alag. Jahan: `ops/n8n/order/build.js` line 312.
- **Same build, different stamp:** ek canvas, naam aur path ka stamp. Jahan: `ops/n8n/order/prod.test.js` line 41.
- **Read-back per environment:** build aur live ko env flag ke saath milana. Jahan: `ops/n8n/order/verify_live.js` line 16.
- **Never-activate guard:** `wasActive` guard aur "never activates" dono chalu hain. Jahan: `ops/n8n/order/deploy.js`.

## 15. AI-Review Lens
- **Trust:** environment table (test se), prod build mein dev ref nahi (assert), read-back (reviewer ne chalaya), never-activate (assert). [VERIFIED]
- **Interrogate:** activate kab hoga, prod card chahiye ya nahi, aur pilot se pehle rate limit ka sawaal. [VERIFIED]

## 16. Questions
- **Top-3 abhi poocho:**
  1. `ops/n8n/order/deploy.js` line 17: ENVS table mein dev aur prod ka farq kaun si cheezein hain, aur nau desks mein alert kyun nahi?
  2. `ops/n8n/order/build.js` line 312: dono buildings ke liye ek hi ghanti theek hai ya nahi, aur prod card chahiye ya nahi?
  3. `docs/release-checklist.md` line 21: step 3 done hai. Ab baaki steps kaun se hain, aur activate kab hoga?
- **Poora bank:** comment blocks mein 9 sawaal, question order mein (neeche).

## 17. Self-check (light, 2-3)
- `orderFor('prod')` mein kaunsi desk nahi hai, aur kyun? (TOP-1.)
- Activate se pehle prod ko dev ke saath kaise milaya ja sakta hai? (Read-back, `verify_live.js --env prod`.)
- Ek shared ERR 00 se dev ki galti prod wale ko kaise dikhegi? (TOP-2.)

---

## Comment blocks (9 posted, review 5526172877, har block mein GitHub id)

<!-- gh-comment-id: 4277471961 --> `ops/n8n/order/deploy.js:17` · Understanding · **Top-3**
> ENVS table: dev aur prod ki har alag cheez ek jagah (URL var, credential naam, token var, naam ka mark). `orderFor('prod')` nau (alert nahi), ERR 00 shared aur dev se pehle hona chahiye. Reviewer ne dry run chalaya: nau "update", kuch active nahi; verify_live prod: nau parameters=same, inactive. Yaani jo commit hai wahi prod par hai, covers ke saath.
- **Reply (klickbae8yt-star):** Thanks.
- **Status:** answered

<!-- gh-comment-id: 4277471963 --> `ops/n8n/order/build.js:312` · Risk · **Top-3**
> Sirf alert share hota hai (ek bot, ek chat; message mein naam "... PROD"). Baaki sab alag: path `gs-order-prod`, apna webhookId, prod credential, prod token. Owner: ek bell dono buildings ke liye theek hai (F82 c)? Aur MAIN 90 PROD activate karoge to roz do card aayenge (F84 b): prod card chahiye ya nahi?
- **Reply (klickbae8yt-star):** For the owner: one shared alert is the default. MAIN 90 PROD stays inactive unless a prod card is wanted (F84 b).
- **Status:** answered

<!-- gh-comment-id: 4277471973 --> `docs/release-checklist.md:21` · Assumptions · **Top-3**
> Step 3 done: credential `GoServe Supabase prod` + nau PROD workflows inactive (tumhara "haan"). Ab baaki: step 4 PROD secrets (tumhara yes; `PROD_VITE_ORDER_URL` = prod webhook), step 5 release PR, step 6 check, aur prod "activate" pehle prod order se pehle. 18 Oct ka demo dev par hai, to prod activate release ke paas hi karna.
- **Reply (klickbae8yt-star):** Agreed. Prod "activate" happens near the release, not before.
- **Status:** answered

<!-- gh-comment-id: 4277471975 --> `ops/n8n/order/deploy.js:69` · Security
> Prod token vault mein na ho to script naya banakar vault mein likhta hai (`GOSERVE_PROD_DEMO_TOKEN`, aaj hai). Yeh token prod app build ke andar jaayega (ADR-009, low value), har release par rotate. Prod webhook par rate limit nahi (F65 d), kill switch hai. Pilot se pehle captcha/rate limit (F80 e).
- **Reply (klickbae8yt-star):** Yes. The prod token is in the vault, goes into the prod build (low value, ADR-009) and is rotated each release. Rate limit and captcha come before a pilot (F80 e).
- **Status:** answered

<!-- gh-comment-id: 4277471979 --> `ops/n8n/order/prod.test.js:41` · Testing
> Prod build mein dev ref ya "devref" kahin nahi (asserted), prod Config mein prod URL aur prod token, SUB sirf apne MAIN se callable, canvas same, layout clean, deploy.js mein koi project ref hard-coded nahi aur activate/delete nahi. Yahi "same build, different stamp" ka sabut.
- **Reply (klickbae8yt-star):** Thanks.
- **Status:** answered

<!-- gh-comment-id: 4277471988 --> `ops/n8n/order/verify_live.js:16` · Ops
> `--env prod` prod vault values + prod credential se build karke nau ko milata hai; shared alert id alag se. Dev run (bina flag) is build.js ke saath ab bhi parameters=same: prod flag ne dev output nahi badla. Activate ke baad yahi script active=true dikhayegi.
- **Reply (klickbae8yt-star):** Thanks. After "activate" the same script will show active=true.
- **Status:** answered

<!-- gh-comment-id: 4277471995 --> `docs/integrations/n8n-order-workflows.md:123` · Docs
> Activate ka order prod par bhi wahi: SUB pehle, phir MAIN 01 PROD; MAIN 90 PROD sirf jab prod card chahiye. `PROD_VITE_ORDER_URL` = `https://n8n.linkright.in/webhook/gs-order-prod`. Ek line jodo: prod activate se pehle `verify_live.js --env prod` ek baar.
- **Reply (klickbae8yt-star):** Agreed. I add the line "run `verify_live.js --env prod` once before activating" in the next PR.
- **Status:** answered

<!-- gh-comment-id: 4277472003 --> `docs/follow-ups.md:89` · Docs
> F84: (a) activate + PROD secrets tak prod app order nahi rakh sakta; (b) doosra card; (c) prod service-role key n8n par, F52 ke saath rotate; (d) prod token build mein, release par rotate. Ek aur: dev ERR 00 ko kabhi inactive kiya to prod MAIN 01 ka errorWorkflow bhi chup — F84 mein ek line.
- **Reply (klickbae8yt-star):** Agreed. I add to F84: if the dev GS ERR 00 is ever made inactive, the prod workflows lose their alert too (next PR).
- **Status:** answered

<!-- gh-comment-id: 4277472008 --> `docs/tests/test-cases.md:140` · Docs
> Live row pending: activate ke baad `/webhook/gs-order-prod` bina token 401, health 200 token ke saath, prod order prod kitchen tak. Jab chale, execution id aur time yahan; aur `live_check.py` ka ek `--env prod` mode chahiye hoga (abhi dev-only, dev vault names).
- **Reply (klickbae8yt-star):** Agreed. A `--env prod` mode of `live_check.py` writes real rows to prod, so it needs its own yes; logged as F85.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #85 pehle #81 ke upar stack hai: pehle #81 merge karo, phir yeh. Decisions do: ek shared ERR 00 theek hai ya nahi; MAIN 90 PROD chahiye ya nahi; PROD secrets ki haan (step 4).
Prod "activate" release ke paas karna, pehle nahi.
```

Coder paste-block (English):
```
PR #85 APPROVED (review 5526172877, 9 threads). Owner merges.

1. Reply on each of the 9 threads by id.
2. Rebase on dev after PR #81 merges.
3. After merge copy the bundle and rows.
4. Step 4 (PROD secrets) only after the owner's yes.
5. Activate only after the owner's "activate", near the release.
6. #56 live runs stay the critical path.
```

posted as satvik-jain-iitd, review 5526172877, 9 inline threads
