# GoServe — Operations technology, deep research (full reports)

**Date read:** 13 Oct 2026. Two research passes, saved in full (not condensed):
- **Part A — Business systems** (Odoo app by app, Zoho One, Attio, HubSpot, Twenty, ERPNext, three stack options).
- **Part B — Food-delivery operations** (riders, kitchen, support, growth, hiring, compliance, how Indian operators do it, startup credits).

Short version: `docs/research/options-operations-tools-2026-10.md`. Tiers: **A** = vendor page, law, regulator or source code;
**B** = big data from a seller; **C** = blog, aggregator, review site; **P** = a named person's first-hand account with evidence.
Conf = 0 to 1. A vendor page proves "they say so". UNKNOWN = not found. USD→INR at ₹88 = $1 (assumption).

## Summary (read this first)

- **Build** (our core, and paid tools charge per order): dispatch, rider app, kitchen screen, recipe costing, referral and loyalty, refund workflow.
- **Buy** (money and law): rider payouts (RazorpayX), rider KYC checks (API per check), call masking (Exotel / Knowlarity / Pidge quotes).
- **Free or self-hosted:** support inbox (Chatwoot + WhatsApp Cloud API), analytics (PostHog, $50k startup credits), push (FCM), HR and payroll (Zoho People / Payroll free tiers).
- **Overflow delivery:** a 3PL (Pidge, Borzo, Shiprocket Quick) at roughly ₹50–80 a drop.
- **Ops tooling cost (excluding marketing and any gig-worker contribution):** MVP 1 ≈ ₹2–5k/month, MVP 2 ≈ ₹20–35k, MVP 3 ≈ ₹1.5–2.5 lakh.
- **Biggest open legal questions (get a lawyer once):** are we an "aggregator" under the Social Security Code (could mean up to 5% of rider payouts, ~₹4 lakh/month at MVP 3)? Does an own-app cloud kitchen need a central FSSAI licence as an "e-commerce FBO"?
- **Business systems (Part A):** MVP 1 = no ERP; Zoho Books (₹749, or Free under ₹25 lakh revenue) + Zoho Payroll Free; a 2-week test of Odoo One App Free (choose *Manufacturing* — it brings Inventory free) vs ERPNext on Frappe Cloud (₹820). MVP 2 lean = **ERPNext** (free API + built-in n8n node, ~₹4,500–6,500/month). **Odoo's API works only on the Custom plan** (₹1,080/user), so the n8n Odoo node cannot reach a free or Standard database. Leave Attio out of operations (CRM for investors and partners only; workflows burn credits fast).
- **First action:** get DPIIT startup recognition (free). It unlocks Zoho credits (up to ₹1.86 lakh) and other programs.
- **Weak spot:** almost no first-hand (P) evidence from Indian cloud-kitchen operators (Reddit was blocked for the tool). Treat "how others do it" rows as leans (≤ 0.6).

---

# Part B — Food-delivery operations tools to buy instead of build (India, Delhi pilot)

**Short answer:** Keep building dispatch, the rider app, the kitchen screen and referral/loyalty. Those are your core, and the paid alternatives charge per order, so they get dearer as you grow. Buy the money and legal pieces: rider payouts, KYC checks and call masking. Use free or self-hosted tools for support, analytics and HR. Monthly running cost comes to about ₹2–5k at MVP1, ₹20–35k at MVP2 and ₹1.5–2.5 lakh at MVP3, before marketing and before any gig-worker contribution.

**How to read this part**
- Order volume: 500 orders/day ≈ 15,000 orders/month. 5,300/day ≈ 159,000/month.
- First-hand evidence is weak. Reddit blocks the search tool. LinkedIn and YouTube turned up no first-hand cloud-kitchen ops accounts. Almost nothing below is Tier P.

## B1. Rider fleet management

**What it covers:** Dispatch and routing, shifts and attendance, rider KYC, payouts and incentives, earnings statements, TDS, and gig-worker registration.

### B1a. Dispatch software and third-party delivery fleets (3PL)

