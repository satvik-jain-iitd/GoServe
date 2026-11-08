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
