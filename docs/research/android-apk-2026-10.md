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
