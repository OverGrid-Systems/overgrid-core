#!/usr/bin/env bash
set -euo pipefail

# verify that sim_v1 prints Final ChainHash when fed a known replay envelope stream
for f in core/spec/replay_v0/*.json; do
  echo "VERIFY_REPLAY $f"
  OUT=$(DEV_ENVELOPES_PATH="$f" npm run -s ci:all 2>&1 || true)

  # ci:all prints Final ChainHash for bundle/replay runs; ensure we can see at least one hash line
  echo "$OUT" | grep -qE 'Final ChainHash:\s*[0-9a-f]{64}' || {
    echo "---- OUTPUT ($f) ----"
    echo "$OUT"
    echo "NO_FINAL_HASH $f"
    exit 1
  }
done

echo "OK_REPLAY_V0"
