# GoServe

**Fresh food at your door in under 15 minutes.**
GoServe is a food-delivery service with its own kitchens. The first pilot city is **Delhi**.

This repository holds the GoServe website, the design language, and the plans for the product app.

---

## What is in here

| Folder | What it is |
|---|---|
| `site/` | The public website (investor doorway): built with Astro, live on Cloudflare Pages |
| `design/` | The GoServe design language: colour tokens (`tokens.json`) and brand files (logo, app icon) |
| `ops/` | Scripts that set up automations (n8n workflows for the website forms) |
| `docs/` | Plans, decisions, research and the build journey — **on the `dev` branch** |

The `main` branch carries the code that runs. The `dev` branch carries everything, including all documentation.

## The product in one picture

People tap on their phones. One order book records every step. Every screen updates live.

- **Customer app:** browse the menu, order, track the rider, rate.
- **Kitchen screen:** accept, cook, mark ready.
- **Rider app:** pick up, deliver, confirm with an OTP.
- **Ops dashboard:** every order, live, with alerts.

How the system grows from a demo to 1 lakh users, phase by phase, is drawn in `docs/architecture/evolution.md` on the `dev` branch.

## Run the website locally

You need Node.js 22.

```bash
cd site
npm ci
npm run dev          # local site at http://localhost:4321
npm run test:unit    # unit tests
npm run test:e2e     # end-to-end and accessibility tests
npm run build        # production build into site/dist
```

## How we work

1. Every piece of work starts as a GitHub issue: an **epic** (a feature) with **stories** under it.
2. Each story gets its own branch `feat/<issue>-<short-name>`, cut from `dev`.
3. Tests come first. A pull request needs green checks (lint, types, unit, end-to-end, build).
4. **Two accounts:** development (commits, branches, pull requests) happens through `klickbae8yt-star`.
   Every review and every merge is done by `satvik-jain-iitd`.
5. `feat → dev` for each story; `dev → main` when a working increment is ready.
6. Before each product phase starts, we run a phase gate: we check every account, key and approval that phase needs.

## Design rules (short)

- Background cream `#E4E6D9`, text ink green `#263528`, actions deep green `#45654E`.
- Lime and warm yellow are small pops only.
- Never a raw colour in product code: use the token from `design/tokens.json`.

## Status

- Website: live.
- Product app: planning done; the first demo build (MVP 0) is next.

## Contact

Open an issue in this repository.
