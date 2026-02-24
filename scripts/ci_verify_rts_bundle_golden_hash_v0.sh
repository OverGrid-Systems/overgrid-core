#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

GOLD="core/spec/golden_hashes_v0.json"
test -f "$GOLD" || { echo "MISSING_GOLDEN_HASHES_V0 $GOLD"; exit 1; }

EXPECTED="$(node - <<'NODE'
const fs=require("fs");
const j=JSON.parse(fs.readFileSync("core/spec/golden_hashes_v0.json","utf8"));
const v = j?.rts_bundle_v0;
let exp = null;
if(typeof v === "string") exp = v;
else if(v && typeof v === "object") exp = v.expectedFinalChainHash || v.chainHash || v.finalChainHash || v.hash || v.value || null;
if(!exp){ console.error("BAD_GOLDEN_HASHES_V0"); console.error("rts_bundle_v0_value", JSON.stringify(v)); process.exit(1); }
process.stdout.write(exp);
NODE
)"

# اجلب الـFinal ChainHash من verifier الموجود
OUT="$(bash scripts/ci_verify_rts_bundle_v0.sh)"
GOT="$(printf '%s\n' "$OUT" | sed -nE 's/^Final ChainHash:\s*([0-9a-f]+)\s*$/\1/p' | tail -n 1)"

test -n "$GOT" || { echo "BAD_RTS_BUNDLE_V0_OUTPUT"; echo "$OUT"; exit 1; }

if [ "$GOT" != "$EXPECTED" ]; then
  echo "BAD_RTS_BUNDLE_V0_GOLDEN_CHAINHASH"
  echo "expected $EXPECTED"
  echo "got      $GOT"
  exit 1
fi

echo "OK_RTS_BUNDLE_V0_GOLDEN_CHAINHASH $GOT"
