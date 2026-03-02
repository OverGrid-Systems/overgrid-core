#!/usr/bin/env bash
set -euo pipefail

FILE="core/spec/llm_proposal_flow_v0.json"

if [ ! -f "$FILE" ]; then
  echo "ERR_MISSING_LLM_PROPOSAL_FLOW_V0"
  exit 1
fi

VERSION=$(node -e "console.log(require('./$FILE').version)")

if [ "$VERSION" != "llm_proposal_flow_v0" ]; then
  echo "ERR_LLM_PROPOSAL_FLOW_VERSION_MISMATCH"
  exit 1
fi

echo "OK_LLM_PROPOSAL_FLOW_V0"
