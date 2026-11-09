#!/usr/bin/env bash
# The CI checks, run on this Mac before a push (story 822). The kit's own checks first (when the submodule is there), then GoServe's screen check.
# Usage: scripts/check_local.sh [kit check ...]      BASE=dev is the branch to compare with.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
rc=0
kit=knowledge/shipquick_latest/scripts/check_local.sh
if [ -f "$kit" ]; then bash "$kit" "$@" || rc=1; fi
python3 scripts/check_screen_change.py --local --base "${BASE:-dev}" || rc=1
exit $rc
