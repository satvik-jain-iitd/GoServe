# Free tiers for GoServe — what the vendors say

**Date read:** 13 Oct 2026. Tiers follow the web-research rules: A = the vendor's own page.
A vendor's page proves "they say so". Our own load test is still needed.

| # | Claim | Source | Tier | Confidence | What it changes for us |
|---|---|---|---|---|---|
| 1 | Supabase Free: 2 active projects, 500 MB database, 5 GB egress, 1 GB files, 50,000 monthly active users, 200 live connections at once, 2 million live messages a month, 500,000 edge function calls, no backups, 1-day logs, paused after 1 week idle | https://supabase.com/pricing | A | 0.9 | Hot data only. Archive. Keep-alive. Live limits are the first wall |
| 2 | Supabase Realtime Free: 200 connections, 100 messages a second, 100 channel joins a second, 256 KB broadcast | https://supabase.com/docs/guides/realtime/limits | A | 0.9 | Rider GPS must be thinned out |
| 3 | The 2 free projects count across all orgs where you are owner or admin; paused projects do not count | https://supabase.com/docs/guides/platform/billing-on-supabase | A | 0.85 | Check how many projects the owner has before creating one |
| 4 | n8n Data tables: 200 MiB total per instance by default; env `N8N_DATA_TABLES_MAX_SIZE_BYTES` changes it; no direct access from a Code node | https://docs.n8n.io/data/data-tables/ | A | 0.9 | Not used for orders |
| 5 | n8n single instance: up to 220 workflow runs a second on a simple webhook flow (vendor test on c5a.large, Postgres) | https://docs.n8n.io/hosting/scaling/performance-benchmarking | A (vendor test) | 0.6 for our box | Our box uses SQLite and heavier flows. Load test pending |
| 6 | Vercel Hobby: "restricted to non-commercial personal use only" | https://vercel.com/docs/limits/fair-use-guidelines | A | 0.9 | The app stays on Cloudflare Pages |
| 7 | Render Free: sleeps after 15 minutes, about 1 minute to wake, free Postgres deleted after 30 days | https://render.com/docs/free | A | 0.9 | Not for anything live |
| 8 | Railway: one-time $5 trial for 30 days, then $1 a month credit | https://docs.railway.com/reference/pricing/free-trial | A | 0.85 | Not a free home |
| 9 | Enterprise architecture folder has no concrete privacy or security rules | `knowledge/shipquick_latest/architecture/architecture-portal/` (read in full) | S | 0.85 | We use out-of-the-box controls and say so |

Open: Supabase Pro limits and price (to check before MVP 3). DPDP Rules dates (to check, confidence 0.6).
