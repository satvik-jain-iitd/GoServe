# Map providers and the maps study (7 and 8 Nov 2026)

Tiers: A = the owner of the rule or the data. B = big data run by a seller. C = blog. S = our own data. Confidence is 0 to 1.

## Decision (owner, 8 Nov 2026)

Ola Maps now, for accuracy in his town. The free OSM map stays the base and the survey data grows. Later we may look at a custom map of our own, as Ola built theirs. Not now. Ola data is not ours and the free quota is 100K calls per API per month, so survey rows always land in our tables. Ola is the lookup, not the store. Story: #998.

## Ola Maps findings (Tier A, vendor docs, read 8 Nov 2026; test S)

- The API key is bound to whitelisted browser domains. A server call with the key gives `403 Domain  is not allowed.` (no Origin).
- Server path: OAuth client credentials at `/auth/v1/token`, called from the Edge Function. The key is only for browser-side tiles later.
- The client id and secret are in the Secrets vault and on the dev Supabase project (OLA_MAPS_CLIENT_ID, OLA_MAPS_CLIENT_SECRET). Prod gets them at release.
- Test E-OLA-1 (see `experiments.md`): 8 of 8 pins right, 191 to 215 ms. Confidence 0.85, one district only.
- Pricing: 100,000 free calls per API each month. Reverse geocoding then ₹0.099 a request (about ₹99 per 1,000), ₹0.025 above 5M. Map loads ₹0.141 each above 100K. Confidence 0.9 that the page says this.

## Provider price table (vendor pages, Tier A for their own prices)

| Provider | Reverse geocoding | Map loads and tiles | Free each month |
|---|---|---|---|
| OpenStreetMap + Nominatim + our tables | ₹0 | ₹0 (tile policy: light use, credit shown) | all |
| Ola Maps (India, ₹) | free to 100K, then ₹0.099 a request | ₹0.141 a load above 100K | 100,000 calls per API |
| Mapbox (USD) | temporary geocoding free to 100K, then $0.75 per 1,000; permanent $5 per 1,000 | free to 50K loads, then $5 per 1,000 | 50K loads, 100K geocodes |
| Google Maps Platform | not on the page (calculator only) | not on the page | "up to 70,000 free calls per product every month" |
| Mappls (MapmyIndia) | not stated | not stated | not stated |

Confidence 0.9 that the pages say this. Confidence 0.6 that Google per-call prices match our use (the calculator was not read). Google on the Routes API: 10K free, then $5 per 1,000 (A, 0.9). At today's size every provider is free.

## OSM survey path (wiki, Tier A, 0.9)

Every Door (iOS 13+, Android 7+) uploads under the user's own account. StreetComplete is now on iOS (v64, Oct 2026). The Import Guidelines need a wiki plan, community buy-in, forum review, a 14-day wait and a separate `_Import` account; the Data Working Group reverts imports that skip this. `addr:postcode` is allowed on nodes, ways and areas. The owner's survey format is in `survey-sheet.md`.

## Research rows of 7 Nov 2026 (maps study)

| Claim | Evidence | Tier | Conf | Date | Changes for us |
|---|---|---|---|---|---|
| Smartphone GPS under open sky is about 5 m | Second hand (van Diggelen and Enge 2015 not fetched; gps.gov page 404) | C | 0.5 | 2026-11-07 | Quote as "about 5 m, unverified" |
| Urban iPhone GPS: average 7 to 13 m, RMSE 9.9 m, max 99.7 m (one phone, 160 trips) | Merry and Bettinger, PLoS One 2019, PMC6638960 | A | 0.8 | 2026-11-07 | Kitchen pin needs best-of-N and a drag |
| `accuracy` is a 68% confidence radius in metres | MDN GeolocationCoordinates.accuracy | A | 0.9 | 2026-11-07 | Show the ring; never read it as a bound |
| `delivery=only` alone is "problematic"; `craft=caterer` suggested for delivery-only cooked food | OSM wiki Key:delivery | A | 0.8 | 2026-11-07 | Tag set for kitchens |
| Automated edits need documentation, discussion and small batches; hand edits reviewed one by one are not automated | OSM Automated Edits code of conduct | A | 0.9 | 2026-11-07 | Hand edits in iD up to about 50 kitchens |
| Nominatim public: max 1 request a second per app, app-naming User-Agent or Referer, proxy plus cache, no periodic calls, no autocomplete, no grid reverse | OSMF Nominatim usage policy | A | 0.9 | 2026-11-07 | Build the proxy (F278) before launch |
| Self-hosted Nominatim updates from minutely diffs by default | nominatim.org admin docs 5.3.3 | A | 0.9 | 2026-11-07 | Self-host at about 1,000 orders a day |
| OSM tiles: no SLA, named User-Agent, visible credit, cache 7 days, no offline, access may be withdrawn for commercial use | OSMF tile usage policy | A | 0.9 | 2026-11-07 | Dev only; prod PMTiles or MapTiler as decided 29 Oct |
| Valhalla `trace_attributes` returns edge id, way id, names, length, speed; historical speeds in 5-minute buckets per edge | Valhalla docs | A | 0.9 | 2026-11-07 | Stage 1 and 2 of route intelligence |
| OSRM match takes timestamps and radiuses (GPS accuracy), splits on gaps over 60 s | OSRM docs v5.24 | A | 0.9 | 2026-11-07 | Alternative to Valhalla |
| Capacitor Geolocation has no background mode; capacitor-community/background-geolocation does (iOS UIBackgroundModes location, Android legacy bridge, POST_NOTIFICATIONS) | plugin docs | A | 0.8 | 2026-11-07 | The rider trail needs the native app |
| Grab: GPS probes plus imagery to fix OSM; road-change reports from WhatsApp, then in-app | SOTM 2021 abstract | A | 0.8 | 2026-11-07 | In-app "road closed" tap from day one |
| Ola Maps: OSM road network, buildings and POIs plus own telemetry; contributes back; ODbL credit | OSM wiki Ola page, Ola blog | A | 0.7 | 2026-11-07 | Precedent for an OSM-based stack in India |
| Geofabrik India is 1.6 GB; Northern Zone 214 MB; no Delhi sub-extract | geofabrik.de | A | 0.9 | 2026-11-07 | Valhalla and Nominatim build size |
| Stored kitchen pin vs the owner's other-app reading: 17.5 m apart, stored accuracy 7.2 m | dev DB kitchens row, 7 Nov | S | 0.9 | 2026-11-07 | The page's worked example |

