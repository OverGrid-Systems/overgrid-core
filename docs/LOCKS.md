# OverGrid Core — LOCKS (Source of Truth)

This repo is intentionally "hard to change". The purpose is deterministic replay + contract stability.

## 1) CI Gate (must be green)
- Workflow: `.github/workflows/ci.yml`
- Entry: `npm run ci:all`
- Shell enforced: bash (all OS)

## 2) Golden Hash Locks (Replay / Bundles)
- `OK_GOLDEN_bundle_v1`: 686988bfaa1ed12131647fa3161d8bdb4590863d83c66ec0fdb7ad65daf87769
- `OK_GOLDEN_rts_bundle_v0`: 1256e1d0687090b1b9e8d6421212c9f02f48fd56262bfe7be68b5e8c62ccb445

## 3) Replay Verification Lock
- Specs: `core/spec/replay_v0/*.json`
- Script: `scripts/ci_verify_replay_v0.sh`
- Expectation: at least one `Final ChainHash: <64hex>` line.

## 4) RTS Command Contract Lock (v0)
- Spec: `core/spec/contract_hash_v0.json`
- Inputs:
  - `core/spec/rts_command_types_v0.json`
  - `core/spec/rts_command_spec_v0.md`
- Expected sha256:
  - 64bbf12d5169c696ee64702f999174984041be56920505a7eb21f3a2fe06b5eb
- Generator: `scripts/gen_contract_hash_v0.cjs`
- Verifier: `scripts/ci_verify_contract_hash_v0.sh`

## 5) Simulation Contract Lock (v1)
- Spec: `core/spec/sim_contract_hash_v1.json`
- Input:
  - `core/spec/sim_spec_v1.md`
- Expected sha256:
  - 3db892b117ce3e9b866e33bfe23a1c675cd9b19012a3c328e38bf5efdcdf0333
- Generator: `scripts/gen_sim_contract_hash_v1.cjs`
- Verifier: `scripts/ci_verify_sim_contract_hash_v1.sh`

## 6) Ownership Lock (CODEOWNERS)
- File: `.github/CODEOWNERS`
- Security-critical areas:
  - `.github/workflows/*`
  - `scripts/*`
  - `core/spec/*`
  - `admin/llm/**`
  - `admin/prompts/**`

## Update Policy (when a lock must change)
1) Update the underlying spec/content intentionally.
2) Run the matching generator (hash update).
3) CI must go green.
4) PR must clearly state why the lock changed.
