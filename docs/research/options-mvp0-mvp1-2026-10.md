# Options — parts we need for MVP 0 and MVP 1

**Date read:** 13 Oct 2026. Tiers: **A** = the vendor's own page or a regulator, **C** = a blog or a rival vendor.
Conf = confidence from 0 to 1. A vendor page proves "they say so", not that it is true.
UNKNOWN = not found. Claims under 0.7 need a test before we budget on them.

---

## 1. Login and OTP for customers (MVP 1)

**Teach me.** An OTP is like the kirana uncle calling out your name before he hands over the parcel.
It proves the person owns that phone or email. In food delivery the phone matters most, because the
rider calls the customer at the gate. Email and Google login are free "shouts". WhatsApp costs about
12 paise a shout, SMS about 25 paise, and Twilio about ₹11.

**Authenticator apps (like Google Authenticator)** are a second lock, not an ID check. You can only set
one up after you log in (you scan a QR code), and it does not prove your phone number. So: great for
staff, kitchen and ops accounts; wrong for a new customer's first login.

| Option | What you get free | Cost at our volume | Limits / catch | Lead time | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| Supabase Google sign-in | Free plan covers 50,000 monthly active users; social login included | ₹0 in MVP 1–2. Pro $25/mo includes 100,000 MAU, then $0.00325 per MAU | Needs a Google Cloud OAuth consent screen (owner has a Google Cloud account). Gives a verified email, not a phone | 1 day | A | 0.85 | https://supabase.com/pricing |
| Supabase email OTP + own sender | OTP itself free | Only the email sender's cost (section 2) | Built-in mail: 2 per hour, team addresses only, no SLA. With your own sender: 30 per hour by default, can be raised | 1 day | A | 0.9 | https://supabase.com/docs/guides/auth/auth-smtp |
| Supabase TOTP (authenticator) | "Free to use and enabled on all projects" | ₹0 | Phone-based MFA is paid ($75/mo); TOTP is free | Hours | A | 0.9 | https://supabase.com/docs/guides/auth/auth-mfa/totp |
| WhatsApp OTP (Meta Cloud API) | Free replies inside an open chat window; OTP templates are always paid | About ₹0.11–0.13 per OTP (blogs). ~₹400/mo at 1,000 users × 3 OTPs | Billed per message since 1 Jul 2025. India accounts move to INR billing by 31 Dec 2026. Needs a verified business account and an approved template | 1–2 weeks | A (rules), C (price) | 0.85 rules, 0.5 price | https://developers.facebook.com/docs/whatsapp/pricing |
| Twilio Verify (WhatsApp or SMS) | Trial only | $0.05 per check + India SMS $0.0832 → about ₹11 per OTP | Most expensive. Supabase's WhatsApp OTP works only through Twilio | 1–3 days | A | 0.8 | https://www.twilio.com/en-us/verify/pricing |
| SMS OTP via MSG91 | None listed | ₹0.25 per SMS (5,000 pack ₹1,250) | DLT registration needed for all business SMS in India: entity, then a 6-letter header, then each template | 1–3 weeks (DLT) | A (price), C (DLT detail) | 0.8 / 0.75 | https://msg91.com/in/pricing/otp |
| Firebase phone auth | Not on the free plan; needs pay-as-you-go | About $0.07 per SMS (blog) | Needs a billing account | 1–2 days | A (plan), C (price) | 0.8 / 0.45 | https://firebase.google.com/pricing |

**Recommendation.** MVP 0: role picker (no login). MVP 1: Google sign-in + email OTP with our own sender (₹0); TOTP for staff. MVP 2: WhatsApp OTP (about 50× cheaper than Twilio), after a test of the real price in Meta Business Manager. MVP 3: MSG91 SMS as backup. Start DLT paperwork early.

---

## 2. Email sender for OTPs and receipts (MVP 1)

**Teach me.** An email sender is the postman for one-to-one letters. Free ones carry 100 to 300 letters a day.
Amazon SES charges almost nothing per letter, but first checks we are not spammers. All need our own domain.

| Option | Free | Cost at our volume | Catch | Lead time | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| Resend | 100/day, 3,000/month, 3 domains | ₹0 in MVP 1; Pro $20/mo for 50,000 | Daily cap can block a launch spike | 1 day | A | 0.9 | https://resend.com/pricing |
| Brevo | 300/day | ₹0; paid from about $9/mo (blog) | "Sent with Brevo" sticker on free mail | 1 day | A, C | 0.75 | https://help.brevo.com/hc/en-us/articles/208580669 |
| Amazon SES | Credits for new AWS accounts | $0.10 per 1,000 emails (~$10 per 1 lakh) | Starts in a sandbox; production access needs a review | 1–3 days | A | 0.9 | https://aws.amazon.com/ses/pricing/ |
| Zoho ZeptoMail | First 10,000 emails free (credits last 6 months) | About $2.50 per 10,000 (reviews) | Transactional only; Indian company | 1–2 days | A, C | 0.7 | https://www.zoho.com/zeptomail/pricing.html |