## Precedents for the customer's door (7 Nov, page v2)

Swiggy POIs and gates from traces (B, 0.7). Delhivery Addfix (C, 0.5). Grab (A, 0.8). Ola (A, 0.7). Dunzo (C, 0.4). Zepto (C, 0.3). Mapillary (B, 0.6). Plan: the Delivered-tap GPS as the door, a last-300 m card, DIGIPIN; a door photo now; a phone-mount camera test at 100 orders a day; a dashcam at 300 a day (experiments E-DOOR-1, E-CAM-1).

## Night additions, 8 Nov (reviewer)

Ola Maps pricing, read from https://maps.olakrutrim.com/pricing (Tier A, Ola's own page, their motive: sell credits; date on page: "From 1 September 2026", "© 2026"). Claims: (1) "100,000 free calls per API, every month"; Reverse Geocoding tier 2 (100K to 5M) ₹0.099 per request, tier 3 ₹0.025. Confidence 0.9 for "this is what the page says today". (2) Map tiles are not a product on the page; "Dynamic Maps" is billed per map load (₹0.141 per load beyond 100K loads a month); whether Leaflet fetching Ola tiles counts as one "load" per screen or per tile is NOT on the page: confidence 0.5, must read /pricing/details and the Fair Usage PDF (/legal-docs/fair-usage-policy-2026.pdf). (3) Prepaid credit model from 1 Sept 2026 (auto-debit ended 31 Aug 2026): when the free allowance and credit are gone, calls stop; exact failure response not on the page (0.5). (4) No per-second or per-day rate limit on the page. Older news (Tier C, July 2024 launch): "5M free calls a month" and "500K": outdated by the live page. Sizing for 100 orders a day: reverse lookups happen only when a pin is set or moved, not per order; worst case 5 lookups on every order = 500 a day = 15,000 a month = 15 percent of the free 100K (0.85). Map loads: address screen + tracker map, about 1.5 per order = 4,500 a month, well under 100K if a load means a screen open (0.6). What changes: tiles decision needs the details page and the PDF first; add a daily call counter in the Edge Function and an alert at 70 percent of the free allowance; the fallback when Ola fails is our own pincode table (nearest_pin), never Nominatim.

