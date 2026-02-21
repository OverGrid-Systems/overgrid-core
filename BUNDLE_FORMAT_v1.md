OverGrid III — Bundle Format v1 (Public Verification Surface)

Goal
A bundle is a portable proof package that lets any verifier reproduce simulation state hashes, chain hashes, and validate signatures without access to executor internals.

Bundle Directory (dist_final_bundle/)
Required files:
- core.js
- verifyLedger.js
- initial.json
- envelopes.json
- ledger.json
- public.pem

Data Types

initial.json
JSON array of entities used to create the genesis state via createState(initialEntities).
Entities MUST be identical to those used by the producer.

envelopes.json
JSON array of envelopes. Each envelope:
- tick: integer
- frameId: integer
- commands: array

ledger.json
JSON array of proof objects, length MUST equal envelopes length.
Each proof:
- domain: string (must equal "OVERGRID|SIM|STATE")
- version: integer (must equal 1)
- tick: integer (must equal post-tick state.tick)
- phase: integer (must equal post-tick state.phase)
- stateHash: string (hex SHA-256 digest)
- chainHash: string (hex SHA-256 digest)
- signature: string (hex Ed25519 signature over canonical proof encoding)

public.pem
PEM encoded Ed25519 public key used to verify proof signatures.

Canonical Rules (MUST)

1) Entity ordering for hashing
State hashing MUST sort entities by id ascending (lexicographic).

2) State hashing
hashWorldState(state) MUST return a 64-char hex string (SHA-256 digest) over:
- Domain string: "OVERGRID|SIM|STATE" encoded as: U64BE(length) + UTF-8 bytes
- Version: U64BE(1)
- Header: U64BE(tick), U64BE(phase)
- For each entity in canonical order:
  - id: U64BE(len) + UTF-8 bytes
  - team: U64BE(len) + UTF-8 bytes
  - x,y,hp,damage,rangeSq,speed: each U64BE(value)
  - command:
    - U64BE(1) + targetId string if command exists
    - U64BE(0) if no command

3) Envelope hashing
frameHash MUST be:
SHA256_HEX( String(env.tick) + String(env.frameId) + JSON.stringify(env.commands) )
using UTF-8 bytes for each String() part in the same order as producer.

4) Chain hash update
genesisChainHash := stateHash(genesisState)
For each step i:
expectedChainHash := SHA256_HEX( prevChainHash + frameHash + stateHash )
where prevChainHash is previous chain hex string.
Proof.chainHash MUST equal expectedChainHash.

5) Proof canonical encoding (for signature)
Canonical message bytes (UTF-8) MUST be:
domain + "|" + version + "|" + tick + "|" + phase + "|" + stateHash + "|" + chainHash

6) Signature validation
signature is hex string of Ed25519 signature over the canonical proof encoding bytes.
Verifier MUST fail if signature invalid.

Verification Procedure (Verifier)

Inputs:
- initialEntities from initial.json
- envelopes from envelopes.json
- ledger from ledger.json
- publicKeyPem from public.pem
- core.js provides createState, tick, hashWorldState

Algorithm:
- state := createState(initialEntities)
- chain := hashWorldState(state)
- For i in [0..envelopes.length-1]:
  - env := envelopes[i]
  - proof := ledger[i]
  - Assert env.tick == state.tick
  - Assert env.frameId == i
  - state := tick(state, env)
  - stateHash := hashWorldState(state)
  - frameHash := hashEnvelope(env)
  - expectedChain := SHA256_HEX(chain, frameHash, stateHash) using same concatenation rule as producer
  - Assert proof fields match domain/version/tick/phase/stateHash/expectedChain
  - Verify Ed25519 signature over canonical proof encoding
  - chain := expectedChain
- Output final chain hash.

Acceptance Criteria (Phase 19)

- Running verification from dist_final_bundle succeeds:
  node verifyLedger.js initial.json envelopes.json ledger.json public.pem

- Tampering detection:
  - Any change in envelopes.json must fail verification.
  - Any change in ledger.json fields or signature must fail verification.
  - Any change in core.js that affects tick or hashing must fail verification.

Non-Goals
- Gameplay expansion
- Networking transport
- Confidentiality/privacy
- Key management hardening beyond test keys

