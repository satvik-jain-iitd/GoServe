#!/bin/sh
# Pushes a Kaggle kernel folder with a hard time limit, and refuses if the weekly GPU budget is used up.
# Usage: push.sh KERNEL_DIR TIMEOUT_SECONDS MAX_USED_HOURS   (needs KAGGLE_API_TOKEN, KAGGLE_USERNAME, and `kaggle` on PATH)
set -e
dir=$1; secs=$2; max=$3
used=$(kaggle quota | awk '$1=="GPU"{print $2}' | tr -d h)
if grep -q '"enable_gpu": true' "$dir/kernel-metadata.json"; then
  python3 -c "import sys; sys.exit(0 if float('$used') + $secs/3600 <= float('$max') else 1)" || { echo "REFUSED: GPU used ${used}h + ${secs}s would pass the ${max}h cap"; exit 1; }
fi
echo "GPU used before: ${used}h"
kaggle kernels push -p "$dir" -t "$secs"
