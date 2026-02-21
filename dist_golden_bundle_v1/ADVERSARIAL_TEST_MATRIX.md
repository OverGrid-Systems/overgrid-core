# OverGrid III — Adversarial Test Matrix (Bundle v1)

Bundle:
- core.js
- verifyLedger.js
- initial.json / envelopes.json / ledger.json
- public.pem

Golden verification:
- node verifyLedger.js initial.json envelopes.json ledger.json public.pem
Expected: VERIFY OK + stable Final ChainHash

Attacks (expected: verification fails)

A1 — Duplicate command in frame 0
- Mutation: envelopes[0].commands.push(envelopes[0].commands[0])
- Expected failure: chainHash mismatch at i=0

A2 — Inject fake entity command in frame 0
- Mutation: push {type:"ATTACK",entityId:"FAKE",targetId:"FAKE"}
- Expected failure: chainHash mismatch at i=0

A3 — Break frameId sequencing
- Mutation: envelopes[1].frameId = 9999
- Expected failure: frameId mismatch at i=1

A4 — Break tick coherence
- Mutation: envelopes[1].tick = 9999
- Expected failure: tick mismatch at i=1

Observed results (your run):
- A1: VERIFY FAILED: chainHash mismatch | i=0
- A2: VERIFY FAILED: chainHash mismatch | i=0
- A3: VERIFY FAILED: frameId mismatch | i=1
- A4: VERIFY FAILED: tick mismatch | i=1

Conclusion:
- Envelope mutation is detected (hash-chain divergence).
- Sequencing policy violations are detected (frameId/tick contracts).
