# Mental Model

System ka ek-page picture. Har chapter ke baad update karta hoon.

_Last updated: PR #63 (approved, `4b77e65`); PR #62 merged_

## GoServe — ab tak ki tasveer

```
[ GitHub repo ]
     |
     |--- site/          → investor site (letsdwelo.in, "goserve" Pages project)
     |--- design/        → tokens.json  (colours ka single source of truth)
     |--- docs/          → plan, decisions, follow-ups, test-cases, pr-reviews
     |--- scripts/       → guard.py  (repo rules ka checklist)         ← PR #59
     |--- .github/       → ci.yml  (site + app + guard jobs)           ← PR #59
     |                    deploy-dev.yml (push to dev → Vercel dev)   ← PR #62
     |                    deploy-app.yml (push to main → Cloudflare Pages goserve-app, prod) ← PR #63
     |--- app/           → PRODUCT APP  (PR #58 se shuru)
                          |
                          ├─ index.html      (main door)
                          ├─ src/main.tsx    (switchboard)
                          ├─ src/App.tsx     (welcome board — abhi khaali)
                          ├─ src/pwa-manifest.ts  (identity card, colours ← tokens.json)
                          ├─ src/styles/tokens.css + app.css (paint)
                          ├─ vite.config.ts  (assembly line + PWA)
                          └─ tests/          (unit + e2e)

[ pre-commit ] ──> guard.py (local, commit se pehle)   ← PR #59
[ CI ]         ──> site + app + guard jobs (remote, push ke baad)  ← PR #59
```

## Flow (ek code change)
1. Dev commit → pre-commit hook (guard files + message).
2. Push → PR → CI chalta hai (site, app, guard jobs).
3. Sab green → merge → dev.
4. Merge to dev (`app/` badla ho) → deploy to Vercel dev (`deploy-dev.yml`, PR #62).
5. Release PR → `main` → deploy to Cloudflare Pages prod (`deploy-app.yml`, PR #63). Tiffin: van khana main tak laati hai, ab real customer ka address.
6. App chalane par: index.html → main.tsx → App → service worker (offline).

## Yeh PR ke baad kya samajh aaya
- **Do layer ka check:** pre-commit (ghar par) + CI (factory gate). Defense in depth.
- **Rules-as-code:** repo ke rules `guard.py` mein likhe — yaad rakhne ki zarurat nahi.
- Guard **secrets ko dhoondhta hai** par sirf kuch known patterns. Review ke baad Stripe `sk_live_` add hua; Supabase keys JWT pattern se cover. Naya format aa to ek regex + ek test.
- Guard khud par pass karta hai (`test_guard_passes_on_itself`), aur ab ek test doc/regex drift bhi pakadta hai — par agar koi test *delete* kar de to koi flag nahi karta.
- `guard` job ke file/message checks sirf **PR** par chalte hain, direct push par nahi.
- **Deploy ek alag rule board hai** (PR #62): `deploy-dev.yml` CI se alag file hai. CI check karta hai, yeh deliver karta hai.
- **Tiffin ka rule:** sirf `app/` ke order par deploy chalta hai (`paths:`), counter (`site/`) par nahi. `design/tokens.json` bhi ab list mein hai (0630677), kyunki app build usse rang leta hai.
- **Secrets ka ID card:** teeno secrets ab sirf Deploy step par hain (0630677). `npm ci` jaise steps inhe nahi dekhte.
- **Packing ka pin:** Vercel CLI `vercel@64` par pinned hai (0630677). Naya major ab accident nahi, ek faisla hai.
- **Ek hi delivery boy:** `concurrency` naye run se purana cancel karta hai, isliye do deploy ek saath nahi chalte.
- **Green test sirf board check karta hai:** test file ko text ki tarah padhta hai. Asli proof pehle merge ke baad ka run hai.
- **Do address, do rule board** (PR #63): dev (Vercel, PR #62) aur prod (Cloudflare, PR #63). Dono ek hi kitchen (`app/`) se khana lete hain.
- **Release ki packing list ek doc hai, code nahi:** `docs/PLAN.md` §2 aur `CLAUDE.md` rule 17 mein `app` aur `scripts` nahi the. Review ke sawaal se mila; 4b77e65 mein list fix hui aur ab ek test (`test_release_list_carries_the_app_and_its_guard`) use pakadta hai.
- **Investor site ka board chhoota nahi:** `deploy.yml` (letsdwelo.in) PR #63 mein nahi badla. S2 test yeh text se dekhta hai.

## Abhi bhi andhera (jawab nahi mila)
- Router / screens ka shape (aage ke chapters).
- Supabase aur auth kahan baithenge (ADR-009).
- Role-wise code-splitting ka plan.

## Abhi kya NAHI hai
- Koi login, koi order, koi payment, koi kitchen/rider screen.
- Dev deploy job hai (PR #62, merged). Prod deploy workflow hai (PR #63, open), par `main` par `app/` abhi nahi hai. Release list fix ho gayi (4b77e65); pehli release PR ke baad app prod par aayega. `goserve-app.pages.dev` abhi 522 hai.
