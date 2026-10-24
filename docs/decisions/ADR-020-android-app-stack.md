# ADR-020: The Android app stack for MVP 3 (draft for the owner's pick)

## Status

Proposed 25 Oct 2026. The owner picks one of the two paths below; the reviewer puts the choice in front of him. Research: `docs/research/mobile-stack-2026-10.md`.

## Date

2026-10-25.

## Context

MVP 3 (epic E22) wants an Android APK anyone can download, install and use by Sunday 2 November 2026, every feature and integration working, at zero running cost. The product is one React + TypeScript web app with four installable manifests (customer, kitchen, rider, admin) on one origin; the four share one session (ADR-016). The owner asked for the cross-platform framework in trend among popular consumer apps, the best and latest, with code cost not a constraint because AI writes the code. The owner also chose four APKs, one per role.

The research found: Expo (React Native) is what Meta, Microsoft, Amazon, Discord and Bluesky ship today and it is React like our app; Flutter is Google's and runs Google Pay and NotebookLM; Kotlin Multiplatform is stable with Compose for iOS since May 2025; and Shopify, the loudest React Native shop, went back to native in September 2026 because AI agents made building twice cheap. Only a Trusted Web Activity ships the app we already have in days. In every route the rider's location with the screen off needs an Android foreground service.

## Decision (proposed): two stages, the owner picks the second

**Stage 1, by 2 Nov 2026: four Trusted Web Activities built with Bubblewrap.** Package names `in.goserve.customer`, `.kitchen`, `.rider`, `.admin`, one build script with four outputs (#251), one signing key in the vault and GitHub secrets, `assetlinks.json` served from the site. The rider wrapper gets a small Kotlin foreground service if the spike shows Chrome stops the pings with the screen off (#252). Every feature is the live web app's, so "every feature working" is true on day one; a release to main updates all four apps with no store review. The customer app goes to the Play Store internal track (#254).

**Stage 2, after 2 Nov, one of:**
- **A. Expo (React Native) for the rider app first**, reusing `app/src/lib` as is and porting the rider screens; the other three stay TWAs until the numbers ask. This is the "in trend among consumer apps, reuses our code" answer. Risk: a port is a port; five working days for one role is the estimate, untested.
- **B. Native Kotlin (Jetpack Compose) for the rider app first**, written by agents from the web screens, as Shopify did. This is the "best Android app, AI writes it" answer. Risk: none of us has shipped Kotlin; the test is the same five-day box.

The recommendation is Stage 1 now and a two-day spike of A against B in the week of 3 Nov, because the evidence for "which is best for us" is 0.6 either way and the 2 Nov date is fixed.

## Consequences

- 2 Nov is met by Stage 1 with no new codebase. Nothing in the web app changes for it.
- The only Android code before 2 Nov is the rider's foreground service, if needed.
- Stage 2 is a product bet, not a date bet; it is decided by the spike and the pilot's numbers, and recorded in a new ADR.
- Four listings and four downloads to keep; each TWA is 2 to 3 MB and built by one script.
