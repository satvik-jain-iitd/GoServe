# Release checklist: production (story #78)

Who does what: **O** = the owner, **A** = the agent (with the owner's yes before each write). Nothing here is done by itself.
This replaces F63 and F64 (a). Read `docs/architecture/phase-gate.md` first.

## Where we stand (15 Oct 2026)

| Part | State |
|---|---|
| Prod Supabase project | **Done 15 Oct 2026:** seven migrations applied, anonymous sign-in ON, 10 dishes, 8 tables, 6 rules; security spot check passed. Prod has no orders and no users. |
| Cloudflare Pages project `goserve-app` | **Exists** (made 12 Oct 2026, production branch `main`, no deployment yet; read with `cf pages list` after the owner's `cf auth login`, 15 Oct). `goserve-app.pages.dev` answers 522 only because nothing is deployed. |
| Repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Exist. |
| Prod keys for the build (`PROD_VITE_*`) | Not set. |
| Prod copy of the order workflows | **Done 15 Oct 2026, inactive:** nine `PROD` workflows, credential `GoServe Supabase prod`, webhook path `gs-order-prod`. Waits for "activate". |
| `main` | Has only the investor site and old code. The app reaches it through a release PR. |

## Steps, in order

1. **Done, no click needed (F61 closed 15 Oct).** The Pages project exists. If it ever has to be made again: **O: create the Pages project.** In the Cloudflare dashboard open Workers & Pages, then Create, then the Pages tab, then "Upload assets" (Direct Upload). Name it exactly `goserve-app`. Upload any one small file (an empty `index.html` is fine) and deploy it. Then open the project, Settings, Branch control (or Builds), and make sure the production branch is `main`. Do not add a custom domain. Do not touch the project `goserve` (that is the investor site, `letsdwelo.in`).
2. **Done 15 Oct 2026 (owner's yes).** For the record: **A: prod database.** Dry run: `set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 scripts/release_db.py`. It reads only, and prints the plan with the project **name** (it must say GoServe; a dev-looking or other name is refused), so your yes goes to a name. **O says yes.** Then `python3 scripts/release_db.py --apply`. It refuses a database that already has tables, applies the migrations in order, switches anonymous sign-in on, and checks 10 dishes, 8 tables and 6 security rules.
3. **Done 15 Oct 2026 (owner: "haan" to the credential and the inactive deploy).** The credential `GoServe Supabase prod` exists (host-limited to the prod Supabase host). Nine `PROD` workflows are deployed **inactive** with their own webhook path `gs-order-prod`; ids in `docs/integrations/n8n-order-workflows.md`. **Still to come: O says "activate"** (sub-workflows first, then MAIN 01 PROD; MAIN 90 PROD only if a prod card is wanted).
4. **A: prod secrets for the build** (after step 3), with the owner's yes. Values come from the vault and are never printed: `PROD_VITE_SUPABASE_URL`, `PROD_VITE_SUPABASE_ANON_KEY`, `PROD_VITE_ORDER_URL`, `PROD_VITE_DEMO_TOKEN`. The prod demo token is new and goes into the vault first (rotate it each release).
5. **A: release PR.** `git checkout -b release/<name> origin/main`, then `git checkout origin/dev -- site app scripts design/tokens.json design/brand ops .github .gitignore README.md` (see `docs/PLAN.md` section 2). The PR body has the demo notes. **O reviews and merges.** The merge runs `deploy-app.yml`.
6. **A: check.** `goserve-app.pages.dev` answers 200 and shows the menu; `/health` shows OK for Supabase, n8n and Jev; place one order and see it on the kitchen screen. Record the result in `docs/tests/test-cases.md`.
7. **Then:** UptimeRobot monitors for dev and prod (story #55), the 20 of 20 scripted runs and the founder's Android check (story #56).

## If something goes wrong

- Bad app deploy: in the Pages project, Deployments, roll back to the last good one. Or revert the release PR on `main`.
- Bad prod migration: the script stops at the first error and says which file. The prod database has no real data yet, so the fix is to reset the project's `public` schema with the owner's yes and run the script again.
- Prod workflows misbehave: turn the kill switch on in the prod MAIN 01 Config; the phone shows "Orders are paused".
