# ADR-006: PWA stack for the product app

## Status

Proposed. Decided at the start of the MVP 0 build.

## Date

2026-10-13.

## Context

The product app is one PWA for customer, kitchen, rider and ops. It must load fast on an Android phone, install to the home screen, and be hosted free on Cloudflare Pages. ADR-002 chose Astro for the investor site only. The components list said "Next.js, DECIDE".

## Options

| Option | For | Against |
|---|---|---|
| Vite + Preact + TypeScript + `vite-plugin-pwa` | Small and fast on phones. Static files. Easy on Cloudflare Pages. Installable out of the box | Fewer built-in pages and routes than Next.js |
| Next.js | Big community | Needs an adapter on Cloudflare Pages. Heavier on phones. Server features we do not need |
| Astro (like the site) | Already in the repo | Built for content pages, not an app with live state |

## Recommendation

Vite + Preact + TypeScript + `vite-plugin-pwa`, on Cloudflare Pages, with a Pages Function as the front door.

## Consequences

- The site (Astro) and the app stay separate builds in one repo, or the app gets its own folder.
- CI gets lint, type check, unit and end-to-end jobs for the app, like the site.
