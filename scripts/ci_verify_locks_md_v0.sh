#!/usr/bin/env bash
set -euo pipefail

P="docs/LOCKS.md"

test -f "$P" || { echo "MISSING_LOCKS_MD"; exit 1; }

# Must contain core headings/anchors
grep -q "OverGrid Core — LOCKS" "$P" || { echo "LOCKS_MD_BAD_HEADER"; exit 1; }
grep -q "Golden Hash Locks" "$P" || { echo "LOCKS_MD_MISSING_GOLDEN"; exit 1; }
grep -q "RTS Command Contract Lock" "$P" || { echo "LOCKS_MD_MISSING_RTS_CONTRACT"; exit 1; }
grep -q "Simulation Contract Lock" "$P" || { echo "LOCKS_MD_MISSING_SIM_CONTRACT"; exit 1; }
grep -q "Ownership Lock (CODEOWNERS)" "$P" || { echo "LOCKS_MD_MISSING_CODEOWNERS"; exit 1; }

# Must contain the current critical hashes (hard guard)
grep -q "686988bfaa1ed12131647fa3161d8bdb4590863d83c66ec0fdb7ad65daf87769" "$P" || { echo "LOCKS_MD_MISSING_bundle_v1_HASH"; exit 1; }
grep -q "1256e1d0687090b1b9e8d6421212c9f02f48fd56262bfe7be68b5e8c62ccb445" "$P" || { echo "LOCKS_MD_MISSING_rts_bundle_v0_HASH"; exit 1; }
grep -q "64bbf12d5169c696ee64702f999174984041be56920505a7eb21f3a2fe06b5eb" "$P" || { echo "LOCKS_MD_MISSING_contract_hash_v0"; exit 1; }
grep -q "3db892b117ce3e9b866e33bfe23a1c675cd9b19012a3c328e38bf5efdcdf0333" "$P" || { echo "LOCKS_MD_MISSING_sim_contract_hash_v1"; exit 1; }

echo "OK_LOCKS_MD_V0"
