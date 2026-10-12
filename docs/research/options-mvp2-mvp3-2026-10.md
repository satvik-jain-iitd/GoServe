# Options — parts we need for MVP 2 and MVP 3

**Date read:** 13 Oct 2026. Tiers: **A** = the vendor's own page, **C** = a blog or a third party.
Conf = confidence from 0 to 1. A vendor page proves "they say so".
**Volume guesses (check before budgeting):** 4 map calls, 3 WhatsApp messages per order; average order ₹300;
MVP 2 = 500 orders a day; MVP 3 = 5,300 orders a day.

---

## 1. Payments (MVP 2)

**Teach me.** A payment gateway is the cashier who takes UPI for the shop. The cashier keeps about ₹2 from
every ₹100 and hands over the rest two days later. If the cashier rings the same sale twice, we must notice
and not cook two orders.

| Option | Free | Cost at our volume | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|---|
| Razorpay (account owned) | No setup fee; test mode with test webhooks | 2% per payment (UPI too, as a "platform fee"); UPI QR 0.99%; +18% GST on the fee. MVP 2 at ~₹45 lakh a month ≈ ₹90,000 + GST | Money arrives T+2 working days. Webhooks can repeat and come out of order: de-duplicate on `x-razorpay-event-id`, reply 2xx within 5 s | A | 0.75 | https://razorpay.com/pricing/ , https://razorpay.com/docs/webhooks/best-practices/ |
| Razorpay KYC | ₹0 | — | Proprietorship: any 2 of UDYAM, GST, Shop & Establishment, IEC, postpaid bill; plus PAN. **FSSAI is required for the food category** | A | 0.8 | https://razorpay.com/docs/payments/business-types-kyc-documents/ |
| Cashfree | No setup fee | 1.95% + taxes (festive 0% offer for new merchants) | UPI rates not clear on the page | A | 0.6 | https://www.cashfree.com/payment-gateway-charges/ |
| PhonePe PG | No setup or yearly fee | "1.99%" with conditions | Rates per method not clear | A | 0.4 | https://www.phonepe.com/business-solutions/payment-gateway/pricing/ |

**Recommendation.** Razorpay in test mode now. FSSAI first (needed for KYC and to sell food). Plan cash for T+2. Before MVP 2, ask Razorpay and Cashfree for a lower UPI rate — on paper, 2% is our biggest cost line.

---

## 2. WhatsApp order updates (MVP 2)

**Teach me.** A WhatsApp template is a printed bill slip that Meta checks once. Each slip then costs about
12 paise. If the customer messaged us first, slips for the next 24 hours are free.

| Option | Free | Cost at our volume | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|---|
| Meta Cloud API (direct) | Free inside the 24-hour window after the customer writes; utility templates free in that window | About ₹0.115 per utility or OTP message (blogs). MVP 2 ≈ ₹5,200/month; MVP 3 ≈ ₹55,000/month | Per-message billing since 1 Jul 2025; India moves to INR billing by 31 Dec 2026; rate update announced for 1 Oct 2026 | A (rules), C (price) | 0.8 / 0.5 | https://developers.facebook.com/docs/whatsapp/pricing |
| Interakt (Indian partner) | No free plan | ₹2,799/month + utility ₹0.150, OTP ₹0.128 per message | Plan fee alone is more than our MVP 2 message bill | A | 0.8 | https://www.interakt.shop/pricing |

**Recommendation.** Meta Cloud API direct, called from n8n (we already run bots there). Read Meta's INR rate card before budgeting.

---

## 3. SMS and DLT (MVP 2, start paperwork in MVP 1)

**Teach me.** DLT is the market association register. Every shop that hands out printed slips must list its name
and slip design first. About ₹6,000 once; then each SMS costs about 20 paise.

| Option | Free | Cost | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|---|
| DLT registration (Jio, Airtel, Vi portals) | — | About ₹5,000–10,000 one time (guides disagree) | PAN, business proof, authorisation letter. Entity approval about 2–7 working days, then templates | C | 0.5 | vendor help pages (Exotel, Infobip, Fast2SMS) |
| MSG91 | — | ₹0.25 per SMS at 5k, ₹0.18 at 30k, + 18% GST | Works with Supabase phone login | A | 0.8 | https://msg91.com/in/pricing/sms |
| Fast2SMS | — | ₹0.11–0.25 | "Quick SMS" skips DLT via an international route — avoid for OTP | A | 0.7 | https://www.fast2sms.com/ |
| Twilio | — | $0.0832 per SMS (~₹7) | About 30× Indian providers | A | 0.85 | https://www.twilio.com/en-us/sms/pricing/in |

**Recommendation.** Start DLT during MVP 1. MSG91 for SMS. Never Twilio for India SMS.
*Note: one researcher suggested phone OTP via MSG91 already in MVP 1. We keep Google + email OTP for MVP 1 (₹0, no DLT wait) and add phone OTP when DLT is done.*

---

## 4. Maps, distance and addresses (MVP 2–3)

**Teach me.** Asking Google "how far is this house?" is like calling a delivery boy who knows every lane. The first
70,000 calls a month are free. Running our own map engine (OSRM) is drawing our own lane map on the wall: free to
use, but we must keep it up to date.

Volume: MVP 2 ≈ 60,000 calls a month; MVP 3 ≈ 636,000.

