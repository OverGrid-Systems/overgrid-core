# OverGrid Core — LOCKS (Source of Truth)

This repo is intentionally "hard to change". The purpose is deterministic replay + contract stability.

## Update Policy (when a lock must change)
1) Update the underlying spec/content intentionally.
2) Run generators (docs/spec hashes).
3) CI must go green.
4) PR must clearly state why the lock changed.

<!-- AUTOGEN_LOCKS_V1:START -->
## 1) CI Gate (must be green)
- Entry: `npm run ci:all`

## 2) Golden Hash Locks (Replay / Bundles)
- OK_GOLDEN_bundle_v1: `686988bfaa1ed12131647fa3161d8bdb4590863d83c66ec0fdb7ad65daf87769`
- OK_GOLDEN_rts_bundle_v0: `1256e1d0687090b1b9e8d6421212c9f02f48fd56262bfe7be68b5e8c62ccb445`

## 3) Replay Verification Lock
- Spec folder: `core/spec/replay_v0/`
- Verifier: `scripts/ci_verify_replay_v0.sh`

## 4) RTS Command Contract Lock (v0)
- contract_hash_v0
  - file: `core/spec/rts_command_spec_v0.md + rts_command_types_v0.json`
  - sha256: `64bbf12d5169c696ee64702f999174984041be56920505a7eb21f3a2fe06b5eb`

## 5) Simulation Contract Lock (v1)
- sim_contract_hash_v1
  - file: `core/spec/sim_spec_v1.md`
  - sha256: `undefined`

## 6) LOCKS.md Hash Lock (v1)
- locks_md_hash_v1
  - file: `docs/LOCKS.md`
  - sha256: `c7c6ce388e94d31159b255bc0461a435f1069b046ad3a571c97e88e7be189d38`

## 7) Event Surface Contract Lock (v1)
- event_surface_hash_v1
  - file: `core/spec/event_surface_v1.md`
  - sha256: `24ef2da03410f1040df0fc443cba0191dbf148101b0586b8032e598961f4edcb`
<!-- AUTOGEN_LOCKS_V1:END -->
