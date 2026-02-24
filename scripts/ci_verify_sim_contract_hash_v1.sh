#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/sim_spec_v1.md"
CONTRACT="core/spec/sim_contract_hash_v1.json"

test -f "$SPEC" || { echo "MISSING_SPEC $SPEC"; exit 1; }
test -f "$CONTRACT" || { echo "MISSING_CONTRACT $CONTRACT"; exit 1; }

EXPECTED=$(node -p 'JSON.parse(require("fs").readFileSync("'"$CONTRACT"'","utf8")).expectedSha256 || ""')
test -n "$EXPECTED" || { echo "BAD_OR_EMPTY_expectedSha256 (run: node scripts/gen_sim_contract_hash_v1.cjs)"; exit 1; }

ACTUAL=$(node - <<'NODE'
const fs=require("fs");
const crypto=require("crypto");
const spec="core/spec/sim_spec_v1.md";
const h=crypto.createHash("sha256").update(fs.readFileSync(spec)).digest("hex");
console.log(h);
NODE
)

if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "SIM_CONTRACT_HASH_MISMATCH"
  echo "EXPECTED $EXPECTED"
  echo "ACTUAL   $ACTUAL"
  exit 1
fi

echo "OK_SIM_CONTRACT_HASH_V1 $ACTUAL"
