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
| 5 | [#64](pr-64-schema.md) | feat(db): 7 tables, legal-status rule and one-order-per-key | MERGED (7563b8b; 18 questions posted) | #43 (epic #34) |
| 6 | [#65](pr-65-rls-realtime-menu.md) | feat(db): row level security, Realtime and the Delhi sample menu | MERGED (e7f1f2b; 17 answered, 4 fixed) | #44 (epic #34) |
| 7 | [#66](pr-66-order-workflows.md) | feat(n8n): order database functions and order workflows (built, not deployed) | MERGED (0f9603a; 20 answered, 7 fixed) | #45 (epic #35) |
| 8 | [#67](pr-67-decide-logs.md) | feat(n8n): decide and log workflows, order cap per session | MERGED (d7836d8; 18 answered, 5 fixed) | #46 (epic #35) |
| 9 | [#68](pr-68-deployed-inactive.md) | docs: order workflows deployed inactive, A41 and A42 confirmed | MERGED (3 answered) | follow-up to #46 (epic #35) |
| 10 | [#69](pr-69-customer-screen.md) | feat(app): customer menu, cart, bill and place order | MERGED (20 answered) | #48 (epic #36) |
| 11 | [#70](pr-70-kitchen-screen.md) | feat(app): kitchen screen with live orders and next-step buttons | OPEN (20 posted, APPROVE) | #49 (epic #36) |

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
| Security + live data (RLS, Realtime, seed) | #65 |
| Order path (n8n MAIN/SUB + SQL functions) | #66 |
| Decisions + run log (SUB 13/14, Jev advice, session cap) | #67 |
| Customer screen (menu, cart, bill, place order) | #69 |
| Kitchen screen (live orders, Accept/Start/Ready) | #70 |

## Notes
- Chapters Romanized Hindi mein hain. Code, file paths, commands English mein.
- Inline comments GitHub par already post ho chuke hain (file-level). Notebook unka record rakhta hai — dobara post nahi hota.