| Option | Free | INR cost per phase (calculated) | Catch | n8n/API | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **Tookan (Jungleworks)** | "Free Forever": 100 tasks/mo, 2 drivers | MVP1: free tier too small past ~3 orders/day. MVP2: Standard $399/mo for 6,000 tasks, plus 9,000 extra × $0.06 ≈ $939 ≈ **₹82.6k/mo**. MVP3: Enterprise custom, at least ~$4.8k ≈ **₹4.2L/mo** (real price UNKNOWN) | FAQ says "no agent limit", which contradicts the free plan's 2-driver cap. Trustpilot 2.7 (402 reviews) vs Capterra 4.1. Add-ons add up. UNKNOWN whether pickup and drop count as 2 tasks | API exists; Petpooja webhook integration documented; no native n8n node (use HTTP) | A (price), C (reviews) | 0.75 | [pricing](https://jungleworks.com/tookan/pricing/), [Petpooja integration](https://jungleworks.com/integrate-your-petpooja-account-with-tookan-for-smart-delivery-management), [reviews](https://www.rfp.wiki/vendors/tookan) |
| **Shipday** | No Starter plan on the current page. Older listing: free = 300 orders, 10 drivers (0.4) | Professional $39 incl. 300 orders, then $0.10 each. MVP2 ≈ $1,509 ≈ **₹1.33L/mo**. MVP3 ≈ $15.9k ≈ **₹14L/mo** | India allowance UNKNOWN ("more in other countries"); page contradicts itself ($349 vs $399) | API docs | A | 0.7 | [pricing](https://www.shipday.com/pricing) |
| **Onfleet** | None (14-day trial) | Launch $619 for 2,500 tasks; Scale $1,349 for 5,000, + ~$0.26 per extra. MVP2 ≈ $3.9k ≈ **₹3.5L/mo** | US-priced; calls and SMS extra | n8n has an Onfleet node (not re-checked) | C | 0.6 | [Levy comparison](https://fleets.levyelectric.com/compare/onfleet-pricing) |
| **LogiNext Mile** | None | ~$50/user/mo or $60/driver (conflict); setup $2–10k | No official price; $60 is from a competitor | API | C | 0.35 | [FarEye](https://fareye.com/resources/blogs/loginext-pricing), [ITQlick](https://www.itqlick.com/loginext-mile/pricing) |
| **Locus** | None | Quote only; enterprise | Built for large firms | API | A | 0.8 | [Locus pricing blog](https://locus.sh/blogs/locus-pricing-2026/) |
| **Pidge** (Delhi-NCR 3PL + dispatch software) | None | ₹5 per order under 3,000 orders/mo (own riders and partners). MVP1 ≈ **₹7.5k/mo** + extras. Above 3,000 UNKNOWN | Masked calls ₹0.75/min, WhatsApp ₹0.80/msg, SMS ₹0.25 | ONDC-integrated; API docs not found | A | 0.6 | [pidge.in](https://pidge.in/?p=22308) |
| **Borzo** (3PL, pay per drop) | None | Mumbai from ₹48 + ₹9/km; Bengaluru ₹45 + ₹12/km. **Delhi UNKNOWN.** ~₹75 for 3 km (calc.) | Rates differ between pages | Order API | A | 0.55 | [Borzo](https://borzodelivery.com/in/cities/bike-delivery-india) |
| **Shiprocket Quick** (Porter, Borzo, Ola...) | None | "From ₹10/km"; food terms UNKNOWN | Vendor claims | API | C/A | 0.5 | [Shiprocket](https://www.shiprocket.in/blog/shiprocket-local-hyperlocal-delivery) |
| **Uber Direct (via ONDC)** | n/a | India price UNKNOWN | Live for groceries; restaurants "planned" (Dec 2025) | ONDC | C | 0.6 | [The Week](https://www.theweek.in/news/biz-tech/2025/12/10/uber-direct-enters-india-s-b2b-logistics-space-here-s-how-it-s-different-from-uber-courier.amp.html) |
| **Shadowfax** | n/a | No rate card; ~₹33/order normal pay (inferred) | ~15 paise profit per order FY25 | Enterprise | C | 0.4 | [Zerodha Daily Brief](https://thedailybrief.zerodha.com/p/can-shadowfax-deliver), [The Ken](https://the-ken.com/story/too-many-cooks-in-shadowfaxs-hyperlocal-delivery-kitchen/) |

**Rider cost benchmark:** delivery jobs pay ~₹18–33k/month (Vahan, Indeed; C, 0.5). At MVP2 (~17 orders a rider a day, 26 days, ₹25k) an own rider costs **~₹57/order**; a 3PL ~₹50–80. Close to break-even — rider utilisation decides. One guide: own riders pay off above 40+ direct orders/day (C, 0.3).

### B1b. Payouts, KYC and gig-worker law

| Option | Free | INR cost per phase | Catch | n8n/API | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **RazorpayX Payouts** | "250 free payouts/mo" only on a blog (0.3) | IMPS/UPI: ₹4 (<₹1k), ₹6 (₹1k–25k), ₹9 (>₹25k); NEFT/RTGS ₹5; +GST. Weekly: MVP1 ≈ ₹155, MVP2 ≈ ₹1.2k, MVP3 ≈ ₹3.7k. Daily: MVP2 ≈ ₹5–7k, MVP3 ≈ ₹25k | Account fees not shown | **Official Razorpay n8n community node**; payouts via HTTP | A | 0.85 | [RazorpayX](https://razorpay.com/x/payouts_x/), [n8n node](https://razorpay.com/docs/razorpay-n8n-node) |
| **Cashfree Payouts** | None | IMPS/UPI ₹6/₹8/₹15; NEFT ₹3/₹5/₹8 (~1.3–1.5× RazorpayX) | AMC unstated | API | A | 0.8 | [Cashfree charges](https://www.cashfree.com/payment-gateway-charges/) |
| **KYC APIs** (DigiLocker, DL, PAN): eKYCNow, Perfios, IDfy, Surepass, HyperVerge | None | ₹2.49–10 per check (eKYCNow conflicts); others UNKNOWN; < ₹2k/mo any phase | Pages contradict | REST | C | 0.45 | [eKYCNow](https://www.messagecentral.com/product/ekyc-now/pricing/india) |

| Gig-worker law and TDS claim | Tier | Conf | Source |
|---|---|---|---|
| Code on Social Security in force 21 Nov 2025; Central Rules notified 8 May 2026 | C | 0.8 | [K&S](https://ksandk.com/labour-employment/gig-workers-epf-code-social-security-2026/) |
| "Aggregators" must register gig workers on eShram (45 days / real-time readings; onboarding API deadline 21 Jun 2026) | C | 0.75 | [DLA/JSA](https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/india-mandates-aggregator-onboarding-to-eshram-portal-to-expand-social-security-coverage), [Taxmann](https://www.taxmann.com/post/blog/analysis-aggregator-obligations-code-on-social-security/) |
| Aggregator contribution 1–2% of turnover, capped at 5% of payments to gig workers; **start date not notified**; no small-aggregator exemption found | C | 0.7 | [Taxclue](https://taxclue.in/blog/sixth-and-seventh-schedules-social-security-code-2020/) |
| Delhi gig-worker bill is a draft; welfare board announced (₹10 cr); nothing in force | C | 0.6 | [Swarajya](https://swarajyamag.com/amp/story/news-brief/gig-worker-delegation-meets-delhi-cm-rekha-gupta-seeks-dedicated-welfare-bill-aligned-with-labour-codes), [Tribune](https://www.tribuneindia.com/news/delhi/govt-to-set-up-welfare-board-for-gig-platform-workers-10-cr-allocated) |
| TDS 194C: 1% for individuals; thresholds ₹30k single / ₹1L a year (a rider at ~₹6k/week crosses ₹1L). Mumbai ITAT: Uber Eats not in default for skipping 194C; no clear CBDT position | C, A (ITAT) | 0.6 | [Zoho guide](https://www.zoho.com/in/payroll/academy/payroll-operations/contract-payroll-india.html), [ITAT Uber](https://itat.gov.in/public/files/upload/1614856527-ITA%20No.5862%20-2018%20Uber%20India%20Systems%20Pvt.%20Ltd.,.pdf) |

**Biggest open legal point:** we sell our own food through our own app with riders who deliver only our orders. Food delivery is a listed category; whether it covers us is UNKNOWN — needs a lawyer. At MVP3 the 5% cap at ~₹50/order rider cost ≈ ₹4L/month. If riders are employees, payroll, ESIC and EPF apply (thresholds not verified).

**Opposing view:** dispatch is a mature category; building it costs routing, live tracking, failover, offline work. The cheapest fleet may be no fleet: a 3PL at ₹50–80/drop with no management.

**Verdict B1:** build dispatch, shifts and earnings on Supabase (SaaS costs ₹80k–1.3L/month at MVP2). Buy payouts (RazorpayX) and KYC. Use Pidge / Borzo / Shiprocket Quick for overflow. Tookan free (100 tasks) only as a sandbox.

## B2. Kitchen operations

| Option | Free | INR cost per phase | Catch | n8n/API | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **Petpooja** | None | Base ₹12,000 ex-tax (period not shown; probably yearly): billing, inventory, aggregator integration, Purchase Manager. Ops Manager ₹20k/₹30k adds KDS + Swiggy/Zomato reconciliation. If yearly: MVP1 ≈ ₹1k/mo; MVP2 (3 outlets) ≈ ₹3–8k; MVP3 (10) ≈ ₹10–27k | G2 users list inventory as a top con; recipe costing "may require careful validation"; USD page ($800/yr) conflicts | No public API; partner keys via support | A (price), C (reviews) | 0.65 | [petpooja.com/pricing](https://petpooja.com/pricing), [G2](https://www.g2.com/compare/petpooja-poss-vs-dineout-inresto-by-dineout), [FitGap](https://us.fitgap.com/products/006761/petpooja), [ERPNext connector](https://cloud.frappe.io/marketplace/apps/petpooja) |
| **Restroworks (Posist)** | None | "$200/user/yr" listings; INR by quote | Enterprise chains | API | C | 0.35 | [Software Advice](https://www.softwareadvice.com/retail/restroworks-profile/) |
| **Odoo** | One App Free | Standard ~₹580–725/user/mo; Custom ₹1,080; 10 users ≈ ₹6–11k/mo | Kitchen display ("Preparation Display") reported Enterprise-only | XML-RPC/JSON; n8n Odoo node | A/C | 0.6 | [odoo.com/pricing](https://www.odoo.com/pricing), [Cybrosys](https://www.images.cybrosys.com/blog/what-are-the-differences-between-community-enterprise-in-odoo-18-pos) |
| **Zoho Inventory** | 50 orders, 1 user, 1 warehouse | Standard ₹12,999/yr; Professional ₹26,999; Premium ₹45,999 (ex-GST) ≈ ₹1.1–3.8k/mo | Not restaurant-specific; no recipes or wastage | REST | A | 0.8 | [Zoho India pricing](https://zstatic.zohostatic.com/in/inventory/pricing) |
| **Supy / Apicbase / MarketMan** | None | MarketMan $199–239/location/mo ≈ ₹17.5–21k per kitchen | Too expensive for India; Supy not launched in India | API | C | 0.6 | [G2 Supy](https://www.g2.com/products/supy/pricing), [Capterra](https://www.capterra.in/compare/136439/171584/marketman-restaurant-inventory/vs/apicbase-restaurant-management) |
| **UrbanPiper** (aggregator hub) | None | Not published | Only if we also list on Swiggy/Zomato | API | A | 0.7 | [UrbanPiper help](https://help.urbanpiper.com/direct-ordering/getting-started) |

Food-safety logs: FSSAI requires one FoSTaC-trained Food Safety Supervisor per 25 food handlers for licence holders (A, 0.85, [FSSAI FoSTaC](https://fssai.gov.in/cms/fostac.php)). No India food-safety-log SaaS found; a checklist form on the kitchen screen covers it.

**Opposing view:** Petpooja is the Indian default and already reconciles Swiggy/Zomato payouts (painful to build). If > ~30% of orders come through aggregators, ₹12–32k per outlet a year is cheaper than building reconciliation.

**Verdict B2:** build recipe costing, wastage and food-safety checklists in Supabase (we already have the KDS). MVP1–2: Zoho Inventory Free/Standard for purchasing if a sheet is not enough. Add Petpooja only when we list on aggregators.

## B3. Customer support

Meta WhatsApp rates in India (C consensus, 0.75): marketing ₹0.8631/msg (since 1 Jan 2026); utility and authentication ~₹0.115; service replies inside 24 h free; utility inside that window free; resellers add 10–60%. ([Monty Mobile](https://montymobile.com/blogs/whatsapp-business-api-pricing-in-india-inr-rates-gst-and-the-2026-currency-migration-deadline), [Baat](https://baat.ai/blog/whatsapp-api-pricing-india))

| Option | Free | INR cost per phase | Catch | n8n/API | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **Chatwoot self-hosted** | Software free; cloud "Hacker" 2 agents, 500 chats, live chat only | VPS ₹1.5–3k (MVP2), ₹5–10k (MVP3) (estimate); WhatsApp at Meta rates; cloud $19/agent | Docs: 4 CPU, 8 GB RAM. Slowness at 10–15 agents in one team; another ran ~101k chats with 40 agents after tuning. SLAs and audit logs paid-only. A 2022 HN user saved money vs Front across 5 brands (P) | REST + webhooks; community node `n8n-nodes-chatwoot` | A, P | 0.7 | [pricing](https://www.chatwoot.com/pricing), [issue](https://github.com/chatwoot/chatwoot/issues/3425), [tuning](https://github.com/orgs/chatwoot/discussions/14838), [HN](https://news.ycombinator.com/item?id=32982485) |
| **Gallabox** | Trial | Basic ₹2,399/mo (yearly), 3 users; Essential ₹5,599, 6 users; Advanced ₹13,599, 10 users; + Meta fees and markup | Markup unstated | API | A | 0.8 | [gallabox.com/pricing](https://gallabox.com/pricing) |
| **Interakt** | 14-day trial | Starter ₹3,499/quarter; Growth ₹7,699; Advanced ₹10,499; + 12–25% markup (reported) | Official page blocked (403) | API | C | 0.55 | [Codingclave](https://codingclave.com/blog/interakt-pricing-india-2026) |
| **Wati** | 7-day trial | ₹999 pay-as-you-go (as credit); others in USD | | API | A | 0.6 | [wati.io/pricing](https://www.wati.io/pricing/) |
| **Zoho Desk** | 3 agents | ~₹420–2,400/agent (conflict) | | API | C | 0.65 | [Aaxonix](https://aaxonix.com/resources/zoho-desk-vs-freshdesk-india/) |
| **Freshdesk / Freshchat** | Up to 10 agents reported (conflict) | Growth ~$18–19/agent | No AI on free | API | C | 0.5 | [CostBench](https://costbench.com/software/live-chat/freshchat/free-plan/) |
| Call masking: **Pidge** | n/a | ₹0.75/min | Only with Pidge | | A | 0.6 | [pidge.in](https://pidge.in/?p=22308) |
| Call masking: **Exotel / Knowlarity / MyOperator** | n/a | ~₹1.5/min (vendor benchmark); Knowlarity 1-year contract reported | 60-second pulses + number rental | APIs | C | 0.4 | [Exotel docs](https://developer.exotel.com/docs/billing/pricing-model), [TeleCMI](https://www.telecmi.com/blog/call-masking-pricing-plan-for-business) |
| Call masking: **Twilio Proxy** | n/a | n/a | **Closed to new customers** | | A | 0.85 | [Twilio Proxy](https://live.docs.dev.twilio.com/docs/proxy.md) |

Masking (both sides see a virtual number) is legal in India; spoofing caller ID is not (C, 0.6).
Phase costs (calc.): WhatsApp status at 2 utility msgs/order: MVP2 ≈ ₹3.5k/mo, MVP3 ≈ ₹36.6k — send status by free push instead. Masking at 20% of orders × 1.5 min: MVP2 ≈ ₹3.4–6.8k, MVP3 ≈ ₹36–72k.

**Opposing view:** self-hosting Chatwoot means being on call for the inbox; a Gallabox seat at ₹2,399/mo may cost less than one engineer-day.

**Verdict B3:** self-host Chatwoot with WhatsApp Cloud API direct (no markup). Build the refund flow in n8n (Razorpay node → Supabase → Chatwoot). Buy masking (quotes) or use Pidge. Fallback: Zoho Desk Free.

## B4. Customer engagement and growth

| Option | Free | INR cost per phase | Catch | n8n/API | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **FCM + In-App Messaging** | Free at scale | ₹0 | Other Firebase services may need Blaze | HTTP v1 | A | 0.85 | [Firebase pricing](https://firebase.google.com/pricing) |
| **PostHog** | 1M events, 5k replays, 1M flag requests a month | MVP1–2 ₹0; MVP3 UNKNOWN. **$50k credits for 12 months** (< 2 years old, < $5M raised); no AI tools from 14 Sep 2026 | | API, webhooks | A | 0.8 | [pricing](https://posthog.com/pricing), [startups](https://posthog.com/handbook/marketing/startups) |
| **Mixpanel** | 1M events, 10k replays, unlimited seats | Startup plan: first year free (< 5 years, < $8M) | | API | A | 0.85 | [mixpanel.com/pricing](https://mixpanel.com/pricing/) |
| **OneSignal** | From 1 Oct 2026 free mobile push capped at 1,000 MAU | Growth ~$19 + $0.012/MAU; MVP3 ≈ ₹44k (calc.) | Sending pauses above the cap | API | A | 0.8 | [OneSignal blog](https://onesignal.com/blog/whats-changing-on-onesignals-free-plan/) |
| **CleverTap** | No permanent free plan | $75 (5k MAU), $250 (20k), $500 (40k); MVP3 ≈ ₹22–44k | Billed on tier or actual MAU, whichever is higher | API | A | 0.7 | [startups](https://docs.clevertap.com/docs/clevertap-for-startups-overview), [AWS listing](https://aws.amazon.com/marketplace/pp/prodview-acgz3i7pc34p6) |
| **MoEngage / WebEngage** | Conflicting | Quote only | | API | C | 0.35 | [G2](https://www.g2.com/compare/moengage-vs-webengage) |

WhatsApp campaigns (calc.): 10k users × 4 a month × ₹0.8631 ≈ ₹34.5k/mo at MVP2 — a marketing line, not tooling.
**Opposing view:** CleverTap/MoEngage give journey builders and churn prediction; home-made referral logic is easy to get wrong (fraud, coupon abuse).
**Verdict B4:** build referral, loyalty, coupons in Supabase; FCM for push; PostHog for analytics (apply for credits); avoid OneSignal mobile; reconsider CleverTap at MVP3.

## B5. Hiring and HR (kitchen staff and riders)

| Option | Free | INR cost per phase | Catch | n8n/API | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **Zoho People** | 5 users | Not researched | Basic only | API | C | 0.6 | [FitSmallBusiness](https://fitsmallbusiness.com/zoho-people-review) |
| **Zoho Payroll India** | Up to 10 employees | ₹1,000/mo for 25 employees (official FAQ) | | API | A | 0.75 | [Zoho Payroll FAQ](https://www.zoho.com/in/payroll/payroll-faq/) |
| **greytHR** | Free up to 25 employees (competitor blogs) | Essential ₹2,495–3,495 for 50, then ₹35–45 each | Conflict | API | A/C | 0.5 | [calculator](https://www.greythr.com/pricing-calculator/) |
| **Keka** | None | ₹9,999/mo minimum up to 100 employees | Same minimum for 10 people | API | C | 0.55 | [HROne](https://hrone.cloud/?p=53120) |
| **Zoho Recruit** | 1 active job | ~$25/recruiter | Useless for volume | API | C | 0.55 | [Toolradar](https://toolradar.com/guides/best-free-ats-software) |
| **apna** | n/a | ~₹600–699 per post (15 days); ₹3,189 for 3 | | n/a | C | 0.5 | [Flexiple](https://flexiple.com/reviews/apna-co) |
| **WorkIndia** | Free post, paid to activate | ₹2,350/30 days; ₹4,200/90; ₹7,500/year | | n/a | C | 0.5 | [100Hires](https://100hires.com/best-job-posting-sites-in-india.html) |
| **Vahan** (WhatsApp rider hiring) | Free for riders | Employer price UNKNOWN | | | C | 0.4 | [NextBillion](https://nextbillion.net/news/y-combinator-backed-vahan-is-helping-low-skilled-workers-in-india-find-jobs-on-whatsapp/) |

Attrition: platforms replace many riders every 3–4 months (2019 estimate, C, 0.4) — plan hiring and KYC as recurring costs.
**Opposing view:** blue-collar hiring runs on referrals and WhatsApp; boards and an ATS can add process without hires.
**Verdict B5:** MVP1–2 Zoho People Free + Zoho Payroll Free/₹1k, apna/WorkIndia posts, rider referral bonus. Rider onboarding (KYC, documents, training video) inside our rider app. MVP3 greytHR or Keka past ~50 staff.

## B6. Compliance helpers

| Claim | Tier | Conf | Source |
|---|---|---|---|
| FSSAI order of 13 Mar 2026: basic registration up to ₹1.5 cr turnover (was ₹12 lakh); state licence ₹1.5–50 cr; central above ₹50 cr. From 1 Apr 2026 licences are perpetual with a yearly fee | A (FSSAI PDF), C | 0.75 | [FSSAI order](https://www.fssai.gov.in/upload/advisories/2026/03/69b4054bb6cd6Order%20dated%2013thMarch2026_Revised%20Turnover%20threshold.pdf) |
| One source: only milk vendors qualify for basic registration up to ₹1.5 cr under the "kind of business" matrix (unverified; could push a kitchen to a state licence) | C | 0.3 | [Setindiabiz](https://www.setindiabiz.com/fssai-applicability) |
| Older fees: registration ₹100/yr; state ₹2,000–5,000/yr; central ₹7,500/yr | C | 0.6 | [Tally](https://tallysolutions.com/business-guides/fssai-license-fees-cost-of-food-business-registration/) |
| E-commerce FBOs and multi-state operators may need a central licence regardless of turnover; UNKNOWN if an own-app kitchen counts | C | 0.45 | [Kanakkupillai](https://kanakkupillai.com/learn/fssai-food-license-for-e-commerce) |
| GST: restaurant service (SAC 9963), incl. cloud kitchens, 5% without input tax credit; unchanged by GST 2.0 (22 Sep 2025). On our own app we are the supplier and charge 5% (reading) | C | 0.75 | [Kanakkupillai GST](https://www.kanakkupillai.com/learn/gst-for-cloud-kitchens-in-india/) |
| Delhi Shops & Establishment: Form A online within ~90 days; fee ₹0–5,000 and validity "lifetime" or 21 years (conflict); amendment bill (Jan 2026) not in force | C | 0.5 | [Keka compliance](https://www.keka.com/compliance/acts/delhi-shops-and-establishments-act) |
| FoSTaC supervisor: 1 per 25 food handlers | A | 0.85 | [FSSAI FoSTaC](https://fssai.gov.in/cms/fostac.php) |

**Opposing view:** consultants charge a few thousand rupees per filing; doing it yourself on FoSCoS is free but slow, and a mistake can block launch.
**Verdict B6:** file FSSAI and Shops & Establishment ourselves; a CA for GST and TDS; one legal opinion on (a) e-commerce FBO central licence and (b) SS Code aggregator status.

## B7. How Indian operators handle ops tooling

| Evidence | Tier | Conf | Source |
|---|---|---|---|
| **Rebel Foods built everything** ("Rebel OS", 2019): inventory, kitchen, delivery, forecasting; 350–450+ kitchens; co-founder calls tech one of their best decisions | A (founder quotes), C | 0.75 | [AIM](https://analyticsindiamag.com/tech-behind-food-tech-unicorn-rebel-foods/), [Entrepreneur](https://india.entrepreneur.com/?p=867), [BW Disrupt](https://bwdisrupt.com/article/what-it-takes-to-build-versatile-cloud-kitchen-businesses-439378) |
| Zepto runs an in-house dark-store and last-mile stack; Zepto Café scaled down over kitchen-staff shortage (a people bottleneck) | C | 0.55 | [Inc42](https://inc42.com/?p=523057) |
| Mid-size multi-brand kitchens buy: Kouzina (40+ locations) uses UrbanPiper; small kitchens default to Petpooja | A (case study) | 0.6 | [UrbanPiper Kouzina](https://urbanpiper.com/case-study/kouzina) |
| Box8/Mojo and Biryani By Kilo reportedly run own fleets in some areas; Box8 ~30–40% orders direct | C | 0.3 | [Founders Insiders](https://foundersinsdrs.beehiiv.com/p/should-you-start-a-cloud-kitchen-in-india-a33e) |
| Jul 2026: 1,000+ Bengaluru restaurants threatened to boycott aggregators; ₹1L sales nets ~₹40k after deductions (supports an own app) | C | 0.6 | [Free Press Journal](https://www.freepressjournal.in/tech/bengaluru-restaurants-threaten-to-boycott-swiggy-zomato-from-august-15-over-high-commissions) |

Pattern: own-channel, own-kitchen operators (Rebel) build their core; aggregator-dependent brands buy POS and hub tools. GoServe is the first group. **Opposing view:** Rebel built after scale and funding; building before demand is proven burns cash (Swiggy cut its cloud-kitchen business: [TechCrunch](https://techcrunch.com/?p=1990008)).

## B8. Startup programs with credits

| Program | What you get | Eligibility | Tier | Conf | Source |
|---|---|---|---|---|---|
| **Zoho for Startups** | Up to ₹1.86L wallet credits for 360 days (₹2L variant via DPIIT link) | DPIIT-recognised; new to paid Zoho | A | 0.8 | [Zoho](https://zoho.com/startups/founders-registration.html), [Startup India](https://www.startupindia.gov.in/marathi/content/sih/en/reources/resource-partners/application-based-services/zoho.html) |
| **PostHog** | $50k, 12 months (no AI tools from 14 Sep 2026) | < 2 years, < $5M raised | A | 0.85 | [handbook](https://posthog.com/handbook/marketing/startups) |
| **Mixpanel** | First year free | < 5 years, < $8M | A | 0.85 | [pricing](https://mixpanel.com/pricing/) |
| **Google for Startups Cloud** | $2k (bootstrapped); up to $200–350k (VC-backed) | MVP live; VC for big tiers | A/C | 0.7 | [Google FAQ](https://cloud.google.com/startup/faq?hl=en) |
| **AWS Activate Founders** | $1k, up to $5k; portfolio up to $100k via VC | Self-funded, live site, < 10 years | A | 0.8 | [AWS guide](https://aws.amazon.com/aws-startups/learn/applying-for-aws-activate-credits-a-step-by-step-guide) |
| **Microsoft for Startups** | Up to $5k self-serve; $100–150k with investor referral | Business verification | C | 0.5 | [Spendbase](https://spendbase.co/blog/saas-management/azure-credits-for-startups/) |
| **Razorpay Rize** | ₹3L free payments (angel-funded), ₹30L (VC-funded); free incorporation | Funded startups | A | 0.65 | [Rize perks](https://razorpay.com/m/startup-perks/) |
| **Freshworks for Startups** | 90% off year 1 or $3–10k credits (conflict) | Early stage | C | 0.4 | [Western Alliance](https://www.westernalliancebancorporation.com/expertise/innovation-banking/startup-banking/partner-offers/freshworks) |
| **HubSpot for Startups** | 75% / 50% / 25% off over 3 years | < $2M raised, via a partner | C | 0.6 | [HubSpot](https://www.hubspot.com/startups/partners/seed-stage-blurb) |
| **Supabase** | Up to $3k or 6 months Team plan (conflict) | < $5M, via partners | C | 0.45 | [startupgrantsindia](https://www.startupgrantsindia.com/perks/supabase-for-startups) |
| **n8n** | 50% off Business plan for 1 year | < 20 employees, < €5M | A/C | 0.6 | [n8n help](https://n8n.support.site/article/do-you-have-a-startup-plan-for-small-startups-and-businesses) |

**Action:** get DPIIT recognition first (free).

## B9. Recommended ops stack by phase (monthly INR, calculated)

| Line item | MVP1 (~1.5k orders/mo) | MVP2 (~15k orders/mo, 40 riders, 3 kitchens) | MVP3 (~159k orders/mo, 120 riders, 10 kitchens) |
|---|---|---|---|
| Dispatch, shifts, earnings (built) | 0 | 0 | 0 |
| Rider payouts (RazorpayX weekly, incl. GST) | ~150 | ~1,200 (daily ~6k) | ~3,700 (daily ~25k) |
| Rider KYC APIs | < 300 | ~600 | ~2,000 |
| 3PL overflow (~₹75/drop) | usage | usage | usage |
| Kitchen: own KDS + Supabase recipes; Zoho Inventory | 0 | ~1,100 | ~2,250 |
| Petpooja (only with aggregators) | (1,000) | (3,000–8,000) | (10,000–27,000) |
| Support inbox (Chatwoot VPS) | 0–1,500 | 1,500–3,000 | 5,000–10,000 |
| WhatsApp utility messages | ~350 | ~3,500 max | ~36,600 max |
| Call masking | ~700 | 3,400–6,800 | 36,000–72,000 |
| Analytics and push (PostHog + FCM) | 0 | 0 | 0 on credits, then UNKNOWN |
| HR (Zoho; Keka at MVP3) | 0 | ~1,000 | ~10,000–16,000 |
| Hiring (job boards) | ~1,400 | ~5,000–10,000 | ~20,000–40,000 |
| **Total (excl. Petpooja, marketing, gig contribution)** | **≈ ₹2–5k** | **≈ ₹20–35k** | **≈ ₹1.5–2.5 lakh** |
| Gig-worker contribution, if it applies | — | up to 5% of rider payouts | ≈ ₹4L |
| For comparison: bought dispatch | — | Tookan ≈ ₹83k, Shipday ≈ ₹1.3L | Tookan ≥ ₹4.2L, Shipday ≈ ₹14L |

One-time/yearly compliance: FSSAI ₹100 to ₹2–5k/yr (state) or ₹7.5k/yr (central); Shops & Establishment ₹0–5k; FoSTaC training (fee not researched).

## B10. Open questions

1. SS Code "aggregator" status and contribution start date (≈ ₹4L/month at MVP3) — legal opinion.
2. FSSAI e-commerce FBO central licence; the basic-registration matrix — check FoSCoS.
3. Delhi Shops & Establishment fee/validity; MCD health trade licence; Delhi Police eating-house licence (not researched).
4. Pidge above 3,000 orders; Borzo Delhi tariff; Uber Direct food price.
5. Exotel / Knowlarity masking rates — get 2–3 quotes.
6. TDS on rider payouts (194C) — CBDT position unclear.
7. Petpooja Base billing period and API for an own app.
8. Shipday India allowance.
9. PostHog cost at MVP3 — measure events per user in MVP1.
10. Own riders vs 3PL — run MVP1 with 2–3 own riders + a 3PL for a month; compare cost per drop.
11. Tier P evidence from Indian operators is almost absent — "others do X" is at most 0.6.
12. ESIC/EPF thresholds and PAN-missing TDS rate not checked.

---

# Part A — Business systems (Odoo, Zoho, Attio, HubSpot, Twenty, ERPNext)

**Method limits:** Reddit blocked the tools (HTTP 400); YouTube not searchable; first-hand evidence comes from Trustpilot,
Hacker News, the Odoo forum, the Frappe forum, Capterra and the BBB. Hard facts were checked in source code where possible
(GitHub manifests, Docker Hub manifests, n8n node source).

## A0. Findings that change decisions

| # | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| 1 | **Odoo's external API (JSON-RPC, XML-RPC, JSON-2) works only on the Custom plan**, not on One App Free or Standard. So the n8n Odoo node cannot talk to a free or Standard database. | A | 0.85 | https://www.odoo.com/documentation/saas-18.1/pt_BR/developer/reference/external_api.html , https://www.odoo.com/pricing-plan |
| 2 | **Choosing Manufacturing as the One App Free app brings Inventory free** (`mrp` depends on `stock`; the free app stays free "whatever the dependencies"). Purchase depends on Invoicing, so purchase orders = a second app = end of free. | A | 0.75 | https://raw.githubusercontent.com/odoo/odoo/20.0/addons/mrp/__manifest__.py , https://www.odoo.com/pricing-plan |
| 3 | **Enterprise-only (not in Community code):** Kitchen Display (`pos_preparation_display`), India GSTR filing (`l10n_in_reports_gstr`), India Payroll (`l10n_in_hr_payroll`), Helpdesk, Field Service, Knowledge, Studio, UrbanPiper (Swiggy/Zomato) connector. | A | 0.9 | GitHub odoo/odoo 18.0, 19.0, 20.0 (those folders return 404; e.g. https://github.com/odoo/odoo/tree/20.0/addons/pos_restaurant exists) |
| 4 | **Do not push customer orders one by one into Zoho Inventory.** Order caps per month: Free 50, Standard 500, Premium 3,000, Plus 7,500, Enterprise 15,000. Push one daily ingredient total per kitchen instead (same pattern for Odoo and ERPNext). | A | 0.8 | https://www.zoho.com/in/inventory/pricing/ |
| 5 | **Zoho Books Free stops above ₹25 lakh yearly revenue** — likely during MVP 1–2. Free has no e-invoicing (Standard does). | A | 0.85 | https://www.zoho.com/in/books/pricing/ |
| 6 | **E-invoicing is likely not needed yet:** B2B only, above ₹5 crore turnover (Notification 10/2023). B2C food orders are outside it. | C (EY alert citing CBIC) | 0.8 | https://www.ey.com/en_in/alerts-hub/2023/05/cbic-lowers-turnover-threshold-for-e-invoicing-to-inr5-crores-with-effect-from-1-august-2023 |
| 7 | **Labour Codes in effect from 21 Nov 2025:** platform aggregators pay 1–2% of turnover (cap 5% of worker payouts) into a fund; allowances above 50% of CTC count as wages for PF, ESI, gratuity. Whether GoServe is an "aggregator" for its own riders is a legal question. | C | 0.7 | https://www.greythr.com/blog/labour-codes-2025/ , https://eparlib.sansad.in/bitstream/123456789/3017859/1/AS218_TkgMZU.pdf |
| 8 | **ERPNext gives the deepest free integration with our stack:** built-in n8n ERPNext node (create, read, update, delete any record type), free REST API, official Docker image runs on ARM, Frappe Cloud hosts in Mumbai. | A | 0.85 | n8n source `packages/nodes-base/nodes/ERPNext`, Docker Hub `frappe/erpnext`, https://frappe.io/cloud/sites |

## A1. Odoo

### Plans, One App Free, hosting

| Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| India prices per user a month | Standard ₹580 yearly (list ₹725) or ₹760 monthly (list ₹950). Custom ₹1,080 yearly (list ₹1,350) or ₹1,350 monthly (list ₹1,690). Discount lasts 12 months, first-order users only | A | 0.7 | https://www.odoo.com/pricing-plan |
| Light User | ₹195, only through an advisor call; unclear if riders or kitchen staff qualify | A | 0.5 | same |
| Standard vs Custom | Standard: all apps, Odoo Online only, no custom modules, **no external API**. Custom: Studio, "Agentic AI", multi-company, external API, Odoo.sh or own server | A | 0.85 | same |
| One App Free | One app, **unlimited users**, Odoo Online only, dependency apps free, multi-company allowed, Studio can be the app. Installing Studio or adding a company → Custom | A | 0.85 | same |
| Adding a second app | Database becomes a trial; subscribe within ~14–15 days. One user was billed after uninstalling an accidental Purchase install (no answer posted) | P (Odoo forum) | 0.75 | https://www.odoo.com/forum/help-1/is-odoo-free-223391 , https://www.odoo.com/forum/help-1/is-odoo-1-app-free-forever-129258 |
| Inventory only, free | Yes (`stock` needs only product, barcode, digest). But no purchase orders and no API | A | 0.75 | https://raw.githubusercontent.com/odoo/odoo/20.0/addons/stock/__manifest__.py |
| Inactive free databases | Forum: deleted if untouched 3 months (not in official terms) | C | 0.4 | forum 129258 |
| Storage | Up to 100 GB on Odoo Online | A | 0.8 | https://www.odoo.com/pricing |
| Odoo.sh | Billed per worker, GB and staging; amounts not shown officially; third parties say ~$57.60/worker/month, $0.20–0.25/GB; Enterprise licence extra | A (structure), C (numbers) | 0.5 | https://www.odoo.sh/pricing , https://oec.sh/odoo-pricing/odoo-sh |
| Community on ARM | Official `odoo` Docker image (18, 19, 20) built for arm64 | A | 0.95 | Docker Hub library/odoo (updated 2026-10-02) |
| Odoo Online data region | UNKNOWN (no official list; a competitor says Odoo.sh has Mumbai) | C | 0.3 | https://oec.sh/odoo-hosting/india |
| Data ownership | "You can download a backup of your database at any time… You own your data!" | A | 0.8 | https://www.odoo.com/pricing-plan |
| Paid extras (credits) | Odoo AI €1/credit (20 free; use per feature not published). Indian EDI €3 per 1,000 credits up to €90 per 50,000. eWayBill €0.009–0.03 each. GSTR e-filing €0.05/request. OCR €0.05–0.15/doc. Credits never expire | A | 0.9 | https://iap.odoo.com/iap/in-app-services/867 , /644 , /595 , /664 , /259 |

### Versions, upgrades, lock-in

| Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| Versions | 20.0 (Sept 2026, support to Sept 2029); 19.0 to Sept 2028; 18.0 to Sept 2027. Odoo Online also gets SaaS releases every 2–3 months | A | 0.9 | https://www.odoo.com/documentation/master/administration/standard_extended_support.html |
| Upgrade cost | "Upgrades are also included in all our plans at no extra fee." Extended support costs extra (amount not published). Own servers must stay on latest stable | A | 0.8 | pricing FAQ, same doc |
| Forced upgrades on Online | Notice a few weeks ahead, then automatic; majors about every 2 years | A (older docs) | 0.6 | https://www.odoo.com/documentation/saas-17.4/administration/upgrade.html |
| Upgrade failure story | v19.1 → v19.2 automatic update blanked 3 months of repair records; 15+ tickets unresolved; refund refused (3 Oct 2026) | P (Trustpilot, Aleksandr Timofeev) | 0.5 | https://www.trustpilot.com/review/odoo.com |
| API deprecation | `/xmlrpc`, `/jsonrpc` deprecated since 19.0; `db` removed in 20; `common` and `object` planned out in 22 (self-hosted) / Online 21.1. Replacement: JSON-2 with a bearer key | A + C | 0.75 | https://www.odoo.com/documentation/20.0/developer/reference/external_rpc_api.html |
| Custom-code upgrades | Partners quote $5k–$40k+ (sellers of that work) | C | 0.3 | partner blogs |

### App by app for a cloud kitchen

| App | What it does for GoServe | Community or Enterprise | Tier | Conf | Source |
|---|---|---|---|---|---|
| Inventory | Stock per kitchen, transfers, reorder rules, lots and expiry, counts (Barcode app is Enterprise) | Community | A | 0.85 | GitHub 20.0 |
| Purchase | Vendor POs, bills, 3-way match; depends on Invoicing | Community | A | 0.85 | `purchase` manifest |
| Manufacturing / BoM | Recipe as a **Kit BoM**: a POS sale deducts ingredients (real time or at session close). Batch prep with normal BoM. Negative stock allowed by default; kits do not track the finished dish | Community | P/C (forum) | 0.65 | https://www.odoo.com/forum/help-1/how-to-consume-raw-material-at-the-time-of-selling-at-a-restaurant-304120 |
| POS + Restaurant | Counter/phone orders, receipts, GST on receipts (old threads show "VAT" printed on Online receipts) | Community | A / P | 0.6 | https://odoo.com/ro_RO/forum/suport-1/pos-receipt-template-show-term-vat-in-india-odoo-online-242387 |
| **Kitchen Display** | Stages, timers, tick items, recall. **Shows POS orders only** — our app's orders would need to be created as `pos.order` via the API (Custom plan + integration) | **Enterprise** | A | 0.85 | https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/extra/preparation.html |
| Swiggy/Zomato connector | Via UrbanPiper (per location fee UNKNOWN); only with aggregators | Enterprise | A | 0.7 | https://www.odoo.com/hi_IN/food-delivery-platform-integration |
| Accounting + India | GST taxes, TDS/TCS reports; e-invoice and e-way bill in Community (credits). **GSTR-1 send, 2B fetch, GSTR-3 in Enterprise.** Full accounting Enterprise; Community = "Invoicing" | Mixed | A | 0.85 | https://www.odoo.com/documentation/18.0/applications/finance/fiscal_localizations/india.html |
| Helpdesk | Complaints, SLAs | Enterprise | A | 0.9 | GitHub 404 |
| CRM | B2B/catering leads; weak fit for B2C | Community | A | 0.9 | GitHub |
| Attendance / Payroll India | Attendance (kiosk, geolocation) Community. **India Payroll Enterprise** (EPF, ESIC, PT, LWF, TDS challan, gratuity; Form 16/24Q/ECR not seen) | Mixed | A | 0.7 | https://www.odoo.com/documentation/master/applications/hr/payroll/payroll_localizations/india.html |
| Field Service | Little fit | Enterprise | A | 0.9 | GitHub 404 |
| Fleet | Company bikes register, insurance, servicing | Community | A | 0.9 | GitHub |
| Website / eCommerce | Not needed | Community | A | 0.9 | |
| Studio | No-code fields and screens; forces Custom | Enterprise | A | 0.9 | pricing FAQ |
| Knowledge | Recipe cards, SOP wiki | Enterprise | A | 0.9 | GitHub 404 |
| AI | "Ask AI" opens views and reports but **cannot create or change records**; agents via "Topics"; own OpenAI/Gemini key optional on Online, required self-hosted; one user says only OpenAI works for AI fields | A + P | 0.6 | https://www.odoo.com/documentation/19.0/applications/productivity/ai.html , forum 288481 |

### n8n, setup, critical views

| Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| n8n node | Contact, Opportunity, Note/Activity, plus **Custom Resource (any model)** CRUD. v2 uses JSON-2 for Odoo 19+, `/jsonrpc` for 14–18 (n8n 2.23.0) | A | 0.9 | n8n source `Odoo/v2/transport/index.ts`; https://github.com/n8n-io/n8n/issues/21545 |
| Plan needed | **Custom only.** Inbound webhook automation rules *might* work on Standard (untested) | A / UNKNOWN | 0.5 | |
| Setup (Odoo's India Success Packs) | Starter 4 h ₹18,580; Basic 25 h ₹95,570; Standard 50 h ₹1,86,153; Custom 100 h ₹3,32,416; Pro 200 h ₹6,64,831; 15% off the first pack | A | 0.85 | https://www.odoo.com/en_IN/pricing-packs |
| Partner rates (India) | ₹1,200–2,500/h partners; ₹500–1,800 freelancers; one bid ~₹1,788/h | C | 0.5 | partner blog; freelancer listing |
| Critical views | Trustpilot 3.1 (1,294 reviews). Sept 2026: "breaks with every update"; partner quoted $7,600 on top of $5,000; refused refunds; double charge. Capterra India: ~3 days support for small issues; "not very user friendly"; support pushed to partners | P / C | 0.6 | https://www.trustpilot.com/review/odoo.com , https://www.capterra.in/software/135618/odoo |

## A2. Zoho

| Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| Zoho One India | All-Employee **₹1,250 per employee a month yearly** (list ₹1,800) or ~₹2,500 monthly; Flexible User ~₹3,500/user yearly (₹4,000 monthly); +18% GST. Not confirmed on zoho.com (showed another country). HN (Dec 2025): ~USD 13/month for Indian companies | C + P-ish | 0.6 | https://siriusstar.in/cloud-solutions/zoho-one-india-pricing/ , https://www.itforsme.in/pricing/zoho-one-india , https://news.ycombinator.com/item?id=46130470 |
| All-Employee rule | "You must purchase a license for every employee." Short counts → buy the rest or move to Flexible; Zoho reserves "termination". Contractors/riders not defined | A | 0.85 | https://www.zoho.com/one/pricing/faq.html |
| What Zoho One includes | 50+ apps; CRM with 50,000 API credits/day + 1,000 per licence; export 200,000 records per module. **Zoho ERP (India) is not included** | A | 0.8 | https://www.zoho.com/one/plan-details.html |
| Zoho ERP India (new) | ₹999/user/month yearly (Standard, min 5) or ₹2,499 (Premium) + ₹249 per employee; finance/GST, inventory, manufacturing orders, POS, payroll; 1 lakh transactions/year on Standard; API add-on ₹999/month | A | 0.8 | https://www.zoho.com/en-in/erp/pricing/ |
| Zoho Books | Free: 1 user + accountant, 1,000 invoices/year, revenue ≤ ₹25 lakh, **GSTR filing yes, e-way bill yes, e-invoice no**, API 1,000/day. Standard ₹749 (3 users, 5,000 invoices, e-invoice, 2,000 API/day). Professional ₹1,499; Premium ₹2,999; Elite ₹4,999 | A | 0.85 | https://www.zoho.com/in/books/pricing/ |
| Zoho Inventory | Free: 50 orders/month, 1 user, 1 location. Standard ₹999 (500 orders, 3 users, 2 locations). Premium ₹2,299 (3,000, batch tracking). Plus ₹4,999 (7,500). Enterprise ₹7,499 (15,000). API 100/min; 1,000–10,000/day. India DC `zohoapis.in`. **No recipe BoM with auto deduction on sale** | A | 0.8 | https://www.zoho.com/in/inventory/pricing/ , https://www.zoho.com/inventory/api/v1/introduction/ |
| Zoho Payroll | **Free forever up to 10 employees**: income tax, EPF, ESI, PT, LWF, TDS worksheet. Standard ₹1,000/month (25 employees, then ₹40 each). Professional ₹3,000 (50, then ₹60). Form 16/24Q/ECR not named | A | 0.8 | https://www.zoho.com/in/payroll/pricing/ |
| CRM / Analytics / Creator free | CRM 3 users; Analytics 2 users, 10,000 rows; Creator 1 app (INR UNKNOWN; 50 cloud function calls/user/day on lowest plan) | A | 0.7 | Zoho pricing pages |
| Desk / People / Recruit free | UNKNOWN (pages 404) | — | — | |
| Data residency | India data centres Mumbai (primary) + Chennai; Zoho's own hardware | A + P (Sridhar Vembu in press) | 0.8 | https://prezohoweb.zoho.com/know-your-datacenter.html |
| n8n | Built-in node = **Zoho CRM only**; Books, Inventory, Payroll, Creator via HTTP + OAuth | A | 0.9 | n8n source `nodes/Zoho` |
| Critical views | Capterra 4.1 (service 3.6); ~68% of support-themed and ~78% of bug-themed reviews negative. Trustpilot (Zoho One) 2.0 (13). Inventory failed to sync Shopify returns ~8 months (Sylvain Cholette, Sept 2025); Indian firm's migration broke Mail and Books (Linguainfo, Jun 2025); CRM and Books quotes do not sync (Gartner reviewer) | P / C | 0.6 | https://www.capterra.com/p/166175/Zoho-One/reviews/ , https://www.trustpilot.com/review/one.zoho.com |
| Positive view | HN (Dec 2025): "for small businesses, Zoho is a godsend" | C | 0.5 | https://news.ycombinator.com/item?id=46121592 |

## A3. Attio

| Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|
| Fit | Relationship CRM for B2B sales and fundraising — **not operations software**. Useful for catering/corporate leads, investors, suppliers | — | 0.8 | judgement |
| Data model | Objects (People, Companies; optional Deal, User, Workspace; custom) hold records; Lists are boards pointing at records with list-only fields | A | 0.85 | https://docs.attio.com/docs/objects-and-lists |
| Plans | Free: 3 seats, 3 objects, 50,000 records, **250 workspace credits/month**, 100 seat credits/user. Plus $35/$44: 10 seats, 1,500 credits. Pro $79/$99: 10,000 credits. Startup discount up to 80% | A | 0.85 | https://attio.com/pricing |
| Credit burn, workflows | Triggers, logic, lookups free. **Each record write, task, HTTP call or Slack message = 1 credit**; AI/code by tokens; loops charge every step. **1,000 orders/day as records ≈ 30,000 credits/month = 120× the free allowance** | A + arithmetic | 0.85 | https://attio.com/help/reference/automations/automations-billing |
| Credit burn, AI | AI field 1 credit/record; web research agent 10/record; one "Ask Attio" prompt ~10–80. Top-ups +5,000 for $70–85/month up to +50,000 for $475–595. Zero-credit behaviour UNKNOWN | A | 0.8 | Attio help; pricing |
| API limits | 100 reads + 25 writes per second per workspace; 429 + Retry-After | A | 0.9 | https://docs.attio.com/rest-api/guides/rate-limiting |
| Webhooks | At-least-once, Idempotency-Key, HMAC-SHA256, 10 retries over ~3 days, 5 s timeout, 25 rps per target | A | 0.9 | https://docs.attio.com/rest-api/guides/webhooks |
| Export | Zip of CSVs on all plans; **emails and enriched data not exportable** | A | 0.85 | https://attio.com/help/reference/imports-exports/back-up-your-workspace-data |
| n8n | No built-in node (HTTP Request or community node) | A | 0.9 | n8n node list |
| Critical views | Capterra: sequences capped at 10 people at once; "find records" step capped at 100; weak reporting. HN (Jun 2026): "attio/twenty are soooo bad at [agents]" | P / C | 0.55 | Capterra; https://news.ycombinator.com/item?id=48529878 |

## A4. HubSpot Free, Twenty, ERPNext / Frappe

| Tool | Item | Finding | Tier | Conf | Source |
|---|---|---|---|---|---|
| HubSpot Free | Limits | **2 users, 1,000 contacts**, ~1M other records, 10 custom fields total, 1 pipeline per object, 2,000 branded emails/month, 1 automated action; imports 50/day; API exports 30/day. Old "1M contacts, unlimited users" is outdated | A | 0.85 | https://legal.hubspot.com/hubspot-product-and-services-catalog |
| HubSpot Free | Fit / n8n / AI | B2B leads only; built-in n8n node; AI credits start at Starter | A | 0.6–0.9 | catalog, n8n source |
| Twenty | ARM self-host | `twentycrm/twenty` v2.46.0 (9 Oct 2026) amd64 + arm64; Postgres, Redis, server + worker; ~2 GB RAM | A / C | 0.9 / 0.5 | Docker Hub |
| Twenty | Licence | AGPLv3, but `@license Enterprise` files need a paid subscription; SSO, row-level permissions, audit logs on paid tiers | A | 0.8 | https://raw.githubusercontent.com/twentyhq/twenty/main/LICENSE , https://twenty.com/pricing |
| Twenty | Cloud | Pro $9/user/month (yearly), Organization $19; API 50/min (Pro), 100/min; "50 workflow credits per year" on Pro (verify) | A | 0.6 | twenty.com/pricing |
| Twenty | n8n / activity | No built-in node; ~58k GitHub stars; commits 12 Oct 2026 | A | 0.9 | GitHub |
| ERPNext | Core | v15.122 (7 Oct 2026), GPLv3, free: stock, purchase, BoM/manufacturing, accounts, POS; Docker arm64 | A | 0.9 | GitHub releases, Docker Hub `frappe/erpnext` |
| ERPNext | India GST | **India Compliance** app (free, open source): e-invoice, e-way bill, GSTIN checks, GSTR-1 (beta), 2A/2B reconciliation; API suite free on Frappe Cloud; self-hosted buys credits (min 1,000; price UNKNOWN) | A | 0.75 | https://www.indiacompliance.app/pricing , https://discuss.frappe.io/t/india-compliance-whats-new/130126 |
| ERPNext | India payroll | Frappe HR + **frappe/india-payroll** (GPLv3): EPF with ECR export, ESI, PT, LWF, both tax regimes, Form 24Q e-filing (Sandbox API), Form 16. **Repo created Apr 2026, 23 stars — young** | A | 0.7 / 0.4 production-ready | https://github.com/frappe/india-payroll |
| ERPNext | Restaurant | **URY** (Tridz): POS for dine-in, delivery, takeaway, aggregator orders + **URY Mosaic KDS**; "in active development, backward compatibility not guaranteed" | A | 0.7 | https://github.com/ury-erp , https://cloud.frappe.io/marketplace/apps/ury |
| ERPNext | Frappe Cloud (Mumbai) | Shared on AWS Mumbai ₹410 / ₹820 / ₹2,050 (offsite backups, private bench, 150+ apps) / ₹3,075 / ₹4,100 (SSH + DB). Hetzner Mumbai 4× CPU same price. Dedicated from ₹3,600/month. **URY needs a ₹2,050+ private plan** | A | 0.75 | https://frappe.io/cloud/sites , https://frappe.io/cloud/pricing |
| ERPNext | n8n | **Built-in ERPNext node**: create, delete, get, get many, update any record type, with filters | A | 0.95 | n8n source `ERPNext/DocumentDescription.ts` |
| ERPNext | Critical views | Self-hosted `bench` updates broke sites (Elvis_Glazier, 2022); v12→v13 patches failed on Frappe Cloud (rtdany10, 2021); projects die from dirty data and half-set modules (vendor blog) | P / C | 0.6 | https://discuss.frappe.io/t/bench-broken-after-update/85610 , https://discuss.frappe.io/t/1054-unknown-column-mandatory-depends-on-in-field-list/66406 |

## A5. Three-stack comparison (INR a month, before 18% GST)

Assumptions: internal users MVP1 ~3, MVP2 ~10, MVP3 ~40. Payroll headcount MVP1 5, MVP2 ~60, MVP3 ~80 if riders are contractors (~180 if on payroll). Yearly billing; Odoo first-year discount.

| | **Odoo-centric** | **Zoho-centric** | **Best-of-breed + n8n glue** (ERPNext core, Zoho Books/Payroll where safer, HubSpot Free) |
|---|---|---|---|
| MVP1 licence | ₹0 (One App Free: Manufacturing + Inventory, no Purchase, **no API**) or ₹3,240 (Custom × 3) | ₹749–1,748 (Books Standard, Inventory Free/₹999, Payroll Free, CRM Free) | ₹0–820 (ERPNext on Frappe Cloud ₹820 or our ARM box; Payroll Free; HubSpot Free) |
| MVP2 licence | ₹10,800 (Custom × 10) + credits | Single apps ~₹6,200 + Desk (UNKNOWN); Zoho One Flexible × 10 ₹35,000; All-Employee × 60 ₹75,000 | ₹2,050–4,100 Frappe private + Zoho Payroll ~₹2,400 → **~₹4,500–6,500** |
| MVP3 licence | ₹43,200 (Custom × 40) (+₹195/rider as Light User, UNKNOWN if allowed) | Zoho One All-Employee ~₹1,00,000 (80) to ₹2,25,000 (180); Flexible × 40 ₹1,40,000; single apps / Zoho ERP ~₹40,000 + ₹249/employee | Dedicated ₹3,600+ + Frappe partner support (UNKNOWN) → ~₹10,000–30,000 |
| Setup effort | Medium–high: Success Pack ₹81k–1.6L or 2–6 weeks partner at ₹1,200–2,500/h; KDS needs custom work to import our orders | Low–medium: Books and Payroll in days with a CA; Inventory recipes weak | Medium: we own ERPNext setup (BoM, warehouses, India Compliance), n8n syncs; ~2–4 weeks internal (estimate) |
| India compliance | Strong, but **GSTR filing and Payroll are Enterprise**; e-invoice/e-way bill in Community (credits) | Strongest out of the box: Books GST filing even on Free; Payroll PF/ESI/PT/LWF; data in India | Good on paper (India Compliance, india-payroll with ECR/24Q/Form 16) but payroll app is young |
| API / n8n | Built-in node, **only on Custom** | CRM node only; rest via HTTP + OAuth; low daily limits on free plans | Best: built-in any-record node, free API, no daily cap beyond our server |
| Lock-in | Medium (backup download; forced SaaS upgrades; proprietary Enterprise layer) | Medium–high (many apps; export per app) | Low (GPL, own database, movable host) |
| Main risks | Price after year-1 discount; Online updates breaking things (P); weak direct support | Bugs, slow support, apps not syncing (P/C); All-Employee count trap | We become the ERP admin; self-hosted upgrades break; URY and india-payroll immature |

## A6. Recommendation per phase (conf 0.6 — needs the tests below)

- **MVP 1 (1 kitchen, 5 staff):** no ERP. **Zoho Books Standard (₹749)** for ledger + GST with a CA (Free if revenue stays under ₹25 lakh); **Zoho Payroll Free** (≤ 10). For recipes and stock, a **2-week side-by-side test**: Odoo One App Free with *Manufacturing* (Inventory + Kit BoMs free, manual entry, no API) vs **ERPNext on Frappe Cloud (₹820)** (API + n8n node). Score daily stock-count time and how far recipe-based stock drifts from the real count. Total ~₹750–1,600/month.
- **MVP 2 (1–3 kitchens, 20–50 riders):** one system of record for stock, purchase and recipes, switched at a financial-year start (1 April). **Lean: ERPNext** (~₹4,500–6,500/month total) — the free API and built-in node matter more than polish for our n8n + Supabase team. Keep Zoho Payroll until india-payroll gives 3 correct runs in parallel. Choose **Odoo Custom (₹10,800/month)** only for a partner-supported, polished UI and the Odoo KDS. HubSpot Free for catering/corporate leads.
- **MVP 3 (5–10 kitchens, 30 office staff):** review MVP 2 evidence: stay on ERPNext with a paid Frappe partner contract, or move to Odoo Custom (₹43–54k/month + partner) if non-technical staff struggle. **Zoho One** only if we also want email and office apps and riders are contractors. **Leave Attio out of operations** at every phase (keep it, if at all, for investors and partners).

Tests before committing (each claim < 0.7):
1. Odoo Standard: can an inbound webhook automation rule accept orders from n8n without the external API?
2. Odoo Light User: written answer on whether riders/kitchen staff qualify at ₹195.
3. ERPNext india-payroll vs Zoho Payroll: one month in parallel; ECR file and PT must match.
4. A daily ingredient-use push from Supabase to the stock system: one record per kitchen per day, not per order.

## A7. Open questions

Zoho One INR price from zoho.com; Zoho Desk/People/Recruit free limits; Zoho Creator INR; Zia AI cost; Odoo AI credits per feature; Odoo Light User rules; Odoo Online data region; Odoo.sh INR; extended-support fee; Odoo Standard inbound webhooks; Attio zero-credit behaviour; Twenty "50 workflow credits per year"; India Compliance self-hosted credit price; Frappe partner support prices; SS Code aggregator status (legal); UrbanPiper per-location price; Reddit/YouTube first-hand accounts (search manually: "Odoo restaurant India", "ERPNext cloud kitchen", "Zoho One India").
