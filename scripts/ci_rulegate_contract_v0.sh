#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/rts_command_spec_v0.md"
TYPES="core/spec/rts_command_types_v0.json"
SIM="core/sim_rts_v0.cjs"

test -f "$SPEC"
test -f "$TYPES"
test -f "$SIM"

grep -q "RULEGATE_CONTRACT_V0" "$SPEC"
grep -q "RULEGATE_CONTRACT_V0" "$SIM"
grep -q 'require("./spec/rts_command_types_v0.json")' "$SIM"
grep -q 'BAD_CMD_TYPE' "$SIM"
grep -q 'RTS_CMD_TYPES_V0\.includes' "$SIM"

node - <<'NODE'
const fs=require("fs");
const types=JSON.parse(fs.readFileSync("core/spec/rts_command_types_v0.json","utf8"));
if(!Array.isArray(types) || types.some(x=>typeof x!=="string")) process.exit(1);
console.log("OK_RULEGATE_TYPES_JSON");
NODE

echo "OK_RULEGATE_CONTRACT_V0"