| Option | Free | Cost at our volume | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|---|
| Google Maps (India prices) | 70,000 a month each for route matrix, routes, geocoding, maps, autocomplete (Essentials) | MVP 2: $0. MVP 3 ≈ $850/month | Matrix bills per origin × destination pair | A | 0.85 | https://developers.google.com/maps/billing-and-pricing/pricing-india |
| Ola Maps (Krutrim) | 100,000 a month per API | MVP 2: ₹0. MVP 3 ≈ ₹53k–1.07 lakh/month | New prepaid pricing from 1 Sep 2026; free tier shrank from 2024 | A | 0.75 | https://maps.olakrutrim.com/pricing |
| Mappls (MapmyIndia) | "Start for free" (no numbers) | Sales only | Opaque | A | 0.3 | https://about.mappls.com/api/ |
| Self-hosted OSRM (our ARM box) | Free | ₹0 per call | India extract 1.6 GB; our estimate ~3–4 GB RAM to run, ~11 GB to prepare. Use all-India (Noida and Ghaziabad are in UP) | A + our math | 0.55 | https://github.com/Project-OSRM/osrm-backend/wiki/Disk-and-Memory-Requirements |

**Recommendation.** MVP 2: Google India SKUs (inside the free 70k), Ola as backup. MVP 3: OSRM on our box for distance; Google only for addresses. Test OSRM RAM on the box first.

---

## 5. Rider app wrapper (MVP 2)

**Teach me.** A TWA puts our web app inside a Play Store shell. It is still the same shop. When the shutter is down
(app in the background), nobody inside can shout the rider's location.

| Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| Google Play developer account | US$25 one time. New personal accounts must run a closed test with 12+ testers for 14 days first | A | 0.9 | https://support.google.com/googleplay/android-developer/answer/14151465 |
| TWA (Bubblewrap, PWABuilder) | Free tools. **No background location** — a TWA is still a web page. True background GPS needs a small native Android service | A (W3C) + inference | 0.75 | https://github.com/w3c/geolocation-api/issues/74 |

**Recommendation.** MVP 1–2: plain PWA, screen stays on during a trip. If screen-off tracking becomes a must, plan a small native shell (write an ADR) and recruit the 12 testers early.

---

## 6. Laya on our ARM server (MVP 2)

| Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| Install and serve | `pip install laya` (Python 3.10+); `[serve]` gives `laya-serve` on port 8000 with `POST /v1/systemone` and `GET /health` | A | 0.85 | https://github.com/NandhaKishorM/laya |
| ARM64 | Dockerfile says CPU on AMD64 and ARM64; no ARM test recorded | A | 0.7 | repo Dockerfile |
| RAM and speed (Intel CPU test) | ~2.3 GB RAM per model; multilingual 48 ms per question, English 113 ms; ONNX fp32 1.48× faster; INT8 2.9× faster but shifts scores up to 0.16 | A | 0.7 | LOCAL_SETUP.md |

**Recommendation.** Docker CPU image on the ARM box, one model, 4 threads. Benchmark there first. Skip INT8.

---

## 7. Supabase Pro vs self-host (MVP 3)

| Option | What you get | Cost | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|---|
| Free | 500 MB, 200 live connections, 2M messages | $0 | Pauses after 1 week idle; no backups | A | 0.9 | https://supabase.com/pricing |
| Pro | $25/mo (incl. $10 compute credit): 8 GB, 500 live connections, 5M messages, daily backups (7 days), 100k MAU | MVP 3 ≈ $35/mo (+$10 per 1,000 extra connections; $2.50 per extra 1M messages) | Spend cap on by default (stops instead of billing). Micro compute may be small at MVP 3 — load test | A | 0.85 | https://supabase.com/pricing |
| Self-host (Docker) | Free software | Box only | 8 GB+ RAM and 4 cores recommended; we own backups and upgrades | A | 0.8 | https://supabase.com/docs/guides/self-hosting/docker |

**Recommendation.** Free while within limits; Pro with the cap on when the trigger fires (one researcher suggests at MVP 2 already, for backups and no pausing). Self-host only if Pro bills hurt.

---

## 8. Cloudflare protection (MVP 1–3)

| Item | Free plan | Tier | Conf | Source |
|---|---|---|---|---|
| Rate limiting | 1 rule, per IP, 10 s window | A | 0.9 | https://developers.cloudflare.com/waf/rate-limiting-rules/ |
| Bot Fight Mode | Free, whole domain, cannot be skipped; may challenge API or app traffic and webhooks | A | 0.85 | https://developers.cloudflare.com/bots/get-started/bot-fight-mode/ |
| Turnstile | Free, 20 widgets, unlimited checks | A | 0.85 | https://developers.cloudflare.com/turnstile/plans/ |

**Recommendation.** Turnstile on signup and OTP; the one rate rule on the OTP path. Keep Bot Fight Mode off until tested against Razorpay webhooks and the rider app.

---

## 9. Load testing (MVP 2 gate)

| Option | Free | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|
| k6 (open source) | HTTP and WebSockets | Supabase tests its own Realtime with k6 (up to 32,000 users); we script the join messages | A | 0.85 | https://supabase.com/docs/guides/realtime/benchmarks |
| Artillery | WebSocket engine | Open-source vs paid parts unclear | A | 0.6 | https://www.artillery.io/docs/reference/engines/websocket |

**Recommendation.** k6. Test 700 live sockets plus the order API before MVP 3.

---

## Still open

Meta's INR rates (CSV not readable), Mappls prices, OpenRouteService limits, Gupshup/AiSensy fees, DLT fees per operator, whether Razorpay's UPI fee can be negotiated, OSRM and Laya on ARM (test on the box).

---

## MVP 4 (vision only, not researched in depth)

Native apps by wrapping the same code (Capacitor or a native shell), a database per region, a real event queue,
a data warehouse, and Laya trained per city. We research these only when MVP 3 is live and funded.
