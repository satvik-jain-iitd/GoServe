# MVP 1 closure (22 Oct 2026)

MVP 1 is the Golden Path: the whole order works end to end with real login and a real database (PRD section 13).

## What MVP 1 added

| Item | Story | Proof |
|---|---|---|
| Continue with Google, linked to the anonymous user. The user id and the session id do not change (ADR-016, Accepted) | #117, PR #122 | Unit `auth.test.ts`, e2e `login.spec.ts`; Supabase Google settings applied and read back on dev |
| Return address and error message after Google | #117 | `test_set_google_auth.py`, e2e S4 |
| No order lost or doubled | #118, PR #125 | Live on dev: `orders=20 duplicates=0 chains_ok=20 lost=0`, repeats answer 409 (`docs/research/experiments.md` N1) |
| Privacy and terms pages, a footer on every screen, the Google domain file | #123, PR #124 and this PR | `legal.spec.ts` |
| MVP 0 and MVP 1 shown as Done on the roadmap page | #119 | `site.spec.ts` roadmap test |

## Still to prove live (owner steps)

- Live row on dev: sign in with Google from an iPhone Safari tab. The session id must be the same before and after.
- Live row on prod after the release: the same, then one real order. That order is the prod proof of the no-loss rule (no prod run of the 20-order script: F92).
- Prod Google settings: `scripts/set_google_auth.py prod --apply` only with the owner's yes, in the release step.

## Deferred, in writing

See the gate log row in `docs/architecture/phase-gate.md`. Short list: web push and Jev D2 on 23 Oct, UAT numbers on 24 Oct, Mongo archive, Sentry, email sender and UptimeRobot on 25 Oct. Founder steps without a date: own domain, lawyer-checked legal pages, Attio, Zoho Books, DLT, FSSAI.

## Cost

Still about $0 a month. Google sign-in is free. Jev costs about $0.00002 a call.

## Lessons

- A 200 from a settings call is not proof: read it back, and again after a minute.
- Two parts of a screen that ask for a session at once made two anonymous users: share one request.
- A merge can silently drop rows from the follow-ups and trace tables: check your own rows after a merge.
- The Google consent screen was set to Internal by mistake and blocked every outside account (error `org_internal`): use External with Testing and test users.
