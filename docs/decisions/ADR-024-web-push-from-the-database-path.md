# ADR-024: Web push goes out from the database path, not from n8n

## Status

Accepted 8 Nov 2026 (story #1067, owner: "supabase me lao"). Switching n8n GS MAIN 34 off is a later step.

## Date

2026-11-08.

## Context

Every customer alert (a status, the rider's Arriving tap, a kitchen opening) is a row in `push_outbox`. n8n MAIN 34 drained the table and called the push service. Measured on dev from `order_trace` (35 real alerts): push_queued to push_sent p50 12.6 s, p95 28.7 s, max 29.4 s. A customer waiting for "Arriving" feels that.

## Decision

1. An AFTER INSERT trigger on `push_outbox` asks Edge Function `push`, route `/web`, through pg_net at once. A failure is swallowed; the row waits.
2. The function claims one row with one UPDATE guarded by `taken_at is null`, sends one VAPID push per subscription with the words inside the encrypted payload (RFC 8291), and marks the row sent. 404 and 410 forget the subscription.
3. A pg_cron job `goserve-push-retry` asks again for rows unsent after a minute (3 times, dead after 10 minutes).
4. The service worker shows the words that came inside the push; an empty push asks the database as before.
5. MAIN 34 keeps running until a real phone has shown a push from the new path. The claim is the same `taken_at is null` guard on both sides, so a row is sent once.

## Consequences

- After (dev, 8 orders, dead synthetic address): p50 0.36 s, p95 0.64 s. It ends at the push service's answer, not at a phone.
- Three secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) are needed on dev and prod. Without them the route answers 503 and MAIN 34 sends as today.
- Prod: migration files 56 and 58 of the owner-run plan.

## Not decided here

Switching MAIN 34 off. It waits for a real phone check.
