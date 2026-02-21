// ===== OverGrid: Verify ONE-FILE bundle.json =====
// Usage:
//   node verifyBundleOneFile.js bundle.json
//
// This verifier is standalone (no core.js). It verifies:
// - envelope/frame structure
// - signature validity
// - chain recurrence using meta.genesisChainHash
//
// It does NOT re-simulate state, because that would require core.js.

import crypto from "crypto";
import fs from "fs";

const HASH_DOMAIN  = "OVERGRID|SIM|STATE";
const HASH_VERSION = 1;

function sha256HexStr(...parts) {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(Buffer.from(String(p), "utf8"));
  return h.digest("hex");
}

function hashEnvelope(env) {
  // MUST match executor.js exactly
  return sha256HexStr(env.tick, env.frameId, JSON.stringify(env.commands));
}

function encodeProofCanonical(core) {
  // MUST match executor.js exactly
  return Buffer.from(
    core.domain + "|" +
    core.version + "|" +
    core.tick + "|" +
    core.phase + "|" +
    core.stateHash + "|" +
    core.chainHash,
    "utf8"
  );
}

function fail(i, reason) {
  return { valid: false, divergenceIndex: i, reason };
}

function verifyBundleOneFile(bundle) {
  if (!bundle || typeof bundle !== "object") return fail(-1, "bundle not object");

  const meta = bundle.meta;
  const publicKeyPem = bundle.publicKeyPem;
  const envelopes = bundle.envelopes;
  const ledger = bundle.ledger;

  if (!meta || typeof meta !== "object") return fail(-1, "meta missing");
  if (meta.domain !== HASH_DOMAIN) return fail(-1, "meta.domain mismatch");
  if (meta.version !== HASH_VERSION) return fail(-1, "meta.version mismatch");
  if (typeof meta.genesisChainHash !== "string" || meta.genesisChainHash.length < 16) {
    return fail(-1, "meta.genesisChainHash missing");
  }

  if (typeof publicKeyPem !== "string" || publicKeyPem.length < 16) return fail(-1, "publicKeyPem missing");
  if (!Array.isArray(envelopes)) return fail(-1, "envelopes not array");
  if (!Array.isArray(ledger)) return fail(-1, "ledger not array");
  if (envelopes.length !== ledger.length) return fail(-1, "length mismatch");

  const pubKey = crypto.createPublicKey(publicKeyPem);

  let prevChain = meta.genesisChainHash;

  for (let i = 0; i < envelopes.length; i++) {
    const env = envelopes[i];
    const proof = ledger[i];

    if (!env || !Number.isInteger(env.tick)) return fail(i, "env.tick invalid");
    if (!Number.isInteger(env.frameId)) return fail(i, "env.frameId invalid");
    if (!Array.isArray(env.commands)) return fail(i, "env.commands invalid");
    if (env.frameId !== i) return fail(i, "frameId mismatch");

    if (!proof || typeof proof !== "object") return fail(i, "proof missing");
    if (proof.domain !== HASH_DOMAIN) return fail(i, "domain mismatch");
    if (proof.version !== HASH_VERSION) return fail(i, "version mismatch");
    if (!Number.isInteger(proof.tick)) return fail(i, "proof.tick invalid");
    if (!Number.isInteger(proof.phase)) return fail(i, "proof.phase invalid");
    if (typeof proof.stateHash !== "string" || proof.stateHash.length < 16) return fail(i, "stateHash invalid");
    if (typeof proof.chainHash !== "string" || proof.chainHash.length < 16) return fail(i, "chainHash invalid");
    if (typeof proof.signature !== "string" || proof.signature.length < 16) return fail(i, "signature invalid");

    // verify signature over canonical core
    const core = {
      domain: proof.domain,
      version: proof.version,
      tick: proof.tick,
      phase: proof.phase,
      stateHash: proof.stateHash,
      chainHash: proof.chainHash
    };

    const msg = encodeProofCanonical(core);
    const sigBuf = Buffer.from(proof.signature, "hex");
    const okSig = crypto.verify(null, msg, pubKey, sigBuf);
    if (!okSig) return fail(i, "signature invalid");

    // verify chain recurrence
    const frameHash = hashEnvelope(env);
    const expectedChain = sha256HexStr(prevChain, frameHash, proof.stateHash);
    if (proof.chainHash !== expectedChain) return fail(i, "chainHash mismatch");

    prevChain = expectedChain;
  }

  return { valid: true, divergenceIndex: -1, finalChainHash: prevChain };
}

function main() {
  const [bundlePath] = process.argv.slice(2);
  if (!bundlePath) {
    console.error("Usage: node verifyBundleOneFile.js bundle.json");
    process.exit(2);
  }

  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const r = verifyBundleOneFile(bundle);

  if (!r.valid) {
    console.error("VERIFY FAILED:", r.reason, "| i=", r.divergenceIndex);
    process.exit(1);
  }

  console.log("VERIFY OK");
  console.log("Final ChainHash:", r.finalChainHash);
}

main();
