*8 Nov 2026. This is the owner's local survey format: the sheet, the ChatGPT prompt, where the rows go, and map provider prices.*

# Local survey: the sheet, the prompt, and where the data goes

Owner's plan (8 Nov 2026): walk the town, speak or type fast into ChatGPT, get rows out, and have them land in GoServe and in OpenStreetMap. This page is the format. Grade-5 English.

## 1. The sheet (one row per thing)

Make a Google Sheet with these columns, in this order. Fill what you know; leave the rest blank.

| Column | What goes in | Example |
|---|---|---|
| `kind` | one of: `shop`, `house`, `landmark`, `street`, `village`, `kitchen`, `pin_area` | `shop` |
| `name` | the name on the board | `Sharma Kirana Store` |
| `name_hi` | the Hindi name, if the board is in Hindi | `शर्मा किराना स्टोर` |
| `house_no` | house or plot number | `C-128` |
| `street` | road or lane name | `Satai Road` |
| `locality` | colony, mohalla, area | `Green Avenue Colony` |
| `town` | village or town | `Chhatarpur` |
| `district` | district | `Chhatarpur` |
| `state` | state | `Madhya Pradesh` |
| `pin` | six digits | `471001` |
| `lat` | from the phone, 6 decimals | `24.901234` |
| `lng` | from the phone, 6 decimals | `79.589012` |
| `phone` | if on the board | `9876500011` |
| `hours` | plain words | `9 am to 9 pm, closed Tuesday` |
| `what` | what the shop sells, or what the landmark is | `grocery` / `temple` / `bus stand` |
| `photo` | the photo file name or link | `IMG_2041.jpg` |
| `notes` | anything else, free text | `next to the Shiv Mandir gate` |
| `source` | always `survey` | `survey` |
| `surveyed_on` | the date | `2026-11-09` |
| `surveyed_by` | your name | `Satvik` |

Rules:
- `lat`,`lng` must come from the phone at the spot. ChatGPT cannot read your GPS. Use the iPhone Compass app (it shows coordinates at the bottom) or the Maps app (drop a pin, share, copy). Paste them into the row.
- Never copy anything from Google Maps or any other map. Only what you see and know. This keeps the OSM licence clean.
- One row per thing. A street is its own row (`kind=street`), each shop on it is another row.

## 2. The prompt for ChatGPT (paste this once, then dictate)

```
You are my survey clerk. I am walking around my town and will type or speak fast, unorganized notes about shops, houses, streets, landmarks and pin codes. After each note, turn it into rows of this CSV, one row per thing, and nothing else:

kind,name,name_hi,house_no,street,locality,town,district,state,pin,lat,lng,phone,hours,what,photo,notes,source,surveyed_on,surveyed_by

Rules:
- kind is one of: shop, house, landmark, street, village, kitchen, pin_area.
- Keep names exactly as I say them. Do not translate. Put a Hindi name in name_hi only if I give it.
- Leave a field empty if I did not say it. Never guess a pin code, a phone number or coordinates.
- If I paste coordinates like "24.901234, 79.589012", put them in lat and lng of the row I am talking about.
- source is always "survey". surveyed_on is today's date. surveyed_by is "Satvik".
- If a note is unclear, add the rows you can and ask me one short question at the end.
- Keep a running list; when I say "export", print all rows so far as one CSV block.
```

## 3. Where the rows go

1. **GoServe first (same day).** You share the sheet. A script reads it and seeds two tables: `pincodes` (pin, lat, lng) and `places` (the rest). The customer address step, the pin fallback (#987) and the rider map use them at once. This is the product path; it does not depend on anyone else.
2. **OpenStreetMap, the right way.** Two options:
   - **Every Door app** (iOS 13+, free): you tap the spot on the map, add the shop or address with its tags, and it uploads under your own OSM account, with your GPS. No script, no approval, licence clean because you surveyed it. This is what mappers use for exactly your walk. Do this on the walk itself, and the sheet becomes the backup.
   - **A script from the sheet** (bulk upload) is an "import" in OSM's rules: a wiki plan, community discussion on the forum, a 14-day wait, a separate `_Import` account. Skipping that gets the upload reverted and the account at risk. For a few hundred rows in one town, Every Door or the iD editor by hand is faster than the paperwork.
3. **Does it help?** Yes, in this order: our tables fix the pin and address for your customers now; OSM edits make the base map and the reverse lookup better for everyone over weeks (Nominatim re-reads edits in minutes to days; map tiles redraw in hours to days).

## 4. Map providers, prices as their pages say them (read 8 Nov 2026, Tier A vendor pages)

| Provider | Reverse geocoding | Map loads / tiles | Free each month |
|---|---|---|---|
| OpenStreetMap + Nominatim + our tables | ₹0 | ₹0 (tile usage policy: light use, credit shown) | all |
| Ola Maps (India, ₹) | free to 100K, then ₹0.099 per request (about ₹99 per 1,000), ₹0.025 above 5M | ₹0.141 per map load above 100K (about ₹141 per 1,000) | 100,000 calls per API |
| Mapbox (USD) | temporary geocoding free to 100K, then $0.75 per 1,000; permanent $5 per 1,000 | map loads free to 50K, then $5 per 1,000 | 50K loads, 100K geocodes |
| Google Maps Platform | not stated on the page (only in their calculator) | not stated | "up to 70,000 free calls per product every month" |
| Mappls (MapmyIndia) | not stated | not stated | not stated |

What it means for GoServe at today's size: every provider is free at our volume. The reason to stay on OSM is not money; it is that our own survey data and tables make small-town coverage better than any vendor's, and nobody can switch it off or raise the price.
