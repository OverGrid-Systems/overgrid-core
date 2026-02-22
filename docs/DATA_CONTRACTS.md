# OverGrid III — Data Contracts (Deterministic Runtime Structures)

This document defines the canonical data shapes used by the simulation core and dev authority layer.

All structures are deterministic and schema-strict.

---

## 1. Envelope Schema (Dev Input Unit)

File Location:
dev_state/envelopes.dev.json

Structure:

{
  "tick": Number,              // required, strictly monotonic
  "frameId": Number,           // required, unique per envelope
  "prevChainHash": String,     // required, must equal chainHash(tick-1)
  "commands": Array            // required, non-empty
}

Validation Rules:
- tick must be > lastTick
- frameId must be unique
- commands must be non-empty array
- prevChainHash must match deterministic chainHash(tick-1)
- Violations cause rejection before kernel execution

---

## 2. Command Schema (Current Minimal Form)

Example:
{
  "type": "NOOP"
}

Contract:
- Commands are opaque to the dev server
- Kernel interprets commands deterministically
- No random fields allowed
- No implicit state mutation

Note:
Extended command types must preserve determinism and state isolation.

---

## 3. State Object (Kernel Internal Shape)

Conceptual Structure (simplified):

{
  tick: Number,
  phase: "ACTIVE" | "TERMINAL",
  entities: Entity[],
  map: DeterministicStructure
}

Properties:
- Entities array is canonically ordered before hashing
- No floating-point values
- No hidden mutable references
- No external environment dependencies

---

## 4. Hash Model

Per Tick:
stateHash = SHA-256(canonicalStateEncoding)

Chain Accumulator:
chainHash(t) = SHA-256(
  chainHash(t-1) || stateHash(t)
)

prevChainHash in envelope[t+1] must equal chainHash(t).

Domain-separated hashing string and version must remain consistent across runs.

---

## 5. Chain Cache Structure

File:
dev_state/chain_cache.json

Shape:

{
  "maxTick": Number,
  "finalChainHash": String,
  "rulesetVersion": String,
  "updatedAt": ISODateString
}

Used only by:
- /api/commit (to supply prevChainHash)

Not part of release artifact surface.

---

## 6. Golden Bundle Ledger Structure

File:
dist_golden_bundle_v1/ledger.json

Contains:
- Deterministically ordered entries
- stateHash per tick
- chainHash per tick
- Version metadata

Used for:
- CI verification
- Independent replay validation

---

All data contracts must preserve:
✔ Determinism
✔ Canonical ordering
✔ Strict tick monotonicity
✔ Hash reproducibility
✔ Replay equivalence