**Recommendation.** MVP 1: Resend. MVP 2: Brevo or ZeptoMail if the daily cap bites. MVP 3: Amazon SES. India inbox rates are a test to run, not a fact.

---

## 3. Web push (MVP 1)

**Teach me.** Push is the shop bell ringing in your pocket. On Android it works at once. On iPhone you must first
put the shop's sticker on the home screen.

| Option | Free | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|
| Standard Web Push (VAPID keys, from our back end) | Free | Works on Android Chrome; on iPhone only after "Add to Home Screen" | A | 0.85 | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ |
| Firebase Cloud Messaging | "No-cost" | Ties us to Google; not needed for web push | A | 0.85 | https://firebase.google.com/pricing |
| iOS rules | Free | iOS 16.4+, installed to Home Screen, prompt only after a tap | A | 0.9 | WebKit (above) |

**Recommendation.** MVP 1: standard Web Push, no FCM. Many iPhone users will never install the app, so order updates that matter also go by WhatsApp from MVP 2.

---

## 4. Error tracking (MVP 1)

| Option | Free | Cost later | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|---|
| Sentry Developer | 1 user, 5k errors, 50 replays, 1 uptime monitor | Team $26/mo | One user only | A | 0.85 | https://sentry.io/pricing/ |
| GlitchTip (self-host) | Open source, works with Sentry tools | Server only | We run and patch it | C | 0.5 | — |

**Recommendation.** Sentry Developer in MVP 1–2. **Teach me:** Sentry is the CCTV that records the moment a customer trips, so we can fix the step.

---

## 5. Uptime checks (MVP 0 onward)

| Option | Free | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|
| UptimeRobot | 50 monitors, 5-minute checks, 1 status page | Pricing page says "hobby"; its terms (24 Jun 2026) say commercial use is allowed. We trust the terms; save a screenshot | A vs C | 0.7 | https://uptimerobot.com/terms/ |
| Better Stack | 10 monitors, 1 status page | Check interval not stated | A | 0.8 | https://betterstack.com/pricing |

**Teach me:** a neighbour who checks every 5 minutes that our shop shutter is still up, and calls us if not.

---

## 6. Domain and business email (MVP 1)

| Option | Free / price | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|
| Cloudflare Registrar | At cost (.com about $10.46/yr) | **Does not sell .in** | A, C | 0.9 / 0.7 | https://www.cloudflare.com/tld-policies/ |
| .in at an Indian registrar | About ₹500 the first year, ₹800 to renew (aggregator) | Watch the renewal jump | C | 0.6 | https://www.domainoffer.net/tld/in |
| Cloudflare Email Routing | Free forwarding (hello@ → Gmail) | Receive only; sending needs Resend | A | 0.75 | https://developers.cloudflare.com/email-routing/limits/ |
| Zoho Mail Forever Free | 5 users, 5 GB each, 1 domain | Web and app only (no IMAP) | A | 0.75 | https://www.zoho.com/mail/zohomail-pricing.html |

**Recommendation.** Buy the .in at an Indian registrar, DNS on Cloudflare (free). Receive with Email Routing, send with Resend. Also buy the .com at Cloudflare to protect the name.

---

## 7. Map tiles for the demo (MVP 0)

| Option | Free | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|
| OpenFreeMap | Free, commercial use "Yes", no key, no view limit | Run by one person on donations; no SLA. Credit line required (MapLibre adds it) | A | 0.8 rules / 0.5 long-term | https://openfreemap.org/ |
| MapLibre GL JS | Open source (BSD) | Only the map viewer | A | 0.85 | https://github.com/maplibre/maplibre-gl-js |
| MapTiler Free | 5k sessions/month | "Non-commercial" use only | A | 0.8 | https://www.maptiler.com/cloud/pricing/ |

**Recommendation.** MapLibre + OpenFreeMap for MVP 0–1. Self-host tiles or pay for an SLA by MVP 3.

---

## 8. Free food photos for the sample menu (MVP 0)

| Option | Licence | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|
| Unsplash | Free, commercial OK, no credit needed | Not for logos; faces, brands and art may need permission | A | 0.85 | https://unsplash.com/license |
| Pexels | Free, no credit needed | No endorsement implied; not in a trademark | A | 0.85 | https://www.pexels.com/license/ |

**Recommendation.** Photos with no faces and no brand packets. Keep each photo's source link in a list. Label them "sample".

---

## Not found, or contradicting

- Meta's exact India OTP rate in INR, Firebase's India SMS rate from Google, ZeptoMail INR price, .in INR checkout price, Zoho Mail Free in India.
- UptimeRobot: pricing page vs terms disagree on commercial use.
- Under 0.7 (test first): WhatsApp price, Firebase SMS price, India inbox delivery.
