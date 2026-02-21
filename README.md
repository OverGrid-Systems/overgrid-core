# OverGrid Core — Deterministic + Externally Verifiable

This repository ships a deterministic simulation kernel plus an independent external verifier and a locked golden bundle artifact.

## What you get
- Deterministic tick kernel (integer-only, no IO, no randomness)
- Proof-producing executor (hash-chained, append-only ledger)
- Independent external verifier (rebuild + verify + pinpoint divergence)
- Golden bundle v1 (reproducible final chain hash)
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

CI verification script:
- `scripts/ci_verify_bundle_v1.sh`
- `.github/workflows/ci_bundle_v1.yml`

## One-command verification (independent)
From repo root:
```bash
node dist_golden_bundle_v1/verifyLedger.js \
  dist_golden_bundle_v1/initial.json \
  dist_golden_bundle_v1/envelopes.json \
  dist_golden_bundle_v1/ledger.json \
  dist_golden_bundle_v1/public.pem
