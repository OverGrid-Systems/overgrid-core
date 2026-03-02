#!/usr/bin/env bash
set -euo pipefail

EXPECTED=$(node -e "console.log(require('./core/spec/command_surface_hash_v0.json').expectedSha256)")
ACTUAL=$(node - <<'NODE'
const fs=require("fs");
const crypto=require("crypto");
const raw=fs.readFileSync("core/spec/command_surface_v0.json");
console.log(crypto.createHash("sha256").update(raw).digest("hex"));
NODE
)

test "$EXPECTED" = "$ACTUAL" || { echo "BAD_COMMAND_SURFACE_HASH_V0"; exit 1; }
echo "OK_COMMAND_SURFACE_HASH_V0"
