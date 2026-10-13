# My Questions

Apne sawaal yahan. Status: **open** (jawab nahi mila) / **answered** / **dropped**.

## PR #58 ke baad

| # | Sawaal | Status | Jawab / kahan |
|---|---|---|---|
| 1 | `main.tsx` aur `App.tsx` mein farak kya hai? | answered | `main.tsx` = switchboard (app start). `App.tsx` = welcome board (andar ka UI). |
| 2 | Service worker kaam kya karta hai? | answered | Background helper — files cache + offline chalata hai. |
| 3 | Design token "single source of truth" kaise enforced? | answered | `design/tokens.json` se colours aate hain + drift-guard test pakadta hai. |
| 4 | Ek PWA char roles — bundle bada nahi hoga? | open | F59/aage ke chapters — code-splitting ka plan. |
| 5 | `autoUpdate` ke beech order reload ho jaye to? | open | Follow-up F59 (due before story #48). |
| 6 | Supabase/auth kahan baithega? | open | ADR-009 chahiye. |
| 7 | iOS install test kaise hoga jab Playwright na kar sake? | answered | Manual test row F60 (owner iPhone par). |
| 8 | Kyun kuch jaan-boojh kar nahi banaya (router, screens)? | answered | Ponytail rule — sirf zaroori code; screens apni stories mein. |

## PR #59 ke baad

| # | Sawaal | Kahan poocha (PR#/file) | Jawab mila? | Jawab | Status |
|---|---|---|---|---|---|
| Q9 | Pre-commit aur CI guard mein farak kya hai? | PR #59 / ci.yml | haan | pre-commit = local, commit se pehle; CI = remote, push ke baad. Dono `guard.py` chalate hain. | answered |
| Q10 | Secret regex saare secrets pakadta hai? | PR #59 / guard.py | haan | Nahi — ~80% by design. JWT pattern Supabase cover karta hai; Stripe `sk_live_` add hua. Naya format = ek regex + ek test. | answered |
| Q11 | Guard direct push par chalta hai? | PR #59 / ci.yml | haan | Nahi — files/msg steps sirf `pull_request` par. Intended: ruleset push block karta hai, isliye har change PR se aata hai. | answered |
| Q12 | Guard khud ko kaun check karta hai? | PR #59 / guard.py | haan | `test_guard_passes_on_itself` add hua — har `scripts/*.py` par guard chalata hai. (Par test delete hone par koi flag nahi — aadha band hua.) | answered |
