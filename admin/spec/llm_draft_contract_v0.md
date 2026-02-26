# LLM_DRAFT_CONTRACT_V0 (LOCKED)

Goal: LLM can ONLY propose drafts. Drafts are NEVER executed directly.
Pipeline: Draft -> RuleGate Validate -> Human/Admin Approve -> Commit Envelope.

## Draft shape (conceptual)
- draftId: string
- createdAt: ISO string
- source: "llm"
- intent: short text
- commands: array of CommandDraft
- constraints:
  - no direct state mutation
  - no file I/O
  - no network
  - bounded size

## CommandDraft (conceptual)
- type: string
- params: object
- rationale: string
- risk: "LOW"|"MED"|"HIGH"
- expectedEffects: string[]
