
import crypto from "crypto";
import fs from "fs";
import { createState, tick, hashWorldState } from "./core.js";

const HASH_DOMAIN  = "OVERGRID|SIM|STATE";
const HASH_VERSION = 1;

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

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
function readPem(path) {
  return fs.readFileSync(path, "utf8");
}

export function verifyLedger({ initialEntities, envelopes, ledger, publicKeyPem }) {
  let i = -1;

  const fail = (reason) => ({ valid: false, divergenceIndex: i, reason });

  try {
    if (!Array.isArray(initialEntities)) return { valid: false, divergenceIndex: -1, reason: "initialEntities not array" };
    if (!Array.isArray(envelopes)) return { valid: false, divergenceIndex: -1, reason: "envelopes not array" };
    if (!Array.isArray(ledger)) return { valid: false, divergenceIndex: -1, reason: "ledger not array" };
    if (envelopes.length !== ledger.length) return { valid: false, divergenceIndex: -1, reason: "length mismatch" };
    if (typeof publicKeyPem !== "string" || publicKeyPem.length < 16) return { valid: false, divergenceIndex: -1, reason: "publicKeyPem missing" };

    const pubKey = crypto.createPublicKey(publicKeyPem);

    let state = createState(initialEntities);
    let chain = hashWorldState(state);
    if (typeof chain !== "string") return { valid: false, divergenceIndex: -1, reason: "core hashWorldState must return hex string" };

    for (i = 0; i < envelopes.length; i++) {
      const env = envelopes[i];
      const proof = ledger[i];

      if (!env || !Number.isInteger(env.tick)) return fail("env.tick invalid");
      if (!Number.isInteger(env.frameId)) return fail("env.frameId invalid");
      if (!Array.isArray(env.commands)) return fail("env.commands invalid");

      if (env.tick !== state.tick) return fail("tick mismatch");
      if (env.frameId !== i) return fail("frameId mismatch");

      state = tick(state, env);

      const stateHash = hashWorldState(state);
      if (typeof stateHash !== "string") return fail("stateHash invalid");

      const frameHash = hashEnvelope(env);
      const expectedChain = sha256HexStr(chain, frameHash, stateHash);

      if (!proof || typeof proof !== "object") return fail("proof missing");
      if (proof.domain !== HASH_DOMAIN) return fail("domain mismatch");
      if (proof.version !== HASH_VERSION) return fail("version mismatch");
      if (proof.tick !== state.tick) return fail("proof.tick mismatch");
      if (proof.phase !== state.phase) return fail("proof.phase mismatch");

      if (proof.stateHash !== stateHash) return fail("stateHash mismatch");
      if (proof.chainHash !== expectedChain) return fail("chainHash mismatch");

      if (typeof proof.signature !== "string" || proof.signature.length === 0) return fail("signature missing");

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

      chain = expectedChain;
    }

    return { valid: true, divergenceIndex: -1, finalChainHash: chain };
  } catch (e) {
    return { valid: false, divergenceIndex: i, reason: String(e && e.message ? e.message : e) };
  }
}

// ===== CLI =====
const [initialPath, envelopesPath, ledgerPath, publicPemPath] = process.argv.slice(2);
if (process.argv[1] && process.argv[1].endsWith("verifyLedger.js")) {
  if (!initialPath || !envelopesPath || !ledgerPath || !publicPemPath) {
    console.error("Usage: node verifyLedger.js initial.json envelopes.json ledger.json public.pem");
    process.exit(2);
  }

  const initialEntities = readJson(initialPath);
  const envelopes = readJson(envelopesPath);
  const ledger = readJson(ledgerPath);
  const publicKeyPem = readPem(publicPemPath);

  const r = verifyLedger({ initialEntities, envelopes, ledger, publicKeyPem });

  if (!r.valid) {
    console.error("VERIFY FAILED:", r.reason, "| i=", r.divergenceIndex);
    process.exit(1);
  }

  console.log("VERIFY OK");
  console.log("Final ChainHash:", r.finalChainHash);
}
