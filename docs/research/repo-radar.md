# Repo radar (append only)

## 2026-10-25 · need: mobile admin screens for a small food-delivery ops team (list kitchens and riders, one kitchen with staff and menu, add-kitchen form), React PWA on the Ink design system

Runs: `scout.py --need "mobile admin screens for a small food delivery ops team ..." --limit 8` → no repos found; `scout.py --need "react mobile admin list detail form screens" --limit 6` → no repos found (logs: scratchpad `radar-h12b.log`). GitHub `topic:admin-dashboard topic:react` by stars, top 3 READMEs read.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| marmelab/react-admin (★27k, active 24 Oct) | A for the counts | A frontend framework on REST/GraphQL with Material UI, react-hook-form and react-router; its own data provider and look. | Would replace the Ink screens and the Supabase reads with its own layer; ADR-019 fixes one look and one codebase. | Skip (score n/a, confidence 0.6) |
| appsmithorg/appsmith (★41k) | A for the counts | A hosted or self-hosted low-code platform for internal tools (Docker, Kubernetes). | A separate app, not a library in the PWA; the admin must live in the same installable app as the other roles. | Skip |
| dingyi214/slash-admin (★3k) | A for the counts | A React 19 + Vite + shadcn/ui dashboard template. | A template with its own components and theme; borrowing a template beats nothing we lack (lists, rows, forms exist in `app/src/ui`). | Skip |

Decision: build H12b from the house `ui/` components (rows, slip, tabs, StaffLanding). Nothing found calls into the Ink system; the screens are three lists and one form. Confidence 0.6 (keyword fit only; the 20-repo calibration is not done).

## 2026-10-25 · need: cash hand-over reconciliation between a delivery rider and a kitchen, business day bound to a closing time past midnight, Supabase (story #229)

Runs: `scout.py --need "cash hand-over reconciliation between delivery rider and kitchen, business day bound to closing time past midnight, Supabase"` → no repos found; GitHub `topic:cash-reconciliation`, `topic:delivery-management topic:supabase`, `cash settlement rider delivery in:readme stars:>50`.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| wityliti/witylogix (★5, pushed Aug 2026, no licence) | C | A self-hostable delivery platform with order sync, CRM and fleet engines. | A whole platform in another stack; no cash-day or hand-over rule in its README. | Skip |
| sahol3/scarpar (★7, MIT, pushed Jul 2026) | C | Next.js 15 + Supabase commerce platform with cash-on-delivery "settlement batches". | The idea matches (a settlement batch = our hand-over), the code is a multi-tenant platform; borrow the idea only. | Borrow the idea: stamp the orders, not a ledger |
| accord-erp-automation/accord_mobile (★10, pushed Jun 2026) | C | Flutter client for ERPNext delivery and warehouse. | Flutter, ERPNext; nothing on cash days. | Skip |

Decision: build in the app. Two small functions (`dayOf`, `cashInHand`) shared by both screens, one column `orders.cash_handed_at` and one rpc `kitchen_handover`; the "settlement batch" idea from scarpar became a stamp per order, which is less code and gives both screens one source. Confidence 0.7 (the topic search found no library for a cash day or hand-over; the four reconciliation repos were bank or ERP tools, ★0).

## 2026-10-25 · need: roadmap page generated from GitHub issues, static HTML, Python (story #239)