OpenStreetMap rules, read from the OSMF Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/) and the OSM copyright page (https://www.openstreetmap.org/copyright), both Tier A (the data owner's own words). Two different things: (1) the DATA (roads, names) is under the ODbL: "free to copy, distribute, transmit and adapt our data, as long as you credit OpenStreetMap and its contributors"; no commercial restriction; credit "© OpenStreetMap contributors" required; share-alike only if we alter the database itself. Confidence 0.9. (2) the public TILE SERVER (tile.openstreetmap.org) is donation-funded, "capacity is limited", "no SLA or guarantee", "Commercial services … should be especially aware that access may be withdrawn at any point: you may no longer be able to serve your paying customers", "we cannot provide a free-of-charge map API or map tiles for third-parties", blocks "without notice", generic User-Agents blocked, offline or bulk tile download not permitted. Confidence 0.9. What it means for us: a live consumer app must not depend on tile.openstreetmap.org; Ola's tiles are built on OSM data (hence the credit) and come with a contract and a free allowance; Ola stays the tile source (owner, 8 Nov). Tests: tiles are replayed from a recording, zero live tile calls in any run.

## Rider directions: the options and the cost (13 Nov 2026, reviewer)

Owner, 13 Nov 2026: "We don't just need the dot. We need the exact direction on what road he needs to follow" and "I must show directions to reach the location, what are my options, preferred free, else tell me cost."
Decision already taken on 9 Nov 2026 (idea ID343): a bike route, then a walking route, joined at a common junction (the park point), picked by the least total time, never by a fixed distance.

Sizing used below: about 4 routing calls for an order (9 Nov estimate). 100 orders a day is about 12,000 calls a month.

| Option | What the rider gets | Free each month | Price after | Two-wheeler | Walking | Tier | Conf | Source, read 13 Nov 2026 |
|---|---|---|---|---|---|---|---|---|
| Google Maps link (the Navigate button, built, story #1182) | Google's own app: voice, turns, traffic. Leaves our app. No park point of ours | no key needed; cost not on the page | not on the page | yes, `travelmode=two-wheeler` | yes | A | 0.85 that it stays free | developers.google.com/maps/documentation/urls/get-started: "You don't need a Google API key to use Maps URLs." |
| Valhalla on our own server | A road line, the turns as text, Hindi (`hi-IN`), inside our app. Our data, so park points can be kept | all (software is MIT) | ₹0; the server and the upkeep are ours | yes, `motor_scooter` | yes, `pedestrian` | A | 0.9 for what it offers; 0.4 that the Oracle box holds it (not tested, F39) | valhalla.github.io/valhalla/api/route/api-reference; release 3.9.1 of 2026-10-06; Docker image |
| Ola Maps Directions API | A road line inside our app | 100,000 calls per API | ₹0.199 a request (Directions), ₹0.099 (Directions Basic); prepaid credit, calls stop when it runs out | not on the page | not on the page for the API (the Android SDK has a walking profile) | A | 0.9 for the price; 0.4 that it fits the park point | maps.olakrutrim.com/pricing and /pricing/details (rate card of 1 Sept 2026) |
| Google Routes API, India price | A road line inside our app, Google's traffic | two-wheeler is the Enterprise SKU: 7,000 | $4.50 per 1,000 | yes (beta) | yes (beta) | A | 0.9 | developers.google.com/maps/billing-and-pricing/pricing-india and sku-details/routes |
| Mapbox Directions API | A road line inside our app | 100,000 | $2.00 per 1,000 | not on the page | yes | A | 0.9 | mapbox.com/pricing |
| Google Navigation SDK, India price (native app only) | Google's full voice navigation inside our own Android app | 7,000 destinations | $8.00 per 1,000 | not read | not read | A | 0.8 | pricing-india, "Navigation Request" |

Not usable for a live app: the OSRM demo server ("restricted to reasonable, non-commercial use-cases", 1 request a second), the GraphHopper free plan ("for non-commercial use only"). openrouteservice: the plan limits could not be read (the plans page gave no text).

Other facts: OSRM ships car, bicycle and foot profiles, no motorcycle or scooter, and its answer has turn codes, not sentences. GraphHopper's open engine has motorcycle and foot, Apache-2.0, needs Java 25. Geofabrik: India 1.6 GB, Central Zone 335 MB, Northern Zone 214 MB.

What the numbers mean at 100 orders a day (about 12,000 calls a month): Valhalla ₹0. Ola ₹0 (free up to about 830 orders a day). Google Routes two-wheeler: 5,000 paid calls, about $22.50 a month. Mapbox ₹0. Google Navigation SDK: 3,000 destinations, ₹0.

Hypotheses, not facts, until tested: (1) Valhalla with the scooter and walking graphs runs on the Oracle box with RAM to spare and answers under 1 s (F39). (2) The park point it gives is the right place for 16 of 20 real addresses (the 9 Nov rule). (3) Ola's Directions API can give a walking route.

Motive check: every price page sells credits; the free tiers can shrink (Ola's did in 2026). A self-hosted engine has no such page, but its cost is our own time.

## Valhalla: software requirements (13 Nov 2026, reviewer)

Source: Valhalla's own pages, read 13 Nov 2026. Tier A (the project says it about itself). The project sells nothing.

| Claim | What the page says | Tier | Confidence | What it changes for us |
|---|---|---|---|---|
| Runs on Linux and macOS | "fully functional on many Linux and Mac OS distributions" (github.com/valhalla/valhalla) | A | 0.9 | The Oracle box (Linux) is fine |
| A Linux ARM64 Docker image exists | The package page lists `linux/arm64` and the tag `latest-arm64` for `ghcr.io/valhalla/valhalla` | A | 0.9 | No build from source on the box |
| The scripted image is ARM64 too | Not on the page read (`valhalla-scripted` architectures not listed) | - | 0.5 | Check with `docker manifest inspect` before the test |
| Build from source needs CMake and C++17 | "the compiler needs C++17 support"; Debian or Ubuntu: `./scripts/install-linux-deps.sh` | A | 0.9 | Not needed when we use Docker |
| The server listens on port 8002 | `-p 8002:8002` in the Docker README; `valhalla_service valhalla.json 1` runs it | A | 0.9 | One port, kept inside the box |
| RAM to build tiles | Only figure: the whole planet on a quad core with 16 GB RAM and an SSD, about 15 hours | A | 0.9 for the planet | No figure for a 335 MB zone. Must be measured |
| RAM to serve routes | Not on the pages read | - | - | Must be measured |
| Tile size on disk against the pbf size | Not on the pages read | - | - | Must be measured |
| `server_threads` | "If valhalla gets killed when building tiles, lower this number." | A | 0.9 | Start with 1 on the shared box |
| `build_elevation` is off by default | "True downloads elevation tiles" | A | 0.9 | Keep off |
| `build_admins` is on by default | Needed for driving side. A small extract "usually contains no country or state polygons"; set `mjolnir.data_processing.use_admin_db` to false only for right-hand driving | A | 0.8 | India drives on the left: keep admins on, and test the driving side in the route text |
| `build_time_zones` | Needed only for routes with a set departure time | A | 0.9 | Can be off |
| `build_tar` is on by default | One tar of the tiles with an index, "faster graph loading after reboots" | A | 0.9 | Keep on |
| New map data | A changed pbf makes the container build new tiles on the next restart | A | 0.9 | A map update is a rebuild |
| One graph for bike and walk | "This route graph will include motor vehicle, pedestrian, and bicycle route information". `motor_scooter` is not named on that page | A | 0.7 | Lean yes. The test settles it |
| Licence | MIT for the code. The OSM data is ODbL (credit line needed) | A | 0.9 | Free for commercial use, with the OSM credit |

Open, so a test: RAM, disk and time to build one zone on the Oracle box, RAM to serve, and whether `motor_scooter` and `pedestrian` both answer from one graph.

## The maps plan (14 Nov 2026, reviewer)

Owner, 14 Nov 2026: "I want to transition fully to Ola Maps and remove OpenStreetMap from everywhere" and "I want the switch to be configurable in the admin app so we can change from Ola map back to OpenStreetMap anytime" and "tomorrow I will go to Google map". He also wants "multiple API keys and multiple accounts to club in all my credits" with the budget of each one shown in admin. He asked for a plan first. Nothing is built yet.

### What runs today (code on `dev`, read 14 Nov 2026, Tier S)

| Place | Who serves it today | Ola calls |
|---|---|---|
| Customer address pin, the map picture (`PinMapScreen.tsx`) | The public OSM tile server, through `VITE_MAP_TILES`, set at build time in both deploy workflows | 0 |
| Pin to words (`locate.ts` `findAddress`, edge function `geocode`) | Ola reverse geocode, from our server. On a no: public Nominatim, then our `nearest_pin` | 1 each time the pin rests |
| Place search (edge function `place-search`) | Our own pincodes table | 0 |
| Can we deliver, distance, ETA, picking a rider | Our own database, straight-line metres | 0 |
| Order tracker map (`RiderMap.tsx`) | The public OSM tile server. It opens only when the customer taps the rider row, and only while the order is out for delivery | 0 |
| Admin kitchen pin (`KitchenLocation.tsx`) | The same pin screen | 1 each time the pin rests |
| Rider Navigate and "Kitchen ka raasta" | A Google Maps link, no key | 0 |

So Ola does one job today: pin to words. The Ola credit shows on the pin screen when the words came from Ola.

Two additions from the coder's read (PR #1495, dev at 8f4b542):

- The Nominatim fallback and `nearest_pin` are called from the customer's browser, not from our server. So Nominatim sees the customer's IP and the exact point. Step 1 takes this path out of the prod default.
- The admin kitchen form also calls `findAddress` once when it shows a saved location. So it is 1 call for each open of a kitchen that has a location, plus 1 each time the pin rests.

### What does not exist

- Ola map tiles are used nowhere.
- The tile provider is a build-time value. A change needs a deploy. The lookup switch is the `settings` row `lookup_provider`, set by SQL only. No admin screen reads it.
- No road route line and no road ETA. The tracker draws a straight dashed line.
- One Ola credential and one counter (`ola_calls`, hard stop at 100,000). No budget view in admin. No alert.
- No Google API. Only the link.

### Call estimate at 100 orders a day (a guess, not a measurement)

Assumed: the address map opens 60 times a day (30 orders with a new address, 30 people who set an address and do not order). The pin rests 4 times in one open. 70 percent of customers open the tracker map, 1.5 times each. The high case: 150 opens, 8 rests, 3 tracker opens for every order. Prod counts were not read.

| Ola API | Today | Calls a month (expected to high) | Share of the free 100,000 |
|---|---|---|---|
| Reverse geocode | runs | 7,200 to 36,000 | 7 to 36 percent |
| Map loads (Ola tiles) | no | 5,000 to 13,500 | 5 to 14 percent |
| Directions (route line, ETA) | no | 4,500 to 12,000 | 5 to 12 percent |
| Autocomplete | no, own table | 0 | 0 |

- The free 100,000 is for each API, not one shared pool (Ola rate card of 1 Sept 2026, Tier A, 0.9).
- A side estimate the owner pasted said about 16,000 calls a month without tiles. About 9,000 of those were route and ETA calls that are not built. Today's real load is near 7,000.
- The same estimate said about 2.5 lakh with tiles. That holds only if Ola counts each tile. The rate card bills "Dynamic Maps" for each map load (0.6 that a MapLibre map on Ola's vector style counts as one load). If each tile counts, the month is 1.5 to 4 lakh and passes the free cap. Test E-OLA-3 settles it.
- If a load is one call, one account stays free up to about 800 orders a day (0.6), and up to about 280 in the high case. Past the cap the price is about ₹0.6 an order.
- Dev numbers (Tier S, coder, Nov 2026): `ola_calls` 344, 6 saved addresses, 16 orders. Dev is test heavy, so the ratio is not a guide. A week of prod will give the real ratio.

### What matters to the user, most first (reviewer's call, on the owner's delegation)

| Rank | Thing | Why | What we do |
|---|---|---|---|
| 1 | The pin is on the right door and the words are known to the customer | A wrong pin is a lost rider and cold food | Ola calls are spent here. No new call when the pin moved under 20 m |
| 2 | The map always opens, on a cheap phone too | A blank map means no order | Ola tiles. On a failure the next provider takes over by itself |
| 3 | "Do you deliver here?" at once | The first question | Own database, 0 calls, as today |
| 4 | The rider reaches the door | The 20 minute promise | The Google Maps link, as today: free, voice, traffic |
| 5 | A true ETA and a road line | A straight line lies when a river or a railway is in the way | Later: 1 Directions call for an order |
| 6 | Search for a landmark by typing | Dragging the pin does the job | Own table. Ola autocomplete only if people get stuck |
| 7 | A pretty style, 3D, satellite, turn by turn inside our app | No effect on an order | Not built |

### The design in short

- One switch for the whole provider. A `settings` row holds `ola`, `osm`, and later `google`. The app reads it live, the way `otpSwitch.ts` reads `otp_login_on`. A change in admin reaches every open app on its next map open. No deploy. The switch changes the full set: the map picture, pin to words, and later the route.
- The map layer. The Leaflet screens stay. Ola's vector style is drawn inside Leaflet with `@maplibre/maplibre-gl-leaflet` (radar run of 14 Nov). The three map screens use one component.
- The server layer. Pin to words and the route sit behind our edge functions, one adapter for each provider. The `geocode` function already holds the seed: a provider setting and a monthly counter.
- The key pool. One row for each key: provider, account label, on or off, calls this month for each API. The count is our own, since Ola shows no usage API (0.7). Alert the admin at 70 percent. At 90 percent, or on a 401 or 429 from Ola, the next key takes over; with no key left, the next provider; then our own tables. A saved key can never be read back. Only its last 4 letters show.
- The admin "Maps" block. Pick the provider with one tap. See a meter for each key, such as "7,200 / 1,00,000". The Google row does not show until its adapter exists (a control that changes nothing must not reach prod).

### Ways to keep the cost down

1. No new Ola call when the pin moved under 20 m. A saved address costs 0 calls.
2. The tracker map opens only on a tap (as today).
3. Route: 1 call at pickup and the same line for the whole trip. A new call only when the rider is over 150 m off the line, at most 3 for an order.
4. Search and "do you deliver here" stay on our own tables.
5. An Ola answer is never kept in a table of ours and never cached by place (Ola terms, as noted in `geocode/index.ts`). So the saving comes only from fewer calls.

### Findings of 14 Nov 2026

| Claim | What the evidence says | Tier | Conf | What it changes for us |
|---|---|---|---|---|
| Free allowance is per API | "Your first 100,000 calls per API are included each month" (rate card, effective 1 Sept 2026) | A, vendor | 0.9 | Each of reverse geocode, map loads, directions and autocomplete has its own 100,000 |
| Map tiles are billed for each load | Dynamic Maps ₹0.141 a load above the free tier: "Each time a map is loaded in your application counts toward usage". Tiles are not a line on the rate card | A, vendor | 0.6 that our use counts this way | Test E-OLA-3 before the tiles go to prod |
| Per-minute limits | Fair Usage Policy (updated 28 Aug 2026): Reverse Geocoding 2000, Autocompletion 2000, Directions 2000, Direction Basics 1000, Vector Tiles 3000, Static Tiles 80 | A, vendor | 0.9 | No limit is near our load. Static tiles are not a path for us |
| What Ola may do on misuse | "limiting or suspending your access to our APIs, terminating your account, or taking legal action" (Fair Usage Policy); "Ola may suspend, limit, or throttle access" on misuse or a breach (Platform Terms, section 7) | A, vendor | 0.9 | The pool must survive one account going dark |
| Several accounts or several keys | No clause on it was found in the Platform Terms (sections 3, 6, 7, 11, 15) or the Fair Usage Policy. Section 3 asks for "true, correct and complete information" at sign-up. Whether the free allowance is for an account or for a key is not on the pages | A, vendor | 0.6 that it is not forbidden; 0.5 on account or key | Test E-OLA-4. One line of risk in the ADR |
| No usage API | The docs show a credit balance and low-credit alerts on the account page only | A, vendor | 0.7 | The meter is our own counter |
| Ola credit line | "Attribution must be to 'Ola Maps'", with a link that shows the ODbL credit (Platform Terms, section 15) | A, vendor | 0.9 | The credit goes on every Ola map. The OpenStreetMap name stays in the credit, since Ola's map is built on OSM data |
| Mixing Ola content with other data | Section 6.a.VIII: other content may be layered with Ola content for display when the origin of each can be told apart and credited | A, vendor | 0.8 | One provider for the whole set is the clean way |
| A wrong key | `401 {"message":"Unauthorized"}`; no key: `401 {"message":"No credentials provided"}` | S, 14 Nov 2026 | 0.9 | The auto-switch listens for 401 and 429 |
| The vector style path is live | `/tiles/vector/v1/styles/default-light-standard/style.json` answers 401 with no key, not 404 | S, 14 Nov 2026 | 0.9 | A raster path for plain Leaflet was not found; the map needs a vector renderer |
| Google, India prices | Free each month: Dynamic Maps 70,000; Geocoding 70,000; Autocomplete 70,000; Compute Routes Essentials 70,000; 2D Map Tiles 700,000 | A, vendor | 0.9 | Google fits the same adapters later |
| Google answers only on a Google map | The terms page could not be read on 14 Nov | - | 0.7, from memory | Read it before any Google work |
| The public OSM tile server on prod | "Commercial services … should be especially aware that access may be withdrawn at any point" (OSMF tile policy) | A | 0.9 | Prod must leave it. This is step 1 |

Motive check: Ola and Google sell credits, so their price pages are true for the price and silent on what happens at the edge. The OSMF sells nothing and says plainly that it may cut us off.

### The order of work

| Step | What | Done when |
|---|---|---|
| 0 | Three tests on dev: E-OLA-2 (the Ola map on a cheap phone), E-OLA-3 (what Ola counts), E-OLA-4 (one meter or two) | The answers are in `experiments.md` |
| 1 | The Ola map on the three screens, the provider switch in admin, the Ola credit. The public OSM server leaves the prod default | Seen right on prod |
| 2 | The key pool, the meter, the alert, the auto-switch | Seen right on prod |
| 3 | The road line and the road ETA | Seen right on prod |
| 4 | The Google adapter | Only on the owner's ask |

Sources, read 14 Nov 2026: maps.olakrutrim.com/pricing and /pricing/details (vendor); Ola Fair Usage Policy and Platform Terms of Use PDFs (vendor); developers.google.com/maps/billing-and-pricing/pricing-india (vendor); operations.osmfoundation.org/policies/tiles; github.com/maplibre/maplibre-gl-leaflet.

## The owner's reply and what changed (14 Nov 2026, later, reviewer)

Owner, 14 Nov 2026, after reading the plan: "I don't see the tracker anywhere in the application." He asks if a real-time live location map is needed at all for a 15 minute delivery, or if he can share "the latest location of the driver with the user by just giving like a Google map link". "If that will be like a free but viable solution, probably let's go for it. But I need all of this to be … easily configurable in the admin dashboard." On keys: "as soon as even one API key returns 401, we switch to the other API key automatically." He also asked if the names of Ola Maps and OpenStreetMap must be on the map, and why we put them. He is still deciding if the promise is 15 minutes, not 20 or 30.

### Why the owner does not see the tracker (code on `dev` at ffc901c, Tier S)

The tracker is a row on the order screen ("<rider> is 400 m away · On the map"). A tap opens the full-screen live map (`PlacedScreen.tsx`, `RiderMapScreen.tsx`, story 1053). The row shows only when all four are true (`App.tsx`, `riderTrack`):

| Condition | Where it comes from |
|---|---|
| The order is on the way | The rider tapped pick up |
| The rider's phone has sent a place | `rider_ping`, every 30 s, only while the rider app is open, Online and allowed to read the location (`RiderGate.tsx`) |
| The kitchen has a saved map location | The admin kitchen pin |
| The customer's pin code has a point | `pin_points` |

With one missing the row is not there and nothing says why. The customer then sees only "<rider> is bringing your order" and Call.

Three additions from the coder's read (PR #1499, dev at ffc901c):

- A fifth condition hides in two of the four. The kitchen point and the "You" point come from the app's present Deliver-to place (`App.tsx` lines 804 to 811), not from the order. So the present place must still be served and be the order's place. This has the same root as bug #1497; one fix covers both.
- The rider app sends a place only when the browser gives a new position, at most once in 30 s. A refused location permission fails with no word, so the rider is not told.
- A stale place has no age rule today. The 3 minute rule of story #1498 adds one.

- The row has run only in automated tests with made-up data. It was not seen on a real phone by the reviewer. Why the owner did not see it is a guess (0.6): the rider's phone sent no place during his tests. A prod read would settle it; it needs his yes.
- The rider app is a web app. When the rider opens Google Maps to navigate, our app goes to the background and the pings may stop (0.7; phone test P1 in `docs/tests/phone-test-list.md` is not run).
- The distance is measured to the pin code's point, not to the customer's door (`readPinPoint`). Bug #1497.
- The first plan said "the tracker opens only on a tap". That was true and not enough: it did not say the row can be missing.

### Does a 15 minute delivery need a live map (reviewer's view)

On a 15 minute promise the rider is on the road for about 4 to 7 minutes. What the customer needs, most first: the minutes left, if the food has left, a call to the rider. All three exist and none needs the rider's place. "Where exactly is he" comes last.

| Way | What the customer gets | Cost | Weak point |
|---|---|---|---|
| A. No place | The minutes, the status, Call | 0 | None. It always works |
| B. A Google Maps link, "Rider kahan hai" | Google Maps opens with the route from the rider's last place to the door, and Google's minutes | 0. "You don't need a Google API key to use Maps URLs" (Google, Tier A, 0.85 that it stays free) | It leaves our app. The place is one picture in time, not live |
| C. The live map in the app (built) | A dot that moves every 30 s | Map tiles: the public OSM server today, Ola map loads later | The heaviest. It hangs on the tiles |

B and C both need the rider's pings, so both stop when the pings stop.

The pick, on the owner's words ("free but viable … let's go for it"): B is the default. Two rules keep it true: the row says how old the place is ("2 min pehle"), and a place over 3 minutes old shows no row. C stays in the code behind the same admin switch, off. We count the taps on the row for two weeks. The live map opens again only if that count says people want it. Story #1498. Test E-LINK-1.

### The 401 rule for keys (owner, 14 Nov 2026)

1. Pin to words goes through our server. On a 401, 403 or 429 from Ola the key is marked failed (the code and the time), the next key is used in the same request, and the admin gets an alert. The customer sees nothing.
2. Ola's login token grows old in normal use and that also gives a 401. So the function first gets a new token once. Only a second 401 marks the key failed. Without this, good keys would drop out every hour.
3. A map tile key lives in the browser. On a 401 the app tells our server, gets the next key and draws again.
4. A failed key is tried again on the first day of the next month, or when the admin taps "Try again".
5. The counter stays, for the meter and the alert at 70 percent.
6. A timeout or a 5xx is not a key failure. It is one retry, then the next provider.

### Must the names be on the map (Tier A, read 14 Nov 2026)

| Claim | What the page says | Tier | Conf | What it changes for us |
|---|---|---|---|---|
| The OSM credit is a must | "If you want to use OpenStreetMap data in something you create and distribute, you must attribute OpenStreetMap." The licence is the ODbL (OSMF Attribution Guidelines, adopted 25 June 2021, last edited 10 Sept 2026) | A | 0.9 | The credit is a licence term, not a design choice |
| Where it goes | "the credit should typically appear in a corner of the map"; it "may be placed adjacent to the map or on a splash screen or pop-up"; it "should not require individuals to interact with the map" | A | 0.9 | A corner or right beside the map. Not only in About |
| It may fade | "automatically after five seconds", on a map move, or on dismiss. Then the licence must still be found, for example an "(i)" button or an About entry | A | 0.9 | Allowed. We keep one small line that stays: less code |
| The shortest words | "Attribution must be to 'OpenStreetMap'"; "© OpenStreetMap" is acceptable; a link to openstreetmap.org/copyright is one way to show the licence | A | 0.9 | "© OpenStreetMap" in place of "© OpenStreetMap contributors" |
| A rule for phones or small screens | Not on the page. Size limits are for static images only | A | 0.8 | No way out for a phone |
| No credit: what happens | The pages name no penalty. The guidelines say the legal text rules | A | 0.6 | The credit is the condition for using the data |
| The Ola credit is a must | "You agree to prominently display attribution to Ola within any application or product that incorporates or uses the SDK, maps, API, or data. This attribution must be visible to end-users"; "Attribution must be to 'Ola Maps'"; notices inside the map "must remain visible" (Platform Terms, section 15) | A, vendor | 0.9 | One line on every screen that uses Ola |
| One name can do both jobs | The ODbL part "may be done by making the text 'Ola Maps' a link to openstreetmap.org/copyright" (same section) | A, vendor | 0.9 | After the Ola map is in: one name, "Ola Maps", linked |
| Ola's docs on a logo | No attribution or logo page was found in the docs index | A, vendor | 0.6 | The terms are the rule |

Today the pin screen shows two names, "Ola Maps · © OpenStreetMap contributors", because the map picture is from OSM and the words are from Ola. With the Ola map there is one name. With the Google Maps link in place of the tracker map there is no map on that screen, so no name there.

### The Ola browser key is bound to the prod domain (coder, 14 Nov 2026, Tier S)

One probe each for the style file with the key from the vault (the key not printed): no Origin gives 403 "Domain is not allowed."; `http://localhost:5173` gives 403; the prod app's domain gives 200. So E-OLA-2 cannot run on localhost or on the dev app until the owner adds those domains on the Ola dashboard, or makes a second key for them.

### The admin "Maps" block

1. Map provider: Ola or OpenStreetMap.
2. Rider location for the customer: off, Google Maps link, live map.
3. Keys: a meter and a state for each key; the next key by itself on a 401.

### The order of work, changed

| Step | What | Done when |
|---|---|---|
| 0 | Tests: E-OLA-2, E-OLA-3, E-OLA-4, E-LINK-1, and phone test P1 (pings in the background) | The answers are in `experiments.md` |
| 1 | The admin "Maps" block with the rider location choice and the Google Maps link (#1498), the door distance fix (#1497) | Seen right on prod |
| 2 | The Ola map on the pin screens, the provider switch, one credit name | Seen right on prod |
| 3 | The key pool, the meter, the alert, the 401 rule | Seen right on prod |
| 4 | The road line and the road ETA | Seen right on prod |
| 5 | The Google adapter | Only on the owner's ask |

Step 1 moved first: it is small, free, and does not wait for the Ola tests.

## The rider's place, end to end, and the pin lookup (14 Nov 2026, afternoon, reviewer)

Owner, 14 Nov 2026: "when user … sets the pin, that is the exact coordinate where we have to deliver" and "the rider should always see" that point. The customer "should see … the last location of the driver with the time last updated at". In place of hiding an old place: "last updated at ho". On the pin screen: showing the address "every time the pin stops on the map is also a waste of credits"; the address matters only "when he is clicking on the current location".

### Two different things called "pin"

- The map pin: the point the customer sets on the map. It is saved on the address and goes with the order as `orders.drop_lat`, `drop_lng`.
- The postal code's point: a table `pin_points` with one point for a 6 digit postal code. Earlier text in this file called it "the pin code point".

### Where each point is used today (code on `dev` at ffc901c, Tier S)

| Place | Point used | Right |
|---|---|---|
| Saved with the order | The customer's map pin (`dropFor`, `App.tsx` line 938) | yes |
| The rider's Navigate button | The same pin (`RiderScreen.tsx` line 73) | yes |
| The server's delivery time | The same pin; the postal code's point only when the order has none (`refresh_order_tracking`) | yes |
| The customer's tracker row, "N m away" | The postal code's point, by the postal code the app holds now | no |
| The "Home" mark on the customer's live map | The postal code's point | no |

An order has no pin when the address was saved without one, or when the address words were changed by hand after the pin was set (story #910). Then the rider has no Navigate button.

### Why the tracker row does not show

`pin_points` is written only by two seed files (`0034_dream_city.sql`, `0037_wok_house.sql`): 26 postal codes, all starting with 110. For any other postal code "You" is empty and the row cannot show.

Counts on goserve-dev (coder, 14 Nov 2026, counts only): `pin_points` 26 rows, all 110. Orders of Nov 2026: 16; 6 with a drop point, 10 without. 15 of the 16 have a postal code with no row in `pin_points`. Only 1 order has both points; they are 200 m apart. Prod was not read.

### The time on the row is not the time of the place

`order_tracking.updated_at` is set to now on every refresh, also on a status change. The place is `riders.lat`, `lng`: the rider's last ping of any age. So a place from an hour ago can show as "updated just now" at pick up. A refused location permission on the rider's phone fails with no word (`RiderGate.tsx`).

### Pings stop when the rider app is not in front

| Claim | Evidence | Tier | Conf |
|---|---|---|---|
| The rider app sends a place only inside a `watchPosition` callback, at most once in 30 s. No wake lock, no background work | `RiderGate.tsx` line 33, `rider.ts` | S | 0.95 |
| A hidden page gets no positions | W3C Geolocation, Candidate Recommendation Draft of 5 Nov 2026: "Position updates are exclusively for fully-active visible documents"; otherwise they "get silently 'dropped on the floor'" | A | 0.9 that the standard says so |
| Chrome follows this on a desktop | Test E-GEO-1: 0 of 8 moves reached a hidden tab; delivery came back when the tab was in front | S | 0.9 for desktop Chrome |
| Chrome may also freeze a hidden page | Chrome Page Lifecycle page (updated 16 Oct 2026): hidden tabs are frozen "at their discretion"; frozen means "JavaScript timers and fetch callbacks don't run". No time limit and no Android rule on the page | A, vendor | 0.8 |
| The same holds on an Android phone | Not tested. E-TWA-1 is the test (kit ready since 25 Oct) | - | 0.8, a guess from the three rows above |
| One rider on dev: 16 pings in 24 hours, longest gap 31,094 s | `scripts/rider_gap.py dev --minutes 1440` (coder) | S | Dev is test use, not a shift |

On a real delivery this means: the rider taps pick up with our app open (a fresh place, at the kitchen). He opens Google Maps to ride; our app is hidden; no place is sent. At the door he opens our app; one place is sent. A "live" map can show two places: the kitchen and the door. A link to the rider's last place (story #1498) will mostly show the kitchen, with the true time. A place from the road needs the rider's Android app with a foreground service (#252, ADR-020).

### The pin screen: a lookup on every rest

Today (`PinMapScreen.tsx`, `settle`): each time the pin rests more than 1 m away, after 400 ms, the app asks our server if we deliver there, asks Ola for the words and the postal code (one Ola call), then asks our server again with Ola's postal code. The server decides by postal code, so Ola's answer is not only for show. Search is on the map, runs on Enter and reads our own table.

The new rule (story #1500): an Ola call only on a tap, never when the pin rests.

| The customer | Ola calls | The card shows |
|---|---|---|
| Moves the map and rests the pin | 0 | "Pin on the map", the area and postal code from our own table, the deliver yes or no |
| Taps Current Location | 1 | The address |
| Picks a search result | 0 | That result's name |
| Taps Confirm | 0 | The pin's exact point is the drop point |
| Taps Confirm where our table says "not served" | 1 | Ola's postal code settles it before the customer sees a no |

The last row is the reviewer's addition: our own table can give a false no at a postal border, and a false no is a lost customer. The estimate for reverse geocode at 100 orders a day falls from about 7,200 to about 1,400 calls a month, and each call now hangs on a tap, so moving the map cannot use up the free calls.

Open: search by landmark needs Ola autocomplete (its own free 100,000). Test E-SEARCH-1 first.
