# ADR-008: Dev site on Vercel, production on Cloudflare Pages

## Status

Accepted (owner, 13 Oct 2026).

## Date

2026-10-13.

## Context

The owner wants Vercel's one-click Supabase integration for day-to-day development, and Cloudflare for production.
The owner already knows Vercel well (faster, better dev work) and is learning Cloudflare through production. He chose both
for speed and quality, after weighing the costs of two hosts (13 Oct 2026).
Production is the app at `goserve-app.pages.dev`, built from `main`. All accounts live on klickbae8yt@gmail.com.

## Decision

| | Dev | Production |
|---|---|---|
| Branch | `dev` | `main` |
| Host | **Vercel** (project `goserve-app-dev`, Hobby) | **Cloudflare Pages** (project `goserve-app` → `goserve-app.pages.dev`) |
| Database | Supabase project **`goserve-dev`** (Vercel integration fills the keys) | Supabase project **`goserve`** (Mumbai) |
| Keys | Vercel environment variables | Cloudflare Pages environment variables + GitHub Actions secrets |

- ~~Front door as one handler with two adapters~~ — replaced by ADR-009 (no front-door function). Dev and production run the same static app.
- The new Supabase account's 2 free projects are used as one dev and one production project.

## Risks and how we handle them

- **Vercel Hobby terms:** "restricted to non-commercial personal use only"; commercial usage is "any deployment used
  for the purpose of financial gain of anyone involved in any part of the production"
  (https://vercel.com/docs/limits/fair-use-guidelines, Tier A). A dev site of a commercial product may count. Worst
  case: Vercel pauses the dev project. Production is not affected (Cloudflare). If it happens, move dev to a
  Cloudflare branch preview (free, commercial use allowed) or pay for Vercel Pro.
- **Two hosts can drift:** keep one handler, one set of tests, and the same environment variable names on both.
- **Free Supabase projects pause after 1 week idle:** the keep-alive job pings both projects.

## How dev reaches Vercel (owner, 13 Oct 2026)

- **No Vercel GitHub app link.** The Vercel GitHub app on `satvik-jain-iitd` is already tied to another Vercel account
  (LinkRight), and the Hobby plan can block deploys when the commit author is not the Vercel account owner (seen as
  "Blocked" on a LinkRight preview; conf 0.6 that it would hit our two-account flow).
- **GitHub Actions deploys dev to Vercel** with the Vercel CLI and the repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`. PR previews are an extra workflow step. Linking the app later stays possible.

## Consequences

- Owner gets Vercel previews and the Supabase integration for development.
- Production stays free and commercial-safe on Cloudflare.
- Needs `VERCEL_TOKEN` (and later the project and org ids) in the vault for Claude to set up the dev project.
