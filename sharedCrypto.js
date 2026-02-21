// sharedCrypto.js — Single Source of Truth (Hash/Proof Canon)
import crypto from "crypto";

export const STATE_DOMAIN  = "OVERGRID|SIM|STATE";
export const STATE_VERSION = 1;

export const PROOF_DOMAIN  = "OVERGRID|SIM|PROOF";
export const PROOF_VERSION = 1;

export function sha256HexBytes(buffers) {
  const h = crypto.createHash("sha256");
  for (const b of buffers) h.update(b);
  return h.digest("hex");
}

export function sha256HexStrings(parts) {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(Buffer.from(String(p), "utf8"));
  return h.digest("hex");
}

// Canonical, stable envelope hash (DO NOT CHANGE without bumping version)
export function hashEnvelope(env) {
  // tick|frameId|canonicalCommandsJson
  const canonicalCommands = JSON.stringify(env.commands ?? []);
  return sha256HexStrings([env.tick, "|", env.frameId, "|", canonicalCommands]);
}

export function chainStep(prevChainHashHex, frameHashHex, stateHashHex) {
  return sha256HexStrings([prevChainHashHex, "|", frameHashHex, "|", stateHashHex]);
}

// Canonical proof encoding for signing/verifying
export function encodeProofCanonical(proofCore) {
  // domain|version|tick|phase|stateHash|chainHash
  return Buffer.from(
    `${proofCore.domain}|${proofCore.version}|${proofCore.tick}|${proofCore.phase}|${proofCore.stateHash}|${proofCore.chainHash}`,
    "utf8"
  );
}

// Ed25519 helpers
export function signProof(proofCore, privateKeyPem) {
  const encoded = encodeProofCanonical(proofCore);
  const sig = crypto.sign(null, encoded, privateKeyPem);
  return sig.toString("base64");
}

export function verifyProofSignature(proofCore, signatureB64, publicKeyPem) {
  const encoded = encodeProofCanonical(proofCore);
  return crypto.verify(null, encoded, publicKeyPem, Buffer.from(signatureB64, "base64"));
}