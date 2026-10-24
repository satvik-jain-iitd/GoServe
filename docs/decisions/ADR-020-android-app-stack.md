# ADR-020: The Android app stack for MVP 3

## Status

Accepted 25 Oct 2026 (owner's pick at 04:45, relayed by the reviewer). Research: `docs/research/mobile-stack-2026-10.md`.

## Date

2026-10-25.

## Context

MVP 3 (epic E22) wants an Android APK anyone can download, install and use by Sunday 2 November 2026, every feature and integration working, at zero running cost. The product is one React + TypeScript web app with four installable manifests (customer, kitchen, rider, admin) on one origin; the four share one session (ADR-016). The owner asked for the framework in trend among popular consumer apps, the best and latest, with code cost not a constraint because AI writes the code. The owner chose four APKs, one per role.

The research found: Expo (React Native) is what Meta, Microsoft, Amazon, Discord and Bluesky ship today and it is React like our app; Flutter is Google's and runs Google Pay and NotebookLM; Kotlin Multiplatform is stable with Compose for iOS since May 2025; and Shopify, the loudest React Native shop, went back to native Kotlin and Swift in September 2026 because AI agents made building twice cheap. Only a Trusted Web Activity ships the app we already have in days. In every route the rider's location with the screen off needs an Android foreground service.

## Decision

**Stage 1, by 2 Nov 2026: four Trusted Web Activities built with Bubblewrap.** Package names `in.goserve.customer`, `.kitchen`, `.rider`, `.admin`, one build script with four outputs (#251), one signing key in the vault and GitHub secrets, `assetlinks.json` served from the site. Location through the app's own permission (`enableLocationDelegation`). The rider wrapper gets a small Kotlin foreground service if experiment E-TWA-1 shows Chrome stops the pings with the screen off (#252). Every feature is the live web app's, so "every feature working" is true on day one; a release to main updates all four apps with no store review. The customer app goes to the Play Store internal track (#254).

**Stage 2, after 2 Nov 2026: the rider app in native Kotlin (Jetpack Compose)**, written by agents from the web screens, Shopify's route, after a two-day spike in the week of 3 Nov that proves the team can ship one rider feature set in Kotlin. The rider is first because it is the role that needs the phone most (location with the screen off, battery, a foreground service). The customer, kitchen and admin apps stay Trusted Web Activities until the pilot's numbers ask for more. **iPhone later, in Swift**, the same way; it needs an Apple developer account and App Store review in every stack, so it is not part of MVP 3.

## Rejected

- **Expo (React Native):** it reuses `app/src/lib` and is what Meta, Discord and Bluesky run, but it puts a framework between us and the phone; with AI writing the code, the reuse saves little and the native power of Kotlin wins (Shopify, Sept 2026).
- **Flutter:** Google's and strong, but Dart reuses nothing of ours and adds a second language for no gain over Kotlin on Android.
- **Kotlin Multiplatform / Compose Multiplatform:** sharing with iPhone is not needed in MVP 3; plain Kotlin first, Swift for iPhone later.
- **Capacitor:** a WebView with its own storage breaks the shared session (ADR-016) and adds a plugin layer for location; the TWA keeps Chrome's storage and ships the same day.

## Consequences

- 2 Nov is met by Stage 1 with no new codebase. Nothing in the web app changes for it.
- The only Android code before 2 Nov is the rider's foreground service, if E-TWA-1 needs it.
- Stage 2 opens a Kotlin codebase for the rider app (`android/rider/`), with its own tests, and a new ADR records the spike's result and the plan.
- Four listings and four downloads to keep; each TWA is 2 to 3 MB and built by one script.
