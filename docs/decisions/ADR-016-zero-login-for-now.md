# ADR-016: No login for now; Google login at MVP 1

## Status

Proposed. The owner accepts it by merging the pull request.

## Date

2026-10-22.

## Context

Login adds work for every test and every user. The apps are still in user testing. The owner said on 22 Oct: no email, no password, no hard tests because of login.

## Decision

1. For now the apps have **no login**. The anonymous session id stays the user id (ADR-010). Two devices join by link (ADR-011).
2. At MVP 1 we add **Sign in with Google** through Supabase Auth. No password screen is built.
3. Tests keep using the anonymous session, so no test needs an account.

## Consequences

- Anyone with the session id can see that session's orders. That is fine for a demo with test data, and not fine for real customers. See assumption A53.
- The MVP 1 phase gate must cover Google login, the consent screen and how an anonymous session moves into a real account.
- Four separate Capacitor apps would not share storage, so they would need this login. Chrome WebAPKs on one phone share storage and do not.
