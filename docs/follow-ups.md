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
| F24 | Buy a GoServe domain. Later (owner's call) move the investor site there and give `letsdwelo.in` back to the Dropshipping project (Dwelo). Until then, do not change letsdwelo.in. | Founder | Open |
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
| F41 | Run `npx wrangler login` once (the saved Cloudflare login expired) so Claude can create the `goserve-app` Pages project. | Owner | Open |
| F42 | Sign up for UptimeRobot (free) and save `UPTIMEROBOT_API_KEY` in Secrets; Claude then adds monitors with Telegram alerts. | Owner | Open |
| F43 | Get DPIIT startup recognition (free); it unlocks Zoho credits and other startup programs. | Founder | Open |
| F44 | One legal opinion: SS Code aggregator status (gig-worker contribution) and FSSAI e-commerce FBO central licence. | Founder | Open |
| F45 | Get 2–3 call-masking quotes (Exotel, Knowlarity, Pidge) before MVP 2. | Founder | Open |
| F46 | MVP 1 test: 2–3 own riders + a 3PL for one month; compare cost per drop. | Owner + founder | Open |
| F47 | Tell Claude the exact GitHub username of the development account. | Owner | Open |
| F48 | As `satvik-jain-iitd`: invite the development account to this repo with Write access; accept the invite from the dev account. | Owner | Open |
| F49 | As the development account: create a fine-grained token for this repo (Contents, Pull requests, Issues, Workflows: read and write) and save it as `GH_DEV_TOKEN` in Secrets; Claude then logs `gh` in with it. | Owner | Open |
| F50 | Turn on "require 1 approving review" for `dev` and `main` once the dev account works (so only the owner can merge). | Owner + agent | Open (set 13 Oct, see PR) |
| F51 | Vercel account on klickbae8yt: decided — dev site host (ADR-008). Owner saves `VERCEL_TOKEN` in Secrets. | Owner | Open |
| F52 | Rotate the Supabase, Vercel and UptimeRobot keys (pasted in chat on 13 Oct). | Owner | Open |
| F53 | Vercel `goserve-app-dev` deploys from GitHub Actions (no Vercel GitHub app link; it confused the owner and needs the app on the repo owner's account). Repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` set 13 Oct. The workflow (deploy on push to `dev`) is added in story #41 (PR open). | Agent | In review |
| F54 | Add UptimeRobot monitors for the app (prod + dev) after the first deploy; Telegram alerts via the UptimeRobot UI. | Agent | Open |
| F55 | Epics #33–#38 and stories #39–#56 need the owner to look at them (Definition of Ready item 6). | Owner | Open |
| F56 | Webhook demo token sits in the app (ADR-009). Rotate it at every release; keep the webhook throttled. | Agent | Open |
| F58 | Maskable icon: the brand icon has no safe-zone padding. Make a padded maskable version and add `"purpose": "maskable"` (Android adaptive icons) before the founder's Android check. | Agent | Open |
| F59 | PWA update flow: `autoUpdate` reloads silently. Before checkout and order tracking exist (stories #48 to #50), switch to a "new version, tap to refresh" prompt. | Agent | Open |
| F60 | WebKit/iOS: Playwright cannot test Add to Home Screen. The owner's iPhone check is the manual row for it. Add a WebKit project only if a Safari-only bug shows up. | Owner | Open |

| F57 | After PR for #40 merges: add the new CI checks `App (typecheck, unit, e2e, build)` and `Guard (secrets, size, markers, commit messages, PR size)` as required checks in the `protect dev and main` ruleset. | Owner | Open |
| F61 | Prod deploy needs the Pages project `goserve-app` to exist. No Cloudflare token is in the local vault, so I could not check. If the first run says "project not found", the owner creates it once (Pages, Create, Direct Upload, name `goserve-app`, production branch `main`). The app only reaches `main` through a release PR (rule 17). | Owner | Open |
| F62 | Put a read-only Cloudflare token (`Pages: Read`) in `~/Desktop/Secrets/` so the agent can check the Pages project and deploys without the owner. | Owner | Open |
| F63 | Prod needs the same migrations (`0001_schema.sql`, `0002_rls_realtime_menu.sql`, `0003_order_functions.sql`) and anonymous sign-ins switched on (Auth config `external_anonymous_users_enabled`) at the first release. No workflow applies it. Release-day step: `python3 scripts/apply_migration.py <prod-ref> <file>` by the agent with the owner's yes. Later: Supabase CLI with a ledger, and one source for the status list (enum). | Agent | Open |
| F64 | From PR #65 review: (a) before the first release write `docs/release-checklist.md` and move F63 there; (b) decide Turnstile captcha for prod anonymous sign-ins (rate limit is 30 per hour per IP); (c) move the seed out of the migration into `seed.sql` if prod needs a different menu; (d) say in the #56 demo checklist that kitchen and customer must share one browser; (e) show `image_credit` in the dish screen (#48); (f) after subscribing, run one select to catch missed events (#48/#49); (g) add the Realtime docs link to LEARNINGS. | Agent | Open |
| F65 | Story #45 leftovers. (a) Credential `GoServe Supabase dev` is created (14 Oct, owner yes). Still needed: "push kar do" to deploy the three workflows, then a yes to activate. (b) Built `GS ERR 00 Alert` (Telegram to the owner); not deployed. (c) Prod needs its own copy of the workflows (own url and credential) or a switch; decide before the first release. (d) Rate limit in MAIN 01 (ADR-009). (e) After deploy, check the browser preflight (OPTIONS with the `x-gs-token` header); if n8n does not answer it, move the token to the body. (f) Deploy script `ops/n8n/order/deploy.js` is written; dry run works. (g) Add a GoServe n8n folder/tag when the owner wants one. | Owner and agent | Open |
| F66 | From PR #66 review: (a) a shared n8n layout package instead of copies (Lead Engine, GoServe); (b) Config reads the active `params` version (with SUB 14, story #46); (c) a per-session order cap in `place_order` before activation, plus the n8n rate limit (F65 d); (d) DB checks for actor and line count if anything but n8n ever calls the functions; (e) same key with a different cart should return 409, decide when the cart screen (#48) makes keys; (f) registry test (rulebook 95.23) after deploy, with a GS folder or tag; (g) deploy day: fit-view screenshot of each canvas (B12.6) and the 5 live calls with MAIN and SUB execution ids go into test-cases. | Agent | Open |
| F67 | Story #46 needs the owner's yes to create the n8n credential `GoServe OpenRouter` (Header Auth, from the vault key `GOSERVE_OPENROUTER_KEY`). `deploy.js --apply` refuses without it. After deploy: one live Jev call as the S1 live row, and a Jev-down check (wrong model name) as S2. | Owner and agent | Open |
