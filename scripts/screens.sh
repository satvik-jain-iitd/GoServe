#!/usr/bin/env bash
# Story 821 (ShipQuick kit name: scripts/screens.sh). Renders every screen in docs/screens.txt with the project's own e2e runner.
#   scripts/screens.sh            render only: the PNGs go to app/screens-out (or $SCREENS_OUT), nothing is compared
#   scripts/screens.sh --check    render and compare with the accepted pictures; non-zero when a screen changed
#   scripts/screens.sh --update   replace the accepted pictures (the diff of those PNGs is what the reviewer looks at)
# The accepted pictures are made on the CI machine (ubuntu), because fonts and anti-aliasing differ per operating system. A --check on another
# machine can differ by a few pixels; the CI run is the one that counts, and it uploads the renders and the diffs as an artefact.
set -euo pipefail
cd "$(dirname "$0")/../app"
export SCREENS_OUT="${SCREENS_OUT:-$PWD/screens-out}"
mkdir -p "$SCREENS_OUT"
case "${1:-}" in
  --check)  npx playwright test tests/e2e/screens.spec.ts --project=chromium ;;
  --update) npx playwright test tests/e2e/screens.spec.ts --project=chromium --update-snapshots ;;
  "")       SCREENS_RENDER_ONLY=1 npx playwright test tests/e2e/screens.spec.ts --project=chromium ;;
  *)        echo "usage: scripts/screens.sh [--check|--update]" >&2; exit 2 ;;
esac
echo "renders: $SCREENS_OUT"
