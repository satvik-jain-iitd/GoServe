# ADR-015: The customer confirms delivery and cash in the UAT

## Status

Proposed (story S-C, #95). The owner accepts it by merging the pull request.

## Date

2026-10-15.

## Context

In the user acceptance test nobody delivers the food. The kitchen cooks and hands it over, and the customer takes it and pays cash. The order should still end as delivered and paid, like a real one, and the test should finish in minutes.

## Decision

1. The bill says **Place order (cash on delivery)**. After Ready the customer screen says "Tap Yes when you have it".
2. The app asks **"Was your order delivered?"** 3 minutes after Ready, or 8 minutes after placing, whichever is first. The two times are settings in the MAIN 01 Config and come back in every answer, so they can change without a new app build.
3. **Yes** calls the new action `confirm`. MAIN 01 passes it to SUB 12 as the customer. A new database function `confirm_delivery` does the whole job in one transaction: out for delivery, delivered, `paid_by = cash`, and the events `order.picked_up`, `order.delivered`, `order.confirmed`. A repeat answers `already_done`.
4. **Not yet** asks again after 2 minutes. On the third Not yet the Feedback sheet opens with "Order not delivered".
5. If the tester allowed it, the phone also shows a notification when the question comes. With the screen off this may not show until Web Push (story S-C2, after the demo).
6. A second tap on the same kitchen step is refused with `already_done`. The check lives in `change_status`, not in the status trigger: other updates, such as setting `paid_by`, keep the status the same and must still pass.
7. The one-step trigger is unchanged. The real rider flow is unchanged.

## Consequences

- `orders` gets a column `paid_by` (migration 0009). Only `cash` is allowed for now.
- The customer, not the rider, can close an order. In the UAT that is the point. With real riders the customer's Yes would only record cash and confirmation.
- No payment, no push server, no delivery-time model.
- Prod needs migration 0009 by `apply_migration.py` (with the owner's yes), then the new MAIN 01 and SUB 12.
