# OverGrid III: Global Command — Current System State (Deterministic Core + Dev Authority Server)

This document describes what exists in the repository *now*, what is enforced, and what is explicitly out of scope.

## Current Phase

Deterministic simulation core with strict authority separation, tick isolation, hash-chain continuity checks, and local-dev envelope ingestion via an admin dev server.

Golden bundle v1 artifacts exist for baseline verification and CI enforcement. Local dev_state is intentionally not tracked.

## Core Concepts

### Tick
A discrete deterministic step of simulation time. All state changes occur only at tick boundaries.

### Envelope
A single command-frame record appended to local dev state:
- tick (monotonic)
- frameId (unique)
- prevChainHash (must match chain hash at tick-1)
- commands (non-empty array)

Envelope is the *external input unit* to the simulation pipeline.

### Hash Chain (Current Reality)
A SHA-256 chain hash is recomputed deterministically across ticks. Envelopes bind to the chain by requiring:
prevChainHash(envelope[t]) == chainHash(t-1)

If an envelope’s prevChainHash is wrong, simulation fails with a tamper error pinpointing the exact tick.

## Simulation Core (Kernel)

Properties:
- Tick-based deterministic loop.
- Integer-only arithmetic (scaled domain). No floating point.
- Pure state transform per tick: (state, frame) → newState.
- No AI. No autonomy.
- Accepts sealed command frames only.
- Buffered movement (order-neutral resolution).
- Two-phase damage (intent aggregation → commit).
- Immutable/frozen tick boundary outputs.
- Lifecycle monotonic: ACTIVE → TERMINAL (terminal is absorbing).

Kernel responsibilities:
- Movement system (buffered intents → simultaneous resolve).
- Range validation.
- Two-phase damage aggregation.
- Frame contract enforcement (tick coherence).
- Lifecycle contract validation.
- Snapshot creation (frozen boundary object).
- Snapshot rehydration (deterministic reconstruction).
- Invariant guards (structural + arithmetic validation).
- Canonical ordering before hashing.
- Domain-separated, versioned SHA-256 state hashing.
- Chain hash accumulation (deterministic).

Explicitly inside the kernel: nothing else.

## Execution Architecture (What Exists)

Layer 1 — Kernel
- Deterministic mathematical core.
- No IO.
- No logging requirements.
- No randomness.
- No external dependencies.

Layer 2 — Deterministic Executor (inside sim runner)
- Enforces strict envelope ordering by tick.
- Rejects non-monotonic ticks.
- Rejects duplicate frameId.
- Enforces prevChainHash continuity check at each envelope tick.
- Produces deterministic hashes (stateHash + chainHash) per tick boundary.
- Fails fast on divergence/tamper with the exact tick index.

Layer 3 — Time Policy (currently minimal)
- Time progression is driven by the runner inputs and max tick.
- MAX_TICK environment clamp is supported for partial-chain queries and tick-1 chain derivation.

Layer 4 — Command Source (Dev)
- Admin dev server provides /api/commit that appends envelopes to local dev_state.
- Commands are external inputs; kernel remains blind to source.

Layer 5 — External Verification (Current)
- Verification is supported by deterministic replay: initial + envelopes → recompute hashes.
- Golden bundle verification exists and is CI-enforced.
- No cryptographic signature authentication is currently implemented (see “Not Implemented”).

## Golden Bundle v1 (Release Artifact Surface)

Repository contains bundle spec + dist artifacts:
- BUNDLE_FORMAT_v1.md
- dist_golden_bundle_v1/
  - core.js
  - verifyLedger.js (or equivalent verifier)
  - initial.json
  - envelopes.json
  - ledger.json
  - public.pem (present as artifact; not currently used for real Ed25519 per-tick signing)
  - verify.sh / scripts/ci_verify_bundle_v1.sh
- .github/workflows/ci_bundle_v1.yml
- ADVERSARIAL_TEST_MATRIX.md (negative cases)

What is guaranteed by the golden bundle:
- Deterministic replay reproduces the published final chain hash.
- Envelope/ledger tampering is detectable by replay mismatch.
- CI enforces that the golden baseline remains reproducible.

## Local Dev State (Intentionally Not Tracked)

dev_state is local-only:
- dev_state/envelopes.dev.json (local envelopes appended via /api/commit)
- dev_state/chain_cache.json (local helper cache used to supply prevChainHash for commits)

This is intentionally excluded from git to avoid committing transient local simulation inputs.

## Dev Workflow (Terminal)

### 1) Run server
node scripts/dev_admin_server.cjs

### 2) Before posting a new envelope at tick T:
Refresh cache for tick-1 so /api/commit can embed prevChainHash correctly:
MAX_TICK=$((T-1)) node scripts/refresh_chain_cache.cjs

### 3) Post a commit (example NOOP)
printf '%s' "{\"tick\":$T,\"frameId\":$T,\"commands\":[{\"type\":\"NOOP\"}]}" | \
curl -sS -X POST http://localhost:5173/api/commit \
  -H 'content-type: application/json' \
  --data-binary @-

### 4) Verify sim after commit
node -c core/sim_v1.cjs && node core/sim_v1.cjs >/dev/null && echo OK_SIM

### 5) Convenience script (optional local-only)
scripts/dev_noop_commit.sh may be used to auto:
- compute next tick
- refresh cache at tick-1
- post NOOP
- verify sim

## Data Characteristics

- Entities are deterministic and ordered canonically before encoding/hashing.
- Frozen entity instances per tick.
- No mutation outside tick return value.
- No environment-dependent state (other than explicit MAX_TICK clamp used for bounded runs).
- No hidden shared references.

## Known Limitations (Current)

- Targeting may be O(n²) at current kernel scale.
- No spatial partitioning (out of scope).
- No networking, no UI authority, no backend.

## Not Implemented (Do Not Claim)

These are not present in the current repo state:
- Ed25519 per-tick signing and verification over canonical proof encoding.
- Production-grade key management, rotation, trust distribution.
- A fully detached verifier that validates signatures (hash-only replay is supported).
- Transport canonicalization beyond local envelope input.

## Explicitly Forbidden / Out of Scope (Current)

- Economy, production, escalation systems.
- Faction logic, tech tree, upgrades.
- Pathfinding grid.
- LLM decision systems.
- Networking implementation.
- Backend authority.
- UI framework.
- Balance systems.

## Design Constraint

The core must remain:
- Deterministic and mathematically closed.
- Side-effect isolated (pure tick transform).
- Authority-separated (inputs are external envelopes).
- Time-isolated (tick boundary strictness).
- Hash-consistent and replay-verifiable.
- CI-guarded against regressions in golden baseline verification.

<!-- AUTOGEN:START -->
Generated by scripts/gen_docs.cjs

## @DOC Index (extracted)
- Deterministic Simulation Core (sim_v1) — core/sim_v1.cjs
  - guarantee: deterministic replay
  - guarantee: detects envelope tamper via prevChainHash mismatch
  - input: dist_golden_bundle_v1/envelopes.json
  - input: dev_state/envelopes.dev.json (local, optional via DEV_ENVELOPES_PATH)
  - output: per-tick stateHash + chainHash (internal)
  - note: DEV_ENVELOPES_PATH overrides envelope source for tests
- Dev Authority Server (/api/commit) — scripts/dev_admin_server.cjs
  - guarantee: rejects non-monotonic tick
  - guarantee: rejects duplicate frameId
  - guarantee: prevChainHash continuity enforced via chain cache
  - input: POST /api/commit {tick, frameId, commands[]}
  - output: dev_state/envelopes.dev.json append-only (local)
<!-- AUTOGEN:END -->

