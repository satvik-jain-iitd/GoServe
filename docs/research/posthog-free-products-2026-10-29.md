# PostHog: what the free plan gives us, and what we use (29 Oct 2026)

Owner's words, 29 Oct 2026: "no koi roll ni krna h jo hai wah use krke check kro sab working hai ya nhin, also jo bhi posthog me free wizards hon jinke help se hum proper product analytics web analytics etc setup kr sakte hain to wo explore and implement kro and stories bana do properly under correct epic".

Written by the reviewer. Sources are tagged by the web-research tiers (A = PostHog's own API or docs, read 29 Oct 2026). Every number was read live from the PostHog billing API with our own key, not from a blog. Nothing here is a secret: the project token is public by design, the personal key is never written.

## 1. Check with the key we have (Tier A, 29 Oct 2026, 15:40 IST)

| What | Result | Confidence |
|---|---|---|
| Personal API key reads the project (`GET /api/projects/<id>/`) | Works. Project 325394 "Default project", EU cloud, timezone UTC. | 1.0 |
| Events in the last 7 days (HogQL `select event, count() from events`) | **0 events.** | 1.0 |
| Why 0 | The app sends events only when `VITE_POSTHOG_KEY` is set in the build (#207, dev only). The secret `DEV_VITE_POSTHOG_KEY` was set on 29 Oct 09:35Z. The dev deploy (`deploy-dev.yml`) runs on pushes to `dev`, but since 28 Oct every merge goes to `staging`; the last dev deploy ran 27 Oct. So no build ever carried the key. | 0.95 |
| Project settings already on | session replay opt-in, web vitals, heatmaps, console log capture, performance capture. Every product's onboarding is marked complete (03:00Z, 29 Oct). | 1.0 |
| Objects | 0 feature flags, 0 surveys, 0 actions, 1 dashboard, 8 insights. | 1.0 |
| Plan | Free, no subscription. Billing period 29 Oct to 28 Nov. | 1.0 |

The key is fine for reading. Listing or making personal keys through the API is refused ("This action does not support personal API key access"), so a roll would be a UI click; the owner said no roll.

## 2. The free allowance per product (Tier A, billing API, 29 Oct 2026)

| Product | Free per month | Our use today |
|---|---|---|
| Product analytics | 1,000,000 events | 6 custom events (#207), 0 sent so far |
| Session replay | 5,000 recordings | off in the SDK (`disable_session_recording: true`) |
| Feature flags | 1,000,000 requests | none (our flags are build-time `VITE_` values) |
| Surveys | 1,500 responses | off (`disable_surveys: true`) |
| Error tracking | 100,000 exceptions | off |
| Data warehouse | 1,000,000 rows | none |
| Realtime destinations | 10,000 trigger events | none |
| LLM analytics | 100,000 events | none |
| Logs | 10,000 MB ingested | none |
| PostHog AI | 500 credits | none |

At the pilot's size (hundreds of orders a day, section 1 of the founder brief) every line stays far under its free cap. Confidence 0.9 that we pay nothing for a year.

## 3. The "wizards"

- `npx @posthog/wizard` (Tier A, docs): an AI wizard that edits a codebase to add posthog-js. It lists React, not Vite. We already have `posthog-js` 1.438.9 and our own `app/src/lib/analytics.ts` (#207), so the wizard would add a second init beside ours. Decision: do not run it; turn each product on in our own init, one story each. Confidence 0.9.
- The in-app product onboardings are all marked complete in the project already. Nothing to click there.

## 4. What each product needs from our SDK init (Tier A, posthog-js config docs)

| Product | Option in `ph.init` | Today | Story |
|---|---|---|---|
| Web analytics (visitors, paths, referrers, UTMs, devices) | `capture_pageview: 'history_change'` (a single-page app), `capture_pageleave: true`, `defaults: '2026-08-30'` | `capture_pageview: false`, `capture_pageleave: false` | S-B |
| Product analytics funnel | our six events; a funnel insight first_open → code_ok → address_set → order_placed → delivered_yes | events exist, no funnel saved | S-B (insight by the reviewer) |
| Session replay | `disable_session_recording: false`, `session_recording: { maskAllInputs: true }`, `ph-no-capture` class on name, phone and address | off | S-C |
| Error tracking | `capture_exceptions: true`, `captureException(err)` in the app's error boundary; source maps need `posthog-cli` with a personal key in CI (owner's click, optional) | off | S-D |
| Surveys | `disable_surveys: false`, one popover survey targeted on `delivered_yes` | off; we have our own feedback sheet (F1) | S-E (M4, may stay off) |
| Reverse proxy against blockers | PostHog's managed proxy (free on Cloud) or a Cloudflare route, then `VITE_POSTHOG_INGEST` | direct `eu.i.posthog.com` | S-F (M4) |
| Autocapture (every click) | `autocapture: true` | off on purpose: a click can carry a name or an address in its text | stays off |
| Heatmaps | `capture_heatmaps: true` | project toggle on, SDK off | with S-C if the owner wants it |

Privacy line that stays: no prop ever carries a name, phone or address (#207); `person_profiles: 'identified_only'`; `persistence: 'localStorage'` (no cookie banner needed). Prod carries no key until the owner says so (follow-up, not a story).

## 5. Stories written (epic E20 #203)

S-A #737 dev deploy follows `staging` (the root cause of 0 events, M3); S-B #738 web analytics and the funnel (M3); S-C #739 session replay with masking (M3); S-D #740 error tracking (M3); S-E #741 one survey (M4); S-F #742 reverse proxy (M4). All sub-issues of #203.

## 6. Sources
- PostHog billing API `GET /api/billing/`, our project, 29 Oct 2026 (Tier A, live).
- PostHog docs: getting started, web analytics, session replay privacy, error tracking web, surveys web, posthog-js config (`posthog.com/docs/libraries/js/config`), read 29 Oct 2026 (Tier A, the vendor's own; they sell the paid tiers, so the free caps are the fact to trust, the "recommended" extras less so).
