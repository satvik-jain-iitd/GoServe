# Mobile stack for MVP 3: which framework ships the GoServe Android app

**Question (owner, 25 Oct 2026 04:20):** pick the cross-platform framework in trend now, the one popular high-functioning consumer apps use, the best and the latest. Code cost is not a constraint (AI writes it). The goal stays: an Android APK anyone can install and use by Sunday 2 Nov 2026, every feature working, zero running cost.

**What would change the decision:** which framework real consumer apps run on in 2026 (their own posts, not agency lists), how much of our React + TypeScript (`app/src/lib`, screens) each one reuses, whether the rider's location keeps flowing with the screen off, push, offline, four APKs from one build, and what can truly ship in eight days.

**Read on:** 25 Oct 2026. Tiers and scores as in the web-research rule: A primary, B big data by a seller, C blog or vendor article, S our own data. Vendors are marked.

## 1. Who runs on what (adoption by consumer apps)

| Claim | Evidence | Tier | Conf. | Who gains if we believe it |
|---|---|---|---|---|
| Meta (Facebook, Instagram, Messenger desktop), Microsoft (Office, Outlook, Teams, Xbox), Amazon (Shopping, Alexa, Kindle), Wix run React Native in parts of their apps | reactnative.dev/showcase (Meta's own list, undated) | A for "they say so", B for "how much" | 0.8 | Meta: the framework's owner |
| Discord moved Android to React Native in 2022 and kept it; startup time on low-end phones was the cost, halved in 2023 | discord.com/blog "Supercharging Discord Mobile" (2023) | A | 0.85 | Discord: none |
| Bluesky's app runs Expo 58 + React Native 0.88 + React 19.3 today | package.json of bluesky-social/social-app, read 25 Oct 2026 (★18k) | A (the code) | 0.95 | None |
| React Native 0.82 (8 Oct 2025) runs only on the New Architecture; Expo SDK 55 removed the old path; Expo is the framework the React Native docs recommend | reactnative.dev/blog 0.82; Expo docs | A | 0.85 | Meta, Expo (vendor) |
| **Shopify left React Native in Sept 2026** after six years: LLM coding agents made "build it twice, natively" cheap, so the sharing advantage shrank; Shop app rebuilt native in 12 weeks; Skia and Restyle libraries handed over or archived | shopify.engineering/back-to-native, Mustafa Ali, 10 Sep 2026 | A | 0.9 | Shopify: none; it costs them goodwill in the RN world |
| Flutter runs Google Pay, NotebookLM (Dec 2025), Google Classroom, Toyota (May 2026), SoFi (Jun 2026), talabat (May 2026), Nubank, BMW, Alibaba, PUBG Mobile | flutter.dev/showcase (Google's own list, dated case studies) | A for "they say so" | 0.8 | Google: the framework's owner |
| Flutter 3.47 is current (12 Aug 2026); three-month cadence | docs.flutter.dev/release/whats-new | A | 0.9 | Google |
| Kotlin Multiplatform is stable (Nov 2023); Netflix, McDonald's, Cash App, Philips use it for shared logic; Compose Multiplatform for iOS went stable in 1.8.0 (May 2025) | blog.jetbrains.com (Nov 2023, May 2025) | A for "they say so" | 0.8 | JetBrains: sells the IDE |
| Survey shares: Flutter and React Native are the two cross-platform frameworks developers use, within a point of each other (2024: about 12.6% each of all respondents) | Stack Overflow 2024 survey as quoted by Pragmatic Engineer; the 2025 page did not load in full | B | 0.6 | None |
| Capacitor (Ionic) ★17k, MIT, active; background location needs a plugin (community, or Capawesome "Insiders", a paid tier, Sep 2026) | GitHub; capawesome.io (vendor) | A for the repo, C for the plugin claims | 0.7 | Ionic, Capawesome (vendors) |
| Bubblewrap (Google) turns a web manifest into a signed Android app (Trusted Web Activity); android-browser-helper adds location delegation | GitHub READMEs, 25 Oct | A | 0.85 | Google: wants the web to win |

**Opposite view, found on purpose:** Shopify's reversal is the strongest 2026 signal and it points away from every cross-platform framework. Its premise is the owner's own premise: "code cost is not a constraint, AI writes it". If that premise holds for GoServe, the "best" Android app is a native Kotlin (Jetpack Compose) app, which is what the top Android consumer apps are. The premise has not been tested on our team of one founder and two agents in eight days.

## 2. Fit for GoServe (what each route reuses and what it needs)

| Route | Reuses our React + TS | Background location (screen off) | Push | Offline | Four APKs, one build | Ships by 2 Nov | Zero running cost | Confidence |
|---|---|---|---|---|---|---|---|---|
| **TWA (Bubblewrap)** | Everything: the live web app runs inside | Not by itself: Chrome freezes hidden pages (timers and callbacks stop; Chrome's page lifecycle docs, Tier A). Needs an Android foreground service in the rider wrapper (Bubblewrap makes a real Gradle project we can extend) | Web push, already live | Service worker, already live | Yes: four manifests, one script | Yes, days | Yes | 0.8 that it ships; 0.5 on location until the spike |
| **Expo (React Native)** | `app/src/lib` TypeScript as is (cash day, tickets, money); every screen rewritten in React Native components; `ui.css` has no direct port | Yes, with expo-location background task (foreground service) | FCM through Expo's service or direct | AsyncStorage or SQLite, rewrite | Yes: `app.config.js` variants by `APP_VARIANT`, local `expo run:android` + `gradlew bundleRelease`; EAS free tier 15 builds, local builds free | Four apps in eight days: no (0.3). One app (rider) in eight days: maybe (0.5) | Yes (local builds; FCM free) | 0.75 on the facts |
| **Flutter** | Nothing: Dart | Yes, with a plugin | FCM | Yes | Yes (flavors) | No: four apps rewritten in Dart (0.15) | Yes | 0.8 on the facts |
| **Kotlin Multiplatform / Compose** | Nothing | Yes, native | FCM | Yes | Yes (product flavors) | No for four apps (0.15); one app maybe (0.4) | Yes | 0.8 |
| **Capacitor** | Everything, as a WebView; but its own storage means the four apps lose the shared session (ADR-016) | With a plugin | Needs a plugin | Yes | Yes | Yes, days | Yes if the free community plugin holds | 0.7 |

## 3. What the evidence says

- "In trend, used by popular consumer apps, latest" with our code reused points to **Expo (React Native)**: Meta, Microsoft, Amazon, Discord and Bluesky run it today; it is React, like our app; its 2025 and 2026 releases are the New Architecture only. Confidence 0.8.
- The same sentence, read with "AI writes it", points to **native Kotlin**, because Shopify (Tier A, Sept 2026) just showed that with agents the sharing advantage shrinks. Confidence 0.6 that this holds for a team of one plus agents in eight days; untested.
- Neither ships four apps by 2 Nov. Only the **TWA** route does, because it ships the app we already have. Confidence 0.8.
- The one hard problem, the rider's location with the screen off, is an Android problem in every route: Chrome freezes hidden pages; a WebView stops its JavaScript; a native foreground service is the fix in all five. Test it on the owner's phone before choosing (experiment E-xx below).

## 4. Open claims turned into tests (rule 10)

| Hypothesis | Test | Decision rule |
|---|---|---|
| A TWA stops `rider_ping` when the screen is off | Install the spike APK, go online as a rider, screen off for 10 minutes, read `riders.updated_at` | Gap over 60 s: the rider APK needs a foreground service (#252) in any route |
| A foreground service inside the Bubblewrap project keeps the pings flowing | Add a small Kotlin service to the rider wrapper, same 10 minute test | Gap under 60 s: TWA holds for the rider; Expo stays a later choice |
| The team can port one role (rider) to Expo in five working days with the shared `lib` | Time-boxed spike after 2 Nov, rider only | Done with every rider feature: Expo for the rider app; else TWA stays |

## Sources

Tier A: [Shopify, back to native (10 Sep 2026)](https://shopify.engineering/back-to-native); [Shopify, five years of React Native (Jan 2025)](https://shopify.engineering/react-native-future-mobile-shopify); [React Native showcase](https://reactnative.dev/showcase) (Meta, vendor); [React Native 0.82](https://reactnative.dev/blog/2025/10/08/react-native-0.82) (Meta, vendor); [Discord, supercharging mobile](https://discord.com/blog/supercharging-discord-mobile-our-journey-to-a-faster-app); [Bluesky social-app package.json](https://github.com/bluesky-social/social-app); [Flutter showcase](https://flutter.dev/showcase) (Google, vendor); [Flutter what's new](https://docs.flutter.dev/release/whats-new); [Compose Multiplatform 1.8.0](https://blog.jetbrains.com/kotlin/2025/05/compose-multiplatform-1-8-0-released-compose-multiplatform-for-ios-is-stable-and-production-ready/) (JetBrains, vendor); [Kotlin Multiplatform stable](https://blog.jetbrains.com/kotlin/2023/11/kotlin-multiplatform-stable/) (vendor); [Chrome page lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api); [Expo build variants](https://docs.expo.dev/build-reference/variants/), [local production builds](https://docs.expo.dev/guides/local-app-production/), [pricing](https://expo.dev/pricing) (vendor); [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap); [android-browser-helper](https://github.com/GoogleChrome/android-browser-helper). Tier B: [Pragmatic Engineer on cross-platform surveys](https://newsletter.pragmaticengineer.com/p/cross-platform-mobile-development). Tier C (vendor): [Capawesome background geolocation](https://capawesome.io/docs/sdks/capacitor/background-geolocation/).
