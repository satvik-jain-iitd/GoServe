# Release checklist: production (story #78)

Who does what: **O** = the owner, **A** = the agent (with the owner's yes before each write). Nothing here is done by itself.
This replaces F63 and F64 (a). Read `docs/architecture/phase-gate.md` first.

## Where we stand (15 Oct 2026)

| Part | State |
|---|---|
| Prod Supabase project | **Done 15 Oct 2026:** seven migrations applied, anonymous sign-in ON, 10 dishes, 8 tables, 6 rules; security spot check passed. Prod has no orders and no users. |
| Cloudflare Pages project `goserve-app` | **Exists** (made 12 Oct 2026, production branch `main`, no deployment yet; read with `cf pages list` after the owner's `cf auth login`, 15 Oct). `goserve-app.pages.dev` answers 522 only because nothing is deployed. |
| Repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Exist. |
| Prod keys for the build (`PROD_VITE_*`) | **Set 15 Oct 2026** (four GitHub secrets from the vault). |
| Prod copy of the order workflows | **Done 15 Oct 2026, inactive:** nine `PROD` workflows, credential `GoServe Supabase prod`, webhook path `gs-order-prod`. Waits for "activate". |
| `main` | **Release PR #91 merged 15 Oct 2026** (`b7a2a05`). The app is live at `goserve-app.pages.dev`; prod workflows SUB 11 to 16 and MAIN 01 PROD are active, MAIN 90 PROD and SUB 91 PROD stay off. |

## Steps, in order

1. **Done, no click needed (F61 closed 15 Oct).** The Pages project exists. If it ever has to be made again: **O: create the Pages project.** In the Cloudflare dashboard open Workers & Pages, then Create, then the Pages tab, then "Upload assets" (Direct Upload). Name it exactly `goserve-app`. Upload any one small file (an empty `index.html` is fine) and deploy it. Then open the project, Settings, Branch control (or Builds), and make sure the production branch is `main`. Do not add a custom domain. Do not touch the project `goserve` (that is the investor site, `letsdwelo.in`).
2. **Done 15 Oct 2026 (owner's yes).** For the record: **A: prod database.** Dry run: `set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 scripts/release_db.py`. It reads only, and prints the plan with the project **name** (it must say GoServe; a dev-looking or other name is refused), so your yes goes to a name. **O says yes.** Then `python3 scripts/release_db.py --apply`. It refuses a database that already has tables, applies the migrations in order, switches anonymous sign-in on, and checks 10 dishes, 8 tables and 6 security rules.
3. **Done 15 Oct 2026 (owner: "haan" to the credential and the inactive deploy).** The credential `GoServe Supabase prod` exists (host-limited to the prod Supabase host). Nine `PROD` workflows are deployed **inactive** with their own webhook path `gs-order-prod`; ids in `docs/integrations/n8n-order-workflows.md`. **Still to come: O says "activate"** (sub-workflows first, then MAIN 01 PROD; MAIN 90 PROD only if a prod card is wanted).
4. **A: prod secrets for the build** (after step 3), with the owner's yes. Values come from the vault and are never printed: `PROD_VITE_SUPABASE_URL`, `PROD_VITE_SUPABASE_ANON_KEY`, `PROD_VITE_ORDER_URL`, `PROD_VITE_DEMO_TOKEN`. The prod demo token is new and goes into the vault first (rotate it each release).
5. **A: release PR.** `git checkout -b release/<name> origin/main`, then `git checkout origin/dev -- site app scripts design/tokens.json design/brand ops .github .gitignore README.md` (see `docs/PLAN.md` section 2). The PR body has the demo notes. **O reviews and merges.** The merge runs `deploy-app.yml`.
6. **A: check.** `goserve-app.pages.dev` answers 200 and shows the menu; open `/kitchen/`, `/rider/`, `/ops/` and `/customer/` once (they fall back to the app); `/health` shows OK for Supabase, n8n and Jev; place one order and see it on the kitchen screen. Record the result in `docs/tests/test-cases.md`.
7. **Then:** UptimeRobot monitors for dev and prod (story #55), the 20 of 20 scripted runs and the founder's Android check (story #56).

## If something goes wrong

- Bad app deploy: in the Pages project, Deployments, roll back to the last good one. Or revert the release PR on `main`.
- Bad prod migration: the script stops at the first error and says which file. The prod database has no real data yet, so the fix is to reset the project's `public` schema with the owner's yes and run the script again.
- Prod workflows misbehave: turn the kill switch on in the prod MAIN 01 Config; the phone shows "Orders are paused".

## Next prod release (after 8 Nov 2026)

Prod's last release is #795 (30 Oct 2026). Every migration merged to `dev` after that date is missing on prod, so the whole list below applies unless `prod_backend_v2.py --dry-run` says a file is already there.

Do these in order. The owner says yes before each write. Check which migrations prod already has first.

1. Migrations on prod, in file order. List with `git log origin/dev -- supabase/migrations app/supabase/migrations --since=2026-11-04 --name-only`. As of 8 Nov:
   - `app/supabase/migrations/0054_retire_join_session.sql`
   - `supabase/migrations/20261104120000_sim_groups.sql`, `20261104130000_kitchen_remove.sql`, `20261104140000_sim_clear_in_slices.sql`
   - `20261105100000_staff_invites.sql`, `20261105110000_rider_remove_keeps_orders.sql`
   - `20261106100000_dish_description.sql`, `20261106110000_cancel_customer_first.sql`, `20261106120000_kitchen_location_drop_point.sql`
   - `20261107100000_push_outbox_stale.sql`, `20261107100100_push_latest_order_id.sql`, `20261107100200_health_push_wait.sql` (the push watchdog)
   - `20261107110000_push_arriving.sql`
   - `20261107120000_sim_dev_only.sql` (prod admin Reset is refused by design)
   - `20261107130000_order_instructions.sql` (before the Edge deploy, so the column exists)
   - `20261107140000_admin_invite.sql`
   - `20261108100000_owner_admin.sql`
   - any later merged ones.
2. Deploy the Edge Functions.
3. Redeploy n8n MAIN 01 and MAIN 30 on prod (`deploy.js --env prod --apply --from main01`).
4. The `migration-drift` workflow reaches `main` in this release (`.github/workflows/migration-drift.yml`), so the daily check can start. The repo secret SUPABASE_ACCESS_TOKEN is already set.
5. The reviewer checks the prod bundle for secrets (no sim token, no other key) before the release PR merges.
6. Supabase prod secrets: OLA_MAPS_CLIENT_ID and OLA_MAPS_CLIENT_SECRET (the owner stores them; the reviewer cannot).
7. The TWA manifests changed (portrait). The Android build comes later.
8. After the release: refresh the canvas Production row (#782).
