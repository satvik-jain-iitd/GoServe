# ADR-017: The city data model for MVP 2

## Status

Accepted 23 Oct 2026 (owner, in the MVP 2 plan; reviewer approved migrations 0013 to 0021).

## Date

2026-10-23.

## Context

MVP 2 is one city, 10 kitchens, 20 riders and 100 customers, cash only. One kitchen was not enough. Each person sees only their own part of the data.

## Decision

1. A kitchen has pin codes, open and active flags, opening hours and a place. A customer picks a pin code and sees the open kitchen that serves it.
2. Roles are rows, not a column: `kitchen_staff` (role kitchen), `riders`, `admins`, `customers`. Helpers `is_admin`, `is_my_session`, `is_my_kitchen` decide what a user may read.
3. Order functions run only for the service role, called by n8n. The app never writes an order status directly.
4. Dispatch is a rule in n8n: candidates, decide, assign. If no rider is free, the error workflow alerts.
5. A rider card shows the rider's first name and phone to the order's owner only, while the order is ready or on the way (`order_rider`).
6. Web push carries no text. The phone asks `push_latest` what to say. The VAPID private key lives only in the vault and an n8n credential.

## Consequences

Prod needs migrations 0013 to 0021 before the new app runs. Rows move with the owner's yes. Follow-ups F117 to F126 list what is left.
