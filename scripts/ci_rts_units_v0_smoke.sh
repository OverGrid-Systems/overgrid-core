#!/usr/bin/env bash
set -euo pipefail

TMP_BASE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
LOG="${TMP_BASE%/}/rts_units_smoke.log"

RTS_UNITS_V0=1 node core/sim_rts_v0.cjs > "$LOG"
grep -q "OK_RTS_UNITS_V0_LOADED" "$LOG"
echo "OK_RTS_UNITS_V0_SMOKE"
