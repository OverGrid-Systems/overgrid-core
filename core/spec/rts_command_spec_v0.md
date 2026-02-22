# RTS Command Spec v0 (authoritative)

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
