# ADR-022: Everything is demo until the first real kitchen signs

## Status

Accepted 25 Oct 2026 (owner, plan "living demo city", story #283).

## Date

2026-10-25.

## Context

Until now the demo city and the real city were kept apart. A demo kitchen showed only for pins that start with 9000. A demo rider could only take an order of a demo kitchen. The two kitchens we added by hand (GoServe Delhi Kitchen, Tau Ka Dhaba) had no riders at all. The owner wants to test at scale before 2 Nov. He places orders by hand on real Delhi pins and wants a rider to come.

## Decision

- Everything in GoServe is demo until the first real kitchen signs.
- A demo kitchen shows on its real pins. The `isSimPin` gate in the customer app is gone.
- A global param `sim_riders_serve_all` (default on) lets a demo rider take an order of any kitchen, and a real rider take a demo one. The one rule is `sim_rider_ok()`. Off brings back "real and synthetic never mix" for the day a real pilot starts.
- Only an admin can flip the param (`set_sim_riders_serve_all`).

## Consequences

- A customer on a real pin can order from a demo kitchen. Nothing is paid and nobody cooks. The investor site must never present these kitchens as signed.
- When the first real kitchen signs: turn the param off, then Reset the demo city, then the real kitchen stands alone.
- The two hand-made kitchens stay manual. The owner plays their staff. Demo riders deliver their orders.

## Not decided here

Orders moving by themselves (kitchen steps, rider movement, rejects and drops) is story #284.
