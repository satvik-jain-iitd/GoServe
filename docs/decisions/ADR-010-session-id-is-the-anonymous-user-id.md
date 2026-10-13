# ADR-010: The session id is the Supabase anonymous user id

## Status

Accepted (owner, 14 Oct 2026, by merging PR #65).

## Date

2026-10-14.

## Context

ADR-009 says row level security limits every read to the caller's `session_id`. Supabase Realtime checks those rules
with the caller's login token only. It cannot read a custom header. So a rule that reads a header would work for normal
reads but would send no live events.

## Decision

1. Each browser signs in anonymously (`signInAnonymously()`). No email, no password, no screen.
2. The session id is that user's id (`auth.uid()`).
3. Read rules: `orders` and `order_events` rows are visible only when `session_id = auth.uid()::text`.
4. The menu and the kitchen are readable by everyone. `decision_log`, `run_log` and `params` have no read rule, so only the service role reads them.
5. The phone never writes with the anon key. n8n writes with the service role and sets `session_id` from the request.
6. Anonymous sign-ins are switched on for `goserve-dev` now and for production at the first release (F63).

## Consequences

- Live events and normal reads use the same rule. Investors never see each other's orders.
- Clearing the browser data gives a new session. That is fine for a demo; the reset button (story #52) also starts a new one.
- The kitchen and rider views run in the same browser as the customer view (one PWA, roles are screens), so they share the session.
- Real logins in MVP 1 replace this. The rule `session_id = auth.uid()` can stay, with `kitchen_id` rules added.
