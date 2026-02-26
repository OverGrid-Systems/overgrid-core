# Admin API Spec v0 (LOCKED)

Purpose:
This document defines the *only* allowed admin/control-plane surfaces that may propose changes to OverGrid projects.
It does **not** grant authority to mutate simulation state directly. All mutations must flow through PR + CI + owner merge.

Deterministic invariants:
- No endpoint may be added without version bump (v0 -> v1).
- No field may change semantic meaning.
- Field order in JSON examples is canonical (stable).
- All IDs must be deterministic (string tokens allowed only when treated as opaque identifiers).
- No secrets may ever appear in frontend payloads.

---

## 1) Roles (minimum)

- OWNER
  - may merge PRs
  - may approve executions
  - may rotate secrets (outside repo)

- REVIEWER
  - may review proposals and request changes
  - may approve drafts (non-merge)

- BOT
  - may open PRs only
  - MUST NOT merge
  - MUST attach Validation Report
  - MUST operate via RuleGate validation

---

## 2) Required Logging / Audit fields (every action)

Required fields:
- who: string (actor id)
- when: ISO-8601 timestamp
- intent: string (human-readable)
- repo: string (owner/name)
- base_head: string (git sha)
- target_paths: string[] (paths intended to change)
- validation_cmd: string
- validation_ok: boolean
- validation_hash: sha256 string
- diff_hash: sha256 string
- pr_url: string | null
- final_outcome: "OPENED" | "REJECTED" | "MERGED" | "ABORTED"

---

## 3) Endpoints (contract)

### POST /rulegate/validate
Purpose:
- Validate a proposal without mutating target repo.
Input (JSON):
{
  "repo": "OverGrid-Systems/overgrid-core",
  "baseHead": "<git sha>",
  "intent": "lock admin api spec v0",
  "taskId": "TASK_0002_ADMIN_API_SPEC_V0_LOCK",
  "targetPaths": ["core/spec/admin_api_spec_v0.md", "core/spec/admin_api_hash_v0.json", "scripts/*"]
}
Output (JSON):
{
  "ok": true,
  "validationHash": "<sha256>",
  "notes": ["..."]
}

### POST /pr/open
Purpose:
- Open PR from bot branch. Must attach Validation Report.
Input:
{ "repo":"...", "baseHead":"...", "branch":"...", "title":"...", "body":"...", "validationHash":"..." }
Output:
{ "prUrl":"...", "status":"OPENED" }

### POST /pr/comment
Input:
{ "prUrl":"...", "comment":"..." }
Output:
{ "status":"OK" }

### POST /exec/approve
Purpose:
- Owner approval object (append-only) bound to proposal hash.
Input:
{ "proposalHash":"...", "approver":"Rashid", "timestamp":"..." }
Output:
{ "approvalHash":"...", "status":"OK" }

---

## 4) Hard prohibitions (v0)

- No direct state mutation of Simulation Core.
- No CI bypass by design.
- No writing secrets into git.
- No modifying lock files without their generator/verifier.

---

## 5) Out of scope

- runtime game servers
- matchmaking implementation
- production renderer
- any direct state mutation of simulation core
