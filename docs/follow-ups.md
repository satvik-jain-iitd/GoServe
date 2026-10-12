# Follow-ups

Every follow-up, so nothing is lost. Each has an owner and a status.

| # | Follow-up | Owner | Status |
|---|---|---|---|
| F1 | Final stack decision (PWA framework, backend framework, database). Needs its own ADR. | Owner + agent | Open |
| F2 | Exact Delhi kitchen location. | Owner | Open |
| F3 | Expected month-1 orders per day. | Owner | Open |
| F4 | Decide if MVP 0 demo uses real payment or pay-later. | Owner | Open |
| F5 | Decide if V1 has subscriptions or single orders only. | Owner | Open |
| F6 | Node/TypeScript CI jobs (lint, typecheck, test, build) to be added once the stack ADR lands. | Agent | Open |
| F7 | ESLint, Prettier, and lint-staged to be added once the stack ADR lands. | Agent | Open |
| F8 | Merge the `shipquick_latest` `dev` branch rules into its `main` upstream, then re-pin the submodule. | Owner | Open |
| F9 | Decide whether GoServe's new generic rules should be contributed back to `shipquick_latest`. | Owner | Open |
| F10 | Replace the placeholder design tokens with GoServe brand colors and font. | Owner + agent | Done (deck palette in site/src/styles/tokens.css) |
| F11 | Add branch protection on `dev` and `main` (needs a public repo). | Agent | Done |
| F12 | Add the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` so the deploy workflow runs. | Agent | Done |
| F13 | Create the GitHub issue tree (epics and stories) and link tests to stories. | Agent | Open |
| F14 | Attach the two n8n workflows to the 🍔 GoServe tag in the UI (the public API marks tags read-only). | Owner | Open |
| F15 | Choose the final GoServe domain and move the site off letsdwelo.in. | Owner | Open |
| F16 | Create MongoDB indexes on goserve.preregistrations and goserve.investor_contacts (email, receivedAt). | Agent | Open |
| F17 | Decide whether the doorway site keeps its own repo or joins the PWA repo. | Owner + agent | Open |
| F18 | Link the site stories to the PWA stories once the PWA repo exists. | Agent | Open |
| F19 | Check how many Supabase projects the owner has (2 free per owner), then create the "goserve" project. | Owner + agent | Open |
| F20 | Cap MongoDB memory and create a `goserve`-only Mongo user (needs an owner yes; restarts a service). | Owner | Open |
| F21 | Turn on n8n execution pruning (needs an owner yes; restarts n8n). | Owner | Open |
| F22 | Start FSSAI licence and Razorpay KYC. | Founder | Open |
| F23 | Start SMS DLT registration and WhatsApp Business approval. | Founder | Open |
| F24 | Buy the GoServe domain; move the site and the app off letsdwelo.in. | Founder | Open |
| F25 | Move GoServe services to GoServe-owned accounts later. | Owner | Open |
| F26 | Measure Laya speed on the Oracle ARM CPU before any claim. | Agent | Open |
| F27 | Check the DPDP Rules dates and what the pilot must do. | Agent | Open |
| F28 | Decide the PWA stack (ADR-006) at the start of the MVP 0 build. | Owner + agent | Open |
| F29 | Change the website from Kota to Delhi (own fix PR). | Agent | Done (#18) |
| F30 | Load test n8n on the Oracle box with real payloads. | Agent | Open |
| F31 | Discuss ADR-004 MVP 1 to MVP 4 with the founder. | Owner | Open |
| F32 | Rotate the GoServe OpenRouter key (it was pasted in chat). | Owner | Open |
| F33 | Create the Supabase account access token (`SUPABASE_ACCESS_TOKEN`) so Claude can check the paused project and create "goserve". | Owner | Open |
| F34 | After the check, decide whether to delete the paused Supabase project (explicit "haan" with its name). | Owner | Open |
| F35 | Paste the updated rulebook text (A1 rule 3, B11 95.17 and 95.23) into the claude.ai skill `n8n-house-rules`. | Owner | Open |
| F36 | Other projects still mention a fixed workflow count in their own docs (referral_automation HANDOVER, Miraya plan, email-triage). Update when those projects are next touched. | Agent | Open |
| F37 | Read Meta's INR WhatsApp rate card before budgeting MVP 2 messages. | Agent | Open |
| F38 | Ask Razorpay and Cashfree for a lower UPI rate before MVP 2. | Founder | Open |
| F39 | Test OSRM and Laya RAM and speed on the Oracle ARM box. | Agent | Open |
| F40 | Ask the founder for a vector (SVG) logo, if one exists. | Founder | Open |
