#!/usr/bin/env bash
set -euo pipefail
# ---- REGISTRY DRIFT PROTECTION (V0) ----
scripts/build_all_registries_v0.sh

git diff --exit-code core/dist core/spec/unit_registry_hash_v0.json core/spec/unit_art_registry_hash_v0.json || {
  echo "DRIFT_DETECTED: registries / hash locks out of sync (run scripts/build_all_registries_v0.sh and commit outputs)"
  exit 1
}
# -----------------------------------------
node -c core/sim_v1.cjs
node core/sim_v1.cjs >/dev/null

node -c core/sim_rts_v0.cjs
node core/sim_rts_v0.cjs >/dev/null

npm run docs:check
bash scripts/ci_verify_locks_md_no_undefined_v0.sh
./scripts/ci_tamper_test.sh
bash scripts/ci_verify_bundle_v1.sh
bash scripts/ci_verify_rts_bundle_v0.sh

bash scripts/ci_rulegate_contract_v0.sh

bash scripts/ci_verify_golden_hashes_v0.sh

bash scripts/ci_verify_replay_v0.sh

bash scripts/ci_verify_contract_hash_v0.sh

bash scripts/ci_verify_sim_contract_hash_v1.sh
bash scripts/ci_verify_locks_md_hash_v1.sh

bash scripts/ci_verify_event_surface_hash_v1.sh

bash scripts/ci_verify_identity_lock_v0.sh

bash scripts/ci_unit_data_v0.sh

bash scripts/ci_rts_units_v0_smoke.sh

bash scripts/ci_verify_unit_registry_v0.sh

bash scripts/ci_rts_unit_stats_registry_v0_smoke.sh

bash scripts/ci_rts_kind_mapping_v0.sh

bash scripts/ci_rts_unit_art_registry_v0_smoke.sh

bash scripts/ci_verify_unit_art_registry_hash_v0.sh




bash scripts/ci_verify_admin_api_hash_v0.sh

echo "OK_CI_ALL"