# Main Guardrails (OverGrid Core)

Main is protected by GitHub Rules + CI:
- No direct pushes to main (PR only)
- Required status check: CI / ci-all (pull_request)
- Commits must be Verified (SSH signing enabled)

Local workflow (always):
1) Create branch:
   git checkout -b feat/xxx
2) Commit signed:
   git commit -S -m "..."
3) Push branch:
   git push -u origin feat/xxx
4) Open PR -> wait CI green -> merge in UI.
