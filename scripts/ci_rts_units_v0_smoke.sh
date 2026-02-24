#!/usr/bin/env bash
set -euo pipefail
RTS_UNITS_V0=1 node core/sim_rts_v0.cjs >/tmp/rts_units_smoke.log
grep -q "OK_RTS_UNITS_V0_LOADED" /tmp/rts_units_smoke.log
echo "OK_RTS_UNITS_V0_SMOKE"
