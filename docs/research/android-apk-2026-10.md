# Android: install, APK and store

**Date read:** 22 Oct 2026. Priority: lowest. We use the Chrome install first.

| Claim | Evidence | Tier | Confidence | What it changes |
|---|---|---|---|---|
| Add to Home Screen opened the domain because the page linked the default manifest, and the role manifest was set by JavaScript later | Read of the live HTML and `main.tsx` | S | 0.85 | Fixed: one static page per role, with its own manifest |
| Chrome "Install app" makes a WebAPK for each manifest scope. Four roles give four installs from one site | Chromium docs | A | 0.8 | No APK build is needed |
| Install may need the page to have a service worker and a good manifest | Chromium docs | A | 0.8 | Our e2e test checks the link also after the service worker is ready |
| A Trusted Web Activity (TWA) is a real APK that shows the web app. It shares Chrome storage, so the four apps share one session | Chromium docs | A | 0.8 | Second choice if the Chrome install fails |
| A Capacitor app has its own storage, so apps do not share a session | Capacitor docs | A | 0.7 | Needs login (ADR-016) or a join link |
| A sideloaded APK needs no approval | Android docs | A | 0.9 | Fine for testers |
| A new personal Google Play account needs a closed test with 12 testers for 14 days before production | Google Play Help | A | 0.9 | Store launch has a wait of at least 14 days |
| The size of a TWA APK is a few MB | Not measured | C | 0.6 | Measure in a spike, only if needed |

## Order of work

1. Chrome install (WebAPK) from the fixed pages. Test on the owner's phone.
2. Only if that fails: a TWA spike for one role, size measured.
3. Then a `build-apk.yml` GitHub Action with four builds and a send to Telegram. The keystore is a repository secret, with a copy in the secrets vault.
4. Play store only after the closed test rules are planned.

## Workaround for today

In Chrome choose Add to Home screen, then **Create shortcut**. It uses the page address. Not tested yet (confidence 0.7).

## 25 Oct 2026: MVP 3 makes the APK the goal (epic E22, story #250)

The owner's goal of 25 Oct 03:45 reverses the priority above: the APK is now first, due 2 Nov 2026. Radar run: `docs/research/repo-radar.md`, section of 25 Oct (Bubblewrap adopted).

| Claim | Evidence | Tier | Confidence | What it changes |
|---|---|---|---|---|
| Bubblewrap turns our live manifest into a signed APK with one `init` and one `build`; it downloads JDK 17 and the Android SDK itself on first run (about 1 GB under `~/.bubblewrap`) | Bubblewrap CLI README, 25 Oct | A | 0.85 | The spike needs no Android Studio; it needs the owner's yes for the downloads on this Mac |
| The live customer manifest already has what a TWA needs: name, start_url and scope `/customer/`, display standalone, icons 192 and 512 (one maskable) | `curl` of goserve-app.pages.dev/manifests/customer.webmanifest, 25 Oct | S | 0.9 | No manifest work before the spike |
| Without a Digital Asset Links file at `/.well-known/assetlinks.json` the APK still runs but shows Chrome's address bar | TWA quick start | A | 0.85 | Spike first without it; the signed build's fingerprint then goes into `app/public/.well-known/assetlinks.json` and ships with the release |
| `goserve-app.pages.dev/.well-known/assetlinks.json` answers 200 today because Pages serves the app shell for every path; a real JSON file must win over the fallback | `curl -D -` on 25 Oct (content type below) | S | 0.8 | The file goes in `app/public/.well-known/`; the e2e checks the content type |
| A TWA shares Chrome's storage: the customer, kitchen, rider and admin apps keep one session, as on the web | Chromium TWA docs | A | 0.8 | One APK with four shortcuts, or four APKs, is a packaging choice, not a session choice (ADR in #250) |
| Chrome stops a page's geolocation watch when the screen is off; a TWA inherits this | Chromium behaviour; the `twa-location-delegation` demo moves the permission, not the wake | A | 0.7 | Story #252 needs an Android-side service (TWA + foreground service, or Capacitor); measure in the spike with the screen off for 10 minutes |

### The spike (story #250), one step at a time

1. Owner's yes: let Bubblewrap download JDK 17 and the Android SDK under `~/.bubblewrap` on this Mac (about 1 GB, removable by deleting the folder).
2. `npx @bubblewrap/cli init --manifest https://goserve-app.pages.dev/manifests/customer.webmanifest --directory ops/android/customer` with the answers: package `in.goserve.customer`, name GoServe, the Ink green theme, location delegation on, a new signing key whose keystore goes to the vault (`~/Desktop/Secrets/07_android_keystore/`), never the repo.
3. `bubblewrap build` → `app-release-signed.apk`; size written here.
4. Install on the owner's Android phone (`adb install` or the file by Telegram), run the customer app end to end, then the rider app by its address; measure each feature: push, location with the screen on and off, call links, camera for the feedback screenshot, offline.
5. ADR-020: one APK or four, TWA or Capacitor, what #252 needs.

## Spike result, 25 Oct 2026 (customer APK, Bubblewrap 1.27.0)

| Step | What happened | Time |
|---|---|---|
| `bubblewrap update` from a hand-written `ops/android/customer/twa-manifest.json` (no interactive `init`; the live manifest's name, colours, icons, scope `/customer/`, location delegation on) | Android project generated | seconds |
| Build 1 | Failed: two SDK licences not accepted (build-tools 35, platform 36). The legacy `tools/bin/sdkmanager` that Bubblewrap installs cannot accept them on JDK 17; the licence hash files under `~/.bubblewrap/android_sdk/licenses/` did | 2 min 13 s |
| Build 3 | Failed: `minSdkVersion 21` is below the 24 that `androidbrowserhelper 2.7.4` needs. Set 24 (Android 7, 2016) | 41 s |
| Build 4 | `app-release-signed.apk` 1,495,896 bytes (1.5 MB), `app-release-bundle.aab` 1.6 MB | 75 s |

- Signing: one upload key for the four role apps, alias `goserve`, keystore and passwords in the vault (`08_android_keystore.env`, `android/goserve-upload.jks`). Never in the repo. Cert SHA-256 `A7:4F:E2:AC:28:84:A3:62:85:D4:54:28:53:83:99:FD:B0:D7:0F:94:54:BE:14:D7:B7:47:9F:64:F2:BE:91:34`, now in `assetlinks.json` for `in.goserve.customer` (F157, one of four).
- Non-interactive build: `BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD` in the environment, `bubblewrap build --skipPwaValidation`. This is the shape `build-apk.yml` (#251) will use.
- Copy for the owner's phone: `~/Downloads/goserve-customer-v1.apk`. Install, open, check: no address bar once the assetlinks file is live on main, Day theme bar `#45654E`, location prompt from the app not the browser.
- Not measured yet (needs the phone): E-TWA-1 screen-off pings, push, install size on device.
