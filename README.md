# OverGrid Core — Deterministic + Externally Verifiable (Golden Bundle v1)

This repository ships a deterministic simulation kernel, a proof-producing executor, and an independent external verifier. A locked golden bundle artifact is included and CI-enforced.

## What you get
- Deterministic tick kernel (integer-only, no IO, no randomness)
- Proof ledger (hash-chained, append-only) + Ed25519 authenticity per proof
- Independent external verifier (rebuild + verify + pinpoint divergence)
- Golden bundle v1 artifact (reproducible chain hash)
- CI guard (push/PR verification)

## Golden Bundle v1 (canonical artifact)
Path:
- `dist_golden_bundle_v1/`

Contents:
- `core.js`
- `verifyLedger.js`
- `initial.json`
- `envelopes.json`
- `ledger.json`
- `public.pem`
- `verify.sh`
- `ADVERSARIAL_TEST_MATRIX.md`

Spec:
- `BUNDLE_FORMAT_v1.md`

CI:
- `scripts/ci_verify_bundle_v1.sh`
- `.github/workflows/ci_bundle_v1.yml`

## Quick verify (recommended)


## Repo Surface

- Golden canonical artifact: `dist_golden_bundle_v1/`
- Deterministic simulation core: `core/sim_v1.cjs`
- Dev authority server: `scripts/dev_admin_server.cjs`
- CI verification: `scripts/ci_verify_bundle_v1.sh`, `scripts/ci_tamper_test.sh`
- Local dev state (not tracked): `dev_state/`

See: `docs/REPO_SURFACE.md` and `docs/DEV_VS_GOLDEN.md`.

From repo root:
```bash
cd dist_golden_bundle_v1
bash verify.sh
