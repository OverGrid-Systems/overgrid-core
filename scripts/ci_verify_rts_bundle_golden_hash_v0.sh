#!/usr/bin/env bash
set -euo pipefail

# 1) احصل EXPECTED من الـverifier الرسمي (schema-agnostic)
OUT_GOLDEN="$(bash scripts/ci_verify_golden_hashes_v0.sh 2>&1)"
EXPECTED="$(printf '%s\n' "$OUT_GOLDEN" | grep -E '^OK_GOLDEN_rts_bundle_v0 ' | tail -n 1 | cut -d' ' -f2)"

test -n "$EXPECTED" || {
  echo "BAD_GOLDEN_HASHES_V0_NO_RTS_ENTRY"
  echo "$OUT_GOLDEN"
  exit 1
}

# 2) شغّل verifier الـRTS bundle الحالي وخذ الـFinal ChainHash
OUT="$(bash scripts/ci_verify_rts_bundle_v0.sh 2>&1 || true)"
GOT="$(printf '%s\n' "$OUT" | grep -E '^Final ChainHash:' | tail -n 1 | cut -d' ' -f3)"

test -n "$GOT" || { echo "BAD_RTS_BUNDLE_V0_OUTPUT"; echo "$OUT"; exit 1; }

if [ "$GOT" != "$EXPECTED" ]; then
  echo "BAD_RTS_BUNDLE_V0_GOLDEN_CHAINHASH"
  echo "expected $EXPECTED"
  echo "got      $GOT"
  exit 1
fi

echo "OK_RTS_BUNDLE_V0_GOLDEN_CHAINHASH $GOT"
