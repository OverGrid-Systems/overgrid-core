# Simulation Specification v1 (LOCKED)

## 1. Deterministic Tick Model
- Fixed tick rate.
- No wall-clock dependence.
- Pure state transition per tick.
- Inputs = ordered command list.
- Output = canonical state.

## 2. Canonical State Rules
- Stable key ordering.
- No floating-point.
- All numeric ops bounded (u64).

## 3. RNG Partitioning
- Single seed per match.
- Per-system derived streams.
- No global mutable RNG.

## 4. Event Schema
- Commands must be validated by RuleGate.
- Each accepted command produces deterministic diff.

## 5. Hash Chain
- stateHash = sha256(canonical_state)
- chainHash = sha256(prevChainHash + stateHash)

## 6. Snapshot Policy
- Snapshots versioned.
- Snapshots reproducible via replay.

## 7. Budget Rules
- Per-tick compute budget.
- Overflow = reject command.
