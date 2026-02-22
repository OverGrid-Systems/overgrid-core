# OverGrid III — Architecture Map (Code-Linked)

This document maps architectural concepts directly to repository files.

---

## 1. Simulation Kernel

Primary file:
- core/sim_v1.cjs

Responsibilities implemented here:
- Deterministic tick loop
- State transition logic
- Movement resolution (buffered / order-neutral)
- Two-phase damage aggregation
- Lifecycle enforcement
- Canonical state hashing (SHA-256)
- Chain hash accumulation
- MAX_TICK clamp support (environment-bounded replay)

Outputs:
- stateHash per tick
- finalChainHash
- Deterministic failure on tamper

Failure Mode:
- Throws TAMPER_DETECTED_PREV_HASH at exact divergence tick.

---

## 2. Dev Authority Layer

Primary file:
- scripts/dev_admin_server.cjs

Endpoints:
- /api/commit
- /api/meta
- /api/verify
- /api/envelopes
- /api/envelopes_merged
- /api/ledger
- /api/initial

Responsibilities:
- Append envelope to dev_state/envelopes.dev.json
- Validate monotonic tick
- Validate unique frameId
- Enforce prevChainHash continuity using chain_cache.json
- Reject stale_chain_cache
- No mutation of kernel logic

---

## 3. Chain Cache Utility

File:
- scripts/refresh_chain_cache.cjs

Purpose:
- Recompute finalChainHash for MAX_TICK
- Persist to dev_state/chain_cache.json
- Used by /api/commit to derive prevChainHash

Note:
dev_state is local-only and git-ignored.

---

## 4. Golden Bundle

Directory:
- dist_golden_bundle_v1/

Includes:
- core.js
- verifyLedger.js
- initial.json
- envelopes.json
- ledger.json
- public.pem
- verify.sh

CI Enforcement:
- scripts/ci_verify_bundle_v1.sh
- .github/workflows/ci_bundle_v1.yml

Properties:
- Deterministic replay reproducibility
- Hash-chain integrity verification
- Baseline chain hash locked under git history

---

## 5. Verification Strategy

Replay-based deterministic verification:
initial + envelopes → recompute stateHash + chainHash

Tamper Indicators:
- Envelope mutation
- Ordering mutation
- Field mutation
- Core logic mutation

Detection:
- Chain divergence at specific tick.

No live cryptographic signature enforcement currently implemented in runtime.

---

## 6. Local Runtime State

Directory:
- dev_state/

Files:
- envelopes.dev.json
- chain_cache.json

Properties:
- Append-only during dev
- Not tracked by git
- Reset-safe
- Required for local envelope workflow

---

## 7. Scripts Surface

- scripts/dev_noop_commit.sh (optional helper)
- scripts/refresh_chain_cache.cjs
- scripts/ci_verify_bundle_v1.sh

---

## 8. Architectural Guarantees

✔ Deterministic replay
✔ Hash-chain continuity enforcement
✔ Authority separation (kernel blind to source)
✔ Tick-sealed state boundary
✔ CI regression verification
✔ Dev envelope injection controlled

---

System is kernel-sealed + hash-bound + replay-verifiable.
