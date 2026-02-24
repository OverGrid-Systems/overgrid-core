#!/usr/bin/env bash
set -euo pipefail

node scripts/build_unit_registry_v0.cjs >/dev/null
node scripts/gen_unit_registry_hash_v0.cjs >/dev/null

node scripts/build_unit_art_registry_v0.cjs >/dev/null
node scripts/gen_unit_art_registry_hash_v0.cjs >/dev/null

echo "OK_BUILD_ALL_REGISTRIES_V0"
