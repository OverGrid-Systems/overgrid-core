#!/usr/bin/env bash
set -euo pipefail

# RTS bundle v0 must replay deterministically and match the expected chainhash.
EXPECTED="1256e1d0687090b1b9e8d6421212c9f02f48fd56262bfe7be68b5e8c62ccb445"

H1="$(node core/sim_rts_v0.cjs | grep -Eo 'FINAL_CHAINHASH [0-9a-f]+' | tail -n 1 | awk '{print $2}')"
H2="$(node core/sim_rts_v0.cjs | grep -Eo 'FINAL_CHAINHASH [0-9a-f]+' | tail -n 1 | awk '{print $2}')"

test "$H1" = "$H2" || { echo "FAIL: RTS nondeterministic ($H1 vs $H2)"; exit 1; }
test "$H1" = "$EXPECTED" || { echo "FAIL: RTS baseline drift ($H1 != $EXPECTED)"; exit 1; }

echo "OK_RTS_BUNDLE_V0"
echo "Final ChainHash: $H1"
