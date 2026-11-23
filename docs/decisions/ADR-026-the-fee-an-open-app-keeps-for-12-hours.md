# ADR-026: An open app keeps the delivery fee it loaded, for up to 12 hours

## Status

Accepted 22 Nov 2026 (epic #1753; stories #1773, #1774, #1775; owner set the 12 hours on 22 Nov 2026). Shipped to prod in release 16 (23 Nov 2026).

## Date

2026-11-23.

## Context

The Bill drew "Free" first and the fee later, because the app only learned the fee from the quote. The owner wanted the fee in the very first frame of the Bill. A fee read at app start must then match what the quote and the order charge, even if an admin changes the fee while the app stays open.

## Decision

1. The database answers `delivery_fee_at_v1(p_as_of)` with `{amount_paise, as_of, now}`. A null time, or a time after the last change in `delivery_fee_log`, answers the current setting. A time before a newer log row answers the fee that was live then. A time in the future is now. A time older than 12 hours is now minus 12 hours.
2. The app reads the fee once at start and keeps the server's `as_of`. The Bill shows that fee at once; while the read is late it shows grey bars, never "Free".
3. `quote` and `orders` accept `fee_as_of` and charge the fee as of that time, so the Bill, the quote and the order agree. `orders` bundles `quote`, so they deploy together.
4. No secret and no per-phone memory: the app holds its own time stamp; the server keeps only the fee log it already had.
5. The Bill asks the quote on the menu, so its first frame has the server's total (story #1771).

## Consequences

- A new fee starts for an open app within 12 hours at most, and for every new session at once.
- Prod: one migration (`20261123100000_delivery_fee_at.sql`), quote and orders version 12.
- Undo: stop sending `fee_as_of` (the app falls back to the current fee); the function can stay.

## Named limits (accepted by the owner)

- (b) A caller can choose the lowest fee of an up-down-up sequence inside the 12 hours, by sending the `fee_as_of` of the low moment.
- (c) The fee changes of the last 12 hours can be probed, by calling the function with different times. The answer carries no name of who set the fee.

## Not decided here

- Showing the fee on every screen (#1757).
- The stale database tests (#1760).
