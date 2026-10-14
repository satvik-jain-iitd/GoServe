# ADR-011: Two devices share a session by link, and the phone may reset its own session

## Status

Proposed (story #52). The owner accepts it by merging the pull request.

## Date

2026-10-14.

## Context

The 18 Oct demo runs on two devices (owner, 14 Oct): a customer phone and a kitchen device. ADR-010 makes the session id the
anonymous user id, so each device has its own session and the kitchen would not see the customer's order.
The demo also needs a reset button, and `order_events` are frozen (no delete).

## Decision

1. A table `session_links (member, session_id)` records that a device joined a session. No read rule, so only functions read it.
2. `join_session(p_session)`: the caller joins a session that exists. The session id is a random uuid in the link `?join=<id>`.
3. Read rules on `orders` and `order_events` use `is_my_session(session_id)`: the caller's own session, or one it joined.
4. `reset_session(p_session)`: allowed for the same sessions. It deletes that session's events, decisions and orders in one transaction.
   `run_log` stays. The events trigger lets a delete through only while that transaction has set `goserve.reset`.
5. The phone may call these two functions with its signed-in key. The anon key may not. Every order write still goes through n8n (ADR-009).
6. The device uses the joined session for reads and new orders; the choice is kept in the browser's local storage.

## Consequences

- Both devices see the same orders and hear the same live events (proved against goserve-dev, including the 2-second bound).
- Anyone who holds the link can read that session. It is a demo with fake orders; share the link only in the room (F74 b).
- A reset is the only way a phone deletes anything, and only for its own or a joined session.
- `scripts/clear_dev.py` uses the same door to clean goserve-dev.
- MVP 1 replaces this with real logins and `kitchen_id` rules.
- After a reset, `run_log` still holds rows of a session that has no orders. That is fine for the scorecard (#47).
