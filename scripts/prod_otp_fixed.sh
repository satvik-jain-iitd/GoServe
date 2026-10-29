#!/usr/bin/env bash
# OWNER-RUN (story #665). Puts the fixed phone code 123456 on the PROD otp function: sets the secret OTP_FIXED_CODE and deploys the function.
# Without --apply it only prints what it would do. The code is public by design for the test phase (anyone can sign in as any number while it is set).
# To remove it later: `supabase secrets unset OTP_FIXED_CODE --project-ref <prod ref>` and deploy the function again.
set -euo pipefail
# shellcheck disable=SC1090
source "$HOME/Desktop/Secrets/02_databases.env"
# shellcheck disable=SC1090
[ -f "$HOME/Desktop/Secrets/goserve/goserve.env" ] && source "$HOME/Desktop/Secrets/goserve/goserve.env"   # goserve.env last, so its values win (owner, 29 Oct 2026)
REF=$(printf '%s' "$SUPABASE_GOSERVE_PROD_URL" | sed -E 's#https://([^.]+)\..*#\1#')
echo "prod project ref: $REF"
echo "1. supabase secrets set OTP_FIXED_CODE=123456 --project-ref $REF"
echo "2. supabase functions deploy otp --project-ref $REF"
[ "${1:-}" = "--apply" ] || { echo "dry run: nothing changed. Run again with --apply."; exit 0; }
supabase secrets set OTP_FIXED_CODE=123456 --project-ref "$REF"
supabase functions deploy otp --project-ref "$REF"
echo "done"
