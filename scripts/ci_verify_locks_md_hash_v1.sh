#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/locks_md_hash_v1.json"
FILE="docs/LOCKS.md"

test -f "$SPEC" || { echo "MISSING_LOCKS_MD_HASH_SPEC"; exit 1; }
test -f "$FILE" || { echo "MISSING_LOCKS_MD"; exit 1; }

EXPECTED=$(node - <<'NODE'
const fs=require("fs");
const j=JSON.parse(fs.readFileSync("core/spec/locks_md_hash_v1.json","utf8"));
console.log(j.sha256);
NODE
)

ACTUAL=$(node - <<'NODE'
const fs=require("fs");
const crypto=require("crypto");
const data=fs.readFileSync("docs/LOCKS.md");
console.log(crypto.createHash("sha256").update(data).digest("hex"));
NODE
)

if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "LOCKS_MD_HASH_MISMATCH"
  echo "EXPECTED $EXPECTED"
  echo "ACTUAL   $ACTUAL"
  exit 1
fi

echo "OK_LOCKS_MD_HASH_V1 $ACTUAL"
