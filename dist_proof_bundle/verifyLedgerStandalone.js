// ===== OverGrid: Standalone Ledger Verifier (STRICT, NO core.js) =====
// CLI:
//   node verifyLedgerStandalone.js initial.json envelopes.json ledger.json public.pem bundle.meta.json
//
// bundle.meta.json must contain:
// {
//   "domain": "OVERGRID|SIM|STATE",
//   "version": 1,
//   "genesisChainHash": "<hex>"
// }

import crypto from "crypto";
import fs from "fs";

const HASH_DOMAIN  = "OVERGRID|SIM|STATE";
const HASH_VERSION = 1;

function sha256HexStr(...parts) {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(Buffer.from(String(p), "utf8"));
  return h.digest("hex");
}

function readJson(path) { return JSON.parse(fs.readFileSync(path, "utf8")); }
function readPem(path) { return fs.readFileSync(path, "utf8"); }

function hashEnvelope(env) {
  return sha256HexStr(env.tick, env.frameId, JSON.stringify(env.commands));
}

function encodeProofCanonical(core) {
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

export function verifyLedgerStandalone({ envelopes, ledger, publicKeyPem, genesisChainHash }) {
  let i = -1;
  const fail = (reason) => ({ valid: false, divergenceIndex: i, reason });

  try {
    if (!Array.isArray(envelopes)) return fail("envelopes not array");
    if (!Array.isArray(ledger)) return fail("ledger not array");
    if (envelopes.length !== ledger.length) return fail("length mismatch");
    if (typeof publicKeyPem !== "string" || publicKeyPem.length < 16) return fail("publicKeyPem missing");
    if (typeof genesisChainHash !== "string" || genesisChainHash.length < 16) return fail("genesisChainHash missing");

    const pubKey = crypto.createPublicKey(publicKeyPem);

    let prevChain = genesisChainHash;

    for (i = 0; i < envelopes.length; i++) {
      const env = envelopes[i];
      const proof = ledger[i];

      if (!env || !Number.isInteger(env.tick)) return fail("env.tick invalid");
      if (!Number.isInteger(env.frameId)) return fail("env.frameId invalid");
      if (!Array.isArray(env.commands)) return fail("env.commands invalid");
      if (env.frameId !== i) return fail("frameId mismatch");

      if (!proof || typeof proof !== "object") return fail("proof missing");
      if (proof.domain !== HASH_DOMAIN) return fail("domain mismatch");
      if (proof.version !== HASH_VERSION) return fail("version mismatch");
      if (!Number.isInteger(proof.tick)) return fail("proof.tick invalid");
      if (!Number.isInteger(proof.phase)) return fail("proof.phase invalid");
      if (typeof proof.stateHash !== "string" || proof.stateHash.length < 16) return fail("stateHash invalid");
      if (typeof proof.chainHash !== "string" || proof.chainHash.length < 16) return fail("chainHash invalid");
      if (typeof proof.signature !== "string" || proof.signature.length < 16) return fail("signature invalid");

      // signature check
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
      const ok = crypto.verify(null, msg, pubKey, sigBuf);
      if (!ok) return fail("signature invalid");

      // STRICT chain recurrence from i=0
      const frameHash = hashEnvelope(env);
      const expected = sha256HexStr(prevChain, frameHash, proof.stateHash);
      if (proof.chainHash !== expected) return fail("chainHash mismatch");

      prevChain = proof.chainHash;
    }

    return {
      valid: true,
      divergenceIndex: -1,
      finalChainHash: ledger.length ? ledger[ledger.length - 1].chainHash : ""
    };
  } catch (e) {
    return fail(String(e && e.message ? e.message : e));
  }
}

// ===== CLI =====
if (process.argv[1] && process.argv[1].endsWith("verifyLedgerStandalone.js")) {
  const [initialPath, envelopesPath, ledgerPath, publicPemPath, metaPath] = process.argv.slice(2);
  if (!initialPath || !envelopesPath || !ledgerPath || !publicPemPath || !metaPath) {
    console.error("Usage: node verifyLedgerStandalone.js initial.json envelopes.json ledger.json public.pem bundle.meta.json");
    process.exit(2);
  }

  // initial.json unused here; kept for bundle completeness
  void readJson(initialPath);

  const envelopes = readJson(envelopesPath);
  const ledger = readJson(ledgerPath);
  const publicKeyPem = readPem(publicPemPath);
  const meta = readJson(metaPath);

  if (!meta || meta.domain !== HASH_DOMAIN || meta.version !== HASH_VERSION || typeof meta.genesisChainHash !== "string") {
    console.error("VERIFY FAILED: invalid bundle.meta.json");
    process.exit(1);
  }

  const r = verifyLedgerStandalone({
    envelopes,
    ledger,
    publicKeyPem,
    genesisChainHash: meta.genesisChainHash
  });

  if (!r.valid) {
    console.error("VERIFY FAILED:", r.reason, "| i=", r.divergenceIndex);
    process.exit(1);
  }

  console.log("VERIFY OK");
  console.log("Final ChainHash:", r.finalChainHash);
}
