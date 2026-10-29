# Backend v2 on prod: runbook (story #677)

Owner: you run it. The reviewer reads the script first.

## Order
1. Reviewer reads `scripts/prod_backend_v2.py` and says go.
2. Dry run: `set -a; source ~/Desktop/Secrets/02_databases.env; set +a; python3 scripts/prod_backend_v2.py`
   It prints the project name, gaps, the plan and the secret names. No value is printed. Paste the output on #677.
3. If the plan looks right: `python3 scripts/prod_backend_v2.py --apply`
4. Only after step 3 says `done`: release the app to `main` (the deploy sets `VITE_OTP_GATE=1`).

## What `--apply` does, in order
1. The missing v2 migrations, one file at a time. It stops at the first error and names the file.
2. All 13 functions, with every function file (some import a sibling, like `quote`).
3. Secrets: `OTP_FIXED_CODE=123456`, a fresh `PAYMENTS_WEBHOOK_SECRET`, a fresh `PUSH_NOTIFY_SECRET`. The fresh ones are made by the script and written first to `~/Desktop/Secrets/05_goserve_prod_functions.env`. The dev values are never used.
4. The push pair in the database vault (`push_notify_url`, `push_notify_secret`).
5. Anonymous sign-in on, if it was off.
6. Checks: `health` answers ok, and `otp/send` with no login answers 401 `unauthorized`.

`PUSH_PROVIDER` and `PAYMENTS_PROVIDER` stay unset. The fake adapters run, as on dev.

## Rollback
- Functions: delete one in the Supabase dashboard, or deploy the old code again.
- Secrets: `OTP_FIXED_CODE` is removed in the dashboard (Edge Functions, Secrets). Then nobody can use 123456.
- Migrations only go forward. The dry run and the stop at the first error are the safety. Run the dry run again after a stop: it shows what is left.

## Check list after the run
- [ ] `health` ok on prod.
- [ ] Open the prod app on your phone. The first screen asks for a number and a code.
- [ ] Type your number and `123456`. You are in.
- [ ] Place a test order and cancel it.
- [ ] Note the result on #325.
