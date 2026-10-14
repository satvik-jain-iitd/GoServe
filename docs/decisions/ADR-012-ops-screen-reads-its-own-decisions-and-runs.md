# ADR-012: The ops screen reads the decisions and runs of its own session

## Status

Proposed (story #51). The owner accepts it by merging the pull request.

## Date

2026-10-14.

## Context

ADR-010 gave `decision_log`, `run_log` and `params` no read rule, so only the service role could read them.
The ops screen must show the AI suggestion (from `decision_log`) and the numbers (from `run_log`) on the phone.

## Decision

1. `decision_log` and `run_log` get a read rule for signed-in users: `is_my_session(session_id)` (ADR-011). A device reads its own and joined sessions.
2. `params` stays unreadable from the phone. The bare anon key reads nothing.
3. Writes do not change: only n8n, with the service role, writes these tables.
4. The phone asks for a decision with the existing `decide` call (ADR-009). It does not write the row.

## Consequences

- A device sees only the decisions and runs of its own session. `decision_log` holds ids, free flags, distances and trip counts, no names or addresses; `run_log` holds workflow names, times and costs.
- "Runs today" counts one demo session, not the whole system. The scorecard (#47) reads all sessions with the service role.
- Migration `0007_ops_read.sql` is applied to goserve-dev. Prod follows in F63.
