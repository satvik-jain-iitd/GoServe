# My Questions

Apne sawaal yahan. Status: **open** (jawab nahi mila) / **answered** / **dropped**.

## PR #58 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q1 | `main.tsx` aur `App.tsx` mein farak kya hai? | PR #58 / main.tsx, App.tsx | haan | `main.tsx` = switchboard (app start). `App.tsx` = welcome board (andar ka UI). | answered |
| Q2 | Service worker kaam kya karta hai? | PR #58 / vite.config.ts | haan | Background helper — files cache + offline chalata hai. | answered |
| Q3 | Design token "single source of truth" kaise enforced? | PR #58 / tokens.test.ts | haan | `design/tokens.json` se colours aate hain + drift-guard test pakadta hai. | answered |
| Q4 | Ek PWA char roles — bundle bada nahi hoga? | PR #58 / App.tsx | nahi | F59/aage ke chapters — code-splitting ka plan. | open |
| Q5 | `autoUpdate` ke beech order reload ho jaye to? | PR #58 / vite.config.ts | nahi | Follow-up F59 (due before story #48). | open |
| Q6 | Supabase/auth kahan baithega? | PR #58 / (ADR-009) | nahi | ADR-009 chahiye. | open |
| Q7 | iOS install test kaise hoga jab Playwright na kar sake? | PR #58 / playwright.config.ts | haan | Manual test row F60 (owner iPhone par). | answered |
| Q8 | Kyun kuch jaan-boojh kar nahi banaya (router, screens)? | PR #58 / (scope) | haan | Ponytail rule — sirf zaroori code; screens apni stories mein. | answered |

## PR #59 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q9 | Pre-commit aur CI guard mein farak kya hai? | PR #59 / ci.yml | haan | pre-commit = local, commit se pehle; CI = remote, push ke baad. Dono `guard.py` chalate hain. | answered |
| Q10 | Secret regex saare secrets pakadta hai? | PR #59 / guard.py | haan | Nahi — ~80% by design. JWT pattern Supabase cover karta hai; Stripe `sk_live_` add hua. Naya format = ek regex + ek test. | answered |
| Q11 | Guard direct push par chalta hai? | PR #59 / ci.yml | haan | Nahi — files/msg steps sirf `pull_request` par. Intended: ruleset push block karta hai, isliye har change PR se aata hai. | answered |
| Q12 | Guard khud ko kaun check karta hai? | PR #59 / guard.py | haan | `test_guard_passes_on_itself` add hua — har `scripts/*.py` par guard chalata hai. (Par test delete hone par koi flag nahi — aadha band hua.) | answered |

## PR #62 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q13 | Dono tests YAML ka text padhte hain. Agar `.vercel/output` ka shape galat ho to kaunsa test laal hoga? Smoke check (URL 200) CI mein kab aayega? | PR #62 / scripts/test_deploy_dev.py | haan | Galat shape pehle real deploy par fail hoga, test mein nahi. URL-200 smoke check pehli real URL ke baad add hoga. | answered |
| Q14 | `vercel@latest` ki jagah major version pin karna behtar hai? | PR #62 / .github/workflows/deploy-dev.yml | haan | `vercel@64` pin ho gaya (0630677, line 47). Naya major ab jaan-boojh kar bump hoga; test pin check karta hai. | answered |
| Q15 | `paths` mein `design/tokens.json` kyun nahi, jabki app build use import karta hai? | PR #62 / .github/workflows/deploy-dev.yml | haan | Sahi tha. `pwa-manifest.ts` tokens.json import karta hai. 0630677 mein `design/tokens.json` paths mein add hua, test check karta hai. | answered |
| Q16 | Secrets job-level `env` mein hain; sirf Deploy step par rakhna safer nahi? | PR #62 / .github/workflows/deploy-dev.yml | haan | Haan. 0630677 mein teeno secrets sirf Deploy step par hain; `npm ci` inhe nahi dekhta. | answered |

## PR #63 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q17 | Release list (PLAN.md §2, CLAUDE.md rule 17) mein `app` aur `scripts` kyun nahi? Pehli release par deploy fail nahi hoga? | PR #63 / .github/workflows/deploy-app.yml | haan | Haan. `app` aur `scripts` dono release line mein hain (PLAN.md section 2, CLAUDE.md rule 17), 4b77e65 mein. Naya test inhe guard karta hai. | answered |
| Q18 | Pages project `goserve-app` exist nahi karta to CI fail karega ya auto-create karega? F61 kab karna hai? | PR #63 / .github/workflows/deploy-app.yml | haan | Non-interactive wrangler project nahi banata, fail karta hai. Owner F61 ke tahat project pehle banayega, isliye pehla run fail nahi hoga. | answered |
| Q19 | S1 negative check ka trailing space `goserve` ko kuch cases mein miss karta hai? Regex behtar hai? | PR #63 / scripts/test_deploy_app.py | haan | Achha pakda. 4b77e65 mein test `--project-name=goserve(?!-app)` check karta hai; line ke end wala case bhi nahi chhootega. | answered |
