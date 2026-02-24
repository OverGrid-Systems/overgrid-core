#!/usr/bin/env bash
set -euo pipefail

TMP_BASE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
LOG="${TMP_BASE%/}/rts_unit_stats_registry_smoke.log"

RTS_USE_UNIT_REGISTRY_V0=1 node core/sim_rts_v0.cjs > "$LOG"
grep -q "OK_RTS_UNIT_STATS_FROM_REGISTRY rifleman" "$LOG"
grep -q "OK_RTS_DEF_AFTER_REGISTRY INF" "$LOG"
echo "OK_RTS_UNIT_STATS_REGISTRY_V0_SMOKE"
