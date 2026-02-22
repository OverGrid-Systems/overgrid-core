# RTS Command Spec v0 (authoritative)


## RULEGATE_CONTRACT_V0 (non-negotiable)

RuleGate enforces two invariants:
1) Reject unknown fields (strict command shape). Any new field requires updating:
   - core/spec/rts_command_spec_v0.md
   - core/spec/rts_command_types_v0.json (if new command type)
   - core/sim_rts_v0.cjs RuleGate validator/canonicalizer
2) Canonicalize fields that affect hashing:
   - unitIds MUST be canonicalized deterministically (stable order) before hashing.
   - numeric fields MUST be parsed/canonicalized consistently (string -> u64).

Authoritative command types source of truth:
- core/spec/rts_command_types_v0.json


This spec defines the only allowed command payloads for sim_rts_v0 and any future RTS sims.
All numbers are encoded as base-10 strings in JSON and parsed into deterministic integers.
Unknown fields are rejected. Missing required fields are rejected.

## Common rules
- tick/frameId monotonic is enforced by authority layer, not by sim.
- unitIds arrays: sorted ascending before execution (canonicalization).
- positions: x,y are integers in [0..RANGE] inclusive (RANGE currently 800 or 1024 depending on sim config).
- counts: positive integer string.

## Commands

### WORKER_GATHER
Fields:
- type="WORKER_GATHER"
- workerId: string
- nodeId: string
- hqId: string

### QUEUE_UNIT
Fields:
- type="QUEUE_UNIT"
- factoryId: string
- unitKind: string (enum for the sim)
- count: string (positive integer)

### ATTACK_MOVE
Fields:
- type="ATTACK_MOVE"
- unitIds: string[] (entity ids)
- x: string
- y: string
