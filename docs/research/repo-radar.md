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
