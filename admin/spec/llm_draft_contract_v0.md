# LLM_DRAFT_CONTRACT_V0 (ADMIN-ONLY, DRAFT-ONLY)

This contract defines the ONLY allowed shape of an LLM "draft".
Drafts are NOT executed. Drafts are NOT committed into the deterministic core.
A human is the final authority; Rule Engine validation is mandatory before any commit.

## File location
admin/llm/drafts_v0/*.json

## Draft JSON schema (informal)
Required:
- version: "llm_draft_v0"
- id: string (prefix "d_" recommended)
- createdAt: ISO8601 string
- intent: short string ("balance", "unit", "ai", "ui", "docs", etc.)
- target: string (what this draft proposes to change, e.g. "core/spec/mass_sim_v0/...md")
- proposal: object (free-form but must be JSON-serializable)
- constraints:
  - deterministic: true
  - draftOnly: true
  - requiresHumanApproval: true
- provenance:
  - source: "human" | "llm"
  - model: string (if source=llm)
  - promptHash: string (sha256 hex; may be "unknown" for human)
  - inputHash: string (sha256 hex; may be "unknown")
  - outputHash: string (sha256 hex; may be "unknown")

Forbidden:
- Any field indicating execution, auto-apply, or direct commit authority.
- Any network URLs intended for fetching code.
- Any embedded secrets/tokens.

## Safety rules (must hold)
- Drafts never mutate simulation state directly.
- Drafts can only become real changes via PR + CI + human approval.
