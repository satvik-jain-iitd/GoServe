# ADR-016: No login for now; Google login at MVP 1

## Status

Accepted 22 Oct 2026 (owner, in the MVP 1 plan). Updated by story S-M1 (#117): Google sign-in is linked to the anonymous user, not a replacement.

## Date

2026-10-22.

## Context

Login adds work for every test and every user. The apps are still in user testing. The owner said on 22 Oct: no email, no password, no hard tests because of login.

## Decision

1. For now the apps have **no login**. The anonymous session id stays the user id (ADR-010). Two devices join by link (ADR-011).
2. At MVP 1 we add **Continue with Google** through Supabase Auth. It **links** the Google identity to the same anonymous user (`linkIdentity`), so the user id and the session id do not change: orders, join links and tests keep working. No password screen, no email form.
3. Tests keep using the anonymous session, so no test needs an account.

## Consequences

- Anyone with the session id can see that session's orders. That is fine for a demo with test data, and not fine for real customers. See assumption A53.
- The MVP 1 phase gate must cover Google login, the consent screen and how an anonymous session moves into a real account.
- Four separate Capacitor apps would not share storage, so they would need this login. Chrome WebAPKs on one phone share storage and do not.

## Two sign-in modes (S-M5, 23 Oct 2026)

- The customer app links Google to the anonymous user (`linkIdentity`), so the session id stays.
- The kitchen, rider and ops apps sign in as the Google user (`signInWithOAuth`): a worker's phone must become the listed staff user, and linking may fail when that Google account already belongs to another user. The failing case is INFERRED and not yet proven on dev (F114); the kitchen path does not depend on it.
- A staff row needs the user to have signed in with Google once (`scripts/add_kitchen_staff.py`).
