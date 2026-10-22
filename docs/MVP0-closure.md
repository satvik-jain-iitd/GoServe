# MVP 0 closure (22 Oct 2026)

## What is built

- Four role apps on one site: customer, kitchen, rider, ops. Each installs on its own from Chrome (static page per role, own manifest, own icon).
- Order flow with the database doing the work (ADR-007, ADR-009), n8n calling it, Realtime updates.
- Feedback button saved to Supabase, Drive and Telegram (ADR-014).
- Customer confirms delivery and pays cash (ADR-015).
- The Jev decision step with a fallback.
- Dev and prod environments with migrations 0001 to 0009 on both.

## Proof

| Item | Evidence |
|---|---|
| Install fix | e2e tests in `app/tests/e2e/apps.spec.ts`: red first, then green, also with the service worker ready |
| Icons | `app/tests/unit/role-icons.test.ts` and a contact sheet checked by eye |
| Feedback | Live rows in `docs/tests/test-cases.md` (dev and prod) |
| Delivered by hand | Live row for #95 on dev |
| Prod chain | Process trace row 226 |

## State of GitHub on 22 Oct

- `dev` is ahead of `main` by this PR and earlier PRs. `main` holds the 15 Oct release. The release PR `release/mvp0-prod-2` brings the prod front end up to date. The owner merges it.
- Open issues to close after the release: #94, #95, #78, #83, epic #93, epics #33 to #38. Issue #56 closes when the owner finishes S2 and S3.

## How the database moves

A migration is a numbered SQL file. It runs first on the dev database. After tests pass, the same file runs on the prod database with the owner's yes. Dev and prod both have 0001 to 0009.

## Cost

Oracle box is on the free tier. Jev costs about $0.00002 a call. Hosting is free tier on Cloudflare Pages and Vercel.

## Left open (see `docs/follow-ups.md`)

- F52 key rotation. F64 and F65 rate limits. F91 stale schema tests. F92 prod test rows.
- Web Push (S-C2) and UAT numbers (S-E).
- New: F93 test ids and the regression suite. F94 the design experiment and redesign. F95 `jev_mode` and the budget guard. F96 the APK, only if the Chrome install fails. F97 Google login at MVP 1.

## Lessons

See the last rows of `docs/LEARNINGS.md`. The main one: Chrome reads the manifest from the first HTML, so a manifest set later by JavaScript is too late.

## Not part of this closure

Laya on Colab runs in another session. iOS is explained only.
