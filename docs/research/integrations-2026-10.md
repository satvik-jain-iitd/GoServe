# Integrations: one pick for each need (story #196, H13)

Date of this research: 2026-10-29. One table, then the proof. Older long notes stay where they are:
[options-mvp2-mvp3](options-mvp2-mvp3-2026-10.md) (payments, SMS), [operations-tech-deep](operations-tech-deep-2026-10.md) (push, analytics), [founder-checklist](../product/founder-checklist.md) (the owner's clicks).

## How to read the tiers

- **A**: the seller or platform says it about itself. Good for "this is what they charge". Not good for "this is best for us".
- **C**: a blog, a comparison site, a competitor. A price from a Tier C page alone never decides anything.
- Every source has a motive. Ask: what do they gain if I believe this? A competitor's comparison page lists a rival's price to sell its own.
- Confidence is 0 to 1. Under 0.7 means a test or the seller's quote comes before any money moves.

## The table

| Need | Pick | Cost | Date | Tier | Confidence | Sources |
|---|---|---|---|---|---|---|
| Payments gateway | Razorpay (the account exists). Test mode now. Cash stays. | 2% per payment on UPI and cards, plus 18% GST on the fee. No setup fee, no yearly fee. About Rs 47.20 on a Rs 2,000 UPI sale for the fee with GST. | 2026-10-29 | A, C | 0.75 | https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/ (A, their own page); https://pricingsaas.com/companies/razorpay/diffs/2026W14 (C: says the page moved to US prices, India rate not confirmed) |
| SMS code (OTP) | MSG91, after the DLT registration. Until then the fixed test code 123456 (#665). | About Rs 0.13 to 0.25 per SMS plus 18% GST. DLT registration is one time, guides say Rs 5,000 to 10,000. | 2026-10-29 | A, C | 0.6 | https://msg91.com/in/pricing/sms (A, earlier note); https://msg91.com/help/all-service-deductions- (A, no rupee price); https://www.messagecentral.com/blog/sms-otp-pricing-india (C, a competitor) |
| Push | Web push with our own VAPID keys today. FCM for Android and APNs for iPhone when the apps ship. | Rs 0 for all three. | 2026-10-29 | A | 0.85 | https://firebase.google.com/pricing (A); the VAPID code is ours (S) |
| Maps and address lookup | Address from "Use my location": Nominatim, one call per customer. Tiles: none in the app yet. When the rider map (#691) ships, MapTiler Flex, not the free OpenStreetMap tile server. | Nominatim: Rs 0, 1 request a second, a cache proxy before many customers (F278). MapTiler free plan is for non-commercial use only; Flex is US$25 a month with 500,000 requests. | 2026-10-29 | A | 0.7 | https://operations.osmfoundation.org/policies/tiles/ (A: heavy use needs permission, no number given); https://www.maptiler.com/cloud/pricing/ (A); https://www.maptiler.com/cloud/terms/ (A) |
| Product analytics | PostHog EU cloud, dev only for now (#207). | Free up to 1 million events a month. After that about US$0.00005 an event. | 2026-10-29 | A | 0.8 | https://posthog.com/pricing (A); startup credits note: [operations-tech-deep](operations-tech-deep-2026-10.md) |
| Uptime monitor | UptimeRobot on `/functions/v1/health` (the owner's click, F287). Check its terms first. | Free plan: 50 monitors, 5 minute checks. | 2026-10-29 | A, C | 0.5 | https://uptimerobot.com/pricing/ (A: the plan); https://notifier.so/guides/uptimerobot-pricing-2026/ (C: says the free plan is non-commercial since Oct 2024); https://www.host-tracker.com/en/blog/uptimerobot-alternative (C, a competitor) |

## What is true today in our code

- Payments: the seam is `supabase/functions/payments` and `app/src/lib/payGateway.ts`. The gateway is a placeholder until the owner's KYC.
- OTP: `supabase/functions/otp` with the fixed code on dev and prod. A real sender is one function.
- Push: `supabase/functions/push`, the web push queue (0045, 0047) and `ops/n8n`. FCM and APNs files are named and empty.
- Maps: `app/src/lib/locate.ts` calls Nominatim. No tile map yet.
- Analytics: `app/src/lib/analytics.ts`, six events, off unless a key is set.
- Uptime: nothing yet.

## What we could not settle (so it stays a hypothesis)

- Razorpay: the page may have moved to US prices. Ask Razorpay for the India rate in writing before the KYC click.
- MSG91: the rupee price is on no official page we could read. Ask for a quote. The DLT fee differs by guide.
- OpenStreetMap: the policy gives no number for "heavy". A consumer app on the public tile server is the case it names, so we do not plan on it.
- UptimeRobot: the non-commercial rule is reported only by Tier C pages. Read its terms before the click. If it is true, a second pick is needed (a Cloudflare scheduled check with a Telegram alert).
- PostHog: paid rates differ by page. Free is enough for the pilot.

## Tests that would settle them

1. Razorpay: one written quote, then compare with 2% plus GST. Decision: if above 2.5%, ask Cashfree for a rate.
2. UptimeRobot: read the terms on the day of the click. Decision: commercial use not allowed means use the second pick.
3. Maps: count tile requests of the rider map in a one-week pilot on MapTiler's free plan on dev. Decision: over 100,000 requests means Flex.

## 2026-11-13: can Razorpay tell us at once that a door payment came? (owner's question)
Question: at the door, can the app know by itself that the UPI money came, so the rider does not have to trust the customer's phone screen? What it changes: whether "Paid by UPI" stays the rider's word or becomes the gateway's word.
Source: Razorpay's own docs and pricing page, read 13 Nov 2026 (Tier A for "they say it"; they sell the product). No real payment was tested.

| Claim | What the page says | Tier | Confidence | What it changes for us |
|---|---|---|---|---|
| A QR for one order with a fixed amount can be made by API | `usage: single_use`, `fixed_amount: true`, `payment_amount`; it closes after one payment; expiry 2 minutes to 2 hours | A | 0.9 | Fits #1321 (a QR per order with the amount) |
| We are told when it is paid | Webhook `qr_code.credited`: "Triggered when a payment is made using a QR code". Also an API to list the payments on one QR | A | 0.9 | The app can mark "paid" itself |
| How fast | Only the words "real-time", "immediate", "instant". No seconds, no promise | A | 0.5 | Needs our own test at a door before the rider depends on it |
| Who paid | The sample payload has the payer's UPI ID (`vpa`), `contact`, `email`, and a bank reference (`rrn`). No payer name field | A | 0.8 | Helps #1413 for matching and disputes; does not give the name |
| Fee | Pricing page (last updated May 2026): "UPI QR (standard) 0.99% per transaction"; the UPI row says "Zero MDR, 2% platform fee applies"; 18% GST on the fee; setup fee and yearly fee are 0. The page does not say which of the two rates applies | A | 0.5 | On a 340 rupee order: about 4 rupees at 0.99%, about 8 rupees at 2%, both with GST. Ask Razorpay in writing (same open point as October) |
| What we need first | QR codes are switched on by request to Razorpay support; an account is needed. KYC is not named on the QR pages | A | 0.7 | The owner's Razorpay KYC click is still pending (`razorpay.ts` is an empty placeholder) |

Not checked: other gateways, a bank's own merchant QR, what the law lets us store about a payer. Opposite view not searched yet. A Tier C claim was not used.
Test to design before building (goes to `experiments.md` when the owner picks this up): 10 real payments on a test QR, measure seconds from "paid" on the customer's phone to our webhook; pass if 9 of 10 arrive in under 10 seconds.
