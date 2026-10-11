# ADR-003: Use letsdwelo.in as a temporary domain

## Status

Accepted.

## Date

2026-10-11.

## Context

The GoServe brand does not own a domain yet. The owner already has
`letsdwelo.in` on Cloudflare. We need the site live now, and we will move it
to the real GoServe domain later.

## Decision

Serve the doorway site at **`letsdwelo.in`** and **`www.letsdwelo.in`** for now.
Treat this as a temporary home.

- Attach both names to the Cloudflare Pages project `goserve`.
- Leave the `dhandha` record and the `_dmarc` and `_domainconnect` records alone.
- The switch to the real domain must be small: one static build, then attach
  the new domain and detach the old one.

## Consequences

- The site is live today with no cost.
- Any page that shows a contact email must use an address that survives the
  domain move. We use `hello@letsdwelo.in` only as a placeholder and change it
  with the domain.
- The site must not hard-code the domain anywhere it cannot be changed.
