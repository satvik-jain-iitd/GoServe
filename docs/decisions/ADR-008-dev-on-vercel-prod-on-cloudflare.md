# ADR-008: Dev site on Vercel, production on Cloudflare Pages

## Status

Accepted (owner, 13 Oct 2026).

## Date

2026-10-13.

## Context

The owner wants Vercel's one-click Supabase integration for day-to-day development, and Cloudflare for production.
Production is the app at `goserve-app.pages.dev`, built from `main`. All accounts live on klickbae8yt@gmail.com.

## Decision

| | Dev | Production |
|---|---|---|
| Branch | `dev` | `main` |
| Host | **Vercel** (project `goserve-app-dev`, Hobby) | **Cloudflare Pages** (project `goserve-app` → `goserve-app.pages.dev`) |
| Database | Supabase project **`goserve-dev`** (Vercel integration fills the keys) | Supabase project **`goserve`** (Mumbai) |
| Keys | Vercel environment variables | Cloudflare Pages environment variables + GitHub Actions secrets |

- The app's front door (`/api/*`) is written once as a standard `fetch(Request) → Response` handler; a thin adapter
  wraps it for Vercel Functions and for Cloudflare Pages Functions, so dev behaves like production.
- The new Supabase account's 2 free projects are used as one dev and one production project.

## Risks and how we handle them

- **Vercel Hobby terms:** "restricted to non-commercial personal use only"; commercial usage is "any deployment used
  for the purpose of financial gain of anyone involved in any part of the production"
  (https://vercel.com/docs/limits/fair-use-guidelines, Tier A). A dev site of a commercial product may count. Worst
  case: Vercel pauses the dev project. Production is not affected (Cloudflare). If it happens, move dev to a
  Cloudflare branch preview (free, commercial use allowed) or pay for Vercel Pro.
- **Two hosts can drift:** keep one handler, one set of tests, and the same environment variable names on both.
- **Free Supabase projects pause after 1 week idle:** the keep-alive job pings both projects.

## Consequences

- Owner gets Vercel previews and the Supabase integration for development.
- Production stays free and commercial-safe on Cloudflare.
- Needs `VERCEL_TOKEN` (and later the project and org ids) in the vault for Claude to set up the dev project.
