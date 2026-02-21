// ===== Deterministic Executor — Signed Proof Ledger (Phase 19: Persistent Keys) =====

import { createState, tick, hashWorldState } from "./core.js";
import fs from "fs";
import crypto from "crypto";

const HASH_DOMAIN  = "OVERGRID|SIM|STATE";
const HASH_VERSION = 1;

/* ===== Persistent Key Loading (Ed25519) =====
   keys/public.pem  (spki)
   keys/private.pem (pkcs8)
*/
const PUBLIC_PEM  = fs.readFileSync(new URL("./keys/public.pem", import.meta.url), "utf8");
const PRIVATE_PEM = fs.readFileSync(new URL("./keys/private.pem", import.meta.url), "utf8");

const publicKey  = crypto.createPublicKey(PUBLIC_PEM);
const privateKey = crypto.createPrivateKey(PRIVATE_PEM);

/* ===== Helpers ===== */

function sha256Hex(...parts) {
  const hash = crypto.createHash("sha256");
  for (const p of parts) hash.update(Buffer.from(String(p), "utf8"));
  return hash.digest("hex");
}

// MUST be stable and match verifier
function hashEnvelope(env) {
  return sha256Hex(env.tick, env.frameId, JSON.stringify(env.commands));
}

// MUST be stable and match verifier
function encodeProofCanonical(proofCore) {
  return Buffer.from(
    proofCore.domain + "|" +
    proofCore.version + "|" +
    proofCore.tick + "|" +
    proofCore.phase + "|" +
    proofCore.stateHash + "|" +
    proofCore.chainHash,
    "utf8"
  );
}

function assert(c, m) { if (!c) throw new Error("EXECUTOR: " + m); }

/* ===== Executor ===== */

export class DeterministicExecutor {

  #state;
  #chainHash;
  #ledger;
  #envelopes;
  #nextFrameId;

  constructor(initialEntities) {
    this.#state = createState(initialEntities);
    this.#chainHash = hashWorldState(this.#state); // hex string
    this.#ledger = [];
    this.#envelopes = [];
    this.#nextFrameId = 0;

    assert(typeof this.#chainHash === "string", "core hashWorldState must return hex string");
  }

  getTick() { return this.#state.tick; }

  // core already freezes state; expose as boundary snapshot
  getSnapshot() { return this.#state; }

  getLedger() { return Object.freeze([...this.#ledger]); }

  getEnvelopesForVerification() { return Object.freeze([...this.#envelopes]); }

  getPublicKey() { return PUBLIC_PEM; }

  getProof() {
    return this.#ledger.length ? this.#ledger[this.#ledger.length - 1] : null;
  }

  submitFrame(envelope) {

    assert(envelope && Number.isInteger(envelope.tick), "invalid envelope.tick");
    assert(Number.isInteger(envelope.frameId), "invalid envelope.frameId");
    assert(Array.isArray(envelope.commands), "invalid envelope.commands");

    if (envelope.tick !== this.#state.tick) throw new Error("Tick mismatch");
    if (envelope.frameId !== this.#nextFrameId) throw new Error("Frame sequence violation");

    Object.freeze(envelope.commands);
    Object.freeze(envelope);

    const newState = tick(this.#state, envelope);

    const stateHash = hashWorldState(newState);
    assert(typeof stateHash === "string", "core hashWorldState must return hex string");

    const frameHash = hashEnvelope(envelope);

    const newChainHash = sha256Hex(
      this.#chainHash,
      frameHash,
      stateHash
    );

    const proofCore = {
      domain: HASH_DOMAIN,
      version: HASH_VERSION,
      tick: newState.tick,
      phase: newState.phase,
      stateHash,
      chainHash: newChainHash
    };

    const msg = encodeProofCanonical(proofCore);
    const signatureHex = crypto.sign(null, msg, privateKey).toString("hex");

    const proof = Object.freeze({
      ...proofCore,
      signature: signatureHex
    });

    this.#ledger.push(proof);
    this.#envelopes.push(envelope);

    this.#state = newState;
    this.#chainHash = newChainHash;
    this.#nextFrameId++;

    return proof;
  }

  replay(initialEntities) {

    let state = createState(initialEntities);
    let chain = hashWorldState(state);
    assert(typeof chain === "string", "core hashWorldState must return hex string");

    for (let i = 0; i < this.#envelopes.length; i++) {

      const env = this.#envelopes[i];
      state = tick(state, env);

      const stateHash = hashWorldState(state);
      const frameHash = hashEnvelope(env);
      chain = sha256Hex(chain, frameHash, stateHash);

      const proof = this.#ledger[i];

      const core = {
        domain: proof.domain,
        version: proof.version,
        tick: proof.tick,
        phase: proof.phase,
        stateHash: proof.stateHash,
        chainHash: proof.chainHash
      };

      const msg = encodeProofCanonical(core);

      const okSig = crypto.verify(
        null,
        msg,
        publicKey,
        Buffer.from(proof.signature, "hex")
      );

      if (!okSig) throw new Error("Signature invalid at i=" + i);
      if (proof.stateHash !== stateHash) throw new Error("StateHash divergence at i=" + i);
      if (proof.chainHash !== chain) throw new Error("ChainHash divergence at i=" + i);
    }

    return true;
  }
}