#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/event_surface_hash_v1.json"
FILE="core/spec/event_surface_v1.md"

test -f "$SPEC" || { echo "MISSING_EVENT_SURFACE_HASH_SPEC"; exit 1; }
test -f "$FILE" || { echo "MISSING_EVENT_SURFACE_SPEC"; exit 1; }

EXPECTED=$(node - <<'NODE'
const fs=require("fs");
const j=JSON.parse(fs.readFileSync("core/spec/event_surface_hash_v1.json","utf8"));
console.log(j.sha256);
NODE
)

ACTUAL=$(node - <<'NODE'
const fs=require("fs");
const crypto=require("crypto");
const data=fs.readFileSync("core/spec/event_surface_v1.md");
console.log(crypto.createHash("sha256").update(data).digest("hex"));
NODE
)

if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "EVENT_SURFACE_HASH_MISMATCH"
  echo "EXPECTED $EXPECTED"
  echo "ACTUAL   $ACTUAL"
  exit 1
fi

echo "OK_EVENT_SURFACE_HASH_V1 $ACTUAL"
