# GoServe PR Review Notebook

Yeh notebook GoServe ke saare PRs ko **teaching-first** tarike se document karta hai.
Har PR ek chapter. Har chapter mein: overall review + file-by-file breakdown + us PR par post hue comments aur unke replies.

Maqsad: ek non-coding PM ko PR padhne, samajhne, aur review karne layak banana — bina syntax yaad karne ke.

## Kaise padhein
1. Pehle chapter ka **Overall review** padho — bade tasveer se samajh aata hai.
2. Phir us PR ke **Files** section mein jao — har file ka kaam, flow, red flags.
3. `concepts.md` mein naye words dekho.
4. `my-questions.md` mein apne sawaal likho.
5. `mental-model.md` mein apna mental model update karo.

## Chapters
| # | PR | Title | Status | Story |
|---|---|---|---|---|
| 1 | [#58](pr-58-app-scaffold.md) | feat(app): scaffold React, Vite, TypeScript PWA with design tokens | MERGED | #39 (epic #33) |
| 2 | [#59](pr-59-app-ci.md) | ci: add app and guard CI jobs, pre-commit hooks and commit guidelines | MERGED | #40 (epic #33) |
| 3 | [#62](pr-62-dev-deploy.md) | ci: deploy app/ to Vercel dev on push to dev | MERGED (16 answered, 5 fixed) | #41 (epic #33) |
| 4 | [#63](pr-63-prod-deploy.md) | ci: publish app/ to Cloudflare Pages goserve-app on main | APPROVED (15 answered, 5 fixed), merge pending | #42 (epic #33) |
| 5 | [#64](pr-64-schema.md) | feat(db): 7 tables, legal-status rule and one-order-per-key | APPROVED (18 questions posted), merge pending | #43 (epic #34) |

## Journals
- [concepts.md](concepts.md) — naye technical words, plain Hindi mein.
- [mental-model.md](mental-model.md) — system ka ek-page picture, har chapter ke baad update.
- [my-questions.md](my-questions.md) — mere sawaal + jo abhi bhi khule hain.

## Reading map (module → chapter)
| Module | Pehla chapter |
|---|---|
| app (PWA skeleton) | #58 |
| CI + guard (checks) | #59 |
| Deploy (dev → Vercel) | #62 |
| Deploy (prod → Cloudflare Pages) | #63 |
| Data (Supabase schema) | #64 |

## Notes
- Chapters Romanized Hindi mein hain. Code, file paths, commands English mein.
- Inline comments GitHub par already post ho chuke hain (file-level). Notebook unka record rakhta hai — dobara post nahi hota.
