# ADR-002: Build the doorway site with Astro

## Status

Accepted.

## Date

2026-10-11.

## Context

The investor doorway site is a small set of mostly static pages. It shows
the mission, the palette, the plan, and two forms. It does not need a heavy
app framework.

We want a build that is fast, simple, and safe to test.

## Decision

Build the site with **Astro**. Use plain CSS with the GoServe design tokens.
Test with **Vitest** (unit) and **Playwright** plus `@axe-core/playwright`
(end-to-end and accessibility).

Astro is only for the doorway site. The product PWA is a separate decision.

## Consequences

- Pages ship as static HTML, so they load fast and are easy to host.
- The accessibility test is part of CI, so colour and markup problems are
  caught before merge.
- We keep the code small: no client framework is shipped unless a page needs it.
