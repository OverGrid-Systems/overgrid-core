# ARCHITECTURAL_SNAPSHOT_SYSTEM_V0 (LOCKED) — OverGrid III / SRM
Version: v0
Status: SINGLE SOURCE OF TRUTH (System-of-Systems)
Policy: Any change requires PR + CI green.

This document describes the *current* architecture as verified on-device (Mar 2, 2026), not aspirational design.

---

## 0) System Topology (Reality)

Two repos, two roles:

1) `overgrid-core` (Kernel / Authority)
- Deterministic simulation core.
- Hash-verified replay and tamper detection.
- CI locks for bundles, registries, contracts, event surface, identity.

2) `srm-operator` (Sovereign Operator / Governance + Proxy)
- SRM operator HTTP server + proxy to kernel.
- Conversations/sessions/decisions tracking.
- Contract verification for Operator Console API.
- CORS policy centralized at operator server layer.

Runtime dev ports:
- Kernel (overgrid-core admin/dev server): `5173`
- Operator (srm-operator HTTP server): `5180`

Dev launcher (operator side):
- `OP_HOST=127.0.0.1 OG_ROOT_PATH="$HOME/Desktop/OVERGRID" ./scripts/dev_up.sh`

---

## 1) Authority Graph (Non-negotiable)

UI (Hostinger/React future) → Operator (SRM) → Kernel (OG) → Deterministic Core (sim)

Rules:
- Operator is the command authority interface (draft/approve flow).
- Kernel is the deterministic authority (state transitions + hashes).
- The Core is the sole source of world truth.
- No layer below Operator executes LLM output without explicit human approval.

---

## 2) Deterministic Core Guarantees (overgrid-core)

Core files (code-linked in `docs/ARCHITECTURE_MAP.md`):
- `core/sim_v1.cjs` — deterministic replay, canonical hashing, chain hash accumulation, tamper detection.
- `scripts/dev_admin_server.cjs` — dev authority endpoints and envelope commit constraints.

Guarantees:
- Fixed-point / canonical serialization assumptions enforced by implementation + CI.
- Every tick produces:
  - `stateHash`
  - `chainHash` (prevChainHash continuity)
- Tamper detection is enforced; divergence tick is detected (CI tamper tests pass).

Kernel endpoints (dev authority layer):
- `/api/commit`
- `/api/meta`
- `/api/verify`
- `/api/envelopes`
- `/api/envelopes_merged`
- `/api/ledger`
- `/api/initial`

---

## 3) Operator Guarantees (srm-operator)

Operator server:
- `operator/http_v0/server.cjs` is the *single owner* of CORS.
- Router writes zero CORS headers:
  - `operator/http_v0/src/core/router.cjs`
- Proxy writes zero CORS headers:
  - `operator/infrastructure/kernel.proxy.cjs`

CORS invariants:
- `access-control-allow-headers` MUST include:
  - `content-type,authorization,x-admin-token`
- OPTIONS preflight responds `204` with the same CORS policy.
- If `OP_CORS_ORIGIN='*'` then `Vary: Origin` MUST NOT be set.
- CORS headers must appear on error responses (e.g. 401) since applied before dispatch.

Operator governance artifacts:
- Decisions chain ledger: `core/decisions/DECISIONS.ndjson`
- Contracts:
  - `docs/OPERATOR_CONSOLE_API_V0.md`
  - `docs/CONTRACTS.md`

Operator CI meaning:
- CI enforces:
  - operator contracts validity
  - decisions chain integrity
  - sessions boundary constraints

---

## 4) LLM Layer (Draft-only, Governed)

LLM is not a runtime controller.
LLM is a constrained proposal generator.

Currently implemented artifact:
- `admin/llm/create_draft_v0.cjs`
  - Generates a JSON draft under `admin/llm/drafts_v0/`
  - Draft schema: `llm_draft_v0`
  - Contains constraints:
    - deterministic: true
    - draftOnly: true
    - requiresHumanApproval: true

Invariant:
- Drafts are artifacts; they do not execute.
- Execution happens only via explicit approval path (Operator → Kernel).

---

## 5) Sandbox / Heavy Simulation (System Rule)

Purpose:
- Allow heavy mathematical simulation of units/balance BEFORE committing changes.

Placement:
- Heavy simulation runs belong near `overgrid-core` (local machine / CI runners).
- UI must only request a run and display results.
- Operator must treat results as artifacts attached to a proposal.

Minimum artifact contract (required):
- Inputs: a versioned unit registry + scenario spec + seed.
- Outputs: deterministic metrics report + hashes + reproducibility data.

Status:
- Deterministic replay/tamper verification exists now.
- A formal “balance sandbox runner + report contract” is planned and will be locked as v0 when implemented.

---

## 6) What Exists vs What Is Planned

Exists now (verified):
- Deterministic core + chain hashing + replay verification + tamper tests.
- Operator HTTP server + proxy + stable CORS behavior.
- Operator contracts + decisions/sessions governance CI.
- Draft artifact generator (`create_draft_v0.cjs`) governed by core CI.

Planned next (must be CI-locked when added):
- System-wide PR/approval workflow connecting Operator decisions to Kernel commits.
- Formal sandbox runner + report contract.
- Hostinger/React Operator Console UI reading the same contracts.

