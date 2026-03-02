#!/usr/bin/env bash
set -euo pipefail
EXPECTED=$(node -p 'require("./core/spec/kernel_identity_hash_v0.json").expectedSha256||""')
test -n "$EXPECTED" || { echo "BAD_EMPTY_EXPECTED"; exit 1; }
ACTUAL=$(node - <<'NODE'
const fs=require("fs"),crypto=require("crypto");
const md=fs.readFileSync("core/spec/kernel_identity_spec_v0.md","utf8");
console.log(crypto.createHash("sha256").update(md).digest("hex"));
NODE
)
test "$EXPECTED" = "$ACTUAL" || { echo "BAD_KERNEL_IDENTITY_HASH_V0"; exit 1; }
echo "OK_KERNEL_IDENTITY_HASH_V0"
