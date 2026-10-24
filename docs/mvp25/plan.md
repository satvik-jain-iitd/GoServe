# GoServe: MVP 2.5 pilot hardening (written 24 Oct 2026, reviewer session, v4)

MVP 2 (the whole system) is on prod: 13 layers (#162 to #174), release #175, docs #176, VAPID #177 and #178.
Archived plans: MVP 1 at `reviewer-bundle/docs/mvp1/plan.md`, MVP 2 at `reviewer-bundle/docs/mvp2/plan.md`.
This file is the single plan for what the owner asked on 24 Oct after his first prod walk:

1. Two bugs on prod: a kitchen saved with no pin code; an order for a dish of that kitchen did not show in
   the kitchen app signed in with his kitchen account.
2. Synthetic kitchens and riders on prod, for the scale proof, with changing availability; one API to
   create them with randomisation parameters, one API to reset to the initial state. No orders (cost).
3. UI at the level of Zomato, Blinkit, Swiggy: the anti-slop skills, a blind test, then a prioritised rollout.
4. Every validation rule end to end (address, phone, pins, hours, prices).
5. Which APIs and integrations are still needed, and a free maps API (owner: "pick the best free one").

Owner's answers (AskUserQuestion, 24 Oct): simulator is for the prod scale proof; two APIs (seed with
parameters, reset); UI by the 4-skill blind test then rollout; maps: the best free one, reviewer's pick.

## Root causes (VERIFIED on `dev` f8da571; prod rows INFERRED)

**Bug 1, kitchen with no pin code.** `app/src/screens/AdminScreen.tsx:40-44` checks only the name and badly
formed pins; `parsePins` returns `{pins: [], bad: []}` for an empty box; `addKitchen` inserts `pin_codes: []`;
`0013_city_model.sql:7` has `pin_codes text[] not null default '{}'` and no CHECK. Nothing requires one pin.
Phone, address and hours have no rule either.

**Bug 2, the order did not reach the kitchen app.** Two holes:
- The customer app can never show a kitchen with no pins (`area.ts:12`), so the order was placed from the
  **demo console at `/`** (or another role app): `App.tsx:217` loads `fetchMenuRows()` with no kitchen for
  every app that is not `/customer/`, `menu_read` lets anyone read every dish, and `place()` at
  `App.tsx:398-414` never checks `lock`. `/` is published on prod (`deploy-app.yml:52` deploys all of
  `dist`, no `_redirects`). The order went to Tau ka Dhaba correctly (`place_order` takes the dish's
  kitchen, `0019:52`), with no name, phone or pin (no `customers` row for the demo session).
- The kitchen app shows a kitchen's orders only for a user with a `kitchen_staff` row for **that** kitchen:
  `session.ts:57` `select("kitchen_id").limit(1)` with no order; a user with rows for two kitchens gets
  either one; a user with no row silently falls back to the session scope and sees nothing. The owner's
  kitchen account is staff of the old demo kitchen, not of Tau ka Dhaba (INFERRED; the coder reads
  `kitchen_staff` on prod to confirm).

## Epics (milestone "MVP 2.5 Pilot hardening", due 27 Oct), in priority order

| Epic | Name | Stories | Why this rank |
|---|---|---|---|
| E15 | Pilot blockers and validation rules | H1 pin and kitchen rules, H2 demo console off prod, H3 one kitchen per staff and a loud "not staff", H4 validation rules end to end | a pilot kitchen cannot miss an order |
| E16 | Synthetic city on prod | H5 seed and reset API, H6 dynamic availability, H7 admin Simulator tab | the owner's scale proof, today |
| E17 | Maps | H8 Ola Maps geocode and distance | real ETA, nearest kitchen, address check |
| E18 | UI pass 2 | J1 design system on Claude Design, J2 every journey designed on Claude Design (the Steve Jobs bar), H9 four-skill blind test, H10 rollout customer, H11 rollout rider and kitchen, H12 rollout admin | investor-grade look |
| E19 | Integrations map | H13 research doc and decisions | what else we need, with costs |

Order of PRs (one session, one PR at a time, rule 19), owner 24 Oct "simulator UI ke baad me": H1, H2, H3 (merged), J3 website (#201 open), E20 (H14 to H17), H9 blind test (kept by the owner, 24 Oct, reshaped: three screen types, Day and Night, per skill; see E18), H10, H11, H12, then H5, H6, H7, H4, H8, H13. Migration numbers: 0023 is taken by H3 (one kitchen per staff), so the synthetic flags become 0024.
J1 and J2 are not PRs: the reviewer session builds them on Claude Design (the Artifact tool) while the coder
ships H2 to H8, so the designs are ready before H9. The code in H10 to H12 is built to the J2 artboards.
MVP 2 closure waits for H1 to H3 on prod (the kitchen live row failed because of bug 2).

## E15 Pilot blockers and validation rules

- **H1 Kitchen rules.** Migration 0022: `check (cardinality(pin_codes) >= 1 or not active)`,
  `check (phone is null or phone ~ '^[6-9][0-9]{9}$')`, `check (opens_at is null or closes_at is null or
  opens_at <> closes_at)`, `name` unique per city (unique index on `lower(name)`); `menu_items`: price
  `> 0` (today `>= 0`), unique `(kitchen_id, lower(name))`. Admin form: at least one pin, phone 10 digits
  starting 6 to 9, opens before closes, all before any call; `adminMessage` maps the new codes. Existing
  prod rows that break a rule (Tau ka Dhaba) are fixed by the owner in the admin app before the migration
  (the migration refuses otherwise; the coder reads prod first).
- **H2 Demo console off prod.** `app/public/_redirects`: `/  /customer/  302` (Cloudflare Pages honours it;
  Vercel dev keeps `/` for tests through `vercel.json` rewrites untouched, Playwright preview ignores it).
  Also `App.tsx:217`: the kitchen, rider, ops and admin apps load no menu at all (nothing to sell there).
  `place()` refuses when `lock` is not `customer` outside the demo console. One e2e: `/kitchen/` fetches
  no `menu_items`.
- **H3 One kitchen per staff.** Migration 0022 (same file): unique index `kitchen_staff(user_id)`; `myKitchen`
  loses `.limit(1)` ambiguity; the kitchen app with no staff row shows "This account is not kitchen staff.
  Ask the admin." (like `RiderGate`), never the empty session view; `admin_add_person` refuses a second
  kitchen for the same user with `already_staff`. Check rows in `check_city_model.py`.
- **H4 Validation rules end to end** (one table in `docs/product/validation-rules.md`, the DB is the truth,
  the app mirrors it, one test per rule):

| Field | Rule | Where |
|---|---|---|
| Customer pin | 6 digits; a kitchen must serve it (exists already) | app + area lookup |
| Customer name | 2 to 80 characters, letters and spaces | app + `customers` check |
| Customer phone | 10 digits, first digit 6 to 9 | app + check |
| Address | 10 to 300 characters; after H8: geocodes inside the kitchen's radius (6 km, a param), else "We cannot find this address" | app + `place_order` |
| Order | qty 1 to 20, dish available, kitchen open, 20 per day per session (exist) | DB |
| Admin kitchen | name 2 to 60 unique, address 5 to 200, phone rule, 1 to 20 pins, hours order | app + check |
| Dish | name 2 to 60 unique per kitchen, price ₹1 to ₹5,000, category 0 to 30, photo image ≤ 3 MB and resized to 1024 px in the browser before upload (fixes the 3 MB follow-up) | app + check |
| Staff | email format; Google user must exist; one kitchen per user | app + `admin_add_person` |
| Rider | location inside the city box (Delhi: lat 28.3 to 28.9, lng 76.8 to 77.5, params) else ignored | `riders` check |
| Cancel reason | 3 to 200 characters | app + `cancel_order` |

## E16 Synthetic city on prod (the owner's scale proof)

Design, lazy and safe on prod:
- Every synthetic row is marked: `kitchens.synthetic`, `riders.synthetic`, `menu_items.synthetic` (0023,
  boolean default false). Synthetic kitchens use pin codes `900001` to `900099` (no real Indian pin starts
  with 9), realistic Delhi names and addresses (a fixed list of 40 names, 60 dishes with Wikimedia photos),
  phone `9000000xxx`. Riders get fake `user_id`s (no Google user; dispatch does not need one), names from a
  list, start points near their kitchen. Customers are never synthetic (the owner makes them). No orders.
- **H5 Seed and reset API.** `GS MAIN 30 Simulator` (n8n, prod and dev): `POST /webhook/gs-sim` with the
  admin token (a new `SIM_TOKEN` in the vault and n8n Config, never in the app bundle) and a body
  `{action: "seed", kitchens: 10, riders: 20, dishes_per_kitchen: 6, seed: 42, open_pct: 80, online_pct: 70}`
  or `{action: "reset"}`. Seed is deterministic for a given `seed` (same names, same places), so a test can
  be repeated. Reset deletes every row with `synthetic = true` and the orders on them (there should be none)
  in one transaction through `sim_reset()` (service role). Both answer counts. Kill switch honoured.
- **H6 Dynamic availability.** `GS MAIN 31 Simulator tick` (schedule, every minute, only while
  `params.sim_enabled = true`): flips riders online or offline toward `online_pct` with a random walk, moves
  each online rider 50 to 300 m (random bearing, clamped to the city box), opens or closes kitchens toward
  `open_pct`, marks 0 to 2 dishes sold out and back. Parameters live in `params` (`sim_*`, versioned per
  rule 17 of the global manual), changeable from the admin tab. Everything is `synthetic = true` only.
- **H7 Admin Simulator tab** (admin only): the parameters, Seed, Reset, Tick on and off, counts (synthetic
  kitchens, riders online, kitchens open), last tick time. Calls the webhook through n8n, never the DB.
- Scale proof on prod, no orders: `scripts/city_report.py prod --read-only` prints kitchens, riders online,
  dispatch candidates for a sample kitchen (through `dispatch_candidates`, read only). The 100-order proof
  stays on dev (`city_check.py`); on prod the owner places real orders by hand when he wants.
- Guard: a customer app never shows a synthetic kitchen unless its pin (9000xx) is typed on purpose; the
  area lookup also hides `synthetic` kitchens when `params.sim_visible = false` (default true for the proof).

## E17 Maps: Ola Maps (reviewer's pick, Tier A: maps.olakrutrim.com/pricing, 24 Oct 2026)

- Free tier: 100,000 calls per API per month, no KYC, no card while inside the allowance (new pricing from
  1 Sep 2026). After that geocoding ₹0.099 per request, distance matrix ₹0.199 per pair. Indian addresses
  and pin codes, which Nominatim (OSM) handles badly; Nominatim also forbids autocomplete and heavy use
  (1 request per second, "commercial applications should keep that in mind"). Mappls publishes no pricing
  page we could read (sign-up wall); its terms end a free plan after 3 idle months. Google: 10K free per
  SKU, needs a card. Decision: Ola Maps; OSRM self-hosted on the Oracle box later for routing if volume
  grows (F39).
- **H8**: owner makes the Ola Maps account and an API key (`OLA_MAPS_API_KEY` in the vault and an n8n
  credential; the key never ships in the app). `GS SUB 23 Geocode` (address + pin → lat, lng, confidence;
  cached in `geocode_cache(address_hash, lat, lng, created_at)` so a repeated address costs nothing);
  `place_order` path: MAIN 01 geocodes before SUB 11, refuses `address_not_found` or `out_of_range`
  (distance to the kitchen over `params.max_km`, default 6), stores `orders.lat, lng`. Dispatch distance
  switches from kitchen-to-rider to rider-to-kitchen plus kitchen-to-customer (distance matrix, one call
  per dispatch). ETA uses the real km (`etaMinutes(km)` already takes it). Nearest kitchen for a pin with
  two kitchens uses the customer's point (F118 closes). Autocomplete on the address field: later (H4 range
  check first); one e2e with the API mocked, one live row on dev with a real Delhi address.

