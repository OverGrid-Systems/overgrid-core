#!/usr/bin/env bash
set -euo pipefail

node scripts/gen_mass_sim_hash_v0.cjs >/dev/null
git diff --exit-code core/spec/mass_sim_hash_v0.json >/dev/null

echo "OK_MASS_SIM_HASH_V0 $(node -e 'const j=require("./core/spec/mass_sim_hash_v0.json"); process.stdout.write(j.sha256)')"
