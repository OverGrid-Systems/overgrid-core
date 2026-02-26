# LLM_ADMIN_CONTROL_SURFACE_V0 (LOCKED)

Purpose:
The LLM is an ADMIN/META planner only. It may propose design decisions, balance changes, unit roster changes, and rule adjustments — but it MUST NOT execute them.

Hard Rules (Non-Negotiable):
1) Draft-only: The LLM may only produce DRAFTS. A draft is not executable, not applied, and not trusted.
2) No mutation authority: The LLM has zero permission to modify core state, registries, locks, bundles, or any persistent data.
3) No direct event injection: The LLM cannot emit or commit gameplay events/envelopes. It can only propose changes for humans/admin tooling to implement.
4) No file/network side-effects: The LLM cannot read/write files, call network, or access secrets in any pipeline that impacts determinism.
5) Human gate is final: A human is the final authority. Any draft must be reviewed and then implemented via explicit, deterministic code changes + CI.

Allowed Output Types (Draft Categories):
- BALANCE_PROPOSAL: numeric tuning suggestions (costs, DPS, armor classes, counters)
- ROSTER_CHANGE: unit additions/removals/roles (proposal only)
- RULE_CHANGE: constraints, validations, invariants (proposal only)
- CONTENT_PLAN: roadmap, backlog, test scenarios, validation matrices

Disallowed:
- Auto-committing changes
- Writing code into locked registries directly
- Any “agentic” behavior that alters repo outputs automatically

Acceptance Criteria:
- Any adopted change must be implemented as normal code/spec edits, pass RuleGate policies, and pass full CI determinism checks.
