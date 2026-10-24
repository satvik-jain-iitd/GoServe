# MVP 3: an Android app anyone can install, at zero running cost

**Owner's goal (25 Oct 2026, 03:45). This overrides every earlier order of work.**

> By Sunday 2 November 2026 I want a working Android APK of GoServe. Anyone can download it, install it and use it. Every feature works. Every integration works. It is fully tested. iOS comes later. The founder gives Play Store access. Before the APK, the running cost must be zero: the fine-tuned Laya model (or another fine-tuned local model) does all the decision work instead of the paid Jev API.

Ideas: ID188 (APK), ID189 (zero cost). Epic: E22 (number set by the coder).

## What "done" means on 2 Nov

1. A signed APK file at a public link. A stranger with an Android phone installs it in one minute.
2. In that app: a customer orders, a cook accepts and cooks, a rider delivers, the admin sees it all. Push alerts, the rider's location, the call buttons, the feedback screenshot, the offline menu, Day and Night: all work inside the app, not only in Chrome.
3. No paid call per order. Laya answers the decisions; Jev is switched off (cap 0). The health page shows Laya.
4. The Play Store has the app on the internal testing track (the public listing needs the founder's account and Google's review time).
5. One full run on a real Android phone, recorded in `docs/tests/test-cases.md`, before the release.

## Facts we start from (checked 25 Oct)

- The four apps are one React PWA at goserve-app.pages.dev, each role with its own manifest, icons and scope (`app/src/pwa-manifest.ts`).
- Research from 22 Oct (`docs/research/android-apk-2026-10.md`): a Trusted Web Activity (TWA) is a real APK that shows the web app and shares Chrome storage. A Capacitor app has its own storage. A sideloaded APK needs no approval. A new personal Play account needs a 14 day closed test before production.
- Jev is called from the n8n SUB Decide and the health check (`ops/n8n/order/`, `app/src/lib/health.ts`). `docs/ARCHITECTURE_COMPONENTS.md` already plans "Laya first, Jev backup".
- Laya: data generator, metrics and Kaggle training under `ops/ai/laya/`; held-out test about 72% (F103); refund and at_risk are code, not a model (F110).

## The hard parts, named

- **Rider location with the screen off.** A web app stops sending location when the phone sleeps. Options: keep the screen awake while online (Wake Lock), or a small native layer (Capacitor plugin). The spike measures it; the ADR decides.
- **Laya quality.** 72% on the held-out set is not Jev. Each decision gets a code fallback (the rules we already have) so a wrong model answer cannot break an order.
- **Play Store time.** Google's review and the 14 day closed-test rule are outside our hands. The APK link is the 2 Nov deliverable; the store track runs in parallel.

## Stories, in order (each: radar run first, failing test first, one PR)

1. **Spike: TWA APK of one role** (Bubblewrap). Measure size, install, push, location, calls, camera, offline on the owner's phone. ADR: one APK with a role chooser, or four APKs.
2. **Build and publish**: `build-apk.yml` signs the APK on every release; keystore in GitHub secrets and the vault; a download page with a QR code.
3. **Rider location in the app**: wake lock or native plugin, per the ADR; a test with the screen off for ten minutes.
4. **Laya in production**: Laya served over HTTP on the Oracle box; n8n SUB Decide calls Laya first with the code fallback; Jev cap 0; health page row; cost row in the daily card reads zero.
5. **Play Store**: founder's account, internal testing track, listing text and screenshots, privacy and terms links.
6. **MVP 3 gate**: the full run on an Android phone, every integration ticked, release PR to main, closure note.

## Owner steps (one at a time, when asked)

- Play Store access from the founder.
- A yes for the keystore and its place in the vault.
- A yes for Laya on the Oracle box (phase gate, rule 16).
- The phone run at the gate.

## Verification

- Install from the public link on a phone that never had GoServe; order, cook, deliver end to end.
- Push arrives with the app closed. Location keeps updating for ten minutes with the screen off (or the ADR says why not).
- Daily card: Jev cost 0; Laya decisions logged.
- All CI green; the e2e suite runs against the same web build the APK wraps.
