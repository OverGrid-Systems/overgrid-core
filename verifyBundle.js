// ===== OverGrid: Bundle Verifier (STRICT) =====
// CLI:
//   node verifyBundle.js initial.json envelopes.json ledger.json public.pem

import fs from "fs";
import crypto from "crypto";
import { createState, tick, hashWorldState } from "./core.js";

const HASH_DOMAIN  = "OVERGRID|SIM|STATE";
const HASH_VERSION = 1;

function assert(c, m) { if (!c) throw new Error("VERIFY FAILED: " + m); }

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
function readPem(path) {
  return fs.readFileSync(path, "utf8");
}

function sha256HexStr(...parts) {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(Buffer.from(String(p), "utf8"));
  return h.digest("hex");
}

// MUST match executor.js exactly
function hashEnvelope(env) {
  return sha256HexStr(env.tick, env.frameId, JSON.stringify(env.commands));
}

// MUST match executor.js exactly
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

function verifyBundle({ initialEntities, envelopes, ledger, publicKeyPem }) {

  assert(Array.isArray(initialEntities), "initial not array");
  assert(Array.isArray(envelopes), "envelopes not array");
  assert(Array.isArray(ledger), "ledger not array");
  assert(envelopes.length === ledger.length, "length mismatch");
  assert(typeof publicKeyPem === "string" && publicKeyPem.length > 16, "public key missing");

  const pubKey = crypto.createPublicKey(publicKeyPem);

  let state = createState(initialEntities);
  let chain = hashWorldState(state);

  assert(typeof chain === "string", "core hashWorldState must return hex string");

  for (let i = 0; i < envelopes.length; i++) {

    const env = envelopes[i];
    const proof = ledger[i];

    assert(env && Number.isInteger(env.tick), "env.tick invalid");
    assert(Number.isInteger(env.frameId), "env.frameId invalid");
    assert(Array.isArray(env.commands), "env.commands invalid");

    assert(env.tick === state.tick, "tick mismatch at i=" + i);
    assert(env.frameId === i, "frameId mismatch at i=" + i);

    state = tick(state, env);

    const stateHash = hashWorldState(state);
    assert(typeof stateHash === "string", "stateHash invalid at i=" + i);

    const frameHash = hashEnvelope(env);
    const expectedChain = sha256HexStr(chain, frameHash, stateHash);

    assert(proof && typeof proof === "object", "proof missing at i=" + i);
    assert(proof.domain === HASH_DOMAIN, "domain mismatch at i=" + i);
    assert(proof.version === HASH_VERSION, "version mismatch at i=" + i);
    assert(proof.tick === state.tick, "proof.tick mismatch at i=" + i);
    assert(proof.phase === state.phase, "proof.phase mismatch at i=" + i);

    assert(proof.stateHash === stateHash, "stateHash mismatch at i=" + i);
    assert(proof.chainHash === expectedChain, "chainHash mismatch at i=" + i);

    assert(typeof proof.signature === "string" && proof.signature.length > 0, "signature missing at i=" + i);

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
    assert(ok, "signature invalid at i=" + i);

    chain = expectedChain;
  }

  return chain;
}

/* ===== CLI ===== */
const [initialPath, envelopesPath, ledgerPath, publicPemPath] = process.argv.slice(2);
assert(initialPath && envelopesPath && ledgerPath && publicPemPath,
       "Usage: node verifyBundle.js initial.json envelopes.json ledger.json public.pem");

const initialEntities = readJson(initialPath);
const envelopes = readJson(envelopesPath);
const ledger = readJson(ledgerPath);
const publicKeyPem = readPem(publicPemPath);

const finalChain = verifyBundle({ initialEntities, envelopes, ledger, publicKeyPem });

console.log("VERIFY OK");
console.log("Final ChainHash:", finalChain);
