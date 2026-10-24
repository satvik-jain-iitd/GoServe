# ADR-020: Four Android APKs, Trusted Web Activities built with Bubblewrap

## Status

Accepted 25 Oct 2026 (owner's decisions of 03:45 and 08:10, relayed by the reviewer; epic E22, story #250).

## Date

2026-10-25.

## Context

MVP 3 wants an Android app anyone can download, install and use by Sunday 2 November 2026, every feature working, at zero running cost. The product already runs as one web app with four installable manifests (customer, kitchen, rider, admin) on one origin, and the four apps share one session through Chrome's storage (ADR-016: no login for a customer). The radar run of 25 Oct (docs/research/repo-radar.md) found Bubblewrap, Google's own tool that wraps a web manifest into a signed Android app as a Trusted Web Activity (TWA); PWABuilder is the same engine behind a web form; Capacitor is a native shell with its own storage.

## Decision

1. **Trusted Web Activities, built with Bubblewrap.** The Android app is the live web app in a full-screen Chrome window, trusted through `/.well-known/assetlinks.json` on goserve-app.pages.dev. No native code, no second codebase. Chrome's storage stays, so the four apps keep one session.
2. **Four APKs, one per role**, package names `in.goserve.customer`, `in.goserve.kitchen`, `in.goserve.rider`, `in.goserve.admin`, each from its own manifest (start_url and scope `/<role>/`). The owner chose four over one: a cook installs the kitchen app and nothing else; the Play Store listing is the customer app; staff APKs come by direct download first (#251), the Play Store later (#254).
3. **One build script, four outputs** (`ops/android/build.sh`, story #251): one signing key for all four, kept in the vault and in GitHub secrets, never in the repo; its fingerprint fills `assetlinks.json` (F157).
4. **Location through the app's own permission** (`enableLocationDelegation`), so the rider grants Android's permission, not Chrome's. Whether a TWA keeps the location flowing with the screen off is measured in the spike; if it does not, story #252 adds an Android-side foreground service to the rider APK, or moves the rider app alone to Capacitor. The other three apps stay TWAs either way.

## Consequences

- The web app stays the one product; the APKs are wrappers that update when the site updates. A release to main updates all four apps at once with no store review.
- Four listings and four downloads to keep, but each one is 2 to 3 MB and built by the same script.
- `assetlinks.json` ships in `app/public/.well-known/` as real JSON (test apps S4); until the key exists its fingerprint lists are empty and the APK shows Chrome's address bar.
- The spike's measurements (size, push, location on and off, call links, camera, offline) go in docs/research/android-apk-2026-10.md and decide #252.
