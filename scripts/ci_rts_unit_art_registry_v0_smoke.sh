#!/usr/bin/env bash
set -euo pipefail
RTS_USE_UNIT_ART_REGISTRY_V0=1 node core/sim_rts_v0.cjs > /tmp/rts_unit_art_registry_smoke.log
grep -q "OK_RTS_UNIT_ART_FROM_REGISTRY INF rifleman" /tmp/rts_unit_art_registry_smoke.log
echo "OK_RTS_UNIT_ART_REGISTRY_V0_SMOKE"
