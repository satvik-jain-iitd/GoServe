# ADR-025: Dispatch and the Rules decision run in the database

## Status

Accepted 8 Nov 2026 (story #1068, owner: "haan le aao, supabase me lao"). Supersedes the n8n SUB 22 and SUB 13 path for Rules. Switching those workflows off is a later step.

## Date

2026-11-08.

## Context

The Ready action already ranked riders inside the database (`dispatch_order_v2`, story #940). Two gaps remained: a Ready order with no free rider waited with nothing to retry it (SUB 22 hung off a route that gets no status any more), and the database path wrote no `decision_log` row. SUB 13 alone was p50 817 ms.

## Decision

1. `decide_rider_rules_v2` is the n8n rule in SQL, with the same input checks and the same `decision_log` row (`engine rules`). Jev and Laya are not ported (owner, 8 Nov). The golden test runs 153 rider sets through the n8n rule and the function and compares them.
2. `dispatch_order_db` picks the rider, writes the decision row and the assigned event. It never raises.
3. Triggers: an order turning Ready, a rider coming online, a rider freed by a delivery or cancel (waiting ready orders, oldest first, 20 at most). Batch mode has its own tick and nothing here assigns in it.
4. A transaction advisory lock and a busy re-check make two Ready orders safe.
5. Kill switch: `alter table orders disable trigger orders_dispatch; alter table riders disable trigger riders_dispatch;`.

## Consequences

- Ready to rider saved p50 13.4 ms, p95 15.8 ms inside the database.
- Prod: migration files 57, 58 and 59 in order.
- The remaining `dispatch_order_v2` call in `order-actions` answers `already_assigned` and goes later with the n8n switch-off.

## Not decided here

Switching n8n SUB 22 and SUB 13 off.
