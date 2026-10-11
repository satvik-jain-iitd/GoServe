# ADR-001: Host the investor doorway site on Cloudflare Pages

## Status

Accepted.

## Date

2026-10-11.

## Context

We need a place to host the GoServe investor doorway site. The site is a
small, static build. The repository must stay private, but the owner wants
to use hosted CI checks.

The main options we looked at:

- **GitHub Pages.** Free Pages for a private repository needs a paid plan.
  So this is out.
- **Cloudflare Pages.** Free plan works with private repositories. It can
  also be deployed by a direct upload, so no GitHub App is needed and the
  owner does no DNS work.

## Decision

Host the site on **Cloudflare Pages**.

- Project name: `goserve`.
- Deploy by direct upload with `wrangler pages deploy`.
- A GitHub Action runs the same upload on every push to `main`.
- The Cloudflare account is `klickbae8yt`.

## Consequences

- The site is served from Cloudflare, with free TLS and a global CDN.
- Deploys are a single command, so they are easy to repeat and easy to roll back.
- We must keep a Cloudflare API token in GitHub Actions secrets. The token
  can write to Pages but nothing else sensitive.
- If we ever leave Cloudflare, the build is plain static files, so it moves
  anywhere in minutes.
