# ADR-013: Role apps: separate installable PWAs on one origin

## Status

Proposed (story #83). The owner accepts it by merging the pull request.

## Date

2026-10-15.

## Context

The owner asked (15 Oct 2026) that the user app, the driver app and the other app types (PWAs for now) work on one device and on different devices, starting with one device. Until now there was one PWA with role tabs. CLAUDE.md rule 9 says one codebase for customer, kitchen, rider and ops.

## Decision

1. One code base, one build, one origin, one service worker. Each role is its own **app** with its own address:
   `/customer/`, `/kitchen/`, `/rider/`, `/ops/`. The address picks the app. `/` stays the **demo console** (all roles, split view, Autopilot, Reset) so the 18 Oct demo does not change.
2. Each app has its own web manifest (`/manifests/<role>.webmanifest`): its own name, `id`, `scope` and `start_url`. Each can be installed on the same phone. A role app shows only its screen: no role tabs, no demo tools.
3. **One device:** all the apps are the same origin, so they share the browser's storage and therefore one anonymous session (ADR-010). They see the same orders with no sign-in and no link.
4. **Different devices:** the join link (ADR-011) works on any app address (`/kitchen/?join=<id>`). Per-role share links come in a later slice.
5. No separate builds, no app store packages, no role logins (MVP 1).

## Consequences

- Android Chrome installed apps (WebAPKs) are expected to share storage with Chrome for the same origin, so one-device sharing should work there. **This is not yet sourced:** it is checked on the founder's phone in story #56 (F83 a). **iPhone is different (not yet sourced, checked on a real iPhone in story #56):** a home-screen web app has its own storage, so two installed apps on an iPhone do not share a session; they use the join link. The founder's device is Android. Check on a real phone in story #56.
- The manifest is chosen by script on page load (the page swaps the manifest link by address). Chrome reads it for the install check after load; this needs the real-phone check too.
- Each app opens inside its scope; a link out of the scope opens in the browser.
- The service worker covers the whole origin, so every app address opens offline after the first visit.
