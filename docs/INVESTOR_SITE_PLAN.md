# GoServe — Investor Doorway Site: Plan

**Date:** 11 Oct 2026
**Owner approved:** yes ("go")
**Status:** building

This is the plan for one job: build and host a single, beautiful website that acts as an investor "doorway" for GoServe. When an investor opens it, the site should make them stop and think "what did they build here?". This file explains what we build, how it looks, where it lives, and how we test it.

---

## 1. Goal

One fast, accessible, stunning website at **letsdwelo.in** that:
1. Shows what GoServe is (the mission and vision).
2. Makes the exact deck brand palette visible and explainable.
3. Captures interest through two forms: pre-registration and investor contact.

It is a doorway, a gate. Not the product. The product (the PWA) is built separately.

---

## 2. Where it lives (hosting)

- **Host:** Cloudflare Pages, project `goserve`.
- **Account:** klickbae8yt Cloudflare account (id `5a79124d9fd64f30059f498fd203b01c`).
- **Code:** the private repo `satvik-jain-iitd/GoServe`, folder `site/`. The repo stays **private**. Cloudflare Pages works with a private repo on the free plan.
- **Deploy method:** direct upload with `wrangler pages deploy`, plus a GitHub Action that runs the same command on push. No Cloudflare GitHub App, no DNS work for the owner.
- **Domain:** `letsdwelo.in` and `www.letsdwelo.in`, attached to the Pages project.

### DNS rules
- The apex `letsdwelo.in` currently points at two Amazon IPs that do not serve a working site. We replace those records when we attach the Pages custom domain.
- **We do not touch** `dhandha.letsdwelo.in` (a Cloudflare tunnel for a separate side project) or the `_dmarc` / `_domainconnect` records. They stay alive.

### This domain is temporary
The owner will switch this site to its own GoServe domain later. So we keep the site fully portable: one static build, and attaching or removing a domain is a 5-minute job. Steps to switch are written in the ADR.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Site | **Astro** | Ships zero JavaScript by default. Fast, accessible, perfect for a content doorway. |
| Styles | Plain CSS with design tokens | Full control of the deck palette. No heavy framework. |
| Unit tests | **Vitest** | Fast, simple. |
| E2E tests | **Playwright** | Crawls every link, checks forms, runs axe. |
| A11y | `@axe-core/playwright` | Proves WCAG compliance. |
| Host | Cloudflare Pages | Free, global CDN, private repo. |

The product PWA stays a separate decision (Next.js) and is not part of this site.

---

## 4. Design language

Deck palette only. No invented colours.

| Role | Colour | Hex |
|---|---|---|
| Canvas | Cream | `#E4E6D9` |
| Text / ink | Ink Green | `#263528` |
| Primary / action | Deep Green | `#45654E` |
| Section surface | Sage | `#BFCFB4` |
| Soft pop | Lime | `#C8D888` |
| Accent pop | Warm Yellow | `#FFDE59` |
| Warm panel | Off White | `#F7F3EF` |

Rules:
- Apple-level restraint: one idea per screen, large type, generous whitespace, purposeful motion only.
- Contrast checked and asserted: ink-on-cream is about 11:1 (AAA), white-on-deep-green about 6.6:1.
- Motion respects `prefers-reduced-motion`.
- Every interactive element has a visible focus ring.
- No colour-only meaning. Every status has text too.

Full token list lives in `docs/design-tokens.md`.

---

## 5. Pages (sitemap)

| Path | What it shows | State |
|---|---|---|
| `/` | The doorway: hero, mission, how it works, the Jev difference, pre-register call to action | live |
| `/palette` | The palette made visible: every swatch, M3 roles, contrast ratios, live components | live |
| `/how-it-works` | The 15-minute food OS, step by step | live |
| `/technology` | The Jev decision engine and architecture, explained for investors | live |
| `/roadmap` | MVP 0 to MVP 4, each with an honest label | live (with "coming soon" labels) |
| `/investors` | Why GoServe, the ask, and the investor contact form | live |
| `/pre-register` | The pre-registration form | live |
| `/404` | Branded not-found page with a way home | live |

Rules:
- Every link works. No dead ends. No broken redirects.
- If something is not ready, it is labelled clearly: "Work in progress" or "Coming soon". A visitor always understands what they see.

---

## 6. Forms

Two forms, one pipeline. Both post to n8n webhooks, then to Postgres, then a Telegram alert.

### 6.1 Pre-registration form
- Fields: name, email, phone (optional), city, interest role (customer / rider / kitchen partner / investor).
- Goal: measure real interest in the idea.

### 6.2 Investor contact form
- Fields: name, firm, email, message.
- Goal: an investor can reach out, and the owner is alerted at once.

### 6.3 n8n
- One folder-tag: `🍔 GoServe` (matches the existing n8n tag convention).
- Workflow 1: "GoServe — Pre-Registration Capture".
- Workflow 2: "GoServe — Investor Contact".
- Each node has a label and notes so a human can read the flow in the UI. Each workflow has a description.

---

## 7. Test-driven development

For every story, the failing test is written first.

| Test type | Tool | What it proves |
|---|---|---|
| Unit | Vitest | Colour token math, contrast ratios, form validation |
| E2E | Playwright | Every link returns 200, no redirect failure, forms submit |
| A11y | axe-core | No critical accessibility violations on any page |
| Build | Astro build | The site builds clean |

CI runs lint, typecheck, unit, e2e, and build. A link checker fails the build if any internal link is broken.

---

## 8. Process

- First commit the pending bootstrap to `main`, then create `dev`.
- Build the site on `feat/investor-doorway-site`, cut from `dev`.
- PR `feat → dev`, then `dev → main`. The owner merges to `main`.
- ADRs: hosting, stack, temporary domain.
- Update `docs/assumptions.md`, `docs/follow-ups.md`, and `docs/process-trace.md`.

---

## 9. Execution order

1. Write this plan, plus `knowledge/SOURCE.md`.
2. Commit the bootstrap, push `main`, create and push `dev`.
3. Create `feat/investor-doorway-site`.
4. Build tokens and components.
5. Build the pages, starting with `/` then `/palette`.
6. Add both forms and the n8n webhooks.
7. Run tests until green.
8. Deploy to Cloudflare Pages and attach `letsdwelo.in` and `www`.
9. Open PRs, update the trace.

---

## 10. Out of scope (ponytail)

We do not build:
- The product PWA.
- A CMS. Content lives in the code.
- User accounts or logins on this site.
- A blog.
- Multi-language. English first.
