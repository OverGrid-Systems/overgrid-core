# LLM Control Plane (v0) — OverGrid Third Generation

Goal: Provide a deterministic, human-approved control plane where an LLM can propose actions, the UI renders them as buttons, and execution is always archived as append-only events.

## 1) Non-negotiables
- LLM is **draft-only**: it proposes, never executes.
- All execution requires **human approval**.
- Source of truth is **archive_v0.jsonl** (append-only, hash-chained).
- Chat session can be deleted without affecting the project state.

## 2) LLM Response Contract (LLM_RESPONSE_V0)
The LLM returns:
- `message`: human-readable explanation
- `ui.actions`: a list of actionable buttons the UI may render
- `safety`: required constraints + why this proposal is safe

### 2.1 Shape (canonical)
- message: string
- ui.actions[]: UI_ACTION_V0
- safety: object (must exist)

## 3) UI Action Contract (UI_ACTION_V0)
An action is a button the UI can render.
- label: string (button text)
- type: one of:
  - INBOX
  - APPROVE_DRAFT
  - REJECT_DRAFT
  - SIMULATE_DRAFT
  - PUBLISH_INTENT
  - HEAVY_RUN_INTENT
- draftId: string (required for *_DRAFT actions)
- notes: string (optional)

## 4) Execution mapping (UI -> Archive)
When user clicks:
- UI calls a local command (CLI/endpoint) which appends to archive:
  - actor
  - action (APPROVE/REJECT/SIMULATE/PUBLISH_INTENT/HEAVY_RUN_INTENT)
  - draftId
  - target
  - summary
  - result

The archive event is the only authoritative record.

## 5) Deterministic status resolution
Draft status is resolved by replaying archive events:
- Last event for a draft wins (append-only).
- If no event: PENDING

## 6) What v0 does NOT do
- No direct Steam publish.
- No renderer execution.
- No system-level side effects.
All of those are future intents that still require human approval + gating.
