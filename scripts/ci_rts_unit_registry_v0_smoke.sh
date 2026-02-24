#!/usr/bin/env bash
set -euo pipefail
RTS_USE_UNIT_REGISTRY_V0=1 node core/sim_rts_v0.cjs >/tmp/rts_unit_registry_smoke.log
grep -q "OK_RTS_UNIT_REGISTRY_V0_LOADED" /tmp/rts_unit_registry_smoke.log
echo "OK_RTS_UNIT_REGISTRY_V0_SMOKE"
