# Supabase free-tier health watch: what the numbers really are (story #488, 27 Oct 2026)

Question: which daily numbers can we read for real, for the prod project, to warn before a free limit is hit? Tested on the dev project (read only, same plan). Prod needs the owner's token (see the last section).

| Number | Free limit | Real source | Tier | Confidence | Gap or note |
|---|---|---|---|---|---|
| Database size | 500 MB per project | SQL `pg_database_size(current_database())` (dev: 17.6 MB). Already in SUB 94 as `db_mb`. | A (Supabase docs for the limit; our own query for the number) | 0.9 | None. |
| Storage size | 1 GB | SQL `sum((metadata->>'size')::bigint)` on `storage.objects` (dev: 262,714 bytes). | A | 0.85 | Counts objects only; storage billing may use another rounding. |
| Auth users | 50,000 monthly active users | SQL `count(*)` on `auth.users` (dev: 163) and users with `last_sign_in_at` in 30 days. | A | 0.7 | Total users is an upper bound of MAU. Supabase's own MAU count is a dashboard number. |
| Egress | 5 GB | No endpoint. The Management API OpenAPI spec (fetched 27 Oct from `api.supabase.com/api/v1-json`) has none; the docs show egress only in the dashboard Usage page. | A (spec and docs) | 0.85 that no endpoint exists | **Gap.** Proxy: the DB host counter `node_network_transmit_bytes_total` from `analytics/endpoints/metrics` (dev: 1.26 GB since boot). It is the DB node's traffic, not the billed API egress, and it resets on reboot. Show it as "proxy", never as "x of 5 GB". |
| API requests | none on Free | `analytics/endpoints/usage.api-counts?interval=7day` gives auth, realtime, rest and storage requests per day. `usage.api-requests-count` gives one count (dev: 20,589; its window is not documented). | A | 0.8 | No request limit on Free. Show the trend, no percentage. |
| Realtime | 200 peak connections, 2 million messages | `usage.api-counts` has realtime request counts only. | A | 0.6 | **Gap.** Peak connections and message counts are dashboard only. We do not use Realtime much. |
| Healthy | n/a | `GET /v1/projects/{ref}/health?services=auth&services=db&services=realtime&services=rest&services=storage` answers per service (dev: all healthy). A SQL call that answers also proves "the DB answers". | A | 0.9 | Needs `services` or it answers 400. |
| Error rate | n/a | Our own `run_log` errors (already read by SUB 94). | S | 0.9 | Not Supabase's error rate. |

Plan limits: Supabase "About billing" page (Tier A, fetched 27 Oct): database 500 MB, egress 5 GB, storage 1 GB, 50,000 MAU, realtime 200 connections and 2 million messages, 500,000 function calls.

Motive check: Supabase earns when a project upgrades, so it shows usage in the dashboard and has little reason to expose billed egress to alert scripts. That fits the missing endpoint; it does not prove it is never added. Re-check the spec every quarter.

## Shape that follows

1. Phase 1, no new secret: one SQL function `health_numbers()` (service role) returns db bytes, storage bytes, users, active users 30 days. SUB 94 puts "x of limit (pct)" lines in the pilot card (MAIN 92). The call answering is the "DB answers" check. Telegram alert at 80% of any limit, once a day.
2. Phase 2, owner step: the Management API token as an n8n credential adds service health, API counts and the egress proxy. The owner creates it; the story does not.
3. Egress stays a named gap: the card says "egress: read the dashboard" until a source exists.
