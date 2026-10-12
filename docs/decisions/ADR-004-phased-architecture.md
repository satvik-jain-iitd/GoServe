# ADR-004: Grow GoServe in five phases on free tiers

## Status

Accepted for MVP 0 (owner, 13 Oct 2026). Proposed for MVP 1 to MVP 4 (owner and founder to discuss).

## Date

2026-10-13.

## Context

Two docs disagreed. The PRD said Supabase. The solution document said self-hosted Postgres, our own API (Hono) and our own live channel on the Oracle server. The MVP 0 spec said n8n plus Postgres. The owner's goal is the fastest MVP with what he has, on free tiers, for up to 1 lakh users. The Oracle server sometimes goes down. The founder will demo alone, on an Android phone.

## Decision

1. Grow in five phases with the same 8 slots: MVP 0 (demo), MVP 1 (pilot), MVP 2 (one city), MVP 3 (1 lakh users), MVP 4 (vision). See `docs/architecture/evolution.md`.
2. MVP 0: n8n on Oracle is the brain. Supabase holds orders, events and logs, and pushes live updates. The PWA is hosted on Cloudflare Pages, behind a Pages Function front door. The phone has a demo autopilot.
3. Not used for orders: n8n Data tables (no transactions, shared with other projects, 200 MiB per instance).
4. Not used: Vercel Hobby (non-commercial use only), Render and Railway free plans (sleep or expire).
5. From MVP 2, the order hot path moves into Supabase database functions, so orders work when Oracle is down. n8n keeps side jobs.
6. MVP 3 adds Supabase Pro (the first paid line, about $25 a month), when live screens or messages pass the free limits.
7. Every table carries `kitchen_id` and `session_id` from day one.

## Consequences

- The demo does not depend on the Oracle server staying up.
- The Hono API, our own WebSocket server, Upstash Redis and the nginx API route are not used in MVP 0 to MVP 3. They stay listed in `docs/ARCHITECTURE_COMPONENTS.md` as "not used".
- Accounts stay in the owner's personal accounts for now. A transfer to GoServe-owned accounts is a follow-up.
- Supabase Free pauses after 7 idle days and has no backups. We add a keep-alive and a nightly export.
