#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/golden_hashes_v0.json"
test -f "$SPEC" || { echo "MISSING_GOLDEN_HASHES_V0_SPEC $SPEC"; exit 1; }

# extract expectedFinalChainHash from golden_hashes_v0.json (supports object-or-string schema)
EXPECTED="$(node - <<'NODE'
const fs = require("fs");
const p = "core/spec/golden_hashes_v0.json";
const j = JSON.parse(fs.readFileSync(p,"utf8"));
if (!j || j.version !== "golden_hashes_v0" || !j.golden) {
  console.error("BAD_GOLDEN_HASHES_V0_SPEC");
  process.exit(1);
}
const v = j.golden["rts_bundle_v0"];
if (typeof v === "string") { console.log(v); process.exit(0); }
if (v && typeof v === "object" && typeof v.expectedFinalChainHash === "string") {
  console.log(v.expectedFinalChainHash);
  process.exit(0);
}
console.error("BAD_GOLDEN_RTS_BUNDLE_V0_ENTRY");
process.exit(1);
NODE
)"

test -n "$EXPECTED" || { echo "BAD_GOLDEN_RTS_BUNDLE_V0_EXPECTED_EMPTY"; exit 1; }

# run existing RTS bundle verifier and capture output
OUT="$(bash scripts/ci_verify_rts_bundle_v0.sh 2>&1 || true)"

# extract final chainhash line safely (no awk/$3)
GOT="$(printf '%s\n' "$OUT" | grep -E '^Final ChainHash:' | tail -n 1 | cut -d' ' -f3)"

test -n "$GOT" || { echo "BAD_RTS_BUNDLE_V0_OUTPUT"; echo "$OUT"; exit 1; }

if [ "$GOT" != "$EXPECTED" ]; then
  echo "BAD_RTS_BUNDLE_V0_GOLDEN_CHAINHASH"
  echo "expected $EXPECTED"
  echo "got      $GOT"
  exit 1
fi

echo "OK_RTS_BUNDLE_V0_GOLDEN_CHAINHASH $GOT"
