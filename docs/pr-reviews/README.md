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
| 11 | [#70](pr-70-kitchen-screen.md) | feat(app): kitchen screen with live orders and next-step buttons | MERGED (20 answered) | #49 (epic #36) |
| 12 | [#71](pr-71-rider-tracker.md) | feat(app): rider steps and live customer tracker | MERGED (20 answered) | #50 (epic #36) |
| 13 | [#72](pr-72-split-view.md) | feat(app): split view, shared session by link and reset | MERGED (20 answered) | #52 (epic #37) |
| 14 | [#73](pr-73-ops-screen.md) | feat(app): ops screen with AI suggestion and metrics | MERGED (20 answered) | #51 (epic #36) |
| 15 | [#74](pr-74-health-check.md) | feat(app): health check page for Supabase, n8n and Jev | MERGED (20 answered) | #54 (epic #37) |
| 16 | [#75](pr-75-autopilot.md) | feat(app): autopilot with an offline demo story | MERGED (20 answered, 2 should-fix landed in #76) | #53 (epic #37) |
| 17 | [#76](pr-76-scorecard.md) | feat(ops): daily scorecard workflow with Telegram message | MERGED (17 answered, window gap fix pending the owner's pick) | #47 (epic #35) |
| 18 | [#77](pr-77-autopilot-refusal.md) | fix(app): show the autopilot refusal, name the cost line | MERGED (4 answered) | follow-up to #47 |
| 19 | [#79](pr-79-scorecard-window.md) | fix(ops): scorecard covers the last 24 hours | MERGED (9 answered; verify_live parameters fix in #80) | follow-up to #47; n8n deployed, inactive |
| 20 | [#80](pr-80-prod-release-prep.md) | feat(ops): prod database script, prod keys and release checklist | MERGED (12 answered; name check in #82) | #78 (epic #38), slice 1 |
| 21 | [#81](pr-81-jev-decisions-endpoint.md) | fix(ops): ask Jev at the decisions endpoint, not chat completions | MERGED (10 answered) | refs #46 #54; dev live since 15 Oct |
| 22 | [#82](pr-82-release-db-name-check.md) | feat(ops): release script checks the prod project name | MERGED (6 answered; cache file removed) | follow-up to #78; prod DB done 15 Oct |
| 23 | [#84](pr-84-role-apps.md) | feat(app): role apps as separate installable PWAs on one origin | MERGED (10 answered; docs conflicts resolved) | #83 (slice 1), owner direction 15 Oct |
| 24 | [#85](pr-85-prod-workflows.md) | feat(ops): prod copy of the order workflows, deployed inactive | MERGED (9 answered) | #78 (slice S3) |
| 25 | [#86](pr-86-guard-by-path.md) | chore: guard blocks tool caches by path, small review notes | MERGED `31921e3` (fix `c6bdc09`, APPROVE 5528905183 on `75c4df8`) | follow-up to the 15 Oct review round |
| 26 | [#220](pr-220-orders-you.md) | feat(app): Ink v3 Your orders and You screens (#193) | OPEN, APPROVE 5638912878 on `bf73554`, 20 questions open | H10d closes the customer screens; prod migrations 0022 to 0026 applied |
| 27 | [#222](pr-222-rider-ink.md) | feat(app): Ink v3 rider app, boards R1 to R9 (#194) | OPEN, APPROVE 5639179226 on `ab5c8e4`, 17 questions open, Guard red until the reword | H11a, layer 1 of the #194 stack |
| 28 | [#223](pr-223-kitchen-ink.md) | feat(app): Ink v3 kitchen app, boards K1 to K6 (#194) | OPEN, APPROVE 5639174623 on `be32bc1`, 15 questions open | H11b, layer 2, merged into the #222 branch |

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
| Rider steps + customer tracker (events vs status, SUB 15) | #71 |
| Split view, join by link, reset (RLS via function, delete events) | #72 |
| Ops screen: AI advice vs rule, plain metrics, per-session read rules | #73 |
| Health page: a real call per light, failure as a result, SPA fallback | #74 |
| Autopilot: two modes behind one button, ref as clipboard, offline fallback | #75 |
| Scorecard: schedule + timezone, day window, metric pairs, read-only SUB | #76 |
| Refusal reason where the user looks, ordered reads under a cap | #77 |
| Rolling window, read-back after deploy, label the period | #79 |
| Prod release: dry run by default, refuse the wrong target, handover counts, separate key rings | #80 |
| Jev decisions endpoint, fixtures from real answers, publish needs the callees, wasActive guard | #81 |
| A name next to the id, tool caches out of git, throwaway user for a security test | #82 |
| Role apps: one origin several apps, manifest = install identity, lock a shell, count the sign-ins | #84 |
| Prod copy: environment table, share only what is safe, same build different stamp | #85 |
| Block by path not only content, a guard proves itself on its own PR, ignore before you add | #86 |
| Short order number, customer words vs kitchen words, window event as a bell, theme pin, one-way permission switch | #220 |
| Render-prop gate, one job in hand, sticky done slip, today by the phone's clock, generic Tabs | #222 |
| Ticket buckets, the gate holds the switch, one ticket over the tabs, bigger than the board for a story rule, copy as a promise | #223 |

## Notes
- Chapters Romanized Hindi mein hain. Code, file paths, commands English mein.
- Inline comments GitHub par already post ho chuke hain (file-level). Notebook unka record rakhta hai — dobara post nahi hota.