## E18 UI pass 2 (Claude Design first, then the anti-slop skills, blind test, rollout)

Owner, 24 Oct: "All user journeys and flows should be built like Steve Jobs built it", added to MVP 2.5.
Claude Design can be driven from this session: the Artifact tool lists the types "Design System"
(`https://claude.ai/artifact/5M7UeXXcx16TP3vzVFNDzd`) and "Design" (`https://claude.ai/artifact/QKN21svewxgyPb6SYRqWnd`);
no GoServe design system exists there yet (checked 24 Oct). Nothing of this needs a PR; it is design work the
code then follows.

**The Steve Jobs bar** (the review bar for J2, H9 and H10 to H12, written once here):
1. One job per screen. The next action is the biggest thing on the screen, and there is only one.
2. Zero explanation. A first-time customer, cook or rider never needs a tooltip, a help page or a demo.
3. Remove until it breaks. Every control, line and colour must earn its place; a settings screen is a defeat.
4. The product is the whole journey: from the home-screen icon to the delivered meal, with every wait, error
   and empty state designed, not left to chance.
5. Say no to the feature. Nothing goes on a screen because it is possible; it goes because the journey needs it.
6. Taste: the GoServe palette only, Roboto, real photos of real dishes, motion that explains (a status change,
   an item added), never motion that decorates.

- **J1 Design system on Claude Design** (reviewer, this session): `https://claude.ai/artifact/GfQw6ksEWwcnanEAEumZRg`.
  v1 (24 Oct) was the repo as is (cream, greens, Roboto, pills, M3 roles). The research brief
  (`reviewer-bundle/docs/research/design-trends-2026-10.md`) gave three directions; the owner picked B "Delhi Ink"
  blind; v2 built it whole (paper, ink, chili, 4 px, hard offsets, DM Sans). The owner then asked for a balance
  with the original tokens and principles, and answered three knobs (AskUserQuestion, 24 Oct). **v3 "GoServe Ink"
  is the design language from here**, generated by `reviewer-bundle/design-system/gen.py` from one token table:

  | Knob | Decision (owner, 24 Oct) | From |
  |---|---|---|
  | Page | `gs-cream` #e4e6d9 by Day; Night is the dark green carbon copy #101a13, panel #172319, raised #1f2d22 (direction C's LCH steps), cream text | original + C |
  | Ink | `gs-ink-green` #263528 for every word and rule by Day; cream by Night. Muted `gs-text-muted` #46524a | original |
  | Action | `gs-deep-green` #45654e by Day, `gs-lime` #c8d888 by Night (`md-primary` is theme-dependent). Chili dropped. Logo stays, no redraw | original |
  | Status | the original seven: placed gray, accepted olive, cooking warm yellow, ready lime, on the way earth, delivered deep green, failed error; each as a **stamp** word | original + Ink |
  | Type | Bricolage Grotesque 600/800 display (uppercase, tight), **Anek Latin + Anek Devanagari** body and UI (one family for every Indian script as cities grow), DM Mono for every number, time, pin, order id and slip line. Roboto retired | Ink + research |
  | Shape | 6 px corners (`gs-radius-s`), slips and stamps 0 px, the primary button a pill (the one shape people remember), chips 6 px | original + Ink |
  | Depth | 1 px `gs-sage` hairlines between rows and on inputs; no blur anywhere except one `gs-shadow-m` under the sticky cart bar; no hard offsets | research rule 3 |
  | Structure | the bill slip is the hero (cart, tracker, kitchen ticket are one slip with a torn top), stamps for status, ledger rules not cards, mono columns, the stamp lands in 90 ms, button press 120 ms, sheet 200 ms | Ink |
  | Themes | Day and Night for every role, switched by the clock (19:00 to 06:00), phone setting a hint, one toggle in Account | owner |
  | City | nothing city-specific in tokens or look; the city shows only in words | owner |

  The system keeps the twelve components (the ten from the app plus Slip and Stamp) with the same class names as
  `app/src/ui/ui.css`, so H10 is a token and CSS swap. The repo lags the system until H10 ports v3 into
  `design/tokens.json` and `ui.css`; `design/README.md` then points at the artifact. Files live in
  `reviewer-bundle/design-system/` (v1 and v2 kept under `v1/`, `v2/`).
- **J2 Every journey on Claude Design** (reviewer, this session, one Design artifact per role, phone
  artboards 390 by 844, built to v3; the customer canvas is `https://claude.ai/artifact/6faaULE7F6FDCSQw8YvPuW`,
  one shared `ink.css` so a token change re-skins every artboard; each artboard has a Day/Night tweak): customer (home-screen icon, sign in, area, menu, dish, cart, bill, placed, tracker,
  delivered, orders, account, every empty and error state), kitchen (not-staff gate, ticket list, one ticket,
  open or closed, sold out), rider (gate, offline, online, one job, on the way, delivered), admin (people,
  kitchens, menu, orders, numbers, simulator). Each artboard carries the step number in its journey. The
  owner walks every journey on his iPhone and says yes or no per screen; a "no" is a new artboard, never a
  code change. Decisions go to `docs/product/journeys.md` (one row per screen: journey, step, what it does,
  the one action, link to the artboard). J2 starts with the customer journey; the other three follow in the
  order rider, kitchen, admin.

