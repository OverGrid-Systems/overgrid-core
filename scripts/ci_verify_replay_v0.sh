#!/usr/bin/env bash
set -euo pipefail

for f in core/spec/replay_v0/*.json; do
  echo "VERIFY_REPLAY $f"
  OUT=$(node core/sim_v1.cjs "$f")
  echo "$OUT" | grep -q "Final ChainHash" || { echo "NO_FINAL_HASH $f"; exit 1; }
done

echo "OK_REPLAY_V0"
