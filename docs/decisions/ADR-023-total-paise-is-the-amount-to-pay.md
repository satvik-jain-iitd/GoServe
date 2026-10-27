# ADR-023: `total_paise` is the amount to pay

## Status

Accepted 27 Oct 2026 (reviewer).

## Date

2026-10-27.

## Context

In v1 (`place_order`) `orders.total_paise` is the item total. In v2 (`place_order_v2`) it is the amount to pay from the quote. They agree only while fees, tax and coupons are zero. Coupons (#346) and fees (#345) break that.

## Decision

- `orders.total_paise` is the amount the customer pays, after fees, tax and coupons.
- `bill.item_total_paise` is the food value.
- Cash to collect is `order_cash_to_collect_paise`, never `total_paise` alone: an order paid online collects zero.
- The v1 path keeps working, because with zero fees both numbers match.

## Consequences

- Readers to check when fees or coupons go live: `app/src/lib/orders.ts`, `admin.ts`, `kitchen.ts`, `autopilot.ts` and the screens `RiderScreen`, `KitchenScreen`, `OrdersScreen`, `AdminOrders`, `PlacedScreen`. The kitchen ticket must show food value, the rider must show cash to collect.
- Follow-up F245 covers the cash screens.

## Not decided here

Whether the kitchen is paid on food value or on the amount to pay. That is a pricing decision for the owner.