**Proportion pass on the customer canvas (owner, 24 Oct: "the proportions have gone missing, the app looks
misorganized; on screen 02 filters are hidden, a half chip, a vertical scroll inside the filter row").**
Reviewer's critique of the nine published screens (from the rendered screenshots in `scratchpad/check/`):

| What is wrong | Where | Why it reads as disorder |
|---|---|---|
| Headers differ screen to screen: top padding 48 or 52, title 30 or 24, hairline on some, none on others, chevron on some | all | the eye expects one header; four variants feel like four apps |
| "Bar soup" on the menu: live strip 44, search 44, chip row 44, section head, all stacked with 8 px gaps, then four bands at the bottom (tile, cart bar, tab bar) | 02 | five horizontal bands of near-equal height before the first dish; nothing is the main thing |
| Chip row scrolls sideways with a half chip, and `overflow-x: auto` gives it a vertical scrollbar too (sub-pixel overflow) | 02 | the owner reads the half chip as a bug and the scrollbar as broken |
| Gaps are 4, 6, 8, 10, 12, 14, 18 px, chosen per screen | all | no rhythm; the 8 pt grid in the tokens is not used |
| Bottom chrome on the menu is 148 px (cart bar 56 + 12 + tabs 56 + 24): 17% of the screen | 02 | heavy; iOS tab bars are 49 pt |
| "This phone" is two 56 px ghost buttons, the largest thing on You, for the least used actions | 09 | size says importance; these are not important |
| Orders rows: stamp rotated inside a list row fights the row's baseline | 08 | a stamp belongs on a slip, not in a list cell |
| Empty space under the Orders list and under the You sections | 08, 09 | the screen is not composed to its height |

Fixes, one stylesheet rule where possible (ink.css + the design system), then each artboard:
1. **One header spec.** `52px 20px 12px`, title `display-l` 24, hairline below on every screen, 44 px chevron only on
   pushed screens, one mono meta slot on the right. The kitchen name on 02 stays the title at 24, the meta line under it.
2. **Chips wrap, never scroll.** `flex-wrap: wrap`, no `overflow`, every chip visible (two rows for eight). A kitchen
   with more than ten categories is an admin rule (H4), not a scroll. The vertical scrollbar goes with it.
3. **8 pt rhythm.** Gaps and paddings only 8, 16, 24 (4 inside a tile body). Section heads 16 px, 8 above, 4 below.
4. **Lighter live strip.** 40 px, no box: a yellow tag, the mono line, a chevron, a hairline under it, attached to
   the header. Information, not a card.
5. **Lighter bottom chrome.** Tab bar 52 px + 16 px safe area (device inset via `env()`), cart bar 56 px with 8 px
   above the tabs: 132 px, and the cart bar is the only filled thing down there.
6. **You screen.** "This phone" and "Edit details" become list rows with a chevron (52 px, hairline), not buttons;
   the slip holds only the four details; the order-alerts switch row stays.
7. **Orders rows.** The status is a small filled tag (like the live strip), not a rotated stamp; stamps stay on slips.
8. **Compose to the height.** Lists and sections sit from the top; nothing stretches to fill; the empty space is
   the page, which is fine on a list but the You screen gets its sections in one column with 24 px between.
Verification: `tools/artboard-fit.mjs` Day and Night clean on all nine; screenshots viewed; headers measured equal
across screens (same top offset, same title size); chip row has no scroll in any direction.

**Screen 02 header v4 and the state screens (owner, 24 Oct, late).** Owner read "110024 · 25–35 MIN" as an order
id, asked why the chevron opens screen 01, asked for a filter icon instead of "Categories ›", and wants the brand on
02 through the pin mark, with motion: the pin from the lockup on 01 moves up into the header on 02. His answers
(AskUserQuestion): pin mark + "110024 · 25–35 min"; the line stays tappable (change pin), the chevron goes; a funnel
icon alone, 44 px. Build, in this order, then publish canvas + design system, fit check Day and Night, bundle sync:
1. `Menu.dc.html`, `S-Loading`, `S-Closed`, `Categories` header: left = `<a href="Main">` with the mark
   (`/_blob/508d3236926471279484fe3fb63e07b9`, 22 px tall, night = the `.ui-logo` filter) + mono "110024 · 25–35 min",
   no chevron; right = `<a href="Categories" aria-label="Filter">` 44 px round ghost with a funnel SVG. Sheet title
   "Filter" (Veg only switch + the jump list stays).
2. Motion on 02 (inside the artboard, CSS only, so the owner sees it): on load the mark starts where it sits in the
   01 lockup (centre, big) and lands in the header in 500 ms (`transform` + `opacity`, ease-out, `prefers-reduced-motion`
   off). In the app this is a shared-element transition (View Transitions API, `view-transition-name: mark`); add
   point 14 to `docs/native-later.md` (Capacitor/TWA keep it; iOS Safari 18+ supports it).
3. AppBar README in the design system: the home header spec = mark + pin + minutes on the left, one icon action on
   the right, no logo, no title; the "Before a screen ships" home rule updated; `.ui-btn.icon` (44 px round ghost).
4. The five state screens already on disk (`S-NoKitchen`, `S-Loading`, `S-Closed`, `S-EmptyBill`, `S-EmptyOrders`,
   canvas row y 1264, fit check clean Day and Night, generated by `scratchpad/cj/gen/states.py`) go out in the same
   publish; the home-header change is applied to them first.
Verification: fit check clean on Menu, Categories, S-Loading, S-Closed, Orders, Account (Day and Night); the
screenshot of 02 after the animation shows the mark at 22 px in the header, no chevron, the funnel at 44 px;
the owner walks 02, 02a and the five states and says yes per screen.

**Screen 02 warmth pass (owner, 24 Oct, brainstorm: "my application looks kind of boring in the top").** He listed
the Zomato and Swiggy top chrome (location changer, District, wallet, profile, search with a rotating placeholder,
voice, veg-only, ad and subscription banner carousel, section tabs, quick filters). Reviewer's read: that chrome is a
marketplace's cross-sell (Tier A on motive: their own products), built for thousands of restaurants; GoServe has one
kitchen per pin and about eleven dishes, so search, voice and banners would be theatre. What makes 02 look flat is
placeholder colour blocks instead of food and no face for "tonight". Owner's answers (AskUserQuestion): add real
dish photos, a Tonight hero tile, a Veg only switch in the header, a greeting line; skip the marketplace chrome
(ideas row, open: search when a pin has 3+ kitchens, a banner when there is a subscription to sell).
Build on the customer canvas, then the design system, in this order:
1. **Photos.** Five dish photos from Wikimedia Commons (CC BY or CC BY-SA, licence and author recorded in
   `reviewer-bundle/design-journeys/customer/PHOTOS.md`): dal makhani, paneer butter masala, chicken curry, tandoori
   roti, jeera rice. Resize to 152 px square for tiles (2x of 76) and 700 by 400 for the hero, under 60 KB each,
   uploaded as canvas assets (`/_blob/<id>`), copied into `scratchpad/check/assets/` for the fit checker. The app
   uses the kitchen's own photos (admin upload, H4 resize rule).
2. **Header v5** (`.ui-head` on 02, 02b, 02c via `states.py` `homehead()`): left = mark + `110024` only (the minutes
   move to the greeting); right = Veg only toggle (`.ui-btn.ghost.icon` with the veg mark, `aria-pressed`, filled
   `gs-sage` when on) then the funnel. Three 44 px targets, 12 px gaps.
3. **Greeting** as the first block of the scroll area: `display-l` 24 "Good evening, Rahul." (name from the
   `customers` row on this phone; first visit: "Good evening." alone) and a mono line "Dinner at your door in 25 to
   35 min". The word follows the clock (morning till 12, afternoon till 16, evening till 21, night after), the same
   clock that switches Day and Night.
4. **Tonight hero** under the greeting: one full-width 350 by 200 photo, 6 px corners, a small `ui-tag` "Tonight"
   on the photo, under it the name with the veg mark, the one-line meta, the price in mono, and a pill Add on the
   right. One per kitchen per day; the admin picks it (follow-up row: `menu_items.featured` or a kitchen setting,
   H4 or H10). Then the sections as today, now with photos.
5. Design system v17: AppBar README (header v5), a new `Hero` component (preview + README), `Tile` README notes the
   photo rule (real food, 76 px, 6 px corners, no text on the photo), README home-screen rule updated.
6. Fit check Day and Night on 02, 02a, 02b, 02c; screenshots viewed; canvas and design system published; bundle
   synced; rows in discussions, trace, journeys (02 v5), ideas (marketplace chrome, open), follow-ups (featured dish).
Verification: the fit checker prints clean for the four boards in both themes; the 02 screenshot shows header
(mark + pin, veg toggle, funnel), greeting, hero with a real photo, then Mains with photos; the owner walks 02 on
the phone and says yes or a one-line no.

**Hero = the thali (owner, 24 Oct: "combo of the day ... the real photo of the combo that will arrive at your home ...
instead of Dal Makhani").** Reviewer's verdict: better than the single-dish hero. Dinner is eaten as a plate (4 roti,
dal, sabzi); one tap instead of composing a bill; it matches the GoServe-run-kitchen model (one combo = the prep plan,
batch cooking, faster delivery, higher order value); the photo of the plate that arrives is the most honest content.
Owner's answers: not "tonight" only, the hero works by day too; the admin or kitchen picks the combo for the pilot
("most ordered in the region" only when a pin has enough orders, and the words "most ordered" never on screen before
that). Then (owner, same evening): the non-veg thali must NOT be a list tile ("the list is category items"); both thalis
live in the hero and the user switches at will. Brainstormed A pager with dots, B segmented control on the photo,
C split card; owner picked **A + B**: the hero is a two-page pager (swipe, CSS `scroll-snap`, no dots) with a
segmented control "Veg | Non-veg" on the photo (the green and red marks as icons, the active half filled) that shows
the state and switches on tap (anchor links to the pages in the mockup, a scrollTo in the app, 200 ms). Default veg;
the choice is remembered on this phone; with the header Veg only toggle on, the hero locks to veg and the non-veg
half dims. Design terms taught: segmented control, pager, crossfade.
Build:
1. Hero copy: tag "Today", name "Today's thali", the parts in the meta line ("4 tandoori roti · dal makhani · aloo
   gobi · salad · serves 1"), price `₹180` mono with a muted "parts ₹220" beside it (only when computed from the real
   prices), a quantity stepper instead of Add once one is on the bill. Photo: a real thali from Wikimedia Commons
   (CC, credit in `PHOTOS.md`), 700 by 400, uploaded as an asset; in the app the kitchen's own photo of its thali.
2. Clock words: the greeting line and the hero both follow the clock ("Lunch at your door" till 16:00, "Dinner at your
   door" after); the kitchen can set a lunch combo and a dinner combo (two slots), the clock picks the slot. Screen
   01's tagline changes from "Dinner from our kitchen" to "Hot meals from our kitchen · cash at the door" (daytime too).
3. Menu structure: the thali hero (veg page and non-veg page, each with its own photo, parts line, price pair and
   Add or stepper), then the à la carte sections as extras (Mains, Breads, Rice), unchanged. No thali tiles in the
   list. 02b and 02c follow through `states.py`. Two Commons photos: a veg thali and a non-veg thali (700 by 400).
4. Design system: Hero README rewritten for the thali (one plate, parts in the meta, the saving only if real), the
   home-screen rule in README ("the hero is the thali of the day; dishes are extras").
5. Screen 03 Dish (owner: "when I opened chicken curry I did not see images properly"): the sheet's photo area is
   still a colour block; it gets the real chicken photo (a 700 by 400 crop of the same Commons file, uploaded as an
   asset), full width, 6 px corners, no text on it; the menu behind the sheet shows the same photo tiles as 02.
   Fit check 03 Day and Night.
6. Rows: follow-ups (data model: `menu_items.kind` dish or combo, `combo_items(combo_id, item_id, qty)`,
   `kitchens` combo slot per meal picked by the admin; ranking by orders per pin later with a threshold param;
   an ADR by the coder when H10 builds it), ideas (ID for the thali hero), discussions, trace, journeys (02 v6).
Verification: fit check Day and Night clean on 02, 02b, 02c, 01; the 02 screenshot shows the thali hero with the parts
line and the price pair; the owner walks 02 and says yes or a one-line no.

- Candidates (GitHub API, 24 Oct): `pbakaus/impeccable` 85k stars, pushed 23 Oct, Apache-2.0;
  `Leonxlnx/taste-skill` 101k, 20 Oct, MIT; `nextlevelbuilder/ui-ux-pro-max-skill` 139k, 23 Oct, MIT;
  `Nutlope/hallmark` 31k, 22 Oct, MIT; `anthropics/skills` frontend-design. Stars are Tier C for quality;
  the blind test decides (`docs/research/design-skills-2026-10.md`, F94).
- **H9 Blind test** (owner, 24 Oct, kept and reshaped: "create a few screens, not all, for showcasing different
  design directions possible, using 3 different types of screens for each, covering both light and dark modes").
  The coder installs the four skills in his session (`npx skills add <repo>` or the plugin command each repo gives),
  then builds **three screen types, each in Day and Night** (six screens per skill): customer **02 Home** (header,
  greeting, thali hero, list with photos), customer **07 Tracker** (the slip, the stamp, the timeline), kitchen
  **K3 New tickets** (a staff list with one action per row). Fixed for every skill: the Ink v3 tokens (colours, type,
  radii), the copy, the test ids and the approved journey (what each screen does, its one action). Free for the skill:
  layout, hierarchy, spacing, motion, the look of every component, so the owner sees real directions, not re-skins.
  Each skill on its own branch `ui-test/<skill>` from dev, deployed as a Vercel preview (no PR to dev; previews only),
  with a `/ui-test/` index page that links the six screens (Day and Night each) and carries no skill name. The
  reviewer sends the owner the four preview links labelled A to D (the mapping stays with the reviewer until the
  pick). The owner opens them on his iPhone and picks one direction, or one per screen type. The reviewer records the
  checklist (hierarchy, spacing, photos, tap targets, contrast, loading states, Night legibility) per condition in
  `docs/research/experiments.md` row E6 and the pick in `docs/product/journeys.md`. The winner's skill becomes the
  house skill in `CLAUDE.md` (rule 14 honours the owner's choice); H10 to H12 are built with it to the approved
  artboards, re-drawn in the winning direction where the owner said so. H9 runs after E20 and before H10.
- **H10 to H12 Rollout** with the winner, one PR each, built to the J2 artboards the owner approved:
  customer (area, menu, cart, bill, tracker, orders, account), rider and kitchen (one-thumb), admin (tables
  and forms). Same test ids, e2e unchanged, the Steve Jobs bar above plus the benchmark table from the MVP 2
  plan is the review bar, plus: splash and app icon, bottom navigation on
  the customer app (Menu, Orders, Account), micro-motion on add-to-cart and status change, dark mode from
  tokens, a real empty-cart illustration (SVG in `design/brand/`).

**Staff apps get tabs (owner, 24 Oct: "new orders and in-progress orders in 2 different sections like the customer
app; rider app 2 to 3 tabs; lists operated by tapping the other icon").** Answers (AskUserQuestion): kitchen =
**New · Cooking · Kitchen**; rider = **Job · Today · Me**. The TabBar rule in the design system changes: a staff app
gets the same 3-tab bar when it has more than one list; the current job itself stays one screen, one action.
Build (generators `design-journeys/gen/kitchen.py`, `rider.py`; the `tabs()` helper from `states.py` generalised to
take the three tab definitions; the same `.ui-tabs`; a count badge on a tab = `.ui-tab .badge`, 18 px, `md-primary`):
- Kitchen: K3 becomes **New** (only placed tickets, each row = the slip lines + one Accept; a count badge on the tab;
  "new tickets ring"), **K3b Cooking** (accepted and preparing rows with Start or Ready; under them a "Ready, rider
  on the way" group with a tag, no button), **K5 Kitchen** tab (open switch, today's numbers line: done, cash on the
  slips, then stock per dish). K4 one ticket pushes over the tabs with the chevron. K6 empty state per tab ("No new
  tickets", "Nothing cooking"). Header icon on K3 goes (the Kitchen tab replaces it).
- Rider: **R-Job** (= R3 offline, R4 waiting, R5 pick up, R6 on the way, R7 delivered, same screens, now under the
  Job tab), **R-Today** (today's deliveries newest first, each with the order number, the customer's area, the cash
  collected; a total line "Cash in hand ₹1,360 · hand over at the kitchen"; empty state "No deliveries yet today"),
  **R-Me** (online switch with "location shared every 30 s while online", today's count, the rider's name and phone
  as the admin sees them, Sign out row). R1 and R2 (sign in, gate) have no tabs.
- Design system: TabBar README (staff rule), a `badge` note; README "Navigation" updated; journeys rows K3b, R-Today,
  R-Me; the staff-app tab sets go to `docs/native-later.md` as unchanged for native.
Verification: fit check Day and Night clean on every K and R board; the tab bar sits at the phone's bottom in Fill
mode; the owner taps between the tabs on the phone and says yes per screen.

**Admin journey (owner, 24 Oct: "very good now lets go ahead I like the new designs" after the kitchen and rider
tabs).** Phone artboards like the other three apps, tabs **Orders · City · Numbers**, generator
`design-journeys/gen/admin.py` (written, not yet run), canvas row y 4156, boards A1 to A8:
- A1 sign in with Google, A2 "Not an admin account" gate (the real gate text: admin Google account only).
- A3 **Orders**: Live (new, cooking, ready, on the way) then Done (delivered, cancelled), one row per order with the
  customer, the kitchen, the cash and a status tag. A4 **one order**: the slip with the stamp, the timeline (placed,
  accepted by, cooking, ready, on the way, delivered), the customer row with Call, the rider row, and the one
  destructive action "Cancel order" (ghost, error colour; the reason sheet follows the cancel rule, 3 to 200 chars).
- A5 **City**: Kitchens (name, pins, staff, Open or Closed tag) with "+ Add a kitchen"; Riders (name, kitchen,
  what they are doing, Online or Offline) with "+ Add a person". A6 **one kitchen**: pins, hours, phone, address,
  Staff rows (name, email), Menu rows with the photo, price and Sold out tag, "+ Add a dish". A7 **Add a kitchen**:
  name, address, phone (10 digits), pin codes (at least one, 6 digits; the H1 and H4 rules shown as inline errors),
  opens at, closes at; Save disabled until the rules pass; the line "A kitchen with no pin code never shows to a
  customer" (bug 1).
- A8 **Numbers**: today's orders, delivered, cash on slips, on time, kitchens open, riders online as a 2-column
  grid of big mono numbers; the Simulator block from H5 to H7 (synthetic city switch, Seed, Reset, last tick line),
  "synthetic only".
Verification: run `admin.py`, fit check Day and Night on A1 to A8, `artboard-measure.mjs` columns equal to the
kitchen and rider lists (header 89, title 24, tab bar 57 at 844, scroll area 698), publish canvas and bundle,
journeys rows A1 to A8, the owner walks A1 to A8 and says yes per screen. Then J3 website design starts.

**Admin calls v3 and Night in the system (owner, 24 Oct, after canvas v65).** Owner: no call buttons on A5 City
(a clean list); A4 keeps the Call block (customer, the kitchen's owner Sunita, the rider once assigned); A6 One
kitchen: the four details (pin codes, hours, phone, address) are read-only as the kitchen registered them, with one
Edit row for the admin; the phone at the top is the kitchen's common landline with no call button beside it; the staff
rows (mobiles) keep their call buttons; one primary full-width "Call Tau Ka Dhaba" at the bottom, like Save kitchen on
A7. Night: "I like the design of the night sky now; add this to my design system; make sure you do not change anything
else; first solidify the other screens, then the night requirement." Order of work, exactly his:
1. **Admin first** (`design-journeys/gen/admin.py`, boards A4, A5, A6 only; nothing else regenerated):
   - `krow()`: drop `callbtn`; the row is the link + the tag. A5 regenerates with no phone icons.
   - A4: keep the Call block; the kitchen row reads "Sunita Devi · Kitchen owner · 98765 00011"; the rider row
     "No rider yet" with "Not assigned yet" until dispatch, then the rider's name + Call.
   - A6: the four rows read-only (no icon on Phone; the number is a landline "011 2634 0011"), then one `ui-row`
     "Edit details ›" (admin edits when the kitchen asks); Staff rows unchanged (mobile + call button); Menu unchanged;
     a bottom block `padding: 16px 20px 24px` with `<a href="tel:+911126340011" class="ui-btn big">Call Tau Ka Dhaba</a>`
     (the landline), the scroll area above it. Cancel-order on A4 stays the only error-coloured button.
   - Design system: Button README "ghost (Close, Call kitchen)" becomes "ghost (Close, Back to new)"; a line "Call is a
     primary button when calling is the screen's one job (A6), an icon button inside a row when it is one of several
     (A4 Call block, staff rows)". No token changes.
   - Fit check Day and Night on A4, A5, A6; measure A6 (header 89, tab-less, bottom button 56 + 24); screenshot strip
     `check/admin-call4.png`; publish canvas (read the live files first, rule from this session: the owner's page saves
     normalise the HTML); bundle sync; rows: discussions, trace, journeys (A4 v3, A5 v2, A6 v2), ideas (ID139 the read-only
     registered details with an admin Edit; ID140 call as the bottom primary on a detail screen), learnings (one: put the
     call where the job is, not on every row).
2. **Night in the system, second** (design system `gen.py` only; the tokens and `ink.css` do not change):
   - A new component page `Night` (group Brand) whose preview is the 02 home screen in `[data-theme="night"]` at 390 by
     844 (the same markup as board 02n), so the system shows the sky, the stars, the lime action, the grey-blue
     hairlines, the night lockup and night mark in one place. README text: when Night is on (18:00 to 06:00 by the clock,
     or the user's pin in You > Look), what changes (page, surfaces, hairline, ink, action, the two images, the zigzag
     colour, the stars) and what never changes (shapes, sizes, type, motion, the veg and non-veg marks, the status
     stamps' words). The rule "every role gets Night; a kitchen at 9 pm and a rider at midnight see Night by default".
   - The Logos page gets the two night files as previews beside the Day files (already in `assets/Logos/`), with the
     contrast numbers.
   - README "Before a screen ships" step 1 already says Day and Night; add "and the Night screenshot is looked at, not
     only the fit report" (the lockup lesson).
   - Sunset stays on hold, untouched (board 02s, `[data-theme="sunset"]` in the stylesheet, not in the tokens).
   - Publish design system v24; bundle sync (`design-system/`); trace row; journeys row "Night: yes (owner, 24 Oct)".
Verification: fit check clean Day and Night on A4, A5, A6; the A6 screenshot shows no icon on the Phone row, call
icons on both staff rows, and one primary "Call Tau Ka Dhaba" at the bottom; the A5 screenshot shows no phone icons;
the design system page lists `Night` under Brand and its preview renders the starry screen; the owner says yes on A4
to A6 and on the Night page.

## J3 Website v2 at letsdwelo.in (owner, 24 Oct: "do it afterwards"; start after the rider and kitchen journeys get a yes)

**Context.** The owner wants a new site for investors and customers at `letsdwelo.in` (rule 18: the owner asked, so
`site/` may change; it redeploys on merge to `main`, which is his yes). Named tools (rule 14, fixed): Watermelon UI
(`ui.watermelon.sh`), Motion Primitives (`motion-primitives.com`), Haikei (`haikei.app`). Checked 24 Oct (Tier A, their
own pages and repo): Watermelon UI = React 19 + Tailwind 4 + Motion, MIT, components installed as shadcn registry items
(`npx shadcn@latest add https://registry.watermelon.sh/r/<item>.json`), 87 stars (young); Motion Primitives = React +
Motion + Tailwind, open source, copy-paste components (Text Effect, Text Loop, Animated Number, In View, Infinite Slider,
Carousel, Scroll Progress, Spotlight, Tilt, Progressive Blur, Morphing Dialog, and more); Haikei = a free web app that
exports SVG or PNG (blob scene, layered and stacked waves, blurry gradient, low-poly grid, circle scatter), no API.
Today's site is Astro 5 with plain CSS and the old tokens, five pages (home, how it works, technology, investors,
roadmap, pre-register), two forms (investor, pre-register), Playwright + axe tests, a sitemap, deployed by
`.github/workflows` "Deploy site to Cloudflare Pages" on `site/**`. Its copy promises "under 15 minutes", "one tap to
pay", "live map", "10 Jev decision models"; the product today is cash at the door, 25 to 35 minutes, maps after H8.
Owner's answers (AskUserQuestion, 24 Oct): the site carries the vision plus an honest "Today" strip (Delhi pilot, cash
at the door, 25 to 35 min); start after the rider and kitchen journeys are approved.

**What the site must do.** Two readers, one page each plus shared sections:
- Customer: "what do I get tonight, where, how" in five seconds: the thali of the day with the real plate photo,
  the pin codes we serve, cash at the door, 25 to 35 min, one button "Pre-register your pin code" (keeps the form).
- Investor: the model (GoServe-run kitchens per pin code, the system picks the kitchen and the rider, hot meals as
  quick commerce), why it wins (short radius, one codebase, Jev decisions, lean), traction as real numbers only
  (kitchens live, pins served, orders, on-time rate; none invented; `Animated Number` counts them up), the roadmap
  (pilot, 10 kitchens, maps, payments, second city), the team, the ask, one form (keeps the investor form).
- Shared: the product itself, shown as the approved J2 screens (the Day and Night artboards exported as PNG from the
  canvas, in a phone frame, `Carousel` or `Infinite Slider`), how it works in three moves, the "Today" strip, footer
  with FSSAI and contact.

**How it is built (reviewer designs, coder ships; the reviewer never pushes code).**
1. Reviewer, on Claude Design: a desktop and a phone artboard for each page in GoServe Ink (same tokens as the app,
   Day and Night), the copy (grade 5, honest), the component map (which Watermelon block, which Motion Primitives
   effect per section: `Text Effect` on the hero line, `In View` reveals, `Animated Number` for traction, `Infinite
   Slider` for the dishes, `Scroll Progress`, `Spotlight` on the investor cards, `Tilt` on the phone frames,
   `Progressive Blur` under the hero photo), and the asset list. Haikei has no API: the **owner exports** three SVGs
   from haikei.app in the GoServe colours (a blob scene for the hero, layered waves between sections, a blurry
   gradient for the investor band) and drops them in `~/Downloads/_INBOX_TRIAGE/`; the reviewer routes them to
   `site/public/bg/`. Photos: the pilot kitchen's real thali and dishes (owner's phone), never stock, for the live site.
2. Coder, story J3 as a stacked PR into `dev` (rule 19): keep Astro (tests, sitemap, forms, CI stay), add
   `@astrojs/react`, `@astrojs/tailwind` (Tailwind 4), `motion`; Watermelon blocks through the shadcn registry into
   `site/src/components/ui/`, Motion Primitives copied into `site/src/components/motion/`; React islands only where
   motion lives (`client:visible`), the rest static Astro so the page stays light; ADR-018 "site v2 stack"; the old
   `tokens.css` replaced by the v3 tokens (one source with `design/tokens.json`); axe and Lighthouse (performance 90+
   on mobile, every animation off under `prefers-reduced-motion`); the "Today" strip reads its numbers from one JSON
   file the owner can edit. Release PR to `main` on the owner's yes; the workflow deploys to `letsdwelo.in`.
3. Not on the site: prices beyond the thali of the day, "most ordered", live maps, payments, any city but Delhi.

**PR #201 (J3, head 160ac30, reviewed 24 Oct, COMMENT).** The site matches the canvas (copy ratio 0.99, visuals at
1280 and 390), but: CI site job red (the reduced-motion e2e), TextEffect renders the hero words with no spaces
(`h1.textContent` "Hotmealsasquickcommerce."), the Wikimedia Commons CC BY-SA credits are missing on the live site,
Privacy and Terms are dead `#` links, `theme-color` is not the cream. The coder installed no Watermelon UI (nav and
footer are plain Astro) and hand-wrote the Motion Primitives components under their names. **Owner's decision (24 Oct,
rule 14): the real tools.** Watermelon blocks come from the shadcn registry
(`npx shadcn@latest add https://registry.watermelon.sh/r/<item>.json`) into `site/src/components/ui/` (nav, footer,
cards, the form fields where a block exists); Motion Primitives components are copied from motion-primitives.com
(their source, their file names) into `site/src/components/motion/`, not re-written (Text Effect, In View, Animated
Number, Infinite Slider, Scroll Progress, Spotlight, Tilt, Progressive Blur). Both commits land on the same layer, then
the four fixes, CI green, re-request. The reviewer re-reviews: `grep` the registry item names in `components.json` and
the copied files against upstream (same exports), the four fixes, Lighthouse mobile 90+, copy ratio unchanged.

**Verification.** Lighthouse mobile 90+ on performance and accessibility; axe clean; every claim on the page traced to
a row in `docs/assumptions.md` or a real number; the owner opens it on the phone and on a laptop and says yes per page;
the pre-register and investor forms still post to n8n (one test row each).

## E20 Pilot reporting on Telegram, platform health and cost, investor README (owner, 24 Oct, late)

**Context.** The owner accepted the breakpoint table (`reviewer-bundle/docs/product/pilot-breakpoints.md`) and asked for
automated reporting of those numbers against their thresholds on his Telegram, at the right frequency; platform
health and cost workflows ("check what exists, build what is missing"); and a README rewritten for tech investors.
Ideas ID142 to ID144. The pilot runs on the current UI, so this epic goes right after J3 and before H10 (the owner can
reorder). Stories H14, H15, H16. The coder ships; the reviewer wrote the design and reviews.

**What exists (VERIFIED 24 Oct, read-only).** `GS MAIN 90 Daily scorecard` (21:00 IST, dev ON, PROD off) calls `GS SUB 91
Scorecard numbers` (reads `run_log`, `decision_log`, last 24 h) and sends one Telegram message: runs, errors, time, Jev use,
cost. Code: `ops/n8n/order/build.js` (MAIN 90 and SUB 91 blocks), `ops/n8n/order/code/score_window.js`, `score_summary.js`,
`score_message.js`, tests `ops/n8n/order/scorecard.test.js` (CI runs `node --test "ops/n8n/order/*.test.js"`). `GS ERR 00
Alert` is ON for dev and prod (workflow failures to Telegram). `GS SUB 16 Health` asks Jev one question (the health page).
UptimeRobot: one monitor only, `n8n.linkright.in/healthz` (F42 done, F54 open: no app or site monitors). OpenRouter GoServe
key: hard cap $2, usage $0.0007, readable at `GET /api/v1/auth/key`. Sentry: deferred. Data for the pilot numbers:
`orders` (status incl. cancelled, `cancel_reason`, `rider_id`, `created_at`), `order_events` (event, actor, `created_at`:
placed, accepted, ... , `order.cancelled`) give accept latency, cook time and door time; `riders` holds one lat/lng row (no
history, so no location gaps yet); nothing records the customer's platform or a "call the kitchen" tap; `params` is the
versioned tunables table (rule 17 of the global manual); `feedback` rows exist.

**Frequency (reviewer's call, asked by the owner).** Three rhythms, one bot (`GoServeBot`), one chat (the owner):
1. **Instant, during open hours (11:00 to 22:30 IST), every 5 minutes:** the second bell. A placed order not accepted in
   3 minutes; a ready order with no rider for 5 minutes; a kitchen app with no staff read for 30 minutes while open. One
   message per event, never repeated for the same order (a `notified` mark in `order_events`). To the owner now; to the
   kitchen owner's Telegram once the cook joins the bot (`/start`, chat id saved by an admin row).
2. **Daily at 22:15 IST (after the kitchen closes at 22:00):** the pilot day card, the three numbers read every day plus
   the rest of the day's table, each against its breakpoint with a mark: `OK`, `WATCH` (within 20% of the line), `OVER`.
   Replaces the 21:00 scorecard time; the system block (runs, errors, cost) stays at the bottom of the same message.
3. **Weekly, Monday 09:00 IST:** the full breakpoint table for the last 7 days with the week before beside it, plus the
   platform health and cost block. **Monthly, the 1st at 09:00:** the same with a 30-day window and the month's cost
   against the phase estimate (~$0 for MVP 2). One workflow, two schedule triggers, Config picks the window.
Daily is right for the operational three (missed tickets, on-time, location gaps): they change by the day and the fix is
same-day. Weekly is right for the rest (radius, cash, refusals, iPhone share, lost sessions, calls): one day is too few
orders to read. Monthly is right for cost: free tiers bill monthly.

- **H14 Pilot report and watch** (n8n + one migration, `ops/n8n/order/build.js` and `code/`, registry
  `docs/integrations/n8n-order-workflows.md`):
  - Migration 0024 `pilot_numbers`: `rider_pings(user_id, at, lat, lng)` written by the rider app's 30 s location send
    through a new RPC `rider_ping` (keeps `riders.lat/lng` as today, adds the history; 30-day retention by a daily delete in
    the same report run); `orders.client_platform text` (`ios`, `android`, `other`, set by the app from the user agent at
    place); a `customer.call` row in `order_events` when the Tracker's Call button is tapped; `cancel_reason`
    `refused_at_door` from the rider's "Not delivered" path; `params` rows `pilot_breakpoints` v1 (the table's numbers:
    `orders_day 30, tickets_hour 10, missed_day 1, deliveries_rider_hour 4, radius_km 3.5, on_time_pct 80, gap_min 5,
    gap_share 0.2, cash_rider 8000, refused_pct 8, ios_share 0.33, lost_week 2, calls_share 0.2, realtime 200`) read by
    Config at run time (rule 17: a change is a new version, one-step rollback); a SQL function `pilot_numbers(since, until)`
    (security definer, admin or service role) that returns the day's numbers in one row, so SUB 91 does one read.
  - `GS SUB 91 Scorecard numbers`: one more read (`rpc/pilot_numbers`), `score_summary.js` merges it; `score_message.js`
    formats the pilot block first (three daily numbers, then the rest), each line `name: value / breakpoint · OK|WATCH|OVER`;
    the system block after. Window code unchanged except the hour (22:15). Tests red first in `scorecard.test.js`.
  - New `GS MAIN 92 Pilot watch` (schedule every 5 min, Config with `open_from`, `open_to`, `accept_min 3`, `rider_min 5`,
    `chat_id`, `kitchen_chat_id`, kill switch) → new `GS SUB 93 Watch numbers` (one RPC `pilot_watch()` returns the orders
    over the lines, not yet notified) → Format → Telegram → RPC marks `watch.notified` events. Fail closed; `errorWorkflow`
    ERR 00; `callerPolicy` list. Deployed inactive; the owner's "activate" turns the schedule on (rule A2.8).
  - New `GS MAIN 93 Weekly and monthly report` (two schedule triggers: Monday 09:00, the 1st 09:00) → SUB 91 with a 7 or
    30 day window (SUB 91 takes `since` and `until`; the daily card passes 24 h) → `GS SUB 94 Health and cost numbers` →
    Format → Telegram. Both PROD twins deployed inactive by `deploy.js`, as today.
  - Rider app: `rider_ping` call beside the existing location write; customer app: `client_platform` at place and the
    `customer.call` event; rider "Not delivered" sets the reason. e2e: one row each in the existing specs (helpers already
    fake `riders` and `orders`).
- **H15 Platform health and cost** (`GS SUB 94 Health and cost numbers`, UptimeRobot, no new accounts):
  - SUB 94 reads, each with its own fail-soft line (a failed read prints "could not read", never fails the report):
    OpenRouter `GET /api/v1/auth/key` (usage vs the $2 cap; WATCH at 50%, OVER at 80%); Supabase SQL function
    `health_numbers()` (database size vs 500 MB free, rows in `orders`, `run_log`, `rider_pings`, `order_events`, oldest
    row, `pg_stat_activity` count as a connections proxy); n8n API `GET /executions?status=error&limit=100` for the window
    (errors by workflow); UptimeRobot `getMonitors` (each monitor's status and 7-day uptime ratio). Cloudflare Pages and
    the Oracle box are not read (free, flat); a monthly manual line stays in the components doc.
  - UptimeRobot monitors added by script (`ops/health/uptimerobot.py`, read-plan then `--apply` after the owner's yes):
    `goserve-app.pages.dev/customer/`, `/kitchen/`, `/rider/`, `/admin/`, `goserve-app-dev.vercel.app/customer/`,
    `letsdwelo.in`, and the n8n health route `POST /webhook/gs-order` with `{action: "health"}` if UptimeRobot's keyword
    monitor can send a body (else the `healthz` monitor stays the only n8n one). Telegram alert contact is set by the owner
    in the UptimeRobot UI (F54), one line of help in the reply.
  - Cost caps as params: `cost_caps` v1 (`openrouter_usd 2, supabase_mb 500, n8n_errors_day 5`). The weekly and monthly
    messages print each against its cap with OK, WATCH, OVER. Sentry stays deferred (ERR 00 covers workflow errors; the app
    has no error tracker: a follow-up row, not this story).
  - Components doc rows (monitoring, uptime, cost) updated with VERIFIED evidence.
- **H16 README v2 for tech investors** (`README.md` on `dev`, then the release to `main`; `main` holds README by rule 17):
  the reviewer drafts the full text in `reviewer-bundle/docs/README-v2.md`, the coder copies it in. Shape, grade 5, every
  claim true today: (1) one line: GoServe runs its own kitchens and delivers hot meals in 25 to 35 minutes, cash at the door,
  Delhi pilot live; (2) "Why this is different", five short blocks: we run the kitchen so we own the minutes; one codebase,
  four apps, no app store needed; the system decides (Jev decision models, our own Laya model trained from our logs, zero
  text hallucination); zero login; built lean on free tiers with a two-person loop and AI-written, human-reviewed code;
  (3) "See it live" links: customer, kitchen, rider, admin, dev, investor site, the design system and the four journey
  canvases (marked private, the owner shares on request); (4) "Where we are today": pilot facts, no invented numbers, the
  breakpoint table link, the daily Telegram card as proof of discipline; (5) "What comes next": ten kitchens, maps,
  payments, second city, native apps (links to the plan, native-later, roadmap); (6) "How we build": TDD, two GitHub
  accounts, every decision an ADR, the process trace, the review notebook (links as today); (7) every existing link kept,
  regrouped; "under 15 minutes" and "one tap to pay" removed everywhere in the README. Investor FOMO comes from real
  speed of shipping (the trace shows 240+ steps in two weeks) and real AI depth (Jev, Laya), not from adjectives.
- **H17 PostHog product analytics** (owner, 24 Oct: "set it up properly, like a PostHog specialist, plan first; CLI, MCP or
  API key, whichever is easy"). Nothing exists today: no key in the vault, no analytics in `app/`, the components doc lists
  "PostHog free or Plausible, after the pilot starts" (E19). Log idea ID145 at execution.
  - **Account and tooling.** The owner makes a free PostHog Cloud project (region US by default; EU if he prefers data in
    the EU; India has no region), saves `POSTHOG_PROJECT_TOKEN` (public, write-only, ships in the app bundle as
    `VITE_POSTHOG_KEY`) and `POSTHOG_PERSONAL_API_KEY` (private, vault and GitHub secret only) in `04_integrations.env`.
    Easiest path: the **REST API with the personal key** from one spec file, applied by a script, so the setup is
    reproducible and reviewable (`ops/analytics/posthog_spec.json` + `ops/analytics/posthog_apply.py`: plan mode prints the
    diff, `--apply` creates or updates actions, insights and the dashboard; idempotent by name). The PostHog MCP server is a
    fine second tool for reading insights in a session; the CLI is for source maps and is not needed in the pilot.
  - **Identity (zero login, ADR-016).** `distinct_id` = the device session id for customers (the same id the orders carry,
    so PostHog and Supabase join on it); staff = the Google user id; `person_profiles: "identified_only"`. Person
    properties set once: `role`, `pin_code`, `kitchen_id` (staff), `theme`, `installed` (standalone display mode). Never a
    name, phone or address in any event (DPDP hygiene and no PII in a third party). Autocapture **off**, explicit events
    only (clean data, far under the free 1M events a month). Session replay **on for the customer app only**, 20% sample,
    all inputs masked, off for staff apps. Feature flags not used yet. Demo mode and e2e send nothing (`VITE_POSTHOG_KEY`
    empty in tests; the helper mocks `*.posthog.com` to be safe).
  - **Event taxonomy** (`object_action`, snake_case, one wrapper `app/src/lib/analytics.ts` with `track(name, props)`,
    `identify(id, props)`, `pageview(screen)`; every event carries `app` (customer, kitchen, rider, admin), `screen`,
    `theme`, `env`):
    - Customer: `app_opened` (installed, platform from `$os`), `pin_submitted` (pin, served), `menu_viewed` (kitchen_id,
      open), `thali_switched` (veg or non_veg), `veg_only_toggled`, `dish_viewed`, `item_added` (item_id, qty, price_paise,
      from: hero or list), `item_removed`, `bill_viewed` (items, total_paise), `details_saved`, `order_placed` (order_id,
      total_paise, items_count, kitchen_id, pin, platform) **the conversion**, `order_failed` (reason code),
      `tracker_viewed` (status), `call_kitchen_tapped`, `delivery_confirmed` (answer: yes or not_yet), `feedback_sent`
      (kind, has_image), `push_permission` (granted or denied), `theme_changed`, `install_prompt` (shown or accepted).
    - Kitchen: `gate_not_staff_seen`, `ticket_accepted` (order_id, latency_s), `cooking_started`, `ticket_ready`
      (cook_s), `kitchen_open_toggled` (open), `dish_soldout_toggled`, `tab_switched` (new, cooking, kitchen).
    - Rider: `rider_online_toggled`, `job_received` (order_id, distance_m), `pickup_confirmed`, `delivered_tapped`
      (door_s), `not_delivered_tapped` (reason), `cash_handover_marked`. No per-ping event (30 s pings stay in Supabase).
    - Admin: `kitchen_added`, `person_added` (kind), `order_cancelled` (reason), `call_tapped` (who: customer, kitchen,
      rider), `simulator_action` (later).
    - Server side from n8n (HTTP node to `/capture` with the project token from Config, fire and forget, in SUB 14 Write
      logs so every run already passes there): `order_status_changed` (from, to, actor, seconds_since_placed),
      `dispatch_decided` (candidates, jev_used, agrees, ms, cost), `push_sent` (kind, delivered), `watch_alert_sent`
      (kind). Server events carry the order's session id as `distinct_id`, so funnels join client and server.
  - **Spec file contents** (what the script creates): actions `Order placed`, `Order delivered`, `Ticket accepted late`
    (latency_s > 120); insights: funnel pin → menu → item_added → bill → order_placed (per platform), funnel order_placed
    → delivered with median time, trend orders per day, trend on-time share (`door_s` ≤ 2100), trend missed tickets
    (`Ticket accepted late`), platform share pie (`$os`), weekly retention of ordering customers (answers "lost sessions"
    from the other side), trend `call_kitchen_tapped` per order, trend errors (`order_failed` by reason); one dashboard
    "GoServe pilot" with those eleven tiles in the breakpoint table's order; the Telegram day card (H14) links to it.
  - **Guard rails.** Events are listed in `docs/product/analytics-events.md` (one row each: name, who fires it, props,
    why it exists); a unit test fails when `track(` is called with a name not in that list; no event ships without its
    row. Cost line in the weekly health card: events this month vs 1,000,000 and replays vs 5,000 (free tier numbers
    checked on PostHog's pricing page at execution; conf 0.7 today).
- Order inside E20: H14 (watch first, then the day card), H15, H16, H17. Each a layer in the stack after J3 (rule 19).

**Verification.**
- H14: `node --test "ops/n8n/order/*.test.js"` red then green (window at 22:15, breakpoint marks OK/WATCH/OVER on fixture
  numbers, the watch picks only un-notified orders, the message never has a `{{`); `check_city_model.py dev` rows for
  `pilot_numbers`, `pilot_watch`, `rider_ping`, the platform column and the call event; a dry run on dev: seed six dev
  orders with timestamps (one late accept, one refused, one iPhone) and read the dev card the owner receives at 22:15 or on
  the TEST hook; the watch fires once for the late order and not again. Prod twins inactive until "activate".
- H15: `ops/health/uptimerobot.py` plan shows the six monitors, `--apply` after the yes, `getMonitors` lists them; SUB 94
  dry run prints OpenRouter usage, database size and the error count; a Monday card on dev.
- H16: the README reads at grade 5 (`grade.py` 7.0 or under on the prose), every link answers 200 (a link check in the PR),
  no number on it that a doc does not back.
- H17: `posthog_apply.py` plan shows the actions, insights and dashboard; `--apply` after the keys exist; the dashboard
  lists eleven tiles; the events test is red for an unlisted name and green after the row; one dev order from the phone
  shows the funnel pin → order_placed → delivered on the dashboard within a minute; e2e run sends zero PostHog calls.

## E19 Integrations map (H13: `docs/research/integrations-2026-10.md`, one table, tiers and costs)

| Need | Pick | Free? | When |
|---|---|---|---|
| Geocoding, distance, autocomplete | Ola Maps | 100K per API per month | H8 |
| Routing on our own box | OSRM self-hosted (Oracle ARM) | yes | when volume needs it (F39) |
| Payments | Razorpay (test keys now, live after KYC + FSSAI) | 2% per txn | MVP 2b |
| SMS | DLT registration + an SMS gateway (MSG91 or Exotel) | ₹0.15 to 0.25 per SMS | MVP 2b |
| WhatsApp | Meta Cloud API (via a BSP) | first 1,000 conversations free per month | MVP 2b |
| Email | Resend or Brevo free tier | 3,000 a month | 25 Oct (gate deferral) |
| Errors | Sentry free | 5K events | 25 Oct |
| Uptime | UptimeRobot free | 50 monitors | 25 Oct (owner signup) |
| Photos | browser resize before upload (H4); Cloudflare Images later | free | H4 |
| Call masking | Exotel or Knowlarity quotes (F45) | paid | before the pilot |
| Analytics | PostHog free or Plausible self-hosted | free tier | after the pilot starts |

## Verification

- H1 to H3: `check_city_model.py` rows for every new rule (a kitchen with no pins is refused; a second
  kitchen for a staff user is refused; price 0 refused); e2e: `/kitchen/` loads no menu; prod: `/` answers
  302 to `/customer/`; the owner's kitchen account sees the order placed for its kitchen (the MVP 2 live row).
- H5 to H7: on dev first: seed 10 kitchens, 20 riders, 60 dishes in under 5 seconds, tick changes at least
  one rider and one kitchen per minute, reset leaves zero synthetic rows and touches no real row (counts
  before and after on real rows identical). Then prod on the owner's yes; `city_report.py prod` shows 20
  riders with 14 online, 10 kitchens with 8 open, candidates for a sample kitchen sorted by distance.
- H8: a real Delhi address on dev geocodes to a point inside the kitchen's 6 km; a nonsense address is
  refused; the cache answers the second call with no API hit (count in `geocode_cache`).
- H9: four preview URLs, the owner's pick recorded with the checklist scores, E6 row.
- Every PR: TDD red first, ponytail, reviewer runs the tests, one live row on dev before approve.

## The owner's steps (one at a time, the reviewer calls each)

1. Now: paste the coder block. Tell the coder the kitchen account's email (for the prod `kitchen_staff`
   read) and fix Tau ka Dhaba's pin code in the admin app.
2. H5 on prod: "yes sim prod" after the dev proof. H8: make the Ola Maps account and key (10 minutes),
   save `OLA_MAPS_API_KEY` in `04_integrations.env`.
3. J1 and J2: open the design system link, then each journey link on the iPhone; yes or no per screen.
   H9: open four preview links on the iPhone, pick one, say which.
4. After H3 is live: redo the kitchen live row, then the rider, customer and push rows, then "MVP 2 closed".

## Coder block (now)

```
To coder, from reviewer, re MVP 2.5 pilot hardening:
1. Owner, 24 Oct, after the prod walk: two bugs (a kitchen with no pin code; the kitchen app blind to an order placed from the demo console at /), a synthetic city on prod with seed and reset APIs, validation rules end to end, Ola Maps, and a four-skill UI blind test. Plan: ~/.claude/plans/sleepy-soaring-kurzweil.md (v4), root causes and stories inside.
2. First, read-only on prod: kitchen_staff rows for the owner's kitchen email and the last order's kitchen_id, name, phone; paste them. Then epics E15 to E19 and stories H1 to H13 on GitHub, milestone MVP 2.5 due 27 Oct.
3. PR order, one at a time: H1 H2 H3 H5 H6 H7 H4 H8 H9 H10 H11 H12 H13. Prod changes only on the owner's yes.
4. Added 24 Oct: the reviewer builds the GoServe design system and every journey on Claude Design (J1, J2, no PR) while you ship H2 to H8; H10 to H12 are coded to the J2 artboards the owner approved, under the Steve Jobs bar in the plan.
Need from you: the prod read-back and the H1 PR link.
```
