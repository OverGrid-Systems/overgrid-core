#!/usr/bin/env bash
set -euo pipefail

node scripts/gen_admin_api_hash_v0.cjs >/dev/null
git diff --exit-code core/spec/admin_api_hash_v0.json >/dev/null
echo "OK_ADMIN_API_HASH_V0 $(node -e 'const j=require("./core/spec/admin_api_hash_v0.json"); process.stdout.write(j.sha256)')"