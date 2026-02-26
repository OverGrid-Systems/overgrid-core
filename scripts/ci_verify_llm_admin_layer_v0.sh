#!/usr/bin/env bash
set -euo pipefail

test -f admin/spec/llm_draft_contract_v0.md
node admin/llm/validate_draft_v0.cjs >/dev/null || exit 1

echo "OK_LLM_ADMIN_LAYER_V0"
