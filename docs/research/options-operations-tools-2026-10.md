# Options — operations tools to use, not build (Odoo, Attio and more)

**Date read:** 13 Oct 2026. Tiers: **A** = vendor page, the law or source code; **C** = blog, review site or forum without proof.
Conf = 0 to 1. A vendor page proves "they say so". UNKNOWN = not found.

Technology is not only the order app. It is also the tools that run the business: leads, support, stock, money, people.
We build the order system. We use ready tools for the rest.

---

## Teach me: CRM, ERP and helpdesk (Sharma ji's kirana store)

- **CRM** is Sharma ji's tidy, shared diary: Gupta aunty buys atta every 10 days; the builder next door may want bulk tea;
  his cousin may lend ₹2 lakh. For GoServe: investors, kitchen-space owners, corporate tiffin leads. Needed **from day one** (fundraising, partners).
- **ERP** joins the stock register, the supplier khata and the cash book. A Maggi packet sells, stock drops, a reorder alert comes,
  and the money lands in the books. For GoServe: every biryani uses rice, chicken and oil; the ERP shows real cost per plate and warns
  before we run out. One kitchen: a sheet is fine. Two or more kitchens (MVP 2): a sheet mistake costs real money.
- **Helpdesk** gives every complaint a number, an owner and a deadline. "Late order", "cold food", "refund?" come daily.
  MVP 1: WhatsApp + a sheet. MVP 2 (~10k users): a shared inbox for 2–3 agents.

---

## 1. Odoo

| Option | Free | Cost at our volume | Catch | n8n | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **One App Free** (Odoo Online) | 1 app, unlimited users, forever; apps it depends on also free; customer and supplier portal users free | ₹0 | A second app moves you to Standard; Studio moves you to Custom; extra credits (SMS) cost money | Built-in Odoo node | A | 0.8 | https://www.odoo.com/pricing-plan |
| Standard | All apps, Odoo Online | About ₹580–760 per backend user a month (page shows two price pairs) | No Studio, no self-host. Staff and riders who never log in cost nothing | Same | A | 0.6 | https://www.odoo.com/pricing |
| Custom | Studio, AI agents, multi-company, self-host allowed | About ₹1,080–1,350 per user a month | Odoo.sh hosting extra | Same | A | 0.6 | https://www.odoo.com/pricing |
| Community (self-host, open source) | Unlimited users and apps | ₹0 licence + server + our time | No Studio, no Helpdesk, no full accounting reports. India GST and e-invoice modules are included; GSTR filing is not | Same | A (source code) | 0.85 | https://github.com/odoo/odoo/tree/18.0/addons |

**Best single free app for GoServe: Inventory**, from MVP 2 (stock per kitchen, receipts, transfers, reorder points). Catch: auto purchase
orders need the Purchase app and recipe-based stock needs Manufacturing — that is Standard, about ₹2,900–3,800 a month for ~5 backend users (conf 0.6).
Critics (C, 0.4–0.5): some apps show "Upgrade" because they are Enterprise-only; setup is heavy and often needs a partner.

## 2. Attio

| Option | Free | Cost | Catch | n8n | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|
| **Free** | 3 seats, 3 objects, 50,000 records, 3 reports; workflows, API, webhooks, MCP, AI agents; 100 credits per seat + 250 per workspace a month | ₹0 for the two founders + 1 | No permissions; credits run out if AI agents run often (burn rate UNKNOWN) | No built-in node: HTTP node + REST API | A | 0.75 | https://attio.com/pricing |
| Plus | 10 seats, 5 objects, 250k records | $35 per user a month (yearly) | Basic permissions | Same | A | 0.85 | https://attio.com/pricing |
| Pro | Unlimited seats, 12 objects | $79 per user a month | Too much for us | Same | A | 0.85 | https://attio.com/pricing |

**Good at:** relationship CRM — investors, kitchen partners, B2B leads; pulls in email and calendar by itself. **Weak at:** thousands of consumer leads.
Critics (C, 0.4): light reporting, no dedup, credit packs on top of seats.

## 3. Alternatives

