#!/usr/bin/env bash
set -euo pipefail

node -c core/sim_v1.cjs
node core/sim_v1.cjs >/dev/null

node -c core/sim_rts_v0.cjs
node core/sim_rts_v0.cjs >/dev/null

npm run docs:check
./scripts/ci_tamper_test.sh
bash scripts/ci_verify_bundle_v1.sh
bash scripts/ci_verify_rts_bundle_v0.sh

bash scripts/ci_rulegate_contract_v0.sh

bash scripts/ci_verify_golden_hashes_v0.sh

bash scripts/ci_verify_replay_v0.sh

bash scripts/ci_verify_contract_hash_v0.sh

bash scripts/ci_verify_sim_contract_hash_v1.sh

bash scripts/ci_verify_locks_md_v0.sh

bash scripts/ci_verify_locks_md_hash_v1.sh

echo "OK_CI_ALL"