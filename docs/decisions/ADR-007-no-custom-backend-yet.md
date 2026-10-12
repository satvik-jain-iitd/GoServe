# ADR-007: No custom backend server in MVP 0 to MVP 2

## Status

Accepted (owner, 13 Oct 2026).

## Date

2026-10-13.

## Context

The owner asked whether to start with a reusable, fast backend, and whether Rust is the right language. Our MVP 0 is due
on 18 Oct. The logic already has a home (n8n), and the data has a home (Supabase, which can also run SQL functions).
Our peak load at 1 lakh users is about 13 orders a minute, which is not CPU-bound.

## Decision

1. MVP 0–1: n8n holds the order logic; Supabase holds the data and live updates.
2. MVP 2: the hot path moves into Supabase database functions (ADR-004). Still no custom server.
3. A custom service is added only with a new ADR and a measured need (for example, rider-location intake at MVP 3).
   Then we choose Rust (Axum) for a hot, CPU-heavy path, or TypeScript for everything else.

## Consequences

- Fastest path to the demo. Nothing to host or patch.
- The API surface stays stable behind the Cloudflare front door, so a custom service can replace n8n later without
  changing the app.
- Comparison and sources: `docs/research/options-frontend-backend-2026-10.md`.
