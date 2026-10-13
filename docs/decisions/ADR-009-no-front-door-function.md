# ADR-009: No front-door function in MVP 0

## Status

Accepted (owner, 13 Oct 2026). Replaces the front-door part of ADR-008 and the Pages Function row in `docs/architecture/mvp0-build-design.md`.

## Date

2026-10-13.

## Context

Dev runs on Vercel and production runs on Cloudflare Pages (ADR-008). A front-door function would need two adapters to behave the same on both. MVP 0 has no secret that must be hidden from the phone, so the function adds work and risk for little gain.

## Decision

1. The phone reads from Supabase directly with the anon key. Row level security limits every read and write to the caller's `session_id`.
2. The phone writes (place order, change status) through an n8n webhook. The webhook checks a demo token and throttles calls. The server re-checks every price, status step and rule.
3. Live updates come from Supabase Realtime. No polling and no stream endpoint.
4. The frozen API paths and event names in `docs/product/MVP0_SPEC.md` stay as the contract. They are the n8n webhook paths.

## Consequences

- Dev and production run the same static code. One less thing to build and host.
- The demo token sits in the app, so it has low value by design. It is rotated at each release. Real security comes from row level security and server-side checks.
- A function can come back later with a new ADR, when a secret must be hidden (for example payments in MVP 2).
