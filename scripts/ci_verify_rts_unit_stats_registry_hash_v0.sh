#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/rts_unit_stats_registry_hash_v0.json"

test -f "$SPEC" || { echo "MISSING_SPEC $SPEC"; exit 1; }

EXPECTED="$(node - <<'NODE'
const fs=require("fs");
const j=JSON.parse(fs.readFileSync("core/spec/rts_unit_stats_registry_hash_v0.json","utf8"));
if(!j || j.version!=="rts_unit_stats_registry_hash_v0" || typeof j.sha256!=="string"){
  console.error("BAD_RTS_UNIT_STATS_REGISTRY_HASH_V0_SPEC");
  process.exit(1);
}
process.stdout.write(j.sha256);
NODE
)"

GOT="$(node scripts/gen_rts_unit_stats_registry_hash_v0.cjs)"

if [ "$EXPECTED" = "PLACEHOLDER" ]; then
  node - <<'NODE'
const fs=require("fs");
const p="core/spec/rts_unit_stats_registry_hash_v0.json";
const j=JSON.parse(fs.readFileSync(p,"utf8"));
j.sha256=process.env.GOT;
fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n","utf8");
console.log("OK: filled rts_unit_stats_registry_hash_v0 spec sha256", j.sha256);
NODE
else
  if [ "$GOT" != "$EXPECTED" ]; then
    echo "BAD_RTS_UNIT_STATS_REGISTRY_HASH_V0"
    echo "expected $EXPECTED"
    echo "got      $GOT"
    exit 1
  fi
fi

echo "OK_RTS_UNIT_STATS_REGISTRY_HASH_V0 $GOT"