Runs: `scout.py --need "roadmap page generated from GitHub issues, static HTML, python"` → no repos found; GitHub `topic:roadmap topic:github-issues`, `github issues roadmap static html generator in:readme stars:>30`, `topic:github-issues topic:kanban stars:>50`.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| kamranahmedse/developer-roadmap (★370k) | A for the counts | Hand-written learning roadmaps. | Content, not a generator. | Skip |
| Meekdai/Gmeek (★2k, pushed Feb 2026) | C | A blog built from GitHub issues by a GitHub Action. | Same idea (issues to static HTML, Python) but a blog shape, Chinese templates, Action-bound; our page needs epics, stories, PR state and a board. | Borrow the idea only |
| GitHub Projects (the platform's own board) | A | A kanban and roadmap view over issues. | Needs a login, shows titles not the Business sentences, no Vision or Delivered sections, cannot be opened as one local file. | Skip |

Decision: one stdlib script over `gh` (GraphQL for issues with parent links, `gh pr list` for checks). Confidence 0.8: the shape (plain sentence per story, jargon swap, delivered accordion) is this project's own; nothing found renders it.

## 2026-10-25 · need: kitchen display system, a cancelled order notice that shows for a minute then leaves, React (story #230)

Runs: `scout.py --need "kitchen display system cancelled order notice, ticket shows cancelled for a minute then leaves, React"` → no repos found; GitHub `topic:kitchen-display-system`, `kitchen display system react in:readme stars:>20`.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| FreeOpenSourcePOS/FloCafe (★150, MIT, pushed 23 Oct) | C | Offline-first cafe POS. | A POS, not a KDS rule; README has no cancel handling. | Skip |
| ury-erp/mosaic (★47, AGPL, pushed Nov 2025) | C | KDS for ERPNext with KOT printing. | AGPL, ERPNext-bound; no cancel notice in the README. | Skip |
| ahmedali5530/restaurant-pos (★71, pushed 23 Oct) | C | React + SurrealDB POS with void reports. | Voids live in reports, not on the cook's screen. | Skip |

Decision: one pure function (`justCancelled`) and a set of seen ids in the kitchen screen; 20 lines. Confidence 0.8 (a KDS "void flash" is a common feature in paid systems; nothing open and small to borrow).

## 2026-10-25 · need: kitchen display shows the assigned rider's name and minutes away on a ready order (story #231)

Runs: `scout.py --need "kitchen display system shows the assigned delivery rider name and minutes away on a ready order"` → no repos found; GitHub `kitchen display rider assigned in:readme stars:>20` → four student projects (★0 to ★2), none with a rider ETA on the cook's screen.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| Arjun-Chandra-7/Byte-Eats (★2) | C | A student food-delivery app. | No KDS, no rider ETA. | Skip |
| TianLeTL/CloudKitchen (★0, Oct 2026) | C | A cloud-kitchen demo. | Same. | Skip |

Decision: one pure function (`minutesAway`: haversine over a scooter speed, null when the location is older than ten minutes) and the riders read the Kitchen screen already has; ten lines. Confidence 0.9 (an ETA from a last location is textbook; nothing to adopt).

## 2026-10-25 · need: wrap the existing PWA as an Android APK anyone can install, signed in CI, with the rider's location working (story #250, epic E22)

Runs: `scout.py --need "wrap an existing PWA as an Android APK, Trusted Web Activity, Bubblewrap, signed APK in CI, background location"` → no repos found; GitHub `topic:trusted-web-activity stars:>20`; the four known wrappers read by hand (READMEs, 25 Oct 2026).

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| GoogleChromeLabs/bubblewrap (★3.1k, Apache-2.0, pushed 12 Oct 2026) | A (Google, the TWA authors) | CLI: `init --manifest <url>` reads our web manifest, makes an Android project, `build` signs an APK and an AAB; `fingerprint` makes the Digital Asset Links file; keystore passwords by env vars for CI; offers to download JDK 17 and the Android SDK itself on first run (Node 18+). | Exactly our shape: one web app, four manifests, no native code. Shares Chrome's storage, so the four apps share one session (ADR-016 holds). | **Adopt** |
| GoogleChrome/android-browser-helper (★834, Apache-2.0, pushed 12 Oct 2026) | A | The Android library under Bubblewrap; demos: `twa-location-delegation` (the APK asks Android's location permission instead of Chrome's). | Needed for story #252: location through the app's own permission. Bubblewrap can enable it (`enableLocationDelegation`). | **Adopt** (via Bubblewrap) |
| pwa-builder/PWABuilder (★3.8k, pushed 23 Oct 2026) + pwa-builder/CloudAPK (★164, pushed Oct 2025) | B (Microsoft) | A web UI and a cloud service that run Bubblewrap for you (Docker + Azure). | Same engine, one more vendor in the path, and a Docker box we do not need. | Skip (use Bubblewrap directly) |
| ionic-team/capacitor (★17k, MIT, pushed 23 Oct 2026) | A | A native shell with a WebView and plugins (background geolocation plugins exist). | Own storage, so no shared session (login or a join link); a native build per release; heavier. Keep as the fallback for #252 only if a TWA cannot keep location flowing with the screen off. | Hold |

Decision: Bubblewrap TWA, one APK per role first (the customer app), measured on the owner's phone; then decide one APK vs four in the ADR. Confidence 0.8 (Tier A tools, our manifest already passes the TWA fields: name, start_url, scope, display standalone, 192 and 512 icons with a maskable one). Open risk for #252: a TWA runs in Chrome, and Chrome stops geolocation watchers when the screen is off; the fix is Android-side (a foreground service or Capacitor), decided after the spike measures it.
## 2026-10-25 · need: synthetic city seed and reset for a food-delivery marketplace (story #188, epic E16)

Runs: `scout.py --need "synthetic city seed for a food delivery marketplace: fake kitchens, riders and dishes marked synthetic, deterministic seed and reset functions in Postgres, Supabase"` → no repos found; GitHub `synthetic data seed postgres food delivery simulator stars:>20` → only platforms (supabase, grafana, coolify, metabase, prisma), none a seed; `topic:synthetic-data postgres seed` → nothing on topic. Log: scratchpad `radar-h5.log`.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| supabase/supabase (★113k) | A | The platform we already run on. | Its `seed.sql` is a one-time file, not a marked, resettable set. | Already in use; borrow nothing new |
| prisma/orm (★47k) | B | An ORM with a `prisma db seed` hook. | A new runtime for one SQL function. | Skip |
| Faker-style libraries (not surfaced by the search) | C | Random names. | The names must be stable per seed, so a word list in SQL does the same with no dependency. | Skip |

Decision: two plpgsql functions in one migration (`sim_seed`, `sim_reset`), ids from `md5(seed || index)` so a re-seed updates the same rows, a `synthetic` flag on three tables, service_role only. Nothing found that fits; built from scratch. Confidence 0.9 (a seed is a hundred lines of SQL; a library would cost more than it saves).

## 2026-10-25 · need: simulated delivery riders moving on a map every minute, random walk in SQL (story #189, epic E16)

Runs: `scout.py --need "simulated delivery riders moving on a map every minute, random walk in Postgres or SQL, fake GPS positions for a food delivery demo"` → no repos found; GitHub `gps simulator random walk delivery rider` → GNSS signal simulators and Android mock-location apps; `topic:gps-simulator` → the same. Log: scratchpad `radar-h6.log`.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| BeepView/route-gps-simulator (★3) | C | Moves a tracker along a fixed route and posts positions on a timer. | Needs a route per rider and a process to run; our riders live in Postgres and n8n already ticks every minute. Idea borrowed: metres to degrees with the cosine of the latitude. | Borrow the maths only |
| danusha2345/gnss-signal-simulator-rs (★34) | C | A radio-level GNSS signal simulator. | Wrong layer. | Skip |
| emanuele8888/MockGPSPrivacy (★4) | C | Fakes the phone's own location. | Wrong layer; our fake riders have no phones. | Skip |

Decision: one SQL function (`sim_tick`) called by a schedule workflow. Random walk of 100 to 300 m per minute, a tether toward the nearest synthetic kitchen past 1 km so riders do not drift out of Delhi. Nothing found that fits; built from scratch. Confidence 0.9.

## 2026-10-25 · need: admin control panel for a demo data simulator (seed, reset, tick on and off, counts), React (story #190, epic E16)

Runs: `scout.py --need "admin control panel for a demo data simulator: seed, reset, start and stop a tick, show counts, React"` → no repos found. GitHub search skipped: the need is one screen on our own design system (Ink v3) calling our own webhook; any admin-panel kit would bring a second UI language. Log: scratchpad `radar-h7.log`.

Decision: one screen (`AdminSim.tsx`) on the existing rows, fields, switch and buttons of `ui/`, one small client (`lib/sim.ts`) shaped like `lib/orders.ts`. Nothing found that fits; built from scratch. Confidence 0.95.

## 2026-10-25 · need: a feature flag that switches the live decision engine between rules and a model, versioned, set by an admin through n8n (story #263)

Runs: `scout.py --need "feature flag to switch the live decision engine between rules and an ML model, versioned setting, admin toggle, n8n"` → no repos found; GitHub `feature flag toggle self-hosted postgres stars:>500` → platforms (flag services with their own servers and SDKs). Log: scratchpad `radar-263.log`.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| Hosted or self-hosted flag services (Unleash, Flagsmith, GrowthBook class) | C | A server, an SDK and a dashboard for many flags. | One flag with three values, already inside our database (`params`, versioned, the same shape as `sim_enabled` and `cost_caps`). A service adds a server to run and a second admin. | Skip; borrow the idea of a versioned, audited flag |

Decision: one `params` row per change (global/decision_engine), two database functions that check `is_admin()` on the caller, n8n forwards the admin's own token. Nothing found that fits; built from scratch. Confidence 0.9.

## 2026-10-25 · need: batch matching of delivery riders to kitchen orders by food-ready time, in SQL on Postgres (story #263 layer 2)

Runs: the research pass of `docs/research/quick-commerce-dispatch-2026-10.md` (36 claims, tiers A to C, written by the reviewer the same day) is the radar for this need; it covers the published methods of the big delivery apps and found no open component for a 20-rider city. `scout.py` for the earlier engine switch also found nothing near.

| Repo or method | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| Hungarian or auction matching libraries | C | Optimal assignment. | The research (D3) says greedy inside a batch window is enough at our size; a library adds a runtime for no gain. | Skip |
| Open vehicle-routing solvers (OR-Tools class) | C | Routing with time windows. | Needs customer coordinates and road times we do not have yet (Stage 2). | Later, Stage 3 |

Decision: one SQL function (`dispatch_match`) written from the research file's Stage 1 steps, one tick function that applies it, replayed by `scripts/dispatch_sim.py` (E9). Nothing found that fits; built from scratch. Confidence 0.8 on the design (D4 ready-time is Tier A), 0.6 on the size of the gain at our scale until E9.

## 2026-10-25 · need: build and sign the Bubblewrap APK in GitHub Actions on a release and attach it (story #251, epic E22)

Runs: `gh search repos "bubblewrap twa build action"` → nothing; GitHub `topic:trusted-web-activity github-actions` → nothing. The Bubblewrap README (Tier A) already documents the CI shape: `BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD` in the environment, `bubblewrap build --skipPwaValidation`. Log: radar record of #250 above.

| Repo | Tier | Fit | Verdict |
|---|---|---|---|
| GoogleChromeLabs/bubblewrap | A | The CLI itself runs in CI with the two env vars; `actions/setup-java` and the runner's Android SDK give the rest. | Adopt (already chosen in #250) |
| A ready-made GitHub Action for Bubblewrap | none found | n/a | Build the 90-line workflow ourselves |

Decision: one workflow file, no new dependency except `qrencode` from apt for the QR picture. Confidence 0.7: the steps follow the spike on my Mac, but the first run on a GitHub runner is still to be seen (F181).

## 2026-10-25 · need: seed a realistic simulated food delivery city: restaurants, menus, couriers that move (E16 dream city, stories #282 to #284)

Runs: `scout.py --need "seed a realistic simulated food delivery city: restaurants, menus, couriers that move"` → no repos found; a second run with "synthetic delivery data generator couriers restaurants" → no repos found; `gh search repos "food delivery simulation courier"` and `--topic food-delivery --topic simulation`. Read the two READMEs that matched.

| Repo | Tier | Fit | Verdict |
|---|---|---|---|
| seldon1000/Food-Delivery-Simulation | C | A C and TCP exam project, 0 stars, last push 2021. No Delhi data, no database. | Skip |
| ankitjangir-ai/zomato-batching | C | A Python batching study on synthetic Indian cities. It already informed #273 and has no seed data or live tick. | Borrow ideas only (already done in E9) |
| Our own `sim_seed` and `sim_tick` (0028, 0030) | S | Seed, reset and the tick exist, with random kitchens. | Extend in SQL (0034, 0035) |

Decision: nothing off the shelf seeds named kitchens, menus and moving riders inside Postgres. Build in SQL by extending the existing functions, no new dependency. The menu data comes from web research, written under the `web-research` skill. Confidence 0.8 that nothing fits.

## 2026-10-25 · need: download free licensed food photos from Pexels or Unsplash for a list of dish names, keep the photographer credit (story #292, epic E16)

Runs: `scout.py --need "download free licensed food photos from Pexels or Unsplash for a list of dish names, keep photographer credit"` → no repos found; `gh search repos "pexels python"`, `"pexels api client"`, `"unsplash python"`. Read the Pexels API page and licence page (Tier A, for what Pexels says it allows).

| Repo | Tier | Fit | Verdict |
|---|---|---|---|
| Adoubf/pexels-python, Stink-Po/pexels-python, kilhage/pexels | C | One-star clients for a single GET endpoint; the newest has no tests and 1 star; kilhage last pushed in 2020. Adopting one adds a dependency for 10 lines. | Skip |
| kipruun/Pexels-python-scrapper | C | Scrapes the website, which the API terms do not allow. | Skip |
| Pexels API (`GET /v1/search`, key in the `Authorization` header, 200 requests an hour) | A | Gives `photographer`, `url`, `alt` and sizes per photo. Licence: free commercial use, credit not required but asked, no implied endorsement, no unaltered resale. The API page asks for a visible link to Pexels. | Adopt the API with a stdlib script |

Decision: one stdlib script (`scripts/dish_photos.py`) that calls the API, picks a photo whose alt text names the dish, saves it in the `menu` Storage bucket and records the source in a table. Nothing on GitHub fits. Confidence 0.8. Unsplash is the fallback; its API needs a key too.

## 2026-10-25 · need: measure whether the rider app keeps sending its place with the screen off, and build a rider test APK (story #252, epic E22, experiment E-TWA-1)

Runs: no new search. The ADR-020 research (radar of 25 Oct, `docs/research/mobile-stack-2026-10.md`) already chose Bubblewrap, and #250 built the customer project with it. The rider test APK is the same project with another package name, start URL and scope (`ops/android/rider/twa-manifest.json`, then `bubblewrap update` and `build`). Nothing off the shelf reads our own `rider_pings` table, so the gap check is a 40-line stdlib script, `scripts/rider_gap.py`.

Decision: reuse Bubblewrap and the customer project; one small script for the measurement. No Kotlin service until E-TWA-1 says the TWA stops pinging (ADR-020: the only Android code before 2 Nov). Confidence 0.8.

## 2026-10-25 · need: serve a fine-tuned Laya decision model over HTTP on the Oracle ARM server, with Jev capped at zero (story #253, epic E22)

Runs: `scout.py --need "serve a fine-tuned ModernBERT decision model over HTTP on a small ARM CPU server"` → no repos found; `gh search repos "convaiinnovations laya"`. Found small repos around Laya: `TheNerdMan/docker-laya-api` (a Docker image of Laya, 0 stars, Sept 2026), `minhquan2904/laya-scripts` (Laya on CPU through FastAPI, 0 stars), `heheebei-rgb/laya-mirror` (a mirror of the weights). All Tier C, 0 stars, written by unknown people. The author's own `laya-serve` (Tier A, `POST /v1/systemone`) is the better base.

Decision: nothing is built from scratch. If we serve Laya, we use the author's `laya-serve` and our own fine-tuned weights; the community Docker images are not adopted (unknown authors, no stars). Whether to serve at all is the owner's call: `docs/research/laya-first-readiness-2026-10.md`. Confidence 0.8.

## 2026-10-25 · need: upload an Android bundle to the Google Play internal testing track from GitHub Actions (story #254, epic E22)

Runs: `scout.py --need "upload Android AAB or APK to Google Play internal testing track from GitHub Actions"` → no repos found; `gh search repos --topic google-play --topic github-actions`; read the READMEs of `r0adkll/upload-google-play` (MIT, 1054 stars, last release v1.1.5 on 21 Apr 2026, last push 17 Oct 2026; takes `.aab` or `.apk`, `tracks`, `status`, a service account JSON from a secret) and `Triple-T/gradle-play-publisher` (MIT, 4322 stars, maintenance mode; needs a Gradle project, we build with Bubblewrap).

Decision: adopt `r0adkll/upload-google-play` v1.1.5 as one workflow step, pinned to its commit e738b9d (reviewer, #300: it receives the Play key and a tag can move); no code of our own. Facts from its README: the app must already exist in the Play Console (the API cannot create it), so the first bundle is uploaded by hand by the owner. Confidence 0.8 (vendor README, Tier C; the Play API itself is Tier A and was not run yet). Test: the first real upload (owner's step, phone test P2).

## 2026-10-25 · need: a privacy page for the Play listing that matches what the database keeps (story #302, epic E22)

Runs: none new. The page already exists (`app/public/privacy/index.html`, story #123, linked from the Account screen); it only lacked the phone, saved profile, rider place and push address. A privacy-policy generator would write a generic text that does not match our schema, so none is adopted. The only new code is one test that reads our own migrations.

Decision: edit the existing page; add `scripts/test_privacy_page.py` (every personal column in the schema must be named on the page, and nothing listed may be missing from the schema). Confidence 0.8. The text is still a draft, not lawyer-checked: Play may ask for more (data safety form), see F204.

## 2026-10-25 · need: delete rider place history after 30 days on prod without an active n8n workflow (story #302, review of #304)

Runs: no repo search. `pg_available_extensions` on the dev project shows `pg_cron` available (Supabase ships it). A scheduler inside the database is the standard answer for a plain SQL delete and needs no new tool. MAIN 90 PROD stays off (read from the n8n API on 25 Oct: only MAIN 01, 30, 31 and 32 are active, plus their SUBs).

Decision: one migration, `0040_prune_rider_pings.sql`, schedules `pilot_prune()` daily at 02:00 India. MAIN 90 keeps its prune node too; running twice is harmless. Confidence 0.85 (dev run proved the job and the delete; prod not run yet).
## 2026-10-26: watch a phone screen recording frame by frame (Swish app study)
Need: let the agent watch a 9 min 44 s iPhone screen recording (1284x2778, 60 fps, HEVC, almost silent: mean -58.6 dB) of the Swish app, find every screen, journey and animation.
Run: `scout.py --need "analyze a phone screen recording video frame by frame ..."` → no repos found. GitHub search (scene detection, video frames llm, video mcp, topic:scene-detection).
| Repo | Stars, last push | Licence | Tier | Fit |
| HUANGCHIHHUNGLeo/claude-real-video (crv) | 2.2k, 23 Oct 2026 | MIT | C (author's README) | Best fit: scene-change frames, drops near-duplicates, contact-sheet grids, timestamps in frames.json, runs locally. Adopted (pip in a scratch venv, no transcript: the clip is silent) |
| Breakthrough/PySceneDetect | 5.3k, 25 Oct 2026, v0.7.2 | BSD-3 | C | Scene cuts only; crv covers it. Backup if crv misses a cut |
| kajisho5/ffmpeg-skill | 2.8k, 25 Oct 2026 | MIT | C | An editor, not an analyser. Skip |
Chosen: crv for key frames; plain ffmpeg (already installed) for short 10 fps bursts around transitions, so motion and animation can be seen frame by frame.

## 2026-10-27: design reference sources (story #329)

Need: open, checkable design references for a native food-ordering app with an order slip that lives on the lock screen (the Living Slip): platform rules, sample code for Live Activities and Live Updates, motion ideas, colour contrast checks.
Run: `scout.py --need "open source food delivery app ui design reference swiftui compose live activity"` → no repos found. GitHub topic searches: `live-activity` + `swiftui`, `dynamic-island` + `swiftui`, `food-delivery` + `swiftui`, `food-delivery` + `jetpack-compose`, `design-system` + `swiftui`. Numbers come from the GitHub API (Tier A for the numbers only). The tier below is for what we want from the source: design truth.
Read: READMEs of Live-Notifications-Demo, platform-samples and open-swiftui-animations.

| Source | Stars, last push | Licence | Tier | Fit and reason |
|---|---|---|---|---|
| Apple HIG data files (read in story #327) | n/a, current to Dec 2025 | Apple terms | A | The platform's own rules for iOS. True for "Apple says this"; Apple also sells the phones, so test what matters. |
| Google's Material 3, Live Updates, accessibility and haptics pages (read in story #328) | n/a | Google terms | A | The platform's own rules for Android; four gaps are listed in `docs/design/research-android-2026-10.md`. |
| android/platform-samples | 1.8k, 23 Oct 2026 | Apache-2.0 | A | Google's own sample code with a user-interface and an accessibility folder. Its README says the samples are "simplified" and "not intended to be used as production-ready code": use it to check an API call, not to copy a screen. I did not open the Live Updates sample yet. |
| material-components/material-components-android | 17.4k, 16 Oct 2026 | Apache-2.0 | A | The official component library, so the true size and look of each Material part. 805 open issues is normal at this size. |
| iVamsi/Live-Notifications-Demo | 10, 26 Oct 2026 | MIT | C | The same case as ours: a food delivery that goes Confirmed, Preparing, En Route, Delivered with `Notification.ProgressStyle`, segments and action buttons. One author, 10 stars, two days old, so it proves nothing by itself. Read it as a guide, then check every call against Google's page. Best open reference we found for the Android Living Slip. |
| amosgyamfi/open-swiftui-animations | 5.7k, 14 Aug 2026 | Unlicense | C | Many small SwiftUI animation snippets, including a Liquid Glass morph. The README says some are made with AI models, so check each one. Apple's motion rules (short, optional, at most 2 s on a Live Activity) win over any snippet. Ideas only. |
| Meliwat/awesome-ios-design-md | 621, 21 May 2026 | MIT | C | "200 production-grade DESIGN.md design systems" of well-known apps. I could not see how they were made or that the apps' makers wrote them, and it is five months old. Use as a prompt for ideas, never as proof of what an app does. |
| metasidd/ColorTokensKit-Swift | 226, 29 Sep 2026 | MIT | C | Colour tokens with WCAG contrast built in. Our brand colours are fixed (Ink), so at most a contrast checker. No dependency now. |
| Cheiineeey/ios-app-where-it-breaks | 103, 1 Oct 2026 | NOASSERTION | C | One person's field notes on where Dynamic Island, push and call features break on real devices. No proof shown, no licence. Read for hints, then test on a device before believing. |
| ranazaid/food-delivery-ios | 0, 13 Aug 2026 | MIT | C | A SwiftUI food app with animated order tracking. Zero stars and one author: nothing says it is good. One look only. |
| Swish app study (`docs/research/swish-deep-research-2026-10.md`) | n/a | ours | S | Our own measurements from the screen recording: the best source for what a rival does today. |

Decision: read the Tier A sources first (done in #327 and #328); use Live-Notifications-Demo as the one open reference for the Android Living Slip; use the animation repo for motion ideas only; adopt no dependency now. Nothing found beats Apple's and Google's own pages for rules, and nothing shows a finished iOS Live Activity for food delivery (the topic search found none); that one we design from Apple's page. Confidence that no better open reference exists: 0.6 (the search tool found nothing, and GitHub topic search only covers repos that carry the topic).

## 2026-10-27 · need: daily Supabase free-tier usage and health numbers with an 80% alert (story #488, epic E25)

Runs: `scout.py --need "monitor Supabase free tier usage limits database size egress storage and alert"` → no repos found. GitHub search "supabase usage monitor quota alert" and `topic:supabase topic:monitoring` → only the Supabase repo itself and unrelated apps. Tier A read instead: the Management API OpenAPI spec (`api.supabase.com/api/v1-json`) and the billing docs. Details: `docs/research/supabase-health-2026-10.md`.

Decision: nothing to adopt. Reuse SUB 94 and `db_mb` (migrations 0025/0039) and the pilot card (MAIN 92). Add one SQL function for the numbers that SQL can give; the Management API (health, API counts, egress proxy) is phase 2 and needs the owner's token.


## 2026-10-27 · need: one append-only log that answers "what happened to order X" across the app, the service worker and n8n (story #484, epic E25)

Runs: `scout.py --need "append-only event log table with trace of one order across client service worker and server"` → no repos found. GitHub search `topic:observability topic:supabase` → netdata, Langfuse, SigNoz, MLflow, cilium (Tier C, read the descriptions): each is a hosted platform or agent with its own server and store. We need one table in the Supabase we already run, and one read script.

Checked what we have: `order_events` is the customer-facing timeline (business events with a kitchen); `run_log` and `decision_log` are per workflow run and per decision, with no order id and no phone-side events. Reusing them would mix debug noise into the timeline the apps read.

Decision: build one table `order_trace` (migration 0044) and one RPC for the phone and the service worker, plus `scripts/order_trace.py`. Borrowed idea from SigNoz/OpenTelemetry: one trace id (here the order id) across actors. Nothing else adopted.

## 2026-10-27 · need: step by step customer journeys of Swish and Zepto Cafe beside GoServe (story #330, epic E26)

Runs: `scout.py --need "quick food delivery app customer journey teardown Swish Zepto Cafe order flow screens"` → no repos found. GitHub search "zepto cafe clone food delivery app teardown" → clones and tutorials only (Tier C, not read as evidence). Tier A read instead: Apple's iTunes lookup for Swish and a search for Zepto Cafe, and `justswish.in`.

Decision: nothing to adopt. Build the table from our own Swish study, the dispatch study, the store listing and the GoServe code; mark every step with no source as UNKNOWN and write how to close the gap (the owner's phone capture).

## 2026-10-27 · need: a scroll story for the bare app address, like justswish.in, with four doors (story #503, epic E26)

Runs: `scout.py --need "scroll story landing page for a food delivery startup with sections hero neighbourhood kitchens technology delivery"` → no repos found. Looked at what we own: `site/` (Astro 5, Tailwind 4, React islands, built for `letsdwelo.in`, which stays untouched by rule 18).

Decision: reuse the components and copy of `site/`; build no new site. Open question for the design step in the Ink artifact: the bare `/` of the app host is the single-page app, so the story is either a static route in the app build or a small page the host serves at `/`. Nothing is built before the design has the owner's yes.

## 2026-10-27 · need: a served pin code from the phone's GPS position for the pin screen (story #508, epic E26)

Runs: `scout.py --need "find nearest postal pin code from GPS coordinates offline lookup India"` → no repos found. GitHub search "india pincode latitude longitude dataset nearest" → no repo worth reading. Tier A read: the Nominatim usage policy (OSM Foundation, fetched 27 Oct 2026): at most 1 request per second, an identifying User-Agent or Referer, no reverse queries in a grid, apps must be switchable off, access can be withdrawn and the policy can change without notice, commercial apps take care. Tier A search: the data.gov.in "All India Pincode directory with latitude and longitude" has one point per post office; licence and availability are unclear (a note of 3 Oct 2026 says the portal was unreachable one day), so it is not used now.

Decision: the offline lookup. Nearest served pin from `pin_points` (migration 0034, public read, Delhi pins today): no new vendor, no key, no cost, works with a weak network, and it answers with a served pin, not a street address. A reverse-geocode API is rejected for the policy limits and because it returns an address we would still have to map to a pin. For new cities the pincode directory is the candidate source; check its licence first (follow-up).

## 2026-10-27 · need: deploy Supabase Edge Functions from CI (story #337, epic E27)
Runs: `scout.py --need "deploy supabase edge functions from github actions"` and a GitHub `topic:supabase` search. Tier A read: the Supabase CI/CD guide and the `supabase/setup-cli` action (vendor's own docs, Tier A for how to deploy). Decision: adopt `supabase/setup-cli@v1` and `supabase functions deploy --project-ref`; no new tool of our own. The workflow is `.github/workflows/backend.yml`: tests on a PR that touches `supabase/` or `api/`, deploy to the dev project on a push to `staging`.

## 2026-10-27 · need: check that every API answer matches a written contract (story #338, epic E27)
Runs: `scout.py --need "openapi response validation deno"` found no existing pattern. GitHub search found Schemathesis (property-based API tests). Decision: validate in process with `ajv` (2020 draft, strict) against `api/openapi.yaml` for now, so the test needs no network. Schemathesis comes later against the deployed dev project (follow-up F227).

## 2026-10-27 · need: menu, add-on groups, quote, serviceability, orders, order steps, run log and dispatch rule on the v2 backend (stories #343, #344, #345, #341, #342, #347, #349, #356, #350)
Runs: the radar skill was run on the need "pure money math and idempotent order placement on Supabase". Nothing fit better than our own code for these: they are small pure functions plus database functions that must match today's `place_order`, `change_status` and `dispatch_candidates` exactly. Decision: build them ourselves, reuse the existing database functions (`act_on_order` calls the old step functions; `dispatch_order_v2` calls `dispatch_candidates` and `assign_rider`), add no new vendor. Date: 27 Oct 2026.

## 2026-10-27 · need: retry a slow database call in n8n (stories #532 and #541)
Runs: no new repo needed. Tier A: n8n's own node settings (`retryOnFail`, `maxTries`, `waitBetweenTries`). Decision: set them in `build.js`, in one loop for all timer Supabase nodes (#541), with a test that walks them.

## 2026-10-27 · needs: phone OTP, online payments, order tracking, claim of earlier orders, push (stories #339, #348, #352, #558, #351)
Runs: the radar skill was run for each need. For push, `scout.py` found nothing that runs on Deno; the GitHub search showed only `gorush` and `django-push-notifications`, which are other stacks. Decision: write small functions of our own behind one seam file each (`otpGate.ts`, `payGateway.ts`, `pushNative.ts` and the matching backend files), so the owner's vendor (SMS provider, Razorpay, FCM and Apple) drops in later.

## 2026-10-29 · need: reverse geocoding, a browser coordinate to a street address and pin code, free, no key (story #668)
Runs: `scout.py --need` found no repo. GitHub topic search (`reverse-geocoding`, `geocoding` + `openstreetmap`, `nominatim`) gave komoot/photon (3154 stars), osm-search/Nominatim (4542), traccar/traccar-geocoder (257). Read: Photon's README (Tier A for itself): the public demo is for "reasonable" use and heavy use is throttled; Nominatim's public policy (Tier A, fetched): at most 1 request a second, a valid Referer or User-Agent that names the app, no bulk, no autocomplete, "set up a proxy and caching if at all possible", and the policy may change. Checked live (28 Oct): both send `access-control-allow-origin: *`; only Nominatim's answer carries `address.postcode` (our pin code); Photon's city-level answer did not. Decision: call Nominatim from the browser, once per customer, after they allow location (`app/src/lib/locate.ts`, a thin fetch, no library). Motive check: OSM Foundation runs it for the map, not to sell; the risk is the policy changing. Not built: a cache proxy (F278), needed before many customers. Confidence that this works for the test phase: 0.8.

## 2026-10-29 · need: put a whole backend (migrations, functions, secrets) on a Supabase project from one script (story #677)
Runs: `scout.py --need` found no repo; the GitHub topic search `supabase migrations` gave nothing that fits. Reused `scripts/release_db.py` (Management API call, name check, auth switch). The supabase CLI cannot be installed on this Mac (brew needs newer Command Line Tools), so the functions go through `POST /v1/projects/{ref}/functions/deploy` (multipart, read from the OpenAPI, tested on dev). Decision: a thin Python script on the API. Nothing new built beyond that.

## 2026-10-29 · need: canvas by stage: lay out design artboards from a manifest with background boards sized to content, no overlaps, state prefixes
Runs: `scout.py --need "lay out design artboards on an infinite canvas from a manifest..."`: no repos found. GitHub search "canvas layout artboards json positions auto-layout" and `topic:auto-layout topic:canvas`: Swift UI layout libraries (EasyPeasy, Cassowary, BonMot), none for the claude.ai Design canvas format (canvas.json boards, notes, order).. Result: Built from scratch: `canvas_stage.py` (stdlib), to live in ShipQuick `scripts/`. (listed by the reviewer).

## 2026-10-29 · need: a live rider map on the order tracker in the PWA (story #691)
Runs: `scout.py --need "live rider tracking map in a mobile PWA: small bundle map library, rider marker, dashed route, free tiles"`: no repos found. GitHub search `topic:leaflet topic:pwa live tracking`: only the Leaflet repo itself (BSD-2, v1.9.4 stable, 2.0 alpha). Read: Leaflet and MapLibre GL READMEs, the OSM tile policy, MapTiler pricing, Protomaps docs.
Sizes measured 29 Oct (jsDelivr files, gzip -9): Leaflet 1.9.4 js 42 KB + css 3.5 KB; MapLibre GL 5 js 275 KB + css 10 KB; protomaps-leaflet 5.1.0 37 KB + pmtiles 8 KB. The app shell today is 572 KB raw, 158 KB gzip. MapLibre alone would be 1.7 times the whole shell; Leaflet adds about a quarter.
Tiles (Tier A, each is a statement by the seller of that tile service; the numbers are theirs):
- OpenStreetMap public tiles: "access may be withdrawn at any point" for commercial services, "no SLA", attribution must be clear, bulk or offline use not allowed. Fine for the dev test, not for paying customers.
- MapTiler free: 100k requests a month, "suitable for testing ... or non-commercial use", logo shown. Not for commercial use. Cheapest paid: Flex, 30 USD a month (their page, 29 Oct).
- Protomaps/PMTiles: one static file read with HTTP range requests, so it can sit on our own storage with no per-view bill; the file size of one city and the exact attribution text are not on the overview page (to check in the Basemap Downloads and Cloud Storage pages).
Decision (confidence 0.7): Leaflet, loaded only when the tracker reaches On the way (a dynamic import, so the shell stays as it is). Tiles: OSM public tiles on dev only, with clear attribution; for prod, Protomaps PMTiles for the city on our own storage (to measure: file size and tile speed, off the laptop). Reason against MapLibre: 275 KB gzip for one marker and a dashed line. Reason against MapTiler: free plan forbids commercial use. Opposite view: MapLibre gives smooth vector maps and rotation; not needed to show one rider.
Open: the PMTiles extract size for Delhi and the cost on our storage (test E-MAP-TILES, run on Colab or Kaggle, not this Mac).

## 2026-10-29 · need: a scroll-story page at the bare app address with four doors to the four apps (story #503)
Runs: `scout.py --need "single-page scroll-story landing page with four app door links, plain HTML CSS no framework, light and dark"`: no repos found. GitHub `topic:landing-page topic:pwa scroll storytelling`: only design-skill collections, no page to adopt. Read: none fit. Reuse: the investor site's content in `site/src` (Astro; copy and improve the text, not the framework), the app's tokens (`design/tokens.json`) and the role pages that `vite.config.ts` already writes as static files.
Result: nothing to adopt. Build as one static HTML file with the app's tokens, no framework, no script except what the Day and Night switch needs; the bare `/` stops serving the role-picker App. Design first (owner's order): frames from the reviewer, the owner's yes, then red test "/ shows the story and four links".

## 2026-10-29 · need: the Play Store listing pictures (feature graphic 1024 by 500, four phone screenshots 1080 by 1920) and the closed-test runbook (story #254)
Runs: no new tool needed. Reused Playwright (already the app's test tool) for the screenshots and the graphic, the brand lockup and fonts from `app/public`, and Pillow (already on this Mac) only to shrink the PNGs under the repo's 500 KB file limit. The Play steps come from the Play Console Help page on testing requirements for new personal accounts (Tier A, Google, read 29 Oct 2026). Built from scratch: two small scripts in `ops/play/`.

### Radar run 2026-10-31 | need: passwordless phone OTP login without user enumeration | formula 2026-10-25.1

| Repo | Score | Verdict | Stars | Vel/day | Lic | Pushed | Issues 90d (active/closed) | Contrib | Downloads/mo | HN pts | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [supertokens/supertokens-core](https://github.com/supertokens/supertokens-core) | 64 | watch | 15339 | 6.2e | NOASSERTION | 3d | 75/60 | 38 | - | 232 |  |
| [teamhanko/hanko](https://github.com/teamhanko/hanko) | 53 | skip | 9053 | 5.4e | AGPL-3.0 | 2d | 25/12 | 53 | - | 2 | AGPL: fine to run, not to embed |
| [logto-io/logto](https://github.com/logto-io/logto) | 51 | skip | 14823 | 7.6e | MPL-2.0 | 1d | 127/84 | 100 | 38 | 121 |  |
| [authgear/authgear-server](https://github.com/authgear/authgear-server) | 45 | skip | 2135 | 0.9e | Apache-2.0 | 2d | 17/7 | 46 | - | 0 |  |

Vel/day: m = measured from our snapshots, e = estimate (average since creation, first visit).
Issues 90d: counted from the 300 most recently updated issues (pull requests excluded); busy repos are a sample.
Score parts: fit 20, velocity 15, maintenance 15, responsiveness 10, adoption 15, bus_factor 10, hygiene 10, mentions 5. Thresholds: smoke-test >= 70, watch >= 55.
Tier: GitHub API = A for counts; HN = C for talk; downloads = B. Confidence of the ranking: 0.6 until calibrated on 20 repos.
Fit is keyword overlap only. Read the top 3 READMEs before trusting fit.

## 2026-10-31 · need: a phone code sign-in that never says whether the number already has an account (story #807)
Runs: `scout.py --need "phone OTP sign in that never reveals whether a number is already registered..."` and again with the shorter `"passwordless phone OTP login without user enumeration"`: **no repos found** both times (the scorer's search finds nothing for this wording). GitHub topic searches then found the real candidates: `topic:passwordless topic:phone` → supertokens-core, logto, hanko, authgear; `topic:user-enumeration` → only offensive tools (o365enum, vortex, onedrive_user_enum), nothing to build with; `topic:otp topic:authentication` → authenticator apps, not servers. Those four were then scored by name (`--repos`, table above): supertokens-core 64 watch, hanko 53 skip (AGPL, fine to run, not to embed), logto 51 skip, authgear 45 skip. Nothing reaches the 70 that would earn a smoke test.
Decision: **adopt nothing, borrow one idea.** Two reasons, neither about the scores. First, rule 14: the owner named Supabase and Supabase Auth is what this app runs on; replacing the auth server is not what #807 asks for, it is a migration. Second, the story is one endpoint's answer shape, perhaps forty lines of Deno, against adopting a whole auth service.
The idea borrowed, from SuperTokens' passwordless recipe: their flow is two calls, `createCode` then `consumeCode`, and it is `consumeCode` that reports `createdNewUser`. The new-or-returning fact is only told **after** the caller has proved they hold the code. That is exactly the shape #807 needs, and it is the opposite of what our `/otp/send` does today. Tier A for "their API is shaped that way" (their own API reference), confidence 0.9. Whether their `createCode` is itself enumeration-safe is **not** documented: searched and not found, confidence 0.4, so it is not cited as proof of anything.
Read: the SuperTokens passwordless and bot-detection doc pages (their brute-force note is about bots, not enumeration); the four repos' GitHub metadata. Not read in depth: the three READMEs, because the adopt question was already closed by rule 14 before fit mattered.
Nothing new is built from scratch here beyond the change inside the function we already have (`supabase/functions/otp`).

### Radar run 2026-10-31 | need: visual regression testing: render app screens in CI, diff against committed baselines, show the pictures on the pull request | formula 2026-10-25.1

| Repo | Score | Verdict | Stars | Vel/day | Lic | Pushed | Issues 90d (active/closed) | Contrib | Downloads/mo | HN pts | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [reg-viz/reg-cli](https://github.com/reg-viz/reg-cli) | 61 | watch | 427 | 0.1e | MIT | 1d | 6/4 | 19 | 864769 | 0 |  |
| [argos-ci/argos](https://github.com/argos-ci/argos) | 44 | skip | 653 | 0.2e | MIT | 1d | 7/7 | 15 | 42 | 2 |  |
| [lost-pixel/lost-pixel](https://github.com/lost-pixel/lost-pixel) | 0 (raw 37) | ignore | 1676 | 0.9e | MIT | 192d | 0/0 | 23 | 133028 | 102 | archived; no push for 192 days |

Vel/day: m = measured from our snapshots, e = estimate (average since creation, first visit).
Issues 90d: counted from the 300 most recently updated issues (pull requests excluded); busy repos are a sample.
Score parts: fit 20, velocity 15, maintenance 15, responsiveness 10, adoption 15, bus_factor 10, hygiene 10, mentions 5. Thresholds: smoke-test >= 70, watch >= 55.
Tier: GitHub API = A for counts; HN = C for talk; downloads = B. Confidence of the ranking: 0.6 until calibrated on 20 repos.
Fit is keyword overlap only. Read the top 3 READMEs before trusting fit.

## 2026-10-31 · need: nothing in this repo looks at a screen; render each board's screen and put the picture where a reviewer sees it (follow-up F306, ShipQuick feedback #146)
Runs: `scout.py --need "visual regression testing: render app screens in CI, diff against committed baseline images, attach the pictures to the pull request"`: **no repos found**. GitHub `topic:visual-regression-testing` and `topic:visual-testing topic:playwright` found the field: lost-pixel, argos, reg-cli, Visual-Regression-Tracker, loki, storycap, cypress-image-snapshot, differencify. The three that fit a Playwright project were scored (table above): reg-cli 61 watch, argos 44 skip, lost-pixel **0, ignore: archived, no push for 192 days** though it has 1676 stars and 133k downloads a month, which is the clearest case yet for judging behaviour over stars.
Decision: **adopt nothing, use what is installed.** Playwright is already this project's e2e runner (`app/package.json`, `@playwright/test ^1.64.0`) and ships `expect(page).toHaveScreenshot()`: baseline PNGs committed beside the spec, a diff image written on failure, a threshold per assertion. Ponytail rung 5, an already-installed dependency covers the need, so reg-cli's extra report UI and argos's hosted service both lose to zero new dependencies.
The one real risk with a committed baseline is font rendering, and this project is already safe from it: the fonts are **self-hosted** (`app/public/fonts/*.woff2`, `app/src/styles/fonts.css`), not fetched from Google at run time, so a CI render does not depend on a network font arriving in time. The remaining drift is the browser version, which `@playwright/test` pins.
What is still to build, and it is small: a screens list, one spec that walks it, and a CI step that uploads the PNGs as an artefact so a reviewer sees the screen without building the branch. That last part is the half that actually fixes F306; the baseline diff is the half that keeps it fixed.
Not read in depth: the three READMEs, because the adopt question was closed by "it is already installed", not by fit.