| Job | Option | Free | Cost later | Catch | n8n | Tier | Conf | Source |
|---|---|---|---|---|---|---|---|---|
| CRM | HubSpot Free | 2 users, 1,000 contacts | Starter from $15/seat (promo) | HubSpot branding; paid tiers climb fast | Built-in | A | 0.8 | https://www.hubspot.com/products/crm |
| CRM | Zoho CRM Free | 3 users, workflows, API 5,000 calls a day; export max 10 times | ₹800 per user a month | No custom modules | Built-in | A | 0.85 | https://www.zoho.com/crm/zohocrm-pricing.html |
| CRM | Twenty (open source) | Self-host free; cloud has AI agents and MCP | Cloud $9 per user a month | Mixed licence; 50 workflow credits a year on cloud Pro | HTTP | A | 0.75 | https://twenty.com/pricing |
| Helpdesk | Zoho Desk Free | 3 agents, email tickets | ₹800 per agent a month | Email only | HTTP | A | 0.8 | https://www.zoho.com/desk/pricing.html |
| Helpdesk | Freshdesk | **No free plan now** | $19 per agent a month | — | Built-in | A | 0.85 | https://www.freshworks.com/freshdesk/pricing/ |
| Helpdesk | Chatwoot (open source, WhatsApp inbox) | Self-host | Server only | Not checked in depth | HTTP | A (repo) | 0.4 | https://github.com/chatwoot/chatwoot |
| Accounts + GST | **Zoho Books Free (India)** | Free while yearly revenue ≤ ₹25 lakh; 1 user + accountant; 1,000 invoices a year; GST reports | Standard ₹749/mo, Professional ₹1,499/mo | E-invoicing not in Free | HTTP | A | 0.85 | https://www.zoho.com/in/books/pricing/ |
| Accounts | TallyPrime | — | Rent from ₹750/mo; Silver ₹22,500 once | Desktop-first; weak API; CAs know it well | No | A | 0.7 | https://tallysolutions.com/ |
| Law | E-invoicing | Needed only for B2B sales once turnover passes ₹5 crore (Notification 10/2023-CT) | — | B2C food orders are outside it on this reading | — | C | 0.8 | EY alert, May 2023 |
| Kitchen POS | Petpooja | No free plan | Base ₹12,000 (period UNKNOWN) | Built for POS and aggregators; our orders come from our own app | No | A | 0.6 | https://www.petpooja.com/pricing |
| ERP | ERPNext (Frappe Cloud) | 14-day trial; open source | From ₹410/mo per site | Plan contents unclear | Built-in | A | 0.75 | https://frappe.io/cloud/pricing |
| Payroll | **Zoho Payroll (India)** | Free for ≤ 10 employees | Paid price unclear | — | HTTP | A | 0.7 | https://www.zoho.com/in/payroll/free-payroll-software/ |
| HR | greytHR | Trial only | ₹2,495/mo up to 50 staff; ₹4,495 with shifts and geo-fencing | No free plan | HTTP | A | 0.85 | https://www.greythr.com/pricing/ |
| Docs | Notion Free | Unlimited for 1 person; 10 guests | Plus $10 per member a month | Block limit for 2+ members | Built-in | A | 0.8 | https://www.notion.com/pricing |
| Tables | NocoDB (self-host) | Free, unlimited rows | Cloud free: 1,000 records | "Fair-code" licence | Built-in | A | 0.8 | https://nocodb.com/pricing |
| Tables | Baserow | Self-host free; cloud 3,000 rows | Premium $10/user | — | Built-in | A | 0.75 | https://baserow.io/pricing |
| BI | Metabase (open source) | Self-host, unlimited dashboards | Cloud from ~$90/mo | No support | Built-in | A | 0.9 | https://www.metabase.com/pricing |
| Email + docs | Google Workspace (India) | — | Business Starter ₹270 per user a month | Free Gmail has no own-domain email | Built-in | A | 0.85 | https://workspace.google.com/intl/en_in/pricing.html |
| WhatsApp marketing | AiSensy Free | API, blue-tick application, 1 chat agent | Marketing msg ₹1.09, utility ₹0.145 | No broadcasts or automation on Free | HTTP | A | 0.6 | https://aisensy.com/pricing |
| WhatsApp marketing | Meta Cloud API via n8n | No reseller fee | Meta's per-message price only | We build template and opt-out handling | Built-in WhatsApp node | A | 0.7 | n8n node list |

---

## 4. Recommended stack by phase

Rule: **money, tax and payroll records live in SaaS** (our Oracle box sometimes goes down). Only tools that can live with downtime are
self-hosted (BI, internal tables). Back up anything self-hosted every night.

| Job | MVP 1 (1 kitchen) | MVP 2 (1–3 kitchens) | MVP 3 (5–10 kitchens) | n8n |
|---|---|---|---|---|
| Investor / partner / B2B CRM | Attio Free | Attio Free (Plus if > 3 people) | Attio Plus | HTTP |
| Customer data | Our own database | Same | Same | — |
| Support | WhatsApp Business app + a sheet | Zoho Desk Free or Chatwoot | Zoho Desk Standard or Chatwoot | HTTP |
| Kitchen stock and purchase | Sheet or NocoDB | **Odoo One App Free (Inventory)** | Odoo Standard (Inventory + Purchase + Manufacturing) | Built-in |
| Accounts and GST | Zoho Books Free + a CA | Zoho Books Standard (past ₹25 lakh) | Zoho Books Professional | HTTP |
| Payroll / attendance | Zoho Payroll Free (≤ 10 people) | Zoho Payroll paid or greytHR | greytHR Growth | HTTP |
| Tasks | GitHub Issues | Same | Same + Notion for ops | Built-in |
| Docs | `docs/` + Notion Free | Notion Free | Notion Plus | Built-in |
| WhatsApp campaigns | Meta API via n8n (utility only) | Same, or AiSensy/Interakt for a UI | Interakt or similar | Built-in |
| Dashboards | Metabase on Oracle | Same | Same or Metabase Cloud | Built-in |
| Forms | Google Forms | Same | Same | Built-in |
| Own-domain email | Workspace Starter ×2 | ×5 | ×15 | Built-in |

**Rough monthly cost (excludes GST and WhatsApp messages; conf 0.6):** MVP 1 ≈ ₹540 · MVP 2 ≈ ₹4,600 · MVP 3 ≈ ₹30,000–40,000.

**Agentic CRMs.** Attio, Twenty, HubSpot and Odoo all advertise AI agents. Safer for GoServe: n8n runs the agent steps with our
small-model ladder; the CRM stays a record store. AI cost and logic stay in our hands (opinion, conf 0.6, not tested).

## 5. Tests before deciding

1. Run an Attio Free workspace for 2 weeks; measure credit use.
2. Run an Odoo One App Free database with Inventory; test the n8n node on a copy, not live data.

## Weak spots

Odoo India price layout unclear; Attio Free feature ticks read from page layout; Petpooja billing period, Zoho People price, AiSensy paid prices and Meta India rates UNKNOWN; no first-hand (P) complaints found.
