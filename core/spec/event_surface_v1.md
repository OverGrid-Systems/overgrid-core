# Event Surface Contract v1

Version: 1
Purpose: Defines the canonical command types allowed to enter Simulation Core.

## Deterministic Rules

1. No command field may be added without version bump.
2. No command field may change semantic meaning.
3. Order of fields must remain stable.
4. All numeric values must be deterministic types (u64 where applicable).

## Command Types

### NOOP
Fields:
- type: "NOOP"

### MOVE
Fields:
- type: "MOVE"
- entityId: u64
- targetX: u64
- targetY: u64

### ATTACK
Fields:
- type: "ATTACK"
- attackerId: u64
- targetId: u64

### BUILD
Fields:
- type: "BUILD"
- builderId: u64
- buildingType: string
- targetX: u64
- targetY: u64
